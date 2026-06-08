-- Propósito: Insumos operativos adicionales (no vinculados a recetas) en la planificación
-- Última modificación: 2026-05-04

CREATE TABLE public.planificacion_insumos_operativos (
  id int8 PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  id_planificacion int8 NOT NULL REFERENCES public.planificacion_semanal(id) ON DELETE CASCADE,
  id_rubro int8 NOT NULL REFERENCES public.almacen_rubros(id),
  cantidad numeric NOT NULL DEFAULT 0,
  -- Auditoría
  timestamp_create timestamptz NOT NULL,
  id_usuario_create int8 REFERENCES public.usuarios(id)
);

-- Seguridad RLS
ALTER TABLE public.planificacion_insumos_operativos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acceso total a usuarios autenticados" 
ON public.planificacion_insumos_operativos 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
