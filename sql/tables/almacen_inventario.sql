-- Propósito: Inventario detallado por lote y ubicación en almacenes principales (WMS)
-- Última modificación: 2026-05-07

CREATE TABLE public.almacen_inventario (
  id                   int8        PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  id_empresa           int8        NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  id_almacen           int8        NOT NULL REFERENCES public.almacenes(id) ON DELETE CASCADE,
  id_producto          int8        NOT NULL REFERENCES public.almacen_productos(id),
  id_ubicacion         int8        REFERENCES public.almacen_ubicaciones(id),
  lote                 text,
  fecha_vencimiento    date,
  cantidad_actual      numeric     NOT NULL DEFAULT 0,
  costo_unidad_base    numeric     NOT NULL DEFAULT 0,
  id_cotejo_detalle    int8        REFERENCES public.almacen_cotejo_detalle(id),
  tracking_id          text,
  
  -- Estado y Bloqueos
  is_bloqueado         boolean     NOT NULL DEFAULT false,
  motivo_bloqueo       text,
  id_usuario_bloqueo   int8        REFERENCES public.usuarios(id),
  timestamp_bloqueo    timestamptz,

  -- Auditoría (Estándar Sercosys)
  timestamp_create     timestamptz NOT NULL,
  timestamp_update     timestamptz,
  id_usuario_create    int8,
  id_usuario_update    int8
);

-- Índices de Integridad
CREATE UNIQUE INDEX IF NOT EXISTS idx_almacen_inventario_cotejo 
ON public.almacen_inventario (id_cotejo_detalle);

CREATE UNIQUE INDEX IF NOT EXISTS idx_almacen_inventario_lote 
ON public.almacen_inventario (id_empresa, id_almacen, id_producto, COALESCE(id_ubicacion, 0), COALESCE(lote, ''));

CREATE INDEX IF NOT EXISTS idx_almacen_inventario_tracking_id 
ON public.almacen_inventario (tracking_id);

-- Seguridad RLS
ALTER TABLE public.almacen_inventario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acceso total a usuarios autenticados" 
ON public.almacen_inventario 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
