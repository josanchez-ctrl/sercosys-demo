-- Propósito: Configuración de gramajes negociados por comedor, servicio y renglón de menú
-- Última modificación: 2026-06-08

CREATE TABLE public.comedor_servicios_slots_config (
  id                   int8        PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  id_comedor_servicio  int8        NOT NULL REFERENCES public.comedor_servicios_config(id) ON DELETE CASCADE,
  id_slot              int8        NOT NULL REFERENCES public.estructura_menu_base_slots(id),
  cantidad_objetivo    numeric     NOT NULL DEFAULT 0,
  id_unidad_medida     int8        REFERENCES public.almacen_unidades_medida(id),
  timestamp_create     timestamptz NOT NULL,
  id_usuario_create    int8
);

-- Seguridad RLS
ALTER TABLE public.comedor_servicios_slots_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acceso autenticado" ON public.comedor_servicios_slots_config 
FOR ALL TO authenticated USING (true) WITH CHECK (true);
