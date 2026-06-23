-- Creación de la tabla comedor_perfil_nutricional
-- Permite establecer objetivos de calorías y rangos de macronutrientes por comedor y tipo de servicio
-- Última modificación: 2026-06-11

CREATE TABLE IF NOT EXISTS public.comedor_perfil_nutricional (
  id                   int8        PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  id_comedor           int8        NOT NULL REFERENCES public.comedores(id) ON DELETE CASCADE,
  id_tipo_servicio     int8        NOT NULL REFERENCES public.tipos_servicios_comida(id) ON DELETE CASCADE,
  kcal_objetivo        numeric     NOT NULL DEFAULT 800.00,
  carb_min_pct         numeric     NOT NULL DEFAULT 50.00,
  carb_max_pct         numeric     NOT NULL DEFAULT 60.00,
  prot_min_pct         numeric     NOT NULL DEFAULT 15.00,
  prot_max_pct         numeric     NOT NULL DEFAULT 20.00,
  grasa_min_pct        numeric     NOT NULL DEFAULT 25.00,
  grasa_max_pct        numeric     NOT NULL DEFAULT 30.00,

  -- Auditoría
  timestamp_create     timestamptz NOT NULL,
  id_usuario_create    int8,
  timestamp_update     timestamptz,
  id_usuario_update    int8
);

-- Índice único por comedor y tipo de servicio
CREATE UNIQUE INDEX IF NOT EXISTS uidx_comedor_servicio_perfil ON public.comedor_perfil_nutricional(id_comedor, id_tipo_servicio);
