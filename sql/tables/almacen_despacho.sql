-- Propósito: Cabecera de despacho (Guía de remisión) entre almacenes
-- Última modificación: 2026-05-28 - Se agregan campos cestas_enviadas y cestas_retornadas para trazabilidad de envases retornables

CREATE TABLE public.almacen_despacho (
  id int8 PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  id_empresa int8 NOT NULL REFERENCES public.empresas(id),
  id_sucursal int8 NOT NULL REFERENCES public.sucursales(id),
  id_comedor int8 NOT NULL REFERENCES public.comedores(id),
  id_almacen_origen int8 NOT NULL, -- Almacén principal de origen
  transporte_chofer text,
  transporte_dni text,
  transporte_letradni int8,
  transporte_vehiculo int8,
  transporte_placa text,
  transporte_precinto text,
  estatus text NOT NULL DEFAULT 'PENDIENTE', -- PENDIENTE, EN TRÁNSITO, RECIBIDO_TOTAL, RECIBIDO_PARCIAL, ANULADO
  -- Trazabilidad de cestas/envases retornables heredados del picking
  cestas_enviadas   jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{id_tara, descripcion, cantidad}]
  cestas_retornadas jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{id_tara, descripcion, cantidad}] - llenado al cierre
  -- Auditoría
  timestamp_create timestamptz NOT NULL,
  timestamp_update timestamptz,
  timestamp_procesa timestamptz,
  timestamp_recibe timestamptz,
  id_usuario_create int8 REFERENCES public.usuarios(id),
  id_usuario_update int8 REFERENCES public.usuarios(id),
  id_usuario_procesa int8 REFERENCES public.usuarios(id),
  id_usuario_recibe int8 REFERENCES public.usuarios(id)
);

-- Seguridad RLS
ALTER TABLE public.almacen_despacho ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acceso total a usuarios autenticados" 
ON public.almacen_despacho 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
