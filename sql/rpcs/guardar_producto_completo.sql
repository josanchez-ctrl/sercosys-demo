-- Propósito: Guardar un producto y su configuración logística de forma atómica
-- Última modificación: 2026-06-02 - Se agrega campo costo_proporcional_peso

CREATE OR REPLACE FUNCTION public.guardar_producto_completo(
  p_id_producto int8,
  p_payload jsonb,
  p_logistica jsonb,
  p_id_usuario int8,
  p_timestamp_audit timestamptz
)
RETURNS int8
LANGUAGE plpgsql
AS $$
DECLARE
  v_id_producto int8;
  v_id_rubro int8;
  v_id_categoria int8;
  v_item jsonb;
  v_ids_procesados int8[] := ARRAY[]::int8[];
  v_id_item int8;
  v_old_factor numeric;
  v_in_use boolean;
  v_codigo_interno text;
  v_codigo_barras text;
  -- Mapeo de índices a IDs reales para la cadena de conversión
  v_idx int4 := 0;
  v_ids_map jsonb := '{}'::jsonb;
  -- Variables para Stock Mínimo
  v_id_logistica_minimo int8;
  v_factor_minimo numeric := 1;
  v_stock_minimo_usuario numeric;
BEGIN
  -- 1. Guardar o Crear Producto Maestro
  IF p_id_producto IS NOT NULL THEN
    UPDATE public.almacen_productos
    SET 
      id_rubro = (p_payload->>'id_rubro')::int8,
      id_marca = (p_payload->>'id_marca')::int8,
      variedad = (p_payload->>'variedad')::text,
      maneja_lote = (p_payload->>'maneja_lote')::boolean,
      estatus = (p_payload->>'estatus')::boolean,
      es_recipiente_transporte = COALESCE((p_payload->>'es_recipiente_transporte')::boolean, false),
      peso_tara_estandar = COALESCE((p_payload->>'peso_tara_estandar')::numeric, 0),
      es_insumo_transformacion = COALESCE((p_payload->>'es_insumo_transformacion')::boolean, false),
      es_resultado_transformacion = COALESCE((p_payload->>'es_resultado_transformacion')::boolean, false),
      es_reprocesable = COALESCE((p_payload->>'es_reprocesable')::boolean, false),
      peso_variable = COALESCE((p_payload->>'peso_variable')::boolean, false),
      costo_proporcional_peso = COALESCE((p_payload->>'costo_proporcional_peso')::boolean, false),
      es_subproducto = COALESCE((p_payload->>'es_subproducto')::boolean, false),
      id_tipo_depreciacion = (p_payload->>'id_tipo_depreciacion')::int8,
      valor_calculo_depreciacion = (p_payload->>'valor_calculo_depreciacion')::numeric,
      timestamp_update = p_timestamp_audit,
      id_usuario_update = p_id_usuario
    WHERE id = p_id_producto;
    v_id_producto := p_id_producto;
  ELSE
    INSERT INTO public.almacen_productos (
      id_empresa, id_rubro, id_marca, variedad, 
      maneja_lote, estatus,
      es_recipiente_transporte, peso_tara_estandar,
      es_insumo_transformacion, es_resultado_transformacion, es_reprocesable,
      peso_variable, costo_proporcional_peso, es_subproducto,
      id_tipo_depreciacion, valor_calculo_depreciacion,
      timestamp_create, id_usuario_create
    ) VALUES (
      (p_payload->>'id_empresa')::int8,
      (p_payload->>'id_rubro')::int8,
      (p_payload->>'id_marca')::int8,
      (p_payload->>'variedad')::text,
      (p_payload->>'maneja_lote')::boolean,
      COALESCE((p_payload->>'estatus')::boolean, true),
      COALESCE((p_payload->>'es_recipiente_transporte')::boolean, false),
      COALESCE((p_payload->>'peso_tara_estandar')::numeric, 0),
      COALESCE((p_payload->>'es_insumo_transformacion')::boolean, false),
      COALESCE((p_payload->>'es_resultado_transformacion')::boolean, false),
      COALESCE((p_payload->>'es_reprocesable')::boolean, false),
      COALESCE((p_payload->>'peso_variable')::boolean, false),
      COALESCE((p_payload->>'costo_proporcional_peso')::boolean, false),
      COALESCE((p_payload->>'es_subproducto')::boolean, false),
      (p_payload->>'id_tipo_depreciacion')::int8,
      (p_payload->>'valor_calculo_depreciacion')::numeric,
      p_timestamp_audit,
      p_id_usuario
    ) RETURNING id INTO v_id_producto;
  END IF;

  -- Obtenemos Rubro y Categoría para el Código Interno
  SELECT id_rubro INTO v_id_rubro FROM public.almacen_productos WHERE id = v_id_producto;
  SELECT id_categoria INTO v_id_categoria FROM public.almacen_rubros WHERE id = v_id_rubro;

  v_stock_minimo_usuario := (p_payload->>'stock_minimo')::numeric;

  -- 2. PRIMERA PASADA: UPSERT de presentaciones (sin referencias de cadena aún)
  IF p_logistica IS NOT NULL AND jsonb_array_length(p_logistica) > 0 THEN
    v_idx := 0;
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_logistica)
    LOOP
      v_id_item := (v_item->>'id')::int8;
      v_codigo_barras := NULLIF(TRIM((v_item->>'codigo_barras')::text), '');

      IF v_id_item IS NOT NULL THEN
        -- Actualización
        SELECT factor INTO v_old_factor FROM public.almacen_productos_codigos WHERE id = v_id_item;
        
        -- Si cambió el factor total, verificamos si está en uso en transacciones
        IF v_old_factor IS DISTINCT FROM (v_item->>'factor')::numeric THEN
          SELECT EXISTS (
            SELECT 1 FROM public.almacen_cotejo_detalle WHERE id_presentacion_logistica = v_id_item
            UNION ALL
            SELECT 1 FROM public.almacen_picking_detalle WHERE id_presentacion_logistica = v_id_item
          ) INTO v_in_use;

          IF v_in_use THEN
            -- Desactivar viejo, insertar nuevo (para preservar historial de transacciones pasadas)
            UPDATE public.almacen_productos_codigos SET estatus = false, timestamp_update = p_timestamp_audit, id_usuario_update = p_id_usuario WHERE id = v_id_item;
            
            INSERT INTO public.almacen_productos_codigos (
              id_empresa, id_producto, codigo_barras, id_presentacion, factor, es_base, estatus, orden, timestamp_create, id_usuario_create, cantidad_referencia
            ) VALUES (
              (p_payload->>'id_empresa')::int8, v_id_producto, v_codigo_barras, (v_item->>'id_presentacion')::int8,
              (v_item->>'factor')::numeric, COALESCE((v_item->>'es_base')::boolean, false), true, 
              COALESCE((v_item->>'orden')::integer, 0), p_timestamp_audit, p_id_usuario,
              COALESCE((v_item->>'cant_base')::numeric, 1)
            ) RETURNING id INTO v_id_item;
          ELSE
            -- Actualización directa si no tiene uso
            UPDATE public.almacen_productos_codigos SET 
              codigo_barras = v_codigo_barras,
              id_presentacion = (v_item->>'id_presentacion')::int8,
              factor = (v_item->>'factor')::numeric,
              es_base = COALESCE((v_item->>'es_base')::boolean, false),
              orden = COALESCE((v_item->>'orden')::integer, 0),
              cantidad_referencia = COALESCE((v_item->>'cant_base')::numeric, 1),
              timestamp_update = p_timestamp_audit,
              id_usuario_update = p_id_usuario
            WHERE id = v_id_item;
          END IF;
        ELSE
          -- No cambió factor, actualización normal
          UPDATE public.almacen_productos_codigos SET 
            codigo_barras = v_codigo_barras,
            id_presentacion = (v_item->>'id_presentacion')::int8,
            es_base = COALESCE((v_item->>'es_base')::boolean, false),
            orden = COALESCE((v_item->>'orden')::integer, 0),
            cantidad_referencia = COALESCE((v_item->>'cant_base')::numeric, 1),
            timestamp_update = p_timestamp_audit,
            id_usuario_update = p_id_usuario
          WHERE id = v_id_item;
        END IF;
      ELSE
        -- Registro nuevo
        INSERT INTO public.almacen_productos_codigos (
          id_empresa, id_producto, codigo_barras, id_presentacion, factor, es_base, estatus, orden, timestamp_create, id_usuario_create, cantidad_referencia
        ) VALUES (
          (p_payload->>'id_empresa')::int8, v_id_producto, v_codigo_barras, (v_item->>'id_presentacion')::int8,
          (v_item->>'factor')::numeric, COALESCE((v_item->>'es_base')::boolean, false), true, 
          COALESCE((v_item->>'orden')::integer, 0), p_timestamp_audit, p_id_usuario,
          COALESCE((v_item->>'cant_base')::numeric, 1)
        ) RETURNING id INTO v_id_item;
      END IF;

      -- Generar Código Interno
      v_codigo_interno := 'C' || COALESCE(v_id_categoria, 0) || 'R' || COALESCE(v_id_rubro, 0) || 'P' || v_id_producto || 'L' || v_id_item;
      UPDATE public.almacen_productos_codigos SET 
        codigo_interno = v_codigo_interno,
        codigo_barras = COALESCE(codigo_barras, v_codigo_interno)
      WHERE id = v_id_item;

      -- ¿Es stock mínimo?
      IF COALESCE((v_item->>'es_stock_minimo')::boolean, false) = true THEN
        v_id_logistica_minimo := v_id_item;
        v_factor_minimo := (v_item->>'factor')::numeric;
      END IF;

      -- Guardar ID en el mapa (índice -> ID real)
      v_ids_map := v_ids_map || jsonb_build_object(v_idx::text, v_id_item);
      v_ids_procesados := array_append(v_ids_procesados, v_id_item);
      v_idx := v_idx + 1;
    END LOOP;
  END IF;

  -- 3. SEGUNDA PASADA: Establecer id_referencia (Cadena de Conversión)
  IF p_logistica IS NOT NULL AND jsonb_array_length(p_logistica) > 0 THEN
    v_idx := 0;
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_logistica)
    LOOP
      v_id_item := (v_ids_map->>(v_idx::text))::int8;
      IF (v_item->>'relacion_index') IS NOT NULL AND (v_item->>'relacion_index')::int4 >= 0 THEN
        UPDATE public.almacen_productos_codigos 
        SET id_referencia = (v_ids_map->>((v_item->>'relacion_index')::text))::int8
        WHERE id = v_id_item;
      ELSE
        UPDATE public.almacen_productos_codigos SET id_referencia = NULL WHERE id = v_id_item;
      END IF;
      v_idx := v_idx + 1;
    END LOOP;
  END IF;

  -- 4. Actualizar Stock Mínimo Final
  UPDATE public.almacen_productos SET
    stock_minimo = v_stock_minimo_usuario * v_factor_minimo,
    id_logistica_stock_minimo = v_id_logistica_minimo
  WHERE id = v_id_producto;

  -- 5. Limpieza
  FOR v_id_item IN 
    SELECT id FROM public.almacen_productos_codigos 
    WHERE id_producto = v_id_producto AND id <> ALL(v_ids_procesados)
  LOOP
    BEGIN
      DELETE FROM public.almacen_productos_codigos WHERE id = v_id_item;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.almacen_productos_codigos SET estatus = false, timestamp_update = p_timestamp_audit, id_usuario_update = p_id_usuario WHERE id = v_id_item;
    END;
  END LOOP;

  RETURN v_id_producto;
END;
$$;
