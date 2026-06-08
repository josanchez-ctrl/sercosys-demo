-- Propósito: Maestro de logística y códigos de barras (EAN-13, GS1-128)
-- Última modificación: 2026-05-07 - Persistencia de conversión cadena
-- Se añaden id_referencia y cantidad_referencia para jerarquía logística.

CREATE TABLE public.almacen_productos_codigos (
  id                   int8        PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  id_empresa           int8        NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  id_producto          int8        NOT NULL REFERENCES public.almacen_productos(id) ON DELETE CASCADE,
  id_presentacion      int8        NOT NULL REFERENCES public.almacen_presentaciones(id),
  id_referencia        int8        REFERENCES public.almacen_productos_codigos(id),
  cantidad_referencia  numeric     DEFAULT 1,
  codigo_barras        text,
  codigo_interno       text,
  factor               numeric     NOT NULL DEFAULT 1,
  es_base              boolean     NOT NULL DEFAULT false,
  estatus              boolean     NOT NULL DEFAULT true,
  orden                integer     NOT NULL DEFAULT 0,
  -- Auditoría
  timestamp_create     timestamptz NOT NULL,
  timestamp_update     timestamptz,
  id_usuario_create    int8,
  id_usuario_update    int8,
  
  CONSTRAINT unique_codigo_empresa UNIQUE(id_empresa, codigo_barras)
);

COMMENT ON COLUMN public.almacen_productos_codigos.codigo_interno IS 'Código generado automáticamente por Sercosys para trazabilidad interna';
COMMENT ON COLUMN public.almacen_productos_codigos.id_referencia IS 'ID de la presentación que sirve como base para el cálculo relativo';
COMMENT ON COLUMN public.almacen_productos_codigos.cantidad_referencia IS 'Cantidad relativa respecto a la presentación de referencia';
COMMENT ON COLUMN public.almacen_productos_codigos.orden IS 'Orden visual de la presentación en la jerarquía logística';

-- Seguridad RLS
ALTER TABLE public.almacen_productos_codigos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acceso total a usuarios autenticados" 
ON public.almacen_productos_codigos 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
