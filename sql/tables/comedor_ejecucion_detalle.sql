-- Propósito: Detalle de recetas y comensales en una ejecución diaria
-- Última modificación: 2026-05-04

CREATE TABLE public.comedor_ejecucion_detalle (
  id int8 PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  id_ejecucion int8 NOT NULL REFERENCES public.comedor_ejecucion_diaria(id) ON DELETE CASCADE,
  id_receta int8 NOT NULL REFERENCES public.maestro_recetas(id),
  id_estructura_slot int8 REFERENCES public.maestro_nomenclatura_slots(id),
  comensales int4 NOT NULL DEFAULT 0
);

-- Seguridad RLS
ALTER TABLE public.comedor_ejecucion_detalle ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acceso total a usuarios autenticados" 
ON public.comedor_ejecucion_detalle 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
