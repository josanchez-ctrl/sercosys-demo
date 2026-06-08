-- Propósito: Cabecera de requisiciones (Demanda de comedores a almacén central)
-- Última modificación: 2026-05-04

CREATE TABLE public.almacen_requisiciones (
  id int8 PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  id_empresa int8 NOT NULL REFERENCES public.empresas(id),
  id_sucursal int8 NOT NULL REFERENCES public.sucursales(id),
  id_comedor int8 NOT NULL REFERENCES public.comedores(id),
  fecha_requisicion date NOT NULL,
  estatus text NOT NULL DEFAULT 'PENDIENTE', -- PENDIENTE, PICKING, PROCESADA, ANULADA
  observaciones text,
  -- Auditoría
  timestamp_create timestamptz NOT NULL,
  timestamp_update timestamptz,
  timestamp_procesa timestamptz,
  id_usuario_create int8 REFERENCES public.usuarios(id),
  id_usuario_update int8 REFERENCES public.usuarios(id),
  id_usuario_procesa int8 REFERENCES public.usuarios(id)
);

-- Seguridad RLS
ALTER TABLE public.almacen_requisiciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acceso total a usuarios autenticados" 
ON public.almacen_requisiciones 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
