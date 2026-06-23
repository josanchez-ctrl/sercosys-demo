-- Creación de la tabla menu_reglas_nutricionales
-- Define reglas de balance nutricional y combinaciones gastronómicas de menú
-- Última modificación: 2026-06-10

CREATE TABLE IF NOT EXISTS public.menu_reglas_nutricionales (
  id                   int8        PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  id_empresa           int8        NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  codigo_regla         text        NOT NULL, -- ej: 'REG_ACIDEZ', 'REG_FRITURAS', etc.
  nombre               text        NOT NULL,
  descripcion          text,
  config               jsonb       NOT NULL DEFAULT '{}'::jsonb, -- Parámetros de la regla (ej: límites, tags involucrados)
  estatus              boolean     NOT NULL DEFAULT true,

  -- Auditoría
  timestamp_create     timestamptz NOT NULL,
  id_usuario_create    int8,
  timestamp_update     timestamptz,
  id_usuario_update    int8
);

-- Índice de unicidad para evitar duplicar el código de regla por empresa
CREATE UNIQUE INDEX IF NOT EXISTS uidx_empresa_codigo_regla ON public.menu_reglas_nutricionales(id_empresa, codigo_regla);
