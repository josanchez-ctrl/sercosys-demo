-- Propósito: Agregar columna es_reprocesable en almacen_productos y porcentaje_corte en almacen_productos_derivados
-- Última modificación: 2026-06-03

-- Agregar columna es_reprocesable en almacen_productos
ALTER TABLE public.almacen_productos 
ADD COLUMN IF NOT EXISTS es_reprocesable boolean NOT NULL DEFAULT false;

-- Agregar columna porcentaje_corte en almacen_productos_derivados
ALTER TABLE public.almacen_productos_derivados 
ADD COLUMN IF NOT EXISTS porcentaje_corte numeric NOT NULL DEFAULT 0.00;
