-- Propósito: Detalle del menú planificado por día y servicio
-- Última modificación: 2026-05-04

CREATE TABLE public.planificacion_detalle (
  id int8 PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  id_planificacion int8 NOT NULL REFERENCES public.planificacion_semanal(id) ON DELETE CASCADE,
  fecha date NOT NULL,
  id_servicio int8 REFERENCES public.tipos_servicios_comida(id),
  id_estructura_slot int8 REFERENCES public.almacen_nomenclatura(id),
  id_receta int8 NOT NULL REFERENCES public.maestro_recetas(id),
  comensales int4 NOT NULL DEFAULT 0,
  ajustes_ingredientes jsonb DEFAULT '{}',
  -- Auditoría
  timestamp_create timestamptz NOT NULL,
  id_usuario_create int8 REFERENCES public.usuarios(id)
);

-- Seguridad RLS
ALTER TABLE public.planificacion_detalle ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acceso total a usuarios autenticados" 
ON public.planificacion_detalle 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
