-- Propósito: Detalle de productos obtenidos (salidas) de órdenes de transformación/reenvasado en almacenes principales
-- Última modificación: 2026-05-25

CREATE TABLE IF NOT EXISTS public.almacen_orden_transformacion_salidas (
  id                   int8        PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  id_transformacion    int8        NOT NULL REFERENCES public.almacen_ordenes_transformacion(id) ON DELETE CASCADE,
  id_producto          int8        NOT NULL REFERENCES public.almacen_productos(id) ON DELETE RESTRICT,
  cantidad_obtenida    numeric     NOT NULL, -- Cantidad producida/obtenida
  unidad_medida        text        NOT NULL, -- Abreviatura (KG, L, UND)
  lote_generado        text        NOT NULL, -- Lote asignado para trazabilidad
  costo_unitario       numeric     NOT NULL, -- Costo unitario asignado tras calcular mermas
  es_scrap             boolean     NOT NULL DEFAULT false, -- True si es merma/desperdicio (con costo $0.00)
  id_ubicacion         int8        REFERENCES public.almacen_ubicaciones(id) ON DELETE RESTRICT,
  id_entrada_transformacion int8        REFERENCES public.almacen_orden_transformacion_entradas(id) ON DELETE CASCADE,
  id_presentacion_logistica bigint      REFERENCES public.almacen_productos_codigos(id) ON DELETE RESTRICT,
  cantidad_presentacion numeric,

  -- Auditoría (Estándar Sercosys)
  timestamp_create     timestamptz NOT NULL,
  id_usuario_create    int8        REFERENCES public.usuarios(id)
);

-- Seguridad RLS
ALTER TABLE public.almacen_orden_transformacion_salidas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acceso total a usuarios autenticados" 
ON public.almacen_orden_transformacion_salidas 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
