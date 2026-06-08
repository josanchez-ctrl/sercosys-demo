-- Migración: Agregar columnas de presentación logística y cantidad física al inventario y Kardex
-- Fecha: 2026-05-28

-- 1. Agregar columnas a public.almacen_inventario
ALTER TABLE public.almacen_inventario 
ADD COLUMN IF NOT EXISTS id_presentacion_logistica bigint REFERENCES public.almacen_productos_codigos(id) ON DELETE RESTRICT,
ADD COLUMN IF NOT EXISTS cantidad_presentacion numeric;

-- 2. Agregar columnas a public.almacen_inventario_movimientos (Kardex)
ALTER TABLE public.almacen_inventario_movimientos 
ADD COLUMN IF NOT EXISTS id_presentacion_logistica bigint REFERENCES public.almacen_productos_codigos(id) ON DELETE RESTRICT,
ADD COLUMN IF NOT EXISTS cantidad_presentacion numeric;
