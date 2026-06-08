-- Propósito: Configuración de gramajes contratados por comedor y tipología (Negociación)
-- Última modificación: 2026-05-10

CREATE TABLE public.comedor_tipologia_config (
  id                   int8        PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  id_comedor           int8        NOT NULL REFERENCES public.comedores(id) ON DELETE CASCADE,
  id_tipologia         int8        NOT NULL REFERENCES public.receta_tipologias(id),
  gramaje_objetivo     numeric     NOT NULL DEFAULT 0, -- El gramaje negociado con el cliente
  estatus              boolean     NOT NULL DEFAULT true,
  -- Auditoría
  timestamp_create     timestamptz NOT NULL,
  timestamp_update     timestamptz,
  id_usuario_create    int8,
  id_usuario_update    int8
);

-- Seguridad RLS
ALTER TABLE public.comedor_tipologia_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acceso autenticado" ON public.comedor_tipologia_config;
CREATE POLICY "Acceso autenticado" ON public.comedor_tipologia_config 
FOR ALL TO authenticated USING (true) WITH CHECK (true);
