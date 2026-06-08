-- Propósito: Finalizar despacho de insumo en ejecución diaria (Versión Unificada e Inteligente)
-- Última modificación: 2026-05-16
-- Corrección: Se cambió 'observaciones' por 'motivo_anula' para evitar error de columna inexistente.

CREATE OR REPLACE FUNCTION public.fn_finalizar_despacho_insumo(
    p_id_insumo_ejecucion bigint, 
    p_id_usuario bigint, 
    p_timestamp timestamp with time zone
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_cant numeric;
BEGIN
  -- 1. Obtener cantidad despachada actual
  SELECT COALESCE(cantidad_despachada, 0) INTO v_cant 
  FROM public.comedor_ejecucion_insumos 
  WHERE id = p_id_insumo_ejecucion;

  IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'message', 'Insumo no encontrado');
  END IF;

  -- 2. Actualizar estatus (Si no se despachó nada, se anula por omisión)
  UPDATE public.comedor_ejecucion_insumos
  SET 
    estatus_item = CASE WHEN v_cant > 0 THEN 'DESPACHADO_TOTAL' ELSE 'ANULADO' END,
    motivo_anula = CASE WHEN v_cant = 0 THEN 'Omitido manualmente en despacho.' ELSE NULL END,
    timestamp_anula = CASE WHEN v_cant = 0 THEN p_timestamp ELSE NULL END,
    id_usuario_anula = CASE WHEN v_cant = 0 THEN p_id_usuario ELSE NULL END,
    id_usuario_update = p_id_usuario,
    timestamp_update = p_timestamp
  WHERE id = p_id_insumo_ejecucion;

  RETURN jsonb_build_object('success', true, 'message', 'Estatus del insumo actualizado correctamente');

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$function$;
