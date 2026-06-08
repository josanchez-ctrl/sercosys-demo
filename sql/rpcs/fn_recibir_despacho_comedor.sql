-- Propósito: Recepción de despacho en comedor (almacén de destino)
-- Última modificación: 2026-05-14

CREATE OR REPLACE FUNCTION public.fn_recibir_despacho_comedor(p_id_despacho bigint, p_id_usuario bigint, p_detalles jsonb, p_timestamp_ahora timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_despacho RECORD;
    v_item jsonb;
    v_picking_detalle RECORD;
    v_hay_diferencia boolean := false;
    v_estatus_final text;
BEGIN
    -- 1. Obtener datos del despacho
    SELECT * INTO v_despacho FROM public.almacen_despacho WHERE id = p_id_despacho;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Despacho no encontrado');
    END IF;

    IF v_despacho.estatus IN ('RECIBIDO_TOTAL', 'RECIBIDO_PARCIAL', 'ENTREGADO') THEN
        RETURN jsonb_build_object('success', false, 'message', 'Este despacho ya ha sido recibido previamente');
    END IF;

    -- 2. Procesar cada ítem de la recepción
    FOR v_item IN SELECT jsonb_array_elements(p_detalles) LOOP
        
        -- Obtener datos del detalle original y su factor
        SELECT dd.cantidad_enviada, pd.id_producto, pd.lote, pd.fecha_vencimiento, pd.costo_unidad_base, pd.factor, pd.id_presentacion_logistica
        INTO v_picking_detalle 
        FROM public.almacen_despacho_detalle dd
        JOIN public.almacen_picking_detalle pd ON pd.id = dd.id_picking_detalle
        WHERE dd.id = (v_item->>'id_detalle')::int8;

        -- SI LO RECIBIDO ES DIFERENTE A LO ENVIADO (ARRIBA O ABAJO)
        IF (v_item->>'cantidad_recibida')::numeric != v_picking_detalle.cantidad_enviada THEN
            v_hay_diferencia := true;
        END IF;

        -- A. Actualizar el detalle del despacho
        UPDATE public.almacen_despacho_detalle
        SET cantidad_recibida = (v_item->>'cantidad_recibida')::numeric,
            observacion_recepcion = v_item->>'observacion',
            timestamp_update = p_timestamp_ahora,
            id_usuario_update = p_id_usuario
        WHERE id = (v_item->>'id_detalle')::int8;

        -- B. Afectar Inventario del Comedor (Guardar en presentaciones físicas)
        INSERT INTO public.almacen_comedor_inventario (
            id_empresa, id_sucursal, id_comedor, id_producto, id_presentacion_logistica, lote, fecha_vencimiento, cantidad_actual, costo_unidad_base, 
            timestamp_create, id_usuario_create
        ) VALUES (
            v_despacho.id_empresa, v_despacho.id_sucursal, v_despacho.id_comedor, v_picking_detalle.id_producto, v_picking_detalle.id_presentacion_logistica, COALESCE(v_picking_detalle.lote, ''), v_picking_detalle.fecha_vencimiento, 
            ((v_item->>'cantidad_recibida')::numeric * v_picking_detalle.factor), 
            COALESCE(v_picking_detalle.costo_unidad_base, 0), 
            p_timestamp_ahora, p_id_usuario
        )
        ON CONFLICT (id_empresa, id_sucursal, id_comedor, id_producto, (COALESCE(lote, '')), id_presentacion_logistica) DO UPDATE SET
            cantidad_actual = public.almacen_comedor_inventario.cantidad_actual + ((v_item->>'cantidad_recibida')::numeric * v_picking_detalle.factor),
            timestamp_update = p_timestamp_ahora,
            id_usuario_update = p_id_usuario;

        -- C. Registrar Movimiento de Entrada en Comedor
        INSERT INTO public.almacen_inventario_movimientos (
            id_empresa, id_comedor, id_producto, tipo_movimiento, cantidad, lote, id_referencia, timestamp_create, id_usuario_create
        ) VALUES (
            v_despacho.id_empresa, v_despacho.id_comedor, v_picking_detalle.id_producto, 'RECEPCIÓN_ENTRADA', 
            ((v_item->>'cantidad_recibida')::numeric * v_picking_detalle.factor), 
            v_picking_detalle.lote, p_id_despacho, p_timestamp_ahora, p_id_usuario
        );

    END LOOP;

    -- 3. Determinar Estatus Final
    v_estatus_final := CASE WHEN v_hay_diferencia THEN 'RECIBIDO_PARCIAL' ELSE 'RECIBIDO_TOTAL' END;

    -- 4. Cerrar Despacho
    UPDATE public.almacen_despacho
    SET estatus = v_estatus_final,
        timestamp_update = p_timestamp_ahora,
        id_usuario_update = p_id_usuario,
        id_usuario_recibe = p_id_usuario,
        timestamp_recibe = p_timestamp_ahora
    WHERE id = p_id_despacho;

    RETURN jsonb_build_object('success', true, 'message', 'Recepción procesada como ' || v_estatus_final);

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$function$
;
