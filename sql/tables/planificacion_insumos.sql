-- Propósito: Snapshot de explosión de insumos para una planificación (Requerimientos brutos)
-- Última modificación: 2026-05-04

CREATE TABLE public.planificacion_insumos (
  id int8 PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  id_planificacion int8 NOT NULL REFERENCES public.planificacion_semanal(id) ON DELETE CASCADE,
  fecha date NOT NULL,
  id_rubro int8 NOT NULL REFERENCES public.almacen_rubros(id),
  id_receta_raiz int8 REFERENCES public.maestro_recetas(id),
  cantidad_neta float8 NOT NULL,
  merma_pct float8 DEFAULT 0,
  -- Auditoría
  timestamp_create timestamptz NOT NULL,
  id_usuario_create int8 REFERENCES public.usuarios(id)
);

-- Seguridad RLS
ALTER TABLE public.planificacion_insumos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acceso total a usuarios autenticados" 
ON public.planificacion_insumos 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
