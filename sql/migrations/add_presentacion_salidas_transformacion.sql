-- Propósito: Agregar columnas de presentación logística y cantidad de envases a la tabla de salidas de transformación
-- Fecha de creación: 2026-05-28

ALTER TABLE public.almacen_orden_transformacion_salidas 
ADD COLUMN IF NOT EXISTS id_presentacion_logistica bigint REFERENCES public.almacen_productos_codigos(id) ON DELETE RESTRICT,
ADD COLUMN IF NOT EXISTS cantidad_presentacion numeric;
