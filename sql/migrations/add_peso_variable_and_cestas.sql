-- Migración: Soporte de Peso Variable y Trazabilidad de Cestas Retornables
-- Fecha: 2026-05-28

-- 1. Bandera de Peso Variable en el maestro de Productos
ALTER TABLE public.almacen_productos
ADD COLUMN IF NOT EXISTS peso_variable boolean NOT NULL DEFAULT false;

-- 2. Cestas utilizadas en el Picking (consolidado del alistamiento)
ALTER TABLE public.almacen_picking
ADD COLUMN IF NOT EXISTS cestas jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 3. Empaques físicos por renglón en el Detalle de Picking
ALTER TABLE public.almacen_picking_detalle
ADD COLUMN IF NOT EXISTS cantidad_presentacion numeric;

-- 4. Cestas enviadas (heredadas del picking) y retornadas por el vehículo
ALTER TABLE public.almacen_despacho
ADD COLUMN IF NOT EXISTS cestas_enviadas jsonb NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS cestas_retornadas jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 5. Empaques físicos por renglón en el Detalle de Despacho
ALTER TABLE public.almacen_despacho_detalle
ADD COLUMN IF NOT EXISTS cantidad_presentacion numeric;
