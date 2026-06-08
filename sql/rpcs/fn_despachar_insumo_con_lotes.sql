-- Propósito: Despacho de insumo con selección de lotes y actualización de inventario del comedor
-- Última modificación: 2026-05-04

CREATE OR REPLACE FUNCTION public.fn_despachar_insumo_con_lotes(p_id_insumo_ejecucion bigint, p_id_comedor bigint, p_id_rubro bigint, p_lotes jsonb, p_id_usuario bigint, p_volumen_entregado numeric, p_timestamp timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_lote record;
  v_id_ejecucion int8;
  v_id_despacho int8;
  v_id_producto_lote int8;
BEGIN
  -- 0. Obtener el ID de ejecución diaria para vincular el despacho
  SELECT id_ejecucion INTO v_id_ejecucion 
  FROM public.comedor_ejecucion_insumos 
  WHERE id = p_id_insumo_ejecucion;

  -- 1. Buscar o Crear Cabecera de Despacho (Evitar duplicados agrupando por usuario/ejecución reciente)
  SELECT id INTO v_id_despacho
  FROM public.comedor_despacho_ejecucion
  WHERE id_ejecucion = v_id_ejecucion
    AND id_usuario_despacho = p_id_usuario
    AND estatus = 'PENDIENTE'
    AND timestamp_despacho >= (p_timestamp - interval '10 minutes')
  LIMIT 1;

  IF v_id_despacho IS NULL THEN
    INSERT INTO public.comedor_despacho_ejecucion (
        id_ejecucion, estatus, timestamp_despacho, id_usuario_despacho
    )
    VALUES (
        v_id_ejecucion, 'PENDIENTE', p_timestamp, p_id_usuario
    )
    RETURNING id INTO v_id_despacho;
  END IF;

  -- 2. Iterar sobre los lotes enviados
  FOR v_lote IN SELECT * FROM jsonb_to_recordset(p_lotes) AS x(id_inventario int8, cantidad numeric)
  LOOP
    -- Obtener el id_producto del inventario para el detalle del despacho
    SELECT id_producto INTO v_id_producto_lote 
    FROM public.almacen_comedor_inventario 
    WHERE id = v_lote.id_inventario;

    -- A. Registrar el movimiento en la tabla de lotes de ejecución
    INSERT INTO public.comedor_ejecucion_insumos_lotes (
        id_insumo, id_inventario, cantidad, tipo, id_usuario, timestamp_create
    )
    VALUES (
        p_id_insumo_ejecucion, v_lote.id_inventario, v_lote.cantidad, 'DESPACHO', p_id_usuario, p_timestamp
    );

    -- B. Registrar en el detalle del despacho (Remisión)
    INSERT INTO public.comedor_despacho_ejecucion_detalle (
        id_despacho, id_insumo, id_producto, lote, fecha_vencimiento, cantidad_entregada
    )
    SELECT v_id_despacho, p_id_insumo_ejecucion, v_id_producto_lote, lote, fecha_vencimiento, v_lote.cantidad
    FROM public.almacen_comedor_inventario
    WHERE id = v_lote.id_inventario;

    -- C. Validar stock antes de restar para evitar inventarios negativos
    IF (SELECT cantidad_actual FROM public.almacen_comedor_inventario WHERE id = v_lote.id_inventario) < v_lote.cantidad THEN
      RAISE EXCEPTION 'Stock insuficiente para el lote % (ID: %). Requerido: %, Disponible: %', 
        (SELECT lote FROM public.almacen_comedor_inventario WHERE id = v_lote.id_inventario),
        v_lote.id_inventario, v_lote.cantidad, 
        (SELECT cantidad_actual FROM public.almacen_comedor_inventario WHERE id = v_lote.id_inventario);
    END IF;

    -- D. Restar del inventario del almacén
    UPDATE public.almacen_comedor_inventario
    SET cantidad_actual = cantidad_actual - v_lote.cantidad,
        timestamp_update = p_timestamp,
        id_usuario_update = p_id_usuario
    WHERE id = v_lote.id_inventario;
  END LOOP;

  -- 3. Actualizar la cabecera del insumo en la ejecución
  UPDATE public.comedor_ejecucion_insumos
  SET 
    cantidad_despachada = COALESCE(cantidad_despachada, 0) + p_volumen_entregado,
    estatus_item = 'DESPACHANDO',
    id_usuario_procesa = p_id_usuario,
    timestamp_procesa = p_timestamp
  WHERE id = p_id_insumo_ejecucion;

  RETURN jsonb_build_object('success', true, 'id_despacho', v_id_despacho);
END;
$function$
;
