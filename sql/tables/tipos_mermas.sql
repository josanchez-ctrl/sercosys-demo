-- Propósito: Definición de tipos de merma (S, P, C, etc.)
-- Última modificación: 2026-05-04

CREATE TABLE public.tipos_mermas (
  id int8 PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  id_empresa int8 NOT NULL REFERENCES public.empresas(id),
  nombre text NOT NULL,
  letra text NOT NULL,
  orden int4 DEFAULT 0,
  estatus boolean DEFAULT true,
  timestamp_create timestamptz NOT NULL,
  timestamp_update timestamptz,
  id_usuario_create int8,
  id_usuario_update int8
);

-- Seguridad RLS
ALTER TABLE public.tipos_mermas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acceso total a usuarios autenticados" 
ON public.tipos_mermas 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
