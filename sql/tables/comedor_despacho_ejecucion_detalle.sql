-- Propósito: Detalle de despacho de insumos para ejecución con desglose de productos y lotes
-- Última modificación: 2026-05-04

CREATE TABLE public.comedor_despacho_ejecucion_detalle (
  id int8 PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  id_despacho int8 NOT NULL REFERENCES public.comedor_despacho_ejecucion(id) ON DELETE CASCADE,
  id_insumo int8 REFERENCES public.comedor_ejecucion_insumos(id), -- Nullable para despacho manual de desechables
  id_producto int8 NOT NULL REFERENCES public.almacen_productos(id),
  id_presentacion_logistica int8,
  lote text,
  fecha_vencimiento timestamptz,
  cantidad_entregada numeric NOT NULL DEFAULT 0,
  cantidad_recibida numeric NOT NULL DEFAULT 0,
  -- Auditoría
  timestamp_create timestamptz,
  id_usuario_create int8,
  timestamp_update timestamptz,
  id_usuario_update int8
);

-- Seguridad RLS
ALTER TABLE public.comedor_despacho_ejecucion_detalle ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acceso total a usuarios autenticados" 
ON public.comedor_despacho_ejecucion_detalle 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
