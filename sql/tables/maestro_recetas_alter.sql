-- Script de alteración de tabla para maestro_recetas
-- Agrega campos de composición nutricional (Calorías, Proteínas, Carbohidratos, Grasas)
-- Última modificación: 2026-06-10

ALTER TABLE public.maestro_recetas 
  ADD COLUMN IF NOT EXISTS calorias numeric NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS proteinas_g numeric NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS carbohidratos_g numeric NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS grasas_g numeric NOT NULL DEFAULT 0.00;
