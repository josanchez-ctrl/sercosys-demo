-- Propósito: Detalle de despacho entre almacenes
-- Última modificación: 2026-05-28 - Se agrega cantidad_presentacion para tracking de empaques físicos en despachos de peso variable

CREATE TABLE public.almacen_despacho_detalle (
  id int8 PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  id_despacho int8 NOT NULL REFERENCES public.almacen_despacho(id) ON DELETE CASCADE,
  id_picking_detalle int8 REFERENCES public.almacen_picking_detalle(id),
  cantidad_enviada numeric NOT NULL DEFAULT 0,
  cantidad_recibida numeric DEFAULT 0,
  -- Empaques físicos (heredados del picking_detalle para productos de peso variable)
  cantidad_presentacion numeric,
  observacion_recepcion text
);

-- Seguridad RLS
ALTER TABLE public.almacen_despacho_detalle ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acceso total a usuarios autenticados" 
ON public.almacen_despacho_detalle 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
