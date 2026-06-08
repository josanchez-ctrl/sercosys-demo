-- Propósito: Cabecera de planificación semanal de menús
-- Última modificación: 2026-05-04

CREATE TABLE public.planificacion_semanal (
  id int8 PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  id_empresa int8 NOT NULL REFERENCES public.empresas(id),
  id_comedor int8 NOT NULL REFERENCES public.comedores(id),
  id_servicio_config int8, -- Configuración de servicios permitidos
  semana_inicio date NOT NULL,
  semana_fin date NOT NULL,
  observaciones text,
  estatus text NOT NULL DEFAULT 'BORRADOR', -- BORRADOR, APROBADA, PROCESADA, ANULADA
  -- Auditoría
  timestamp_create timestamptz NOT NULL,
  timestamp_update timestamptz,
  id_usuario_create int8 REFERENCES public.usuarios(id),
  id_usuario_update int8 REFERENCES public.usuarios(id)
);

-- Seguridad RLS
ALTER TABLE public.planificacion_semanal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acceso total a usuarios autenticados" 
ON public.planificacion_semanal 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
