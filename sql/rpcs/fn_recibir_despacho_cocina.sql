-- Propósito: Recepción de despacho en cocina y actualización de inventarios
-- Última modificación: 2026-05-22
-- Contexto: Modificado para forzar factor = 1 en desechables (id_insumo = NULL) 
--   y eliminar la asignación de estatus_item = 'RECIBIDO_TOTAL' para que el rubro
--   permanezca abierto para nuevos despachos hasta su finalización manual.

CREATE OR REPLACE FUNCTION public.fn_recibir_despacho_cocina(
  p_id_despacho bigint, 
  p_id_usuario bigint, 
  p_timestamp timestamp with time zone, 
  p_detalles jsonb
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_item record;
  v_id_ejecucion int8;
  v_id_comedor int8;
  v_id_empresa int8;
  v_detalle_row record;
BEGIN
  -- 1. Obtener datos de la cabecera del despacho
  SELECT id_ejecucion INTO v_id_ejecucion FROM public.comedor_despacho_ejecucion WHERE id = p_id_despacho;
  SELECT id_comedor INTO v_id_comedor FROM public.comedor_ejecucion_diaria WHERE id = v_id_ejecucion;
  SELECT id_empresa INTO v_id_empresa FROM public.comedores WHERE id = v_id_comedor;

  -- 2. Marcar cabecera como recibida
  UPDATE public.comedor_despacho_ejecucion
  SET estatus = 'RECIBIDO',
      timestamp_recepcion = p_timestamp,
      id_usuario_recepcion = p_id_usuario,
      timestamp_update = p_timestamp,
      id_usuario_update = p_id_usuario
  WHERE id = p_id_despacho;

  -- 3. Procesar cada ítem del JSON
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_detalles) AS x(id_detalle int8, cantidad_recibida numeric)
  LOOP
    -- A. Obtener datos del detalle, el rubro, la categoría y el FACTOR de la presentación para convertir unidades a volumen
    -- Se usa LEFT JOIN con comedor_ejecucion_insumos porque los despachos manuales de desechables
    -- tienen id_insumo = NULL, por lo que el rubro se obtiene del rubro del producto directamente.
    -- Para desechables, el factor de conversión es siempre 1 ya que se despachan en unidades base individuales.
    -- También obtenemos el nombre de la categoría del rubro para determinar si consolidamos o no.
    DECLARE
      v_categoria_nombre text;
      v_id_producto_saldo bigint;
    BEGIN
      SELECT 
          d.*, 
          COALESCE(i.id_rubro, p.id_rubro) AS id_rubro,
          CASE WHEN d.id_insumo IS NULL THEN 1 ELSE COALESCE(pc.factor, 1) END AS factor,
          UPPER(cat.nombre) AS categoria_nombre
      INTO v_detalle_row 
      FROM public.comedor_despacho_ejecucion_detalle d
      LEFT JOIN public.comedor_ejecucion_insumos i ON i.id = d.id_insumo
      JOIN public.almacen_productos p ON p.id = d.id_producto
      JOIN public.almacen_rubros r ON r.id = COALESCE(i.id_rubro, p.id_rubro)
      LEFT JOIN public.almacen_categorias cat ON cat.id = r.id_categoria
      LEFT JOIN public.almacen_productos_codigos pc ON pc.id = d.id_presentacion_logistica
      WHERE d.id = v_item.id_detalle;

      -- B. Establecer condicionalmente el id_producto para el saldo de cocina
      IF v_detalle_row.categoria_nombre LIKE 'DESECHABLE%' OR v_detalle_row.categoria_nombre LIKE 'CONSUMIBLE%' THEN
        v_id_producto_saldo := v_detalle_row.id_producto;
      ELSE
        v_id_producto_saldo := NULL;
      END IF;

      -- C. Calcular volumen real (Unidades * Factor) para actualizar inventarios
      DECLARE
        v_volumen_recibido numeric := v_item.cantidad_recibida * COALESCE(NULLIF(v_detalle_row.factor, 0), 1);
      BEGIN
        -- D. Actualizar cantidad recibida EN UNIDADES en el detalle de la remisión
        UPDATE public.comedor_despacho_ejecucion_detalle
        SET cantidad_recibida = v_item.cantidad_recibida,
            timestamp_update = p_timestamp,
            id_usuario_update = p_id_usuario
        WHERE id = v_item.id_detalle;

        -- E. Actualizar cantidad recibida EN VOLUMEN en la ejecución diaria (solo si proviene de un insumo programado)
        -- Se elimina la actualización a estatus_item = 'RECIBIDO_TOTAL' para permitir despachos adicionales
        IF v_detalle_row.id_insumo IS NOT NULL THEN
          UPDATE public.comedor_ejecucion_insumos
          SET cantidad_recibida = COALESCE(cantidad_recibida, 0) + v_volumen_recibido,
              id_usuario_recepcion = p_id_usuario,
              timestamp_recepcion = p_timestamp,
              timestamp_update = p_timestamp,
              id_usuario_update = p_id_usuario
          WHERE id = v_detalle_row.id_insumo;
        END IF;

        -- F. Aumentar el saldo en cocina usando la función centralizada (Asegura historial)
        -- Pasamos el v_id_producto_saldo (NULL para ingredientes de receta, id_producto específico para desechables)
        PERFORM public.fn_actualizar_saldo_cocina(
            v_id_empresa,
            v_id_comedor,
            v_detalle_row.id_rubro,
            v_volumen_recibido,
            'RECEPCION',
            p_id_despacho,
            p_id_usuario,
            p_timestamp,
            'Recepción de despacho: ' || p_id_despacho,
            v_id_producto_saldo
        );
      END;
    END;
  END LOOP;

  RETURN jsonb_build_object('success', true);
END;
$function$;
