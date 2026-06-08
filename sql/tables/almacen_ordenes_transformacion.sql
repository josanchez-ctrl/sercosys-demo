-- Propósito: Cabecera de órdenes de transformación/reenvasado/desposte en almacenes principales (WMS)
-- Última modificación: 2026-05-25

CREATE TABLE IF NOT EXISTS public.almacen_ordenes_transformacion (
  id                   int8        PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  id_empresa           int8        NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  id_sucursal          int8        NOT NULL REFERENCES public.sucursales(id) ON DELETE CASCADE,
  id_almacen           int8        NOT NULL REFERENCES public.almacenes(id) ON DELETE CASCADE,
  tipo_proceso         text        NOT NULL, -- 'REENVASADO', 'DESPOSTE', 'MOLIENDA'
  estatus              text        NOT NULL DEFAULT 'BORRADOR', -- 'BORRADOR', 'PROCESADO', 'ANULADO'
  observaciones        text,
  
  -- Auditoría (Estándar Sercosys)
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
ALTER TABLE public.almacen_ordenes_transformacion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acceso total a usuarios autenticados" 
ON public.almacen_ordenes_transformacion 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
