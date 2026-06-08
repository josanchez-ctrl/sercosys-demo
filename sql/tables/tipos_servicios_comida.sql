-- Propósito: Tipos de servicio de alimentación (ej: Desayuno, Almuerzo, Cena)
-- Última modificación: 2026-05-04

CREATE TABLE public.tipo_servicio_comida (
  id int8 PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  id_empresa int8 NOT NULL REFERENCES public.empresas(id),
  nombre text NOT NULL,
  hora_inicio time,
  hora_fin time,
  estatus bool NOT NULL DEFAULT true,
  -- Auditoría
  timestamp_create timestamptz NOT NULL,
  timestamp_update timestamptz,
  id_usuario_create int8 REFERENCES public.usuarios(id),
  id_usuario_update int8 REFERENCES public.usuarios(id)
);

-- Seguridad RLS
ALTER TABLE public.tipos_servicios_comida ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acceso total a usuarios autenticados" 
ON public.tipos_servicios_comida 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
