-- Propósito: Agregar columna de porcentaje_costo para la distribución de costos por defecto a nivel de derivados
-- Fecha de creación: 2026-05-28

ALTER TABLE public.almacen_productos_derivados 
ADD COLUMN IF NOT EXISTS porcentaje_costo numeric NOT NULL DEFAULT 0.00,
DROP CONSTRAINT IF EXISTS chk_porcentaje_costo,
ADD CONSTRAINT chk_porcentaje_costo CHECK (porcentaje_costo >= 0 AND porcentaje_costo <= 100);
