-- Propósito: Unidades de medida (Kg, L, Und, etc.)
-- Última modificación: 2026-05-04

CREATE TABLE public.almacen_unidades_medida (
  id int8 PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  id_empresa int8 NOT NULL REFERENCES public.empresas(id),
  nombre text NOT NULL,
  abreviatura text NOT NULL,
  estatus bool NOT NULL DEFAULT true,
  -- Auditoría
  timestamp_create timestamptz NOT NULL,
  timestamp_update timestamptz,
  id_usuario_create int8 REFERENCES public.usuarios(id),
  id_usuario_update int8 REFERENCES public.usuarios(id)
);

-- Seguridad RLS
ALTER TABLE public.almacen_unidades_medida ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acceso total a usuarios autenticados" 
ON public.almacen_unidades_medida 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
