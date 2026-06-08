-- Propósito: Maestro de monedas
-- Última modificación: 2026-05-04

CREATE TABLE public.monedas (
  id int8 PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  nombre text NOT NULL,
  simbolo text NOT NULL,
  es_base boolean DEFAULT false,
  estatus boolean DEFAULT true
);

-- Seguridad RLS
ALTER TABLE public.monedas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acceso total a usuarios autenticados" 
ON public.monedas 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
