/*
  TABLA: logistica_activos_movimientos
  DESCRIPCIÓN: Historial inmutable de movimientos, cambios de ubicación y estado de los activos.
  ÚLTIMA MODIFICACIÓN: 2026-05-17
*/

CREATE TABLE public.logistica_activos_movimientos (
    id                   int8        PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    id_empresa           int8        NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    id_activo            int8        NOT NULL REFERENCES public.logistica_activos(id) ON DELETE CASCADE,
    
    tipo_movimiento      text        NOT NULL, -- ASIGNACION_INICIAL, TRASLADO, MANTENIMIENTO, REASIGNACION, BAJA, REACTIVACION, ACTUALIZACION_DATOS
    
    -- Trazabilidad geográfica
    id_sucursal_origen   int8        REFERENCES public.sucursales(id),
    id_sucursal_destino  int8        REFERENCES public.sucursales(id),
    
    -- Trazabilidad departamental
    id_departamento_origen int8      REFERENCES public.departamentos(id),
    id_departamento_destino int8     REFERENCES public.departamentos(id),
    
    -- Cambios de estado y condición
    condicion_origen     text,
    condicion_destino    text,
    estatus_operativo_origen text,
    estatus_operativo_destino text,
    
    observaciones        text,
    
    -- auditoría (inmutable)
    timestamp_create     timestamptz NOT NULL,
    id_usuario_create    int8        REFERENCES public.usuarios(id)
);

CREATE INDEX idx_activos_mov_activo ON public.logistica_activos_movimientos(id_activo);
CREATE INDEX idx_activos_mov_empresa ON public.logistica_activos_movimientos(id_empresa);

-- Políticas RLS
ALTER TABLE public.logistica_activos_movimientos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir select a usuarios autenticados" 
ON public.logistica_activos_movimientos
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Permitir insert a usuarios autenticados" 
ON public.logistica_activos_movimientos
FOR INSERT 
TO authenticated 
WITH CHECK (true);

