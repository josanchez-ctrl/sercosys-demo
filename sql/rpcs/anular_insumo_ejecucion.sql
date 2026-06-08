-- Propósito: Anulación individual de insumo en ejecución diaria
-- Última modificación: 2026-05-04

CREATE OR REPLACE FUNCTION public.anular_insumo_ejecucion(
    p_id_insumo bigint, 
    p_motivo text, 
    p_id_usuario bigint,
    p_timestamp_ahora timestamp with time zone DEFAULT now()
)
 RETURNS jsonb
 LANGUAGE plpgsql
 AS $function$
 DECLARE
     v_id_ejecucion int8;
     v_total_pendientes int;
 BEGIN
     -- A. Obtener ID de la ejecución y validar
     SELECT id_ejecucion INTO v_id_ejecucion
     FROM public.comedor_ejecucion_insumos
     WHERE id = p_id_insumo;
 
     IF NOT FOUND THEN
         RETURN jsonb_build_object('success', false, 'message', 'Insumo de ejecución no encontrado');
     END IF;
 
     -- B. Anular el insumo con auditoría estándar
     UPDATE public.comedor_ejecucion_insumos
     SET estatus_item = 'ANULADO',
         timestamp_anula = p_timestamp_ahora,
         id_usuario_anula = p_id_usuario,
         motivo_anula = p_motivo,
         timestamp_update = p_timestamp_ahora,
         id_usuario_update = p_id_usuario
     WHERE id = p_id_insumo;
 
     -- C. Verificar si la ejecución ya no tiene nada más pendiente
     SELECT count(*) INTO v_total_pendientes
     FROM public.comedor_ejecucion_insumos
     WHERE id_ejecucion = v_id_ejecucion
       AND estatus_item = 'PENDIENTE';
 
     -- D. Si no hay pendientes, podríamos marcar la cabecera (opcional)
     IF v_total_pendientes = 0 THEN
         RETURN jsonb_build_object('success', true, 'message', 'Insumo anulado. No quedan ítems pendientes en esta ejecución.');
     END IF;
 
     RETURN jsonb_build_object('success', true, 'message', 'Insumo anulado correctamente');
 
 EXCEPTION WHEN OTHERS THEN
     RETURN jsonb_build_object('success', false, 'message', SQLERRM);
 END;
 $function$;
