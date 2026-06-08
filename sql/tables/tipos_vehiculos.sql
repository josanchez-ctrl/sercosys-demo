-- Propósito: Maestro de tipos de vehículos para transporte
-- Última modificación: 2026-05-04

CREATE TABLE public.tipos_vehiculos (
  id int8 PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  nombre text NOT NULL,
  estatus boolean DEFAULT true,
  timestamp_create timestamptz NOT NULL,
  timestamp_update timestamptz,
  id_usuario_create int8,
  id_usuario_update int8
);

-- Seguridad RLS
ALTER TABLE public.tipos_vehiculos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acceso total a usuarios autenticados" 
ON public.tipos_vehiculos 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
