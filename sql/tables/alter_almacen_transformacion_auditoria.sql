-- Propósito: Agregar columnas de auditoría estándar a las tablas de detalle de transformación
-- Última modificación: 2026-06-03

-- 1. Agregar columnas a almacen_orden_transformacion_entradas
ALTER TABLE public.almacen_orden_transformacion_entradas 
ADD COLUMN IF NOT EXISTS timestamp_create timestamptz,
ADD COLUMN IF NOT EXISTS id_usuario_create int8 REFERENCES public.usuarios(id);

-- 2. Agregar columnas a almacen_orden_transformacion_salidas
ALTER TABLE public.almacen_orden_transformacion_salidas 
ADD COLUMN IF NOT EXISTS timestamp_create timestamptz,
ADD COLUMN IF NOT EXISTS id_usuario_create int8 REFERENCES public.usuarios(id);

-- 3. Poblar datos históricos existentes usando los datos de la cabecera
UPDATE public.almacen_orden_transformacion_entradas e
SET timestamp_create = t.timestamp_create,
    id_usuario_create = t.id_usuario_create
FROM public.almacen_ordenes_transformacion t
WHERE e.id_transformacion = t.id
  AND e.timestamp_create IS NULL;

UPDATE public.almacen_orden_transformacion_salidas s
SET timestamp_create = t.timestamp_create,
    id_usuario_create = t.id_usuario_create
FROM public.almacen_ordenes_transformacion t
WHERE s.id_transformacion = t.id
  AND s.timestamp_create IS NULL;

-- 4. Establecer restricciones NOT NULL después de poblar
ALTER TABLE public.almacen_orden_transformacion_entradas 
ALTER COLUMN timestamp_create SET NOT NULL;

ALTER TABLE public.almacen_orden_transformacion_salidas 
ALTER COLUMN timestamp_create SET NOT NULL;
