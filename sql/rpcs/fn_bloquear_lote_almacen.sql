-- Propósito: Bloquear o desbloquear un lote de inventario
-- Última modificación: 2026-05-04

CREATE OR REPLACE FUNCTION public.fn_bloquear_lote_almacen(p_id_inventario bigint, p_is_bloqueado boolean, p_motivo text, p_id_usuario bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_now timestamptz := now();
BEGIN
    UPDATE public.almacen_inventario
    SET is_bloqueado = p_is_bloqueado,
        motivo_bloqueo = CASE WHEN p_is_bloqueado THEN p_motivo ELSE NULL END,
        id_usuario_bloqueo = CASE WHEN p_is_bloqueado THEN p_id_usuario ELSE NULL END,
        timestamp_bloqueo = CASE WHEN p_is_bloqueado THEN v_now ELSE NULL END,
        timestamp_update = v_now,
        id_usuario_update = p_id_usuario
    WHERE id = p_id_inventario;

    RETURN jsonb_build_object('success', true, 'message', 'Estado de bloqueo actualizado correctamente');
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$function$
;
