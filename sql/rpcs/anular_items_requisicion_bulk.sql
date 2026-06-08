-- Propósito: Anulación masiva de ítems en requisiciones
-- Última modificación: 2026-05-04

CREATE OR REPLACE FUNCTION public.anular_items_requisicion_bulk(p_ids_items bigint[], p_motivo text, p_id_usuario bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_now timestamptz := now();
    v_req_id int8;
    v_total_pendientes_global int;
BEGIN
    -- 1. Obtener el ID de la requisición (asumimos que todos los items pertenecen a la misma REQ)
    SELECT id_requisicion INTO v_req_id 
    FROM public.almacen_requisiciones_detalle 
    WHERE id = p_ids_items[1];

    IF v_req_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Ítems no encontrados');
    END IF;

    -- 2. Marcar ítems como ANULADOS
    UPDATE public.almacen_requisiciones_detalle
    SET estatus_item = 'ANULADO',
        motivo_anula = p_motivo,
        timestamp_anula = v_now,
        id_usuario_anula = p_id_usuario,
        timestamp_update = v_now,
        id_usuario_update = p_id_usuario
    WHERE id = ANY(p_ids_items)
      AND estatus_item = 'PENDIENTE';

    -- 3. VERIFICACIÓN GLOBAL: ¿Queda algo por hacer en esta REQ?
    SELECT count(*) INTO v_total_pendientes_global
    FROM public.almacen_requisiciones_detalle
    WHERE id_requisicion = v_req_id
      AND estatus_item = 'PENDIENTE';

    IF v_total_pendientes_global = 0 THEN
        UPDATE public.almacen_requisiciones
        SET estatus = 'PROCESADA',
            timestamp_update = v_now,
            timestamp_procesa = v_now,
            id_usuario_procesa = p_id_usuario,
            id_usuario_update = p_id_usuario
        WHERE id = v_req_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'message', 'Ítems anulados correctamente. El estatus global se actualizó si no quedan pendientes.');

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$function$
;
