-- Propósito: Perfiles de usuario y permisos
-- Última modificación: 2026-05-04

CREATE TABLE public.perfiles (
  id int8 PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  nombre text NOT NULL,
  descripcion text,
  permisos jsonb, -- Estructura de permisos por módulo
  estatus bool NOT NULL DEFAULT true,
  -- Auditoría
  timestamp_create timestamptz NOT NULL,
  timestamp_update timestamptz
);

-- Seguridad RLS
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acceso total a usuarios autenticados" 
ON public.perfiles 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
