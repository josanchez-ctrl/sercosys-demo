-- Propósito: Insumos (rubros) requeridos para una ejecución diaria (Explosión de materiales)
-- Última modificación: 2026-05-04

CREATE TABLE public.comedor_ejecucion_insumos (
  id int8 PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  id_ejecucion int8 NOT NULL REFERENCES public.comedor_ejecucion_diaria(id) ON DELETE CASCADE,
  id_rubro int8 NOT NULL REFERENCES public.almacen_rubros(id),
  cantidad_requerida numeric NOT NULL DEFAULT 0,
  id_unidad_medida int8 REFERENCES public.almacen_unidades_medida(id),
  id_ejecucion_receta int8 REFERENCES public.comedor_ejecucion_detalle(id),
  cantidad_despachada numeric DEFAULT 0,
  cantidad_recibida numeric DEFAULT 0,
  estatus_item text NOT NULL DEFAULT 'PENDIENTE', -- PENDIENTE, DESPACHANDO, DESPACHADO_TOTAL, RECIBIDO_TOTAL, ANULADO
  timestamp_despacho timestamptz,
  id_usuario_despacho int8 REFERENCES public.usuarios(id),
  timestamp_recepcion timestamptz,
  id_usuario_recepcion int8 REFERENCES public.usuarios(id),
  timestamp_procesa timestamptz,
  id_usuario_procesa int8 REFERENCES public.usuarios(id),
  -- Auditoría
  timestamp_update timestamptz,
  id_usuario_update int8 REFERENCES public.usuarios(id)
);

-- Seguridad RLS
ALTER TABLE public.comedor_ejecucion_insumos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acceso total a usuarios autenticados" 
ON public.comedor_ejecucion_insumos 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
