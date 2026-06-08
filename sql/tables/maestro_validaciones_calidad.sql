-- Propósito: Maestro de estados de validación organoléptica para recepción (Color, Olor, Textura)
-- Última modificación: 2026-05-08

CREATE TABLE public.maestro_validaciones_calidad (
  id int8 PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  nombre text NOT NULL,
  letra char(1) NOT NULL,
  estatus bool NOT NULL DEFAULT true,
  timestamp_create timestamptz NOT NULL DEFAULT now()
);

-- Datos iniciales estándar para el flujo industrial
INSERT INTO public.maestro_validaciones_calidad (nombre, letra) VALUES
('EXCELENTE', 'E'),
('BUENO', 'B'),
('REGULAR', 'R'),
('DEFICIENTE', 'D'),
('N/A', 'N');

-- Seguridad RLS
ALTER TABLE public.maestro_validaciones_calidad ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acceso total a usuarios autenticados" 
ON public.maestro_validaciones_calidad 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
