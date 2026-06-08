-- Propósito: Procesar picking para despacho
-- Última modificación: 2026-05-04

CREATE OR REPLACE FUNCTION public.fn_procesar_despacho(p_id_picking bigint, p_id_usuario bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_picking RECORD;
    v_now timestamptz := now();
BEGIN
    SELECT * INTO v_picking FROM public.almacen_picking WHERE id = p_id_picking FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'message', 'Picking no encontrado'); END IF;
    IF v_picking.estatus != 'PENDIENTE' THEN RETURN jsonb_build_object('success', false, 'message', 'Estatus inválido'); END IF;

    -- Solo cambiamos estatus. El inventario se descontará al GENERAR EL DESPACHO (Salida del camión)
    UPDATE public.almacen_picking
    SET estatus = 'PROCESADO',
        id_usuario_update = p_id_usuario,
        timestamp_update = v_now
    WHERE id = p_id_picking;

    RETURN jsonb_build_object('success', true, 'message', 'Picking marcado como PROCESADO. Listo para despacho.');
END;
$function$
;
