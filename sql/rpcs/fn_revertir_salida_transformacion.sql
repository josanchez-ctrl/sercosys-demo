-- Propósito: Revertir una salida parcial (fraccionada) de despote/reenvasado, devolver stock y restaurar mesa
-- Última modificación: 2026-05-28

CREATE OR REPLACE FUNCTION public.fn_revertir_salida_transformacion(
    p_id_salida bigint,
    p_id_usuario bigint,
    p_timestamp timestamp with time zone DEFAULT now()
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 AS $function$
DECLARE
    v_id_transformacion int8;
    v_id_empresa int8;
    v_id_almacen int8;
    v_id_producto int8;
    v_cantidad_obtenida numeric;
    v_lote_generado text;
    v_id_ubicacion int8;
    v_id_entrada_transformacion int8;
    v_estatus_orden text;
    v_id_item_inventario int8;
    v_cantidad_actual_inventario numeric;
    v_costo_unitario numeric;
    v_costo_actual_prod numeric;
    v_stock_actual_total numeric;
    v_stock_previo_total numeric;
    v_nuevo_costo_ponderado numeric;
    v_id_presentacion_logistica int8;
    v_cantidad_presentacion numeric;
BEGIN
    -- 1. Obtener y bloquear los detalles de la salida a revertir
    SELECT 
        id_transformacion, id_producto, cantidad_obtenida, lote_generado, id_ubicacion, id_entrada_transformacion, costo_unitario, id_presentacion_logistica, cantidad_presentacion
    INTO 
        v_id_transformacion, v_id_producto, v_cantidad_obtenida, v_lote_generado, v_id_ubicacion, v_id_entrada_transformacion, v_costo_unitario, v_id_presentacion_logistica, v_cantidad_presentacion
    FROM public.almacen_orden_transformacion_salidas
    WHERE id = p_id_salida
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El registro de salida especificado no existe.';
    END IF;

    -- 2. Validar estatus de la orden (debe estar EN_PROCESO)
    SELECT id_empresa, id_almacen, estatus INTO v_id_empresa, v_id_almacen, v_estatus_orden
    FROM public.almacen_ordenes_transformacion
    WHERE id = v_id_transformacion
    FOR UPDATE;

    IF v_estatus_orden != 'EN_PROCESO' THEN
        RAISE EXCEPTION 'Solo se pueden revertir pesajes de órdenes en estatus EN_PROCESO.';
    END IF;

    -- 3. Buscar y validar stock en el inventario
    SELECT id, cantidad_actual INTO v_id_item_inventario, v_cantidad_actual_inventario
    FROM public.almacen_inventario
    WHERE id_empresa = v_id_empresa
      AND id_almacen = v_id_almacen
      AND id_producto = v_id_producto
      AND COALESCE(id_ubicacion, 0) = COALESCE(v_id_ubicacion, 0)
      AND COALESCE(lote, '') = COALESCE(v_lote_generado, '')
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se encontró el stock correspondiente en el inventario para revertir.';
    END IF;

    IF v_cantidad_actual_inventario < v_cantidad_obtenida THEN
        RAISE EXCEPTION 'No se puede revertir: el stock ya fue consumido, transferido o despachado en parte. Disponible actual: %, Requerido para revertir: %',
            v_cantidad_actual_inventario, v_cantidad_obtenida;
    END IF;

    -- 4. Restar stock del inventario
    UPDATE public.almacen_inventario
    SET 
        cantidad_actual = cantidad_actual - v_cantidad_obtenida,
        cantidad_presentacion = CASE 
            WHEN cantidad_presentacion IS NOT NULL 
            THEN GREATEST(0, cantidad_presentacion - COALESCE(v_cantidad_presentacion, 0))
            ELSE NULL 
        END,
        timestamp_update = p_timestamp,
        id_usuario_update = p_id_usuario
    WHERE id = v_id_item_inventario;

    -- Eliminar registro de inventario si quedó en 0
    DELETE FROM public.almacen_inventario
    WHERE id = v_id_item_inventario AND cantidad_actual <= 0;

    -- 5. Devolver los kilos correspondientes al insumo en mesa
    UPDATE public.almacen_orden_transformacion_entradas
    SET cantidad_pendiente = cantidad_pendiente + v_cantidad_obtenida
    WHERE id = v_id_entrada_transformacion;

    -- 6. Eliminar el registro de salida
    DELETE FROM public.almacen_orden_transformacion_salidas
    WHERE id = p_id_salida;

    -- 7. Registrar Kardex (Movimiento de reversión)
    INSERT INTO public.almacen_inventario_movimientos (
        id_empresa, 
        id_almacen, 
        id_producto, 
        tipo_movimiento, 
        cantidad, 
        lote, 
        id_referencia, 
        id_presentacion_logistica,
        cantidad_presentacion,
        timestamp_create, 
        id_usuario_create, 
        notas
    ) VALUES (
        v_id_empresa, 
        v_id_almacen, 
        v_id_producto, 
        'TRANSFORMACION_SALIDA',
        -v_cantidad_obtenida, 
        COALESCE(v_lote_generado, 'SIN-LOTE'), 
        v_id_transformacion, 
        v_id_presentacion_logistica,
        -COALESCE(v_cantidad_presentacion, 0),
        p_timestamp, 
        p_id_usuario,
        'Reversión/Anulación de pesaje parcial en orden #' || v_id_transformacion
    );

    -- 8. Recalcular costo ponderado (PMP) del producto
    -- Bloquear maestro
    PERFORM 1 FROM public.almacen_productos WHERE id = v_id_producto FOR UPDATE;

    -- Costo ponderado actual del producto
    SELECT COALESCE(costo_ponderado, 0) INTO v_costo_actual_prod
    FROM public.almacen_productos
    WHERE id = v_id_producto;

    -- Stock total actual en la empresa
    SELECT COALESCE(SUM(cantidad_actual), 0) INTO v_stock_actual_total
    FROM public.almacen_inventario 
    WHERE id_producto = v_id_producto AND id_empresa = v_id_empresa;

    -- Stock previo antes de la reversión
    v_stock_previo_total := v_stock_actual_total + v_cantidad_obtenida;

    IF (v_stock_actual_total > 0) THEN
        v_nuevo_costo_ponderado := ROUND(
            ((v_stock_previo_total * v_costo_actual_prod) - (v_cantidad_obtenida * v_costo_unitario))
            / v_stock_actual_total, 
            6
        );
        IF v_nuevo_costo_ponderado < 0 THEN
            v_nuevo_costo_ponderado := 0;
        END IF;
    ELSE
        v_nuevo_costo_ponderado := v_costo_actual_prod;
    END IF;

    -- Actualizar maestro de productos
    UPDATE public.almacen_productos 
    SET
        costo_ponderado = v_nuevo_costo_ponderado,
        timestamp_update = p_timestamp,
        id_usuario_update = p_id_usuario
    WHERE id = v_id_producto;

    -- Registrar historial de costos si varió
    IF v_costo_actual_prod != v_nuevo_costo_ponderado THEN
        INSERT INTO public.almacen_productos_costos_historial (
            id_empresa, 
            id_producto, 
            costo_anterior, 
            costo_nuevo, 
            tipo_movimiento, 
            id_referencia, 
            timestamp_create, 
            id_usuario_create
        ) VALUES (
            v_id_empresa, 
            v_id_producto, 
            v_costo_actual_prod, 
            v_nuevo_costo_ponderado,
            'TRANSFORMACION_REVERSION', 
            v_id_transformacion, 
            p_timestamp, 
            p_id_usuario
        );
    END IF;

END;
$function$;
