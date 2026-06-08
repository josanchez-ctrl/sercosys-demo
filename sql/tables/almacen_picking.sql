-- Propósito: Cabecera de picking (alistamiento de mercancía)
-- Última modificación: 2026-05-28 - Se agrega campo cestas para trazabilidad de envases retornables

CREATE TABLE public.almacen_picking (
  id int8 PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  id_empresa int8 NOT NULL REFERENCES public.empresas(id),
  id_almacen int8 NOT NULL, -- Almacén principal que surte
  id_sucursal int8 REFERENCES public.sucursales(id),
  id_comedor int8 REFERENCES public.comedores(id),
  id_requisicion jsonb NOT NULL DEFAULT '[]'::jsonb, -- Almacena array de IDs de requisiciones vinculadas
  cestas jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{id_tara, descripcion, cantidad}] - Cestas enviadas, se heredan al despacho
  estatus text NOT NULL DEFAULT 'PENDIENTE', -- BORRADOR, PENDIENTE (Tracking), RECOLECTADO (Validado), PROCESADO (Despachado), ANULADO
  observaciones text,
  -- Auditoría
  timestamp_create timestamptz NOT NULL,
  timestamp_update timestamptz,
  timestamp_anula timestamptz,
  timestamp_procesa timestamptz,
  id_usuario_create int8 REFERENCES public.usuarios(id),
  id_usuario_update int8 REFERENCES public.usuarios(id),
  id_usuario_anula int8 REFERENCES public.usuarios(id),
  id_usuario_procesa int8 REFERENCES public.usuarios(id),
  observacion_anula text
);

-- Seguridad RLS
ALTER TABLE public.almacen_picking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acceso total a usuarios autenticados" 
ON public.almacen_picking 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
