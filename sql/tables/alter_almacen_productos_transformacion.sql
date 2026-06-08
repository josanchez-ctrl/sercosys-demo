-- Propósito: Agregar columnas de clasificación para transformación y reenvasado
-- Última modificación: 2026-05-26

ALTER TABLE public.almacen_productos 
  ADD COLUMN IF NOT EXISTS es_insumo_transformacion boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS es_resultado_transformacion boolean NOT NULL DEFAULT false;
