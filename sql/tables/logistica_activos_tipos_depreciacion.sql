-- Propósito: Catálogo maestro de metodologías de depreciación para activos fijos
-- Última modificación: 2026-05-16

CREATE TABLE public.logistica_activos_tipos_depreciacion (
  id int8 PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  codigo text NOT NULL UNIQUE,
  nombre text NOT NULL,
  descripcion text,
  unidad_medida text NOT NULL, -- Ej: 'Meses', 'Porcentaje', 'Kilómetros', 'Horas', 'Unidades', 'N/A'
  estatus bool NOT NULL DEFAULT true,
  
  -- Auditoría
  timestamp_create timestamptz NOT NULL,
  timestamp_update timestamptz,
  id_usuario_create int8 REFERENCES public.usuarios(id),
  id_usuario_update int8 REFERENCES public.usuarios(id)
);

-- Seguridad RLS
ALTER TABLE public.logistica_activos_tipos_depreciacion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acceso total a usuarios autenticados" 
ON public.logistica_activos_tipos_depreciacion 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
