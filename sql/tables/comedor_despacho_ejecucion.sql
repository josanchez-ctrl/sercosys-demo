-- Propósito: Cabecera de despacho de insumos para una ejecución diaria (Remisión interna)
-- Última modificación: 2026-05-04

CREATE TABLE public.comedor_despacho_ejecucion (
  id int8 PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  id_ejecucion int8 NOT NULL REFERENCES public.comedor_ejecucion_diaria(id),
  estatus text NOT NULL DEFAULT 'PENDIENTE', -- PENDIENTE, RECIBIDO, ANULADO
  -- Auditoría
  timestamp_despacho timestamptz NOT NULL,
  id_usuario_despacho int8 REFERENCES public.usuarios(id),
  timestamp_recepcion timestamptz,
  id_usuario_recepcion int8 REFERENCES public.usuarios(id)
);

-- Seguridad RLS
ALTER TABLE public.comedor_despacho_ejecucion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acceso total a usuarios autenticados" 
ON public.comedor_despacho_ejecucion 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
