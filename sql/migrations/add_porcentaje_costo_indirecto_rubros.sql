-- Propósito: Agregar columna de recargo por costo indirecto a la tabla de rubros
-- Fecha de creación: 2026-05-27

ALTER TABLE public.almacen_rubros 
ADD COLUMN IF NOT EXISTS porcentaje_costo_indirecto numeric NOT NULL DEFAULT 0.00,
ADD CONSTRAINT chk_porcentaje_costo_indirecto CHECK (porcentaje_costo_indirecto >= 0);
