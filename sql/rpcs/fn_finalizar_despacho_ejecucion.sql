-- Propósito: Finalizar todo el proceso de despacho de una ejecución diaria
-- Última modificación: 2026-05-16
-- Corrección: Se cambió 'observaciones' por 'motivo_anula' y se añadió auditoría de anulación automática.

CREATE OR REPLACE FUNCTION public.fn_finalizar_despacho_ejecucion(
    p_id_ejecucion int8,
    p_id_usuario int8,
    p_timestamp_audit timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    -- 1. Actualizar cabecera de ejecución
    UPDATE public.comedor_ejecucion_diaria SET
        estatus = 'PROCESADO',
        id_usuario_procesa = p_id_usuario,
        timestamp_procesa = p_timestamp_audit,
        id_usuario_update = p_id_usuario,
        timestamp_update = p_timestamp_audit
    WHERE id = p_id_ejecucion;

    -- 2. Finalizar rubros que quedaron con despachos parciales (DESPACHANDO -> DESPACHADO_TOTAL)
    UPDATE public.comedor_ejecucion_insumos SET
        estatus_item = 'DESPACHADO_TOTAL',
        id_usuario_update = p_id_usuario,
        timestamp_update = p_timestamp_audit
    WHERE id_ejecucion = p_id_ejecucion 
    AND estatus_item = 'DESPACHANDO'
    AND cantidad_despachada > 0;

    -- 3. Anular rubros que nunca se despacharon (PENDIENTES o DESPACHANDO con 0)
    UPDATE public.comedor_ejecucion_insumos SET
        estatus_item = 'ANULADO',
        motivo_anula = COALESCE(motivo_anula, '') || ' | Anulado automáticamente al finalizar despacho por falta de envío.',
        id_usuario_anula = p_id_usuario,
        timestamp_anula = p_timestamp_audit,
        id_usuario_update = p_id_usuario,
        timestamp_update = p_timestamp_audit
    WHERE id_ejecucion = p_id_ejecucion 
    AND estatus_item IN ('PENDIENTE', 'DESPACHANDO')
    AND (cantidad_despachada IS NULL OR cantidad_despachada = 0);

END;
$function$;
