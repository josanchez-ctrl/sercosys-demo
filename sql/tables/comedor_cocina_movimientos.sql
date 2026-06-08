-- Propósito: Historial de movimientos de insumos en la despensa de cocina (Auditoría de Saldos)
-- Última modificación: 2026-05-21
-- Cambio: se agrega id_producto (nullable) para identificar el producto específico en movimientos de desechables.

CREATE TABLE public.comedor_cocina_movimientos (
  id int8 PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  id_empresa int8 NOT NULL REFERENCES public.empresas(id),
  id_comedor int8 NOT NULL REFERENCES public.comedores(id),
  id_rubro int8 NOT NULL REFERENCES public.almacen_rubros(id),
  id_producto int8 REFERENCES public.almacen_productos(id), -- NULL para ingredientes, valor para desechables
  tipo_movimiento text NOT NULL, -- 'RECEPCION', 'CONSUMO', 'AJUSTE_POS', 'AJUSTE_NEG', 'ANULACION', 'DESPACHO_MANUAL'
  cantidad numeric NOT NULL,
  id_referencia int8, -- ID de la ejecución, despacho o ajuste manual
  observaciones text,
  -- Auditoría
  timestamp_create timestamptz NOT NULL DEFAULT now(),
  id_usuario_create int8 REFERENCES public.usuarios(id)
);

-- Índices para velocidad de consulta
CREATE INDEX idx_cocina_mov_comedor_rubro ON public.comedor_cocina_movimientos(id_comedor, id_rubro);
CREATE INDEX idx_cocina_mov_fecha ON public.comedor_cocina_movimientos(timestamp_create);

-- Seguridad RLS
ALTER TABLE public.comedor_cocina_movimientos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acceso total a usuarios autenticados" 
ON public.comedor_cocina_movimientos 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
