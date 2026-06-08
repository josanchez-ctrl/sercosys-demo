-- Propósito: Ingredientes que componen una receta con bandera de escalabilidad
-- Última modificación: 2026-05-10

CREATE TABLE public.maestro_receta_ingredientes (
  id                   int8        PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  id_receta_padre      int8        NOT NULL REFERENCES public.maestro_recetas(id) ON DELETE CASCADE,
  id_rubro             int8        NOT NULL REFERENCES public.almacen_rubros(id),
  id_sub_receta        int8        REFERENCES public.maestro_recetas(id), -- Para recetas anidadas
  cantidad             numeric     NOT NULL DEFAULT 0,
  es_escalable         boolean     NOT NULL DEFAULT true, -- Define si el ingrediente escala con el gramaje
  es_opcional          boolean     DEFAULT false,
  -- Auditoría básica (opcional en detalle)
  timestamp_create     timestamptz NOT NULL,
  id_usuario_create    int8
);

-- Seguridad RLS
ALTER TABLE public.maestro_receta_ingredientes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acceso autenticado" ON public.maestro_receta_ingredientes;
CREATE POLICY "Acceso autenticado" ON public.maestro_receta_ingredientes 
FOR ALL TO authenticated USING (true) WITH CHECK (true);
