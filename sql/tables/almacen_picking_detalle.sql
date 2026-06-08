-- Propósito: Detalle de picking con especificación de lotes
-- Última modificación: 2026-05-28 - Se agrega cantidad_presentacion para contar empaques físicos en productos de peso variable

CREATE TABLE public.almacen_picking_detalle (
  id int8 PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  id_picking int8 NOT NULL REFERENCES public.almacen_picking(id) ON DELETE CASCADE,
  id_producto int8 NOT NULL REFERENCES public.almacen_productos(id),
  cantidad numeric NOT NULL DEFAULT 0,
  lote text,
  fecha_vencimiento date,
  id_requisicion_detalle int8 REFERENCES public.almacen_requisiciones_detalle(id),
  costo_unidad_base numeric DEFAULT 0,
  cantidad_recibida numeric,
  cantidad_recolectada numeric NOT NULL DEFAULT 0,
  observacion_recepcion text,
  id_presentacion_logistica int8 REFERENCES public.almacen_productos_codigos(id),
  factor numeric NOT NULL DEFAULT 1,
  -- Empaques físicos reales (solo para productos con peso_variable=true)
  -- Si es NULL, se calcula por factor; si tiene valor, se display tal cual
  cantidad_presentacion numeric,
  -- Auditoría
  timestamp_create timestamptz NOT NULL,
  timestamp_update timestamptz,
  timestamp_anula timestamptz,
  timestamp_procesa timestamptz,
  id_usuario_create int8 REFERENCES public.usuarios(id),
  id_usuario_update int8 REFERENCES public.usuarios(id),
  id_usuario_anula int8 REFERENCES public.usuarios(id),
  id_usuario_procesa int8 REFERENCES public.usuarios(id)
);

-- Seguridad RLS
ALTER TABLE public.almacen_picking_detalle ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acceso total a usuarios autenticados" 
ON public.almacen_picking_detalle 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
