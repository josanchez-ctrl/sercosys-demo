-- Propósito: Cabecera de cotejo (recepción de mercancía)
-- Última modificación: 2026-05-04

CREATE TABLE public.almacen_cotejo (
  id int8 PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  id_empresa int8 NOT NULL REFERENCES public.empresas(id),
  id_almacen int8 NOT NULL, -- Referencia a almacén (puede ser de comedores o principal)
  fecha_cotejo date NOT NULL,
  estatus text NOT NULL DEFAULT 'PENDIENTE', -- PENDIENTE, PROCESADO, ANULADO
  observaciones text,
  -- Auditoría
  timestamp_create timestamptz NOT NULL,
  timestamp_update timestamptz,
  timestamp_procesa timestamptz,
  timestamp_anula timestamptz,
  id_usuario_create int8 REFERENCES public.usuarios(id),
  id_usuario_update int8 REFERENCES public.usuarios(id),
  id_usuario_procesa int8 REFERENCES public.usuarios(id),
  id_usuario_anula int8 REFERENCES public.usuarios(id),
  -- Multimoneda
  id_moneda int8 REFERENCES public.monedas(id),
  tasa_cambio numeric NOT NULL DEFAULT 1
);

-- Seguridad RLS
ALTER TABLE public.almacen_cotejo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acceso total a usuarios autenticados" 
ON public.almacen_cotejo 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
