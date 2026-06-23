-- Creación de la tabla receta_tags_relacion
-- Vincula recetas con sus etiquetas de compatibilidad de forma relacional
-- Última modificación: 2026-06-10

CREATE TABLE IF NOT EXISTS public.receta_tags_relacion (
  id                   int8        PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  id_receta            int8        NOT NULL REFERENCES public.maestro_recetas(id) ON DELETE CASCADE,
  tag_code             text        NOT NULL, -- ej: 'FRITO', 'LEGUMINOSA', 'BEBIDA_ACIDA', etc.
  
  -- Auditoría
  timestamp_create     timestamptz NOT NULL,
  id_usuario_create    int8
);

-- Índices para mejorar rendimiento en búsquedas y validaciones
CREATE INDEX IF NOT EXISTS idx_receta_tags_rel_receta ON public.receta_tags_relacion(id_receta);
CREATE INDEX IF NOT EXISTS idx_receta_tags_rel_code ON public.receta_tags_relacion(tag_code);
