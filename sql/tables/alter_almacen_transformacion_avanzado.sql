-- Propósito: Modificar las tablas de detalle de transformación para soportar presentaciones y ubicaciones de destino
-- Última modificación: 2026-05-26

ALTER TABLE public.almacen_orden_transformacion_entradas
  ADD COLUMN IF NOT EXISTS id_presentacion_logistica int8 REFERENCES public.almacen_productos_codigos(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS cantidad_presentacion      numeric;

ALTER TABLE public.almacen_orden_transformacion_salidas
  ADD COLUMN IF NOT EXISTS id_ubicacion int8 REFERENCES public.almacen_ubicaciones(id) ON DELETE RESTRICT;
