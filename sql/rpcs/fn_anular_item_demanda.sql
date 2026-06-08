-- Propósito: Anulación individual de ítem en demanda
-- Última modificación: 2026-05-04

CREATE OR REPLACE FUNCTION public.fn_anular_item_demanda(p_id_item bigint, p_id_usuario bigint, p_motivo text)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_id_requisicion int8;
    v_total_pendientes int;
    v_now timestamptz := now();
BEGIN
    -- A. Obtener ID de la requisición y validar
    SELECT id_requisicion INTO v_id_requisicion
    FROM public.almacen_requisiciones_detalle
    WHERE id = p_id_item;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Ítem no encontrado');
    END IF;

    -- B. Anular el ítem
    UPDATE public.almacen_requisiciones_detalle
    SET estatus_item = 'ANULADO',
        motivo_anula = p_motivo,
        id_usuario_anula = p_id_usuario,
        timestamp_anula = v_now,
        timestamp_update = v_now,
        id_usuario_update = p_id_usuario
    WHERE id = p_id_item;

    -- C. Verificar si la requisición ya no tiene nada más pendiente
    SELECT count(*) INTO v_total_pendientes
    FROM public.almacen_requisiciones_detalle
    WHERE id_requisicion = v_id_requisicion
      AND estatus_item = 'PENDIENTE';

    -- D. Si no hay pendientes, cerramos la cabecera
    IF v_total_pendientes = 0 THEN
        UPDATE public.almacen_requisiciones
        SET estatus = 'PROCESADA',
            timestamp_update = v_now,
            id_usuario_update = p_id_usuario,
            timestamp_procesa = v_now,
            id_usuario_procesa = p_id_usuario
        WHERE id = v_id_requisicion;
        
        RETURN jsonb_build_object('success', true, 'message', 'Ítem anulado y requisición cerrada automáticamente');
    END IF;

    RETURN jsonb_build_object('success', true, 'message', 'Ítem anulado correctamente');

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$function$
;
