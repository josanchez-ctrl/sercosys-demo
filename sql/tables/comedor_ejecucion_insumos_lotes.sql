-- Propósito: Trazabilidad de lotes específicos utilizados en la ejecución
-- Última modificación: 2026-05-04

CREATE TABLE public.comedor_ejecucion_insumos_lotes (
  id int8 PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  id_insumo int8 NOT NULL REFERENCES public.comedor_ejecucion_insumos(id) ON DELETE CASCADE,
  id_inventario int8 NOT NULL REFERENCES public.almacen_comedor_inventario(id),
  cantidad numeric NOT NULL DEFAULT 0,
  tipo text NOT NULL DEFAULT 'DESPACHO', -- DESPACHO, RECEPCION
  cantidad_recibida numeric DEFAULT 0,
  -- Auditoría
  timestamp_create timestamptz NOT NULL,
  id_usuario int8 REFERENCES public.usuarios(id),
  timestamp_update timestamptz,
  id_usuario_update int8 REFERENCES public.usuarios(id)
);

-- Seguridad RLS
ALTER TABLE public.comedor_ejecucion_insumos_lotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acceso total a usuarios autenticados" 
ON public.comedor_ejecucion_insumos_lotes 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
