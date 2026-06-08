-- Propósito: Detalle de los ítems despachados manualmente desde almacén-comedor hacia cocina
-- Última modificación: 2026-05-21
-- Contexto: Cada fila representa un producto desechable específico despachado en una remisión manual.
--   id_producto se registra para trazabilidad exacta (anime #5 vs anime #7, etc.)

CREATE TABLE public.almacen_despacho_manual_cocina_detalle (
  id                          int8        PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  id_despacho                 int8        NOT NULL REFERENCES public.almacen_despacho_manual_cocina(id) ON DELETE CASCADE,
  id_item_inventario_comedor  int8        NOT NULL REFERENCES public.almacen_comedor_inventario(id),
  id_producto                 int8        NOT NULL REFERENCES public.almacen_productos(id),
  cantidad                    numeric     NOT NULL,
  timestamp_create            timestamptz NOT NULL
);

-- Seguridad RLS
ALTER TABLE public.almacen_despacho_manual_cocina_detalle ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acceso total a usuarios autenticados"
ON public.almacen_despacho_manual_cocina_detalle
FOR ALL TO authenticated
USING (true) WITH CHECK (true);
