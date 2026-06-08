-- Propósito: Maestro de porcentajes de merma por rubro/categoría
-- Última modificación: 2026-05-04

CREATE TABLE public.maestro_mermas (
  id int8 PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  id_empresa int8 NOT NULL REFERENCES public.empresas(id),
  id_categoria int8 REFERENCES public.almacen_categorias(id),
  id_rubro int8 REFERENCES public.almacen_rubros(id),
  porcentaje numeric NOT NULL DEFAULT 0,
  nombre text,
  -- Auditoría
  timestamp_create timestamptz NOT NULL,
  timestamp_update timestamptz,
  id_usuario_create int8 REFERENCES public.usuarios(id),
  id_usuario_update int8 REFERENCES public.usuarios(id)
);

-- Seguridad RLS
ALTER TABLE public.maestro_mermas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acceso total a usuarios autenticados" 
ON public.maestro_mermas 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
