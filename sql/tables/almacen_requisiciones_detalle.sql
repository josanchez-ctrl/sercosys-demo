-- Propósito: Detalle de requisiciones (demanda por producto/rubro)
-- Última modificación: 2026-05-04

CREATE TABLE public.almacen_requisiciones_detalle (
  id int8 PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  id_requisicion int8 NOT NULL REFERENCES public.almacen_requisiciones(id) ON DELETE CASCADE,
  id_producto int8 REFERENCES public.almacen_productos(id),
  id_rubro int8 NOT NULL REFERENCES public.almacen_rubros(id),
  cantidad_solicitada numeric NOT NULL DEFAULT 0,
  cantidad_despachada numeric DEFAULT 0,
  estatus_item text NOT NULL DEFAULT 'PENDIENTE', -- PENDIENTE, PICKING, DESPACHADO, PROCESADO, ANULADO, PARCIAL
  motivo_anula text,
  -- Auditoría
  timestamp_create timestamptz NOT NULL,
  timestamp_update timestamptz,
  timestamp_anula timestamptz,
  id_usuario_create int8 REFERENCES public.usuarios(id),
  id_usuario_update int8 REFERENCES public.usuarios(id),
  id_usuario_anula int8 REFERENCES public.usuarios(id)
);

-- Seguridad RLS
ALTER TABLE public.almacen_requisiciones_detalle ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acceso total a usuarios autenticados" 
ON public.almacen_requisiciones_detalle 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
