-- Propósito: Estructuras o clasificaciones base de menú (Esqueletos)
-- Última modificación: 2026-06-08

CREATE TABLE public.estructura_menu_base (
  id                   int8        PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  id_empresa           int8        NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  id_tipo_servicio     int8        REFERENCES public.tipos_servicios_comida(id),
  nombre               text        NOT NULL,
  estatus              boolean     NOT NULL DEFAULT true,
  -- Auditoría
  timestamp_create     timestamptz NOT NULL,
  timestamp_update     timestamptz,
  id_usuario_create    int8,
  id_usuario_update    int8
);

-- Seguridad RLS
ALTER TABLE public.estructura_menu_base ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acceso autenticado" ON public.estructura_menu_base 
FOR ALL TO authenticated USING (true) WITH CHECK (true);
