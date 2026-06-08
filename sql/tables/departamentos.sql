/*
  TABLA: departamentos
  DESCRIPCIÓN: Define las áreas organizacionales de la empresa para la asignación de activos y personal.
  ÚLTIMA MODIFICACIÓN: 2026-05-16
*/

CREATE TABLE public.departamentos (
    id                   int8        PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    id_empresa           int8        NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    nombre               text        NOT NULL,
    estatus              boolean     NOT NULL DEFAULT true,
    
    -- auditoría
    timestamp_create     timestamptz NOT NULL,
    timestamp_update     timestamptz,
    id_usuario_create    int8        REFERENCES public.usuarios(id),
    id_usuario_update    int8        REFERENCES public.usuarios(id)
);

-- Índices para optimización
CREATE INDEX idx_departamentos_empresa ON public.departamentos(id_empresa);
