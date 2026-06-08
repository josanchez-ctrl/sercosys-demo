-- Propósito: Letras identificadoras de DNI/RIF (V, J, E, G, etc.)
-- Última modificación: 2026-05-04

CREATE TABLE public.letrasdni (
  id int8 PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  nombre text NOT NULL,
  estatus boolean DEFAULT true,
  orden int4 DEFAULT 0
);

-- Seguridad RLS
ALTER TABLE public.letrasdni ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acceso total a usuarios autenticados" 
ON public.letrasdni 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
