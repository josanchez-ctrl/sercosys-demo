-- Propósito: Registrar automáticamente un movimiento de ASIGNACION_INICIAL al insertar un activo
-- Última modificación: 2026-05-17

CREATE OR REPLACE FUNCTION public.fn_trg_activo_creacion_inicial()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.logistica_activos_movimientos (
    id_empresa, id_activo, tipo_movimiento,
    id_sucursal_origen, id_sucursal_destino,
    id_departamento_origen, id_departamento_destino,
    condicion_origen, condicion_destino,
    estatus_operativo_origen, estatus_operativo_destino,
    observaciones, timestamp_create, id_usuario_create
  ) VALUES (
    NEW.id_empresa, NEW.id, 'ASIGNACION_INICIAL',
    NULL, NEW.id_sucursal_actual,
    NULL, NEW.id_departamento_actual,
    NULL, NEW.condicion,
    NULL, NEW.estatus_operativo,
    'Registro inicial del activo en catálogo', NEW.timestamp_create, NEW.id_usuario_create
  );
  RETURN NEW;
END;
$$;

-- Eliminar trigger si existe
DROP TRIGGER IF EXISTS trg_activo_creacion_inicial ON public.logistica_activos;

-- Crear trigger
CREATE TRIGGER trg_activo_creacion_inicial
AFTER INSERT ON public.logistica_activos
FOR EACH ROW
EXECUTE FUNCTION public.fn_trg_activo_creacion_inicial();
