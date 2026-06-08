-- Propósito: Relación de recetas planificadas para una ejecución
-- Última modificación: 2026-05-04

CREATE TABLE public.comedor_ejecucion_diaria_recetas (
  id int8 PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  id_ejecucion int8 NOT NULL REFERENCES public.comedor_ejecucion_diaria(id) ON DELETE CASCADE,
  id_receta int8 NOT NULL REFERENCES public.maestro_recetas(id),
  id_estructura_slot int8 REFERENCES public.maestro_nomenclatura_slots(id)
);

-- Seguridad RLS
ALTER TABLE public.comedor_ejecucion_diaria_recetas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acceso total a usuarios autenticados" 
ON public.comedor_ejecucion_diaria_recetas 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
