-- sql/tables/cocina_despachos.sql
-- Última modificación: 2026-05-17
-- Propósito: Cabecera del documento de salida de comida preparada y utensilios.

CREATE TABLE IF NOT EXISTS public.cocina_despachos (
  id                       int8        PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  id_empresa               int8        NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  id_sucursal_origen       int8        NOT NULL REFERENCES public.sucursales(id),
  id_comedor_destino       int8        NOT NULL REFERENCES public.comedores(id),
  id_tipo_servicio         int8        NOT NULL REFERENCES public.tipos_servicios_comida(id),
  tipo_salida              text        NOT NULL, -- 'LINEA', 'EMPACADO', 'CATERING_LINEA', 'CATERING_EMPACADO'
  estatus                  text        NOT NULL DEFAULT 'BORRADOR', -- 'BORRADOR', 'DESPACHADO', 'RETORNADO', 'ANULADO'
  
  -- Cantidades de Comensales
  comensales_estimados     int4        NOT NULL DEFAULT 0,
  comensales_reales        int4,       -- Registrado al retorno
  personal_serco_estimado  int4        NOT NULL DEFAULT 0,
  personal_serco_real      int4,       -- Registrado al retorno
  
  -- Datos de Logística de Transporte (Opcionales según tipo_salida)
  responsable_traslado     text,
  cargo_responsable        text,
  tipo_vehiculo            text,       -- 'MOTO', 'CAMIONETA', 'CARRO', 'OTRO'
  placa_vehiculo           text,
  ruta_entrega             text,
  
  -- Tiempos de Entrega
  hora_contratada          text,
  timestamp_salida         timestamptz,
  timestamp_llegada        timestamptz,
  
  -- Auditoría Estándar Sercosys
  timestamp_create         timestamptz NOT NULL,
  timestamp_update         timestamptz,
  timestamp_anula          timestamptz,
  timestamp_procesa        timestamptz,
  id_usuario_create        int8        REFERENCES public.usuarios(id),
  id_usuario_update        int8        REFERENCES public.usuarios(id),
  id_usuario_anula         int8        REFERENCES public.usuarios(id),
  id_usuario_procesa       int8        REFERENCES public.usuarios(id)
);

CREATE INDEX IF NOT EXISTS idx_cocina_despachos_empresa ON public.cocina_despachos(id_empresa);
CREATE INDEX IF NOT EXISTS idx_cocina_despachos_sucursal ON public.cocina_despachos(id_sucursal_origen);
CREATE INDEX IF NOT EXISTS idx_cocina_despachos_comedor ON public.cocina_despachos(id_comedor_destino);
CREATE INDEX IF NOT EXISTS idx_cocina_despachos_fecha ON public.cocina_despachos(timestamp_create);
