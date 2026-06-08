-- Propósito: Registrar despacho manual de desechables desde almacén-comedor hacia cocina
-- Última modificación: 2026-05-21
-- Contexto: Los desechables (envases, vasos, papel aluminio, servilletas) no salen de recetas.
--   Esta función: valida stock ATP → descuenta almacen_comedor_inventario → crea registro en
--   comedor_despacho_ejecucion y comedor_despacho_ejecucion_detalle como PENDIENTE (en tránsito) →
--   registra en kardex almacen_inventario_movimientos.
-- Parámetros del array p_detalles (jsonb):
--   { id_item_inventario_comedor, id_producto, id_rubro, cantidad }

CREATE OR REPLACE FUNCTION public.fn_despacho_manual_desechable(
  p_id_empresa    bigint,
  p_id_sucursal   bigint,
  p_id_comedor    bigint,
  p_id_ejecucion  bigint,
  p_correlativo   text,
  p_observaciones text,
  p_detalles      jsonb,   -- [{id_item_inventario_comedor, id_producto, id_rubro, cantidad}]
  p_id_usuario    bigint,
  p_timestamp     timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id_despacho  bigint;
  v_item         jsonb;
  v_inv          RECORD;
  v_cant_actual  numeric;
BEGIN
  -- 1. Validar stock de todos los ítems antes de tocar el inventario (Principio ATP)
  FOR v_item IN SELECT jsonb_array_elements(p_detalles) LOOP
    SELECT cantidad_actual INTO v_cant_actual
    FROM public.almacen_comedor_inventario
    WHERE id = (v_item->>'id_item_inventario_comedor')::int8;

    IF v_cant_actual IS NULL THEN
      RETURN jsonb_build_object('success', false, 'message',
        format('Ítem de inventario %s no encontrado.', v_item->>'id_item_inventario_comedor'));
    END IF;

    IF v_cant_actual < (v_item->>'cantidad')::numeric THEN
      RETURN jsonb_build_object('success', false, 'message',
        format('Stock insuficiente para el ítem %s. Disponible: %s, Requerido: %s',
          v_item->>'id_item_inventario_comedor', v_cant_actual, v_item->>'cantidad'));
    END IF;
  END LOOP;

  -- 2. Crear cabecera del despacho en la tabla estándar comedor_despacho_ejecucion (como PENDIENTE/En Tránsito)
  INSERT INTO public.comedor_despacho_ejecucion (
    id_ejecucion,
    estatus,
    timestamp_despacho,
    id_usuario_despacho,
    timestamp_create,
    id_usuario_create
  ) VALUES (
    p_id_ejecucion,
    'PENDIENTE',
    p_timestamp,
    p_id_usuario,
    p_timestamp,
    p_id_usuario
  ) RETURNING id INTO v_id_despacho;

  -- 3. Procesar cada ítem
  FOR v_item IN SELECT jsonb_array_elements(p_detalles) LOOP
    SELECT * INTO v_inv FROM public.almacen_comedor_inventario
    WHERE id = (v_item->>'id_item_inventario_comedor')::int8;

    -- A. Descontar del inventario físico del comedor (volumen base o presentación física)
    UPDATE public.almacen_comedor_inventario
    SET cantidad_actual   = cantidad_actual - (v_item->>'cantidad')::numeric,
        timestamp_update  = p_timestamp,
        id_usuario_update = p_id_usuario
    WHERE id = v_inv.id;

    -- B. Insertar detalle en la tabla estándar comedor_despacho_ejecucion_detalle
    -- id_insumo es NULL porque se trata de un despacho manual no programado en receta
    INSERT INTO public.comedor_despacho_ejecucion_detalle (
      id_despacho,
      id_insumo,
      id_producto,
      id_presentacion_logistica,
      lote,
      fecha_vencimiento,
      cantidad_entregada,
      cantidad_recibida,
      timestamp_create,
      id_usuario_create
    ) VALUES (
      v_id_despacho,
      NULL,
      (v_item->>'id_producto')::int8,
      v_inv.id_presentacion_logistica,
      v_inv.lote,
      v_inv.fecha_vencimiento,
      (v_item->>'cantidad')::numeric,
      0, -- Inicialmente 0 recibidos
      p_timestamp,
      p_id_usuario
    );

    -- C. Registrar movimiento en kardex general
    INSERT INTO public.almacen_inventario_movimientos (
      id_empresa, id_comedor, id_producto, tipo_movimiento,
      cantidad, lote, id_referencia, timestamp_create, id_usuario_create
    ) VALUES (
      p_id_empresa, p_id_comedor, (v_item->>'id_producto')::int8, 'DESPACHO_MANUAL_COCINA',
      (v_item->>'cantidad')::numeric, v_inv.lote, v_id_despacho, p_timestamp, p_id_usuario
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success',     true,
    'message',     'Despacho manual registrado en tránsito correctamente.',
    'id_despacho',  v_id_despacho,
    'correlativo',  p_correlativo
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;
