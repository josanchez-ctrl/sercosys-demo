-- Propósito: Modificar las tablas de transformación para soportar flujo de declaraciones parciales y control de saldos en mesa
-- Última modificación: 2026-05-26

ALTER TABLE public.almacen_orden_transformacion_entradas
  ADD COLUMN IF NOT EXISTS cantidad_pendiente numeric NOT NULL DEFAULT 0;
