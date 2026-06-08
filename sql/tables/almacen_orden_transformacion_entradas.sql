-- Propósito: Detalle de consumos (entradas) de órdenes de transformación/reenvasado en almacenes principales
-- Última modificación: 2026-05-25

CREATE TABLE IF NOT EXISTS public.almacen_orden_transformacion_entradas (
  id                   int8        PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  id_transformacion    int8        NOT NULL REFERENCES public.almacen_ordenes_transformacion(id) ON DELETE CASCADE,
  id_item_inventario   int8        NOT NULL REFERENCES public.almacen_inventario(id) ON DELETE RESTRICT,
  cantidad_consumida   numeric     NOT NULL, -- Cantidad retirada del inventario (peso/unidades)
  unidad_medida        text        NOT NULL, -- Abreviatura (KG, L, UND)
  costo_unitario       numeric     NOT NULL, -- Costo unitario original al momento del consumo
  -- Presentación logistica seleccionada para el consumo (opcional, para visualización y auditoría)
  id_presentacion_logistica int8        REFERENCES public.almacen_productos_codigos(id) ON DELETE RESTRICT,
  cantidad_presentacion      numeric,             -- Cantidad ingresada en esa presentación (ej. 1 Saco)
  cantidad_mesa        numeric,             -- Peso real neto ingresado a la mesa tras reposo/descongelamiento
  cantidad_pendiente   numeric     NOT NULL DEFAULT 0, -- Cantidad pendiente por fraccionar/procesar en mesa

  -- Auditoría (Estándar Sercosys)
  timestamp_create     timestamptz NOT NULL,
  id_usuario_create    int8        REFERENCES public.usuarios(id)
);

-- Seguridad RLS
ALTER TABLE public.almacen_orden_transformacion_entradas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acceso total a usuarios autenticados" 
ON public.almacen_orden_transformacion_entradas 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
