-- Propósito: Log de movimientos asociados a la ejecución (Auditoría operativa)
-- Última modificación: 2026-05-04

CREATE TABLE public.comedor_ejecucion_movimientos (
  id int8 PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  id_insumo int8 REFERENCES public.comedor_ejecucion_insumos(id),
  id_ejecucion int8 NOT NULL REFERENCES public.comedor_ejecucion_diaria(id),
  tipo text NOT NULL, -- DESPACHO, RECEPCION, ANULACION
  cantidad numeric NOT NULL,
  -- Auditoría
  timestamp_create timestamptz NOT NULL DEFAULT now(),
  id_usuario_create int8 REFERENCES public.usuarios(id)
);

-- Seguridad RLS
ALTER TABLE public.comedor_ejecucion_movimientos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acceso total a usuarios autenticados" 
ON public.comedor_ejecucion_movimientos 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
