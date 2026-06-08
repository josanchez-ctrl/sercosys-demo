-- Propósito: Configuración de servicios habilitados y precios por comedor
-- Última modificación: 2026-06-08

CREATE TABLE public.comedor_servicios_config (
  id                   int8        PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  id_comedor           int8        NOT NULL REFERENCES public.comedores(id) ON DELETE CASCADE,
  id_tipo_servicio     int8        NOT NULL REFERENCES public.tipos_servicios_comida(id),
  id_estructura_menu   int8        REFERENCES public.estructura_menu_base(id),
  precio_menu          numeric     NOT NULL DEFAULT 0.00,
  estatus              boolean     NOT NULL DEFAULT true,
  -- Auditoría
  timestamp_create     timestamptz NOT NULL,
  timestamp_update     timestamptz,
  id_usuario_create    int8,
  id_usuario_update    int8
);

-- Seguridad RLS
ALTER TABLE public.comedor_servicios_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acceso autenticado" ON public.comedor_servicios_config 
FOR ALL TO authenticated USING (true) WITH CHECK (true);
