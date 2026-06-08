-- Propósito: Registrar un movimiento de activo y actualizar su estado principal de manera atómica
-- Última modificación: 2026-05-17

CREATE OR REPLACE FUNCTION public.fn_registrar_movimiento_activo(
  p_id_activo int8,
  p_id_empresa int8,
  p_tipo_movimiento text,
  p_id_sucursal_destino int8,
  p_id_departamento_destino int8,
  p_condicion_destino text,
  p_estatus_operativo_destino text,
  p_observaciones text,
  p_id_usuario int8,
  p_timestamp timestamptz
)
RETURNS int8
LANGUAGE plpgsql
AS $$
DECLARE
  v_sucursal_origen int8;
  v_departamento_origen int8;
  v_condicion_origen text;
  v_estatus_operativo_origen text;
  v_id_movimiento int8;
BEGIN
  -- 1. Obtener estado actual (origen)
  SELECT 
    id_sucursal_actual, 
    id_departamento_actual, 
    condicion, 
    estatus_operativo
  INTO 
    v_sucursal_origen, 
    v_departamento_origen, 
    v_condicion_origen, 
    v_estatus_operativo_origen
  FROM public.logistica_activos
  WHERE id = p_id_activo;

  -- 2. Insertar historial de movimiento
  INSERT INTO public.logistica_activos_movimientos (
    id_empresa, id_activo, tipo_movimiento,
    id_sucursal_origen, id_sucursal_destino,
    id_departamento_origen, id_departamento_destino,
    condicion_origen, condicion_destino,
    estatus_operativo_origen, estatus_operativo_destino,
    observaciones, timestamp_create, id_usuario_create
  ) VALUES (
    p_id_empresa, p_id_activo, p_tipo_movimiento,
    v_sucursal_origen, p_id_sucursal_destino,
    v_departamento_origen, p_id_departamento_destino,
    v_condicion_origen, p_condicion_destino,
    v_estatus_operativo_origen, p_estatus_operativo_destino,
    p_observaciones, p_timestamp, p_id_usuario
  ) RETURNING id INTO v_id_movimiento;

  -- 3. Actualizar tabla principal del activo
  UPDATE public.logistica_activos
  SET
    id_sucursal_actual = p_id_sucursal_destino,
    id_departamento_actual = p_id_departamento_destino,
    condicion = p_condicion_destino,
    estatus_operativo = p_estatus_operativo_destino,
    id_usuario_update = p_id_usuario,
    timestamp_update = p_timestamp
  WHERE id = p_id_activo;

  RETURN v_id_movimiento;
END;
$$;
