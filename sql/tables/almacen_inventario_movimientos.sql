-- Propósito: Log de movimientos de inventario (Kardex)
-- Última modificación: 2026-05-04

CREATE TABLE public.almacen_inventario_movimientos (
  id int8 PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  id_empresa int8 NOT NULL REFERENCES public.empresas(id),
  id_almacen int8, -- Almacén de origen/destino (si aplica)
  id_comedor int8 REFERENCES public.comedores(id), -- Comedor de origen/destino (si aplica)
  id_producto int8 NOT NULL REFERENCES public.almacen_productos(id),
  tipo_movimiento text NOT NULL, -- RECEPCIÓN_ENTRADA, DESPACHO_SALIDA, AJUSTE_ENTRADA, AJUSTE_SALIDA, etc.
  cantidad numeric NOT NULL,
  lote text,
  id_referencia int8, -- ID del documento que origina el movimiento (cotejo, despacho, picking, etc)
  notas text,
  -- Auditoría
  timestamp_create timestamptz NOT NULL,
  id_usuario_create int8 REFERENCES public.usuarios(id)
);

-- Seguridad RLS
ALTER TABLE public.almacen_inventario_movimientos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acceso total a usuarios autenticados" 
ON public.almacen_inventario_movimientos 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
