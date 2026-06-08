-- Propósito: Maestro de recetas (Fichas técnicas) con soporte para escalado dinámico
-- Última modificación: 2026-05-21

CREATE TABLE public.maestro_recetas (
  id                   int8        PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  id_empresa           int8        NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  id_tipologia         int8        REFERENCES public.receta_tipologias(id),
  codigo_ficha         text,
  nombre               text        NOT NULL,
  descripcion          text,
  rendimiento          numeric     NOT NULL DEFAULT 1,
  peso_porcion_base    numeric     NOT NULL DEFAULT 0, -- Peso total de la porción original
  id_unidad_medida     int8        REFERENCES public.almacen_unidades_medida(id), -- Unidad base de medida de la receta (KG, L, UND, RAC). Si es NULL se asume KG.
  estatus              boolean     NOT NULL DEFAULT true,
  -- Auditoría
  timestamp_create     timestamptz NOT NULL,
  timestamp_update     timestamptz,
  id_usuario_create    int8,
  id_usuario_update    int8
);

-- Seguridad RLS (Actualizada según Protocolo)
ALTER TABLE public.maestro_recetas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acceso autenticado" ON public.maestro_recetas;
CREATE POLICY "Acceso autenticado" ON public.maestro_recetas 
FOR ALL TO authenticated USING (true) WITH CHECK (true);
