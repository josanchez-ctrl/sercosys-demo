-- sql/migrations/1_add_estatus_interno_activos.sql
-- Última modificación: 2026-05-18
-- Propósito: Agregar columna estatus_interno a la tabla logistica_activos para rastrear uso operativo interno de la cocina.

ALTER TABLE public.logistica_activos 
ADD COLUMN IF NOT EXISTS estatus_interno text NOT NULL DEFAULT 'DISPONIBLE';

COMMENT ON COLUMN public.logistica_activos.estatus_interno IS 'Estatus operativo interno de la cocina/comedor: DISPONIBLE, EN_USO';
