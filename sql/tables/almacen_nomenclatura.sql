-- Propósito: Nomenclatura genérica para clasificaciones (ej: marcas, categorías, tipos)
-- Última modificación: 2026-05-04

CREATE TABLE public.almacen_nomenclatura (
  id int8 PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  id_empresa int8 NOT NULL REFERENCES public.empresas(id),
  nombre text NOT NULL,
  tipo text NOT NULL, -- CATEGORIA, MARCA, UNIDAD, etc.
  estatus bool NOT NULL DEFAULT true,
  -- Auditoría
  timestamp_create timestamptz NOT NULL,
  timestamp_update timestamptz,
  id_usuario_create int8 REFERENCES public.usuarios(id),
  id_usuario_update int8 REFERENCES public.usuarios(id)
);

-- Seguridad RLS
ALTER TABLE public.almacen_nomenclatura ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acceso total a usuarios autenticados" 
ON public.almacen_nomenclatura 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
