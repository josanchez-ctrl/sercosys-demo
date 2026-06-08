-- Propósito: Finalizar picking y actualizar estatus de requisiciones
-- Última modificación: 2026-05-04

CREATE OR REPLACE FUNCTION public.fn_finalizar_picking(p_id_picking bigint, p_id_usuario bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_req_id int8;
    v_item RECORD;
    v_total_items int;
    v_despachados int;
BEGIN
    -- 1. Actualizar estatus del Picking
    UPDATE public.almacen_picking 
    SET estatus = 'PENDIENTE',
        timestamp_update = now(),
        id_usuario_update = p_id_usuario
    WHERE id = p_id_picking;

    -- 2. Actualizar ítems de Requisición vinculados
    FOR v_item IN 
        SELECT id_requisicion_detalle 
        FROM public.almacen_picking_detalle 
        WHERE id_picking = p_id_picking AND id_requisicion_detalle IS NOT NULL
    LOOP
        UPDATE public.almacen_requisiciones_detalle 
        SET estatus_item = 'DESPACHADO' 
        WHERE id = v_item.id_requisicion_detalle;
    END LOOP;

    -- 3. Revisar y cerrar Requisiciones completadas
    FOR v_req_id IN 
        SELECT DISTINCT r.id 
        FROM public.almacen_requisiciones r
        JOIN public.almacen_requisiciones_detalle rd ON r.id = rd.id_requisicion
        JOIN public.almacen_picking_detalle pd ON rd.id = pd.id_requisicion_detalle
        WHERE pd.id_picking = p_id_picking
    LOOP
        -- Contar ítems totales vs despachados de esta REQ
        SELECT COUNT(*), COUNT(*) FILTER (WHERE estatus_item = 'DESPACHADO')
        INTO v_total_items, v_despachados
        FROM public.almacen_requisiciones_detalle
        WHERE id_requisicion = v_req_id;

        -- Si todo está despachado, cerramos la cabecera
        IF v_total_items = v_despachados THEN
            UPDATE public.almacen_requisiciones 
            SET estatus = 'PROCESADA' 
            WHERE id = v_req_id;
        ELSE
            -- Si quedó algo pendiente, la dejamos como PENDIENTE (o PARCIAL si tuviéramos ese estatus)
            UPDATE public.almacen_requisiciones 
            SET estatus = 'PENDIENTE' 
            WHERE id = v_req_id;
        END IF;
    END LOOP;

    RETURN jsonb_build_object('success', true);
END;
$function$
;
