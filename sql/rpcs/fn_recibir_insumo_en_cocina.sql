-- Propósito: Recepción de insumo en cocina y actualización de saldos
-- Última modificación: 2026-05-04

CREATE OR REPLACE FUNCTION public.fn_recibir_insumo_en_cocina(p_id_insumo_ejecucion bigint, p_id_comedor bigint, p_id_rubro bigint, p_lotes_recibidos jsonb, p_id_usuario bigint, p_timestamp timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_item record;
  v_volumen_total_recibido numeric := 0;
BEGIN
  -- 1. Actualizar cada registro de trazabilidad con lo que realmente llegó
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_lotes_recibidos) AS x(id_trazabilidad int8, cantidad_recibida numeric, volumen_recibido numeric)
  LOOP
    UPDATE public.comedor_ejecucion_insumos_lotes
    SET cantidad_recibida = v_item.cantidad_recibida,
        timestamp_update = p_timestamp,
        id_usuario_update = p_id_usuario
    WHERE id = v_item.id_trazabilidad;
    
    v_volumen_total_recibido := v_volumen_total_recibido + v_item.volumen_recibido;
  END LOOP;

  -- 2. Actualizar el acumulado en la ejecución y cambiar estatus
  UPDATE public.comedor_ejecucion_insumos
  SET 
    cantidad_recibida = COALESCE(cantidad_recibida, 0) + v_volumen_total_recibido,
    estatus_item = 'RECIBIDO_TOTAL', -- O RECEPCION_PARCIAL si decides manejarlo así
    id_usuario_update = p_id_usuario,
    timestamp_update = p_timestamp
  WHERE id = p_id_insumo_ejecucion;

  -- 3. INCREMENTAR EL SALDO EN COCINA (Aquí es donde nace el stock para la olla)
  INSERT INTO public.comedor_cocina_saldos (id_comedor, id_rubro, cantidad, timestamp_update)
  VALUES (p_id_comedor, p_id_rubro, v_volumen_total_recibido, p_timestamp)
  ON CONFLICT (id_comedor, id_rubro) 
  DO UPDATE SET 
    cantidad = public.comedor_cocina_saldos.cantidad + EXCLUDED.cantidad,
    timestamp_update = p_timestamp;

  RETURN jsonb_build_object('success', true, 'volumen_recibido', v_volumen_total_recibido);
END;
$function$
;
