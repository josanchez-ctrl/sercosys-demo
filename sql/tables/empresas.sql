-- Propósito: Maestro de empresas (Multi-tenancy)
-- Última modificación: 2026-05-04

CREATE TABLE public.empresas (
  id int8 PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  nombre text NOT NULL,
  subdominio text UNIQUE,
  estatus bool NOT NULL DEFAULT true,
  -- Auditoría
  timestamp_create timestamptz NOT NULL,
  timestamp_update timestamptz
);

-- Seguridad RLS
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acceso total a usuarios autenticados" 
ON public.empresas 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
