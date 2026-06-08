-- Propósito: Cabecera de ejecución diaria (Producción de alimentos)
-- Última modificación: 2026-05-14

CREATE TABLE public.comedor_ejecucion_diaria (
  id                   int8        PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  id_empresa           int8        NOT NULL REFERENCES public.empresas(id),
  id_comedor           int8        NOT NULL REFERENCES public.comedores(id),
  fecha_ejecucion      date        NOT NULL,
  id_tipo_servicio     int8        REFERENCES public.tipos_servicios_comida(id),
  comensales_reales    int4        DEFAULT 0,
  estatus              text        NOT NULL DEFAULT 'PENDIENTE', -- PENDIENTE, PROCESADO, ANULADO
  observaciones        text,
  -- Auditoría
  timestamp_create     timestamptz NOT NULL,
  timestamp_update     timestamptz,
  timestamp_anula      timestamptz,
  timestamp_procesa    timestamptz,
  id_usuario_create    int8        REFERENCES public.usuarios(id),
  id_usuario_update    int8        REFERENCES public.usuarios(id),
  id_usuario_anula     int8        REFERENCES public.usuarios(id),
  id_usuario_procesa   int8        REFERENCES public.usuarios(id)
);

-- Seguridad RLS
ALTER TABLE public.comedor_ejecucion_diaria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acceso total a usuarios autenticados" 
ON public.comedor_ejecucion_diaria 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
