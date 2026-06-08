-- Propósito: Log centralizado de auditoría para cambios en registros
-- Última modificación: 2026-05-04

CREATE TABLE public.auditoria_logs (
  id int8 PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  tabla_afectada text NOT NULL,
  registro_id int8 NOT NULL,
  accion text NOT NULL, -- INSERT, UPDATE, DELETE
  datos_anteriores jsonb,
  datos_nuevos jsonb,
  timestamp timestamptz NOT NULL DEFAULT now(),
  id_usuario int8 REFERENCES public.usuarios(id)
);

-- Seguridad RLS
ALTER TABLE public.auditoria_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acceso total a usuarios autenticados" 
ON public.auditoria_logs 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
