-- Propósito: Configuración de tasas de cambio (ej: BCV)
-- Última modificación: 2026-05-04

CREATE TABLE public.configuracion_tasas (
  id int8 PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  id_empresa int8 NOT NULL REFERENCES public.empresas(id),
  fecha date NOT NULL,
  tasa_dolar numeric NOT NULL,
  tasa_euro numeric,
  is_activa boolean DEFAULT true,
  -- Auditoría
  timestamp_create timestamptz NOT NULL,
  id_usuario_create int8 REFERENCES public.usuarios(id)
);

-- Seguridad RLS
ALTER TABLE public.configuracion_tasas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acceso total a usuarios autenticados" 
ON public.configuracion_tasas 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
