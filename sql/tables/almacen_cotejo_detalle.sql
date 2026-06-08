-- Propósito: Detalle de cotejo de mercancía con soporte para logística
-- Última modificación: 2026-05-05

CREATE TABLE public.almacen_cotejo_detalle (
  id                        int8        PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  id_cotejo                 int8        NOT NULL REFERENCES public.almacen_cotejo(id) ON DELETE CASCADE,
  id_almacen                int8        NOT NULL REFERENCES public.almacenes(id),
  id_producto               int8        NOT NULL REFERENCES public.almacen_productos(id),
  id_presentacion_logistica int8        REFERENCES public.almacen_productos_codigos(id),
  factor                    numeric     NOT NULL DEFAULT 1, -- Factor de conversión al momento de la recepción
  cantidad                  numeric     NOT NULL DEFAULT 0, -- Cantidad en la presentación recibida
  cantidad_factura          numeric,                        -- Cantidad/peso especificado en la factura del proveedor
  costo_unitario            numeric     DEFAULT 0,          -- Costo por presentación recibida
  costo_unitario_base       numeric     DEFAULT 0,          -- Costo por unidad base (convertido)
  lote                      text,
  fecha_vencimiento         timestamptz,
  id_validacion_color       int8        REFERENCES public.maestro_validaciones_calidad(id),
  id_validacion_olor        int8        REFERENCES public.maestro_validaciones_calidad(id),
  id_validacion_textura     int8        REFERENCES public.maestro_validaciones_calidad(id),
  -- Auditoría
  timestamp_create          timestamptz NOT NULL,
  id_usuario_create         int8,
  timestamp_update          timestamptz,
  id_usuario_update         int8,
  timestamp_procesa         timestamptz,
  id_usuario_procesa        int8,
  timestamp_anula           timestamptz,
  id_usuario_anula          int8
);

-- Seguridad RLS
ALTER TABLE public.almacen_cotejo_detalle ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acceso total a usuarios autenticados" 
ON public.almacen_cotejo_detalle 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
