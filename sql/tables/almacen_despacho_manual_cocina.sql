-- Propósito: Cabecera de despachos manuales de desechables desde almacén-comedor hacia cocina
-- Última modificación: 2026-05-21
-- Contexto: Los desechables (envases, vasos, papel aluminio, servilletas) no salen de recetas.
--   Se despachan manualmente y alimentan comedor_cocina_saldos con tracking por id_producto.

CREATE TABLE public.almacen_despacho_manual_cocina (
  id                   int8        PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  id_empresa           int8        NOT NULL REFERENCES public.empresas(id),
  id_sucursal          int8        NOT NULL,
  id_comedor           int8        NOT NULL REFERENCES public.comedores(id),
  correlativo          text        NOT NULL,
  observaciones        text,
  estatus              text        NOT NULL DEFAULT 'PROCESADO',
  timestamp_create     timestamptz NOT NULL,
  timestamp_anula      timestamptz,
  id_usuario_create    int8        REFERENCES public.usuarios(id),
  id_usuario_anula     int8        REFERENCES public.usuarios(id)
);

-- Seguridad RLS
ALTER TABLE public.almacen_despacho_manual_cocina ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acceso total a usuarios autenticados"
ON public.almacen_despacho_manual_cocina
FOR ALL TO authenticated
USING (true) WITH CHECK (true);
