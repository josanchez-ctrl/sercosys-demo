-- Propósito: Sincronizar detalles de cotejo recalculando costo base en servidor para integridad
-- Última modificación: 2026-05-04

CREATE OR REPLACE FUNCTION public.sincronizar_cotejo_detalles(
  p_id_cotejo bigint, 
  p_detalles jsonb, 
  p_id_usuario bigint, 
  p_timestamp_audit timestamp with time zone DEFAULT now()
)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_detalle jsonb;
  v_tasa numeric;
  v_id_moneda int8;
  v_costo_unitario numeric;
  v_costo_base numeric;
BEGIN
  -- 1. Obtener la tasa y moneda de la cabecera (La Fuente de Verdad)
  SELECT id_moneda, COALESCE(tasa_cambio, 1) INTO v_id_moneda, v_tasa
  FROM public.almacen_cotejo
  WHERE id = p_id_cotejo;

  -- Si la moneda es la BASE (ID: 1, Dólares), la tasa para cálculo SIEMPRE es 1
  IF v_id_moneda = 1 THEN
    v_tasa := 1;
  END IF;

  -- Seguridad: Evitar división por cero
  IF v_tasa <= 0 THEN v_tasa := 1; END IF;

  -- 2. Borrar detalles previos
  DELETE FROM public.almacen_cotejo_detalle
  WHERE id_cotejo = p_id_cotejo;

  -- 3. Insertar nuevos detalles recalculando el costo base en el servidor
  FOR v_detalle IN SELECT * FROM jsonb_array_elements(p_detalles)
  LOOP
    v_costo_unitario := (v_detalle->>'costo_unitario')::numeric;
    
    -- CÁLCULO ATÓMICO LOGÍSTICO CON SOPORTE PARA MERMA DE TRASLADO:
    IF COALESCE((v_detalle->>'cantidad_factura')::numeric, 0) > 0 AND COALESCE((v_detalle->>'cantidad')::numeric, 0) > 0 THEN
      -- Se recalcula el costo base absorbido por los kilos reales recibidos
      v_costo_base := (((v_detalle->>'cantidad_factura')::numeric * v_costo_unitario) / v_tasa) / ((v_detalle->>'cantidad')::numeric * COALESCE(NULLIF((v_detalle->>'factor')::numeric, 0), 1));
    ELSE
      -- Fallback tradicional
      v_costo_base := (v_costo_unitario / v_tasa) / COALESCE(NULLIF((v_detalle->>'factor')::numeric, 0), 1);
    END IF;

    INSERT INTO public.almacen_cotejo_detalle (
      id_cotejo,
      id_almacen,
      id_producto,
      cantidad,
      cantidad_factura,
      costo_unitario,
      costo_unitario_base,
      lote,
      fecha_vencimiento,
      id_validacion_color,
      id_validacion_olor,
      id_validacion_textura,
      id_presentacion_logistica,
      factor,
      timestamp_create,
      id_usuario_create
    ) VALUES (
      p_id_cotejo,
      (v_detalle->>'id_almacen')::int8,
      (v_detalle->>'id_producto')::int8,
      (v_detalle->>'cantidad')::numeric,
      (v_detalle->>'cantidad_factura')::numeric,
      v_costo_unitario,
      v_costo_base, -- Valor calculado por la DB
      (v_detalle->>'lote')::text,
      NULLIF(v_detalle->>'fecha_vencimiento', '')::timestamptz,
      (v_detalle->>'id_validacion_color')::int8,
      (v_detalle->>'id_validacion_olor')::int8,
      (v_detalle->>'id_validacion_textura')::int8,
      (v_detalle->>'id_presentacion_logistica')::int8,
      COALESCE((v_detalle->>'factor')::numeric, 1),
      p_timestamp_audit,
      p_id_usuario
    );
  END LOOP;

  -- 4. Actualizar auditoría en cabecera
  UPDATE public.almacen_cotejo
  SET 
    timestamp_update = p_timestamp_audit,
    id_usuario_update = p_id_usuario
  WHERE id = p_id_cotejo;

END;
$function$;
