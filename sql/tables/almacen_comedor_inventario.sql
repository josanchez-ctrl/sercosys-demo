-- Propósito: Inventario detallado por lote en comedores (almacenes de destino)
-- Última modificación: 2026-05-14

CREATE TABLE public.almacen_comedor_inventario (
  id                         int8        PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  id_empresa                 int8        NOT NULL REFERENCES public.empresas(id),
  id_sucursal                int8        NOT NULL REFERENCES public.sucursales(id),
  id_comedor                 int8        NOT NULL REFERENCES public.comedores(id),
  id_producto                int8        NOT NULL REFERENCES public.almacen_productos(id),
  id_presentacion_logistica  int8        REFERENCES public.almacen_productos_codigos(id),
  lote                       text,
  fecha_vencimiento          date,
  cantidad_actual            numeric     NOT NULL DEFAULT 0,
  costo_unidad_base          numeric     NOT NULL DEFAULT 0,
  -- Auditoría
  timestamp_create           timestamptz NOT NULL,
  timestamp_update           timestamptz,
  id_usuario_create          int8        REFERENCES public.usuarios(id),
  id_usuario_update          int8        REFERENCES public.usuarios(id),
  -- Bloqueo
  is_bloqueado               boolean     NOT NULL DEFAULT false,
  motivo_bloqueo             text,
  id_usuario_bloqueo         int8        REFERENCES public.usuarios(id),
  timestamp_bloqueo          timestamptz
);

-- Índice de Integridad (Incluye presentación para permitir múltiples formatos del mismo lote)
CREATE UNIQUE INDEX IF NOT EXISTS idx_almacen_comedor_inventario_lote 
ON public.almacen_comedor_inventario (id_empresa, id_sucursal, id_comedor, id_producto, COALESCE(lote, ''), id_presentacion_logistica);

-- Seguridad RLS
ALTER TABLE public.almacen_comedor_inventario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acceso total a usuarios autenticados" 
ON public.almacen_comedor_inventario 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
