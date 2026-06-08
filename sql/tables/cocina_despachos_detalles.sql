-- sql/tables/cocina_despachos_detalles.sql
-- Última modificación: 2026-05-20 (Migración a almacen_comedor_inventario; soporte tara, bandejas y grupos)
-- Propósito: Detalle de cavas, termos, alimentos y consumibles despachados.

CREATE TABLE IF NOT EXISTS public.cocina_despachos_detalles (
  id                       int8        PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  id_despacho              int8        NOT NULL REFERENCES public.cocina_despachos(id) ON DELETE CASCADE,

  -- Clasificación del Renglón
  bloque_tipo              text        NOT NULL, -- 'RECETA', 'UTENSILIO', 'CONSUMIBLE'

  -- Relación con Inventario del Comedor (fuente única de productos físicos)
  id_item_inventario_comedor int8      REFERENCES public.almacen_comedor_inventario(id),

  -- DEPRECATED: columna id_activo se mantiene por compatibilidad con registros históricos
  id_activo                int8,       -- No se usa en registros nuevos

  -- Relación con Receta elaborada (Nullable si es solo utensilio o consumible)
  id_receta                int8        REFERENCES public.maestro_recetas(id),
  nombre_producto_manual   text,       -- DEPRECATED: mantenido por historial

  -- Marcadores de comportamiento
  es_insumo_aparte         boolean     NOT NULL DEFAULT false, -- True = insumo que acompaña a una receta pero va aparte
  id_grupo_bandeja         int4,       -- Agrupa renglones de un mismo grupo de bandejas (modo EMPACADO)

  -- Métricas de Despacho — Modo LINEA
  raciones_despachadas     int4,
  peso_bruto               numeric(10,2), -- Peso bruto (recipiente + comida) ingresado en báscula
  tara                     numeric(10,2), -- Peso del recipiente vacío (ingresado manualmente)
  -- peso_neto = peso_bruto - tara (calculado en frontend y en reportes)

  -- Métricas de Despacho — Modo EMPACADO
  cantidad_bandejas        int4,          -- Número de bandejas/viandas de este tipo de envase

  -- Métricas Generales (Cantidad de unidades despachadas y volumen)
  cantidad_despachada      numeric(10,2) NOT NULL DEFAULT 1.00,
  volumen_despachado       numeric(10,2),
  unidad_volumen           text,       -- 'KG', 'L', 'UNIDADES'

  -- Auditoría y Conciliación de Retorno
  cantidad_devuelta        numeric(10,2) DEFAULT 0.00,
  raciones_devueltas       int4,
  volumen_devuelto         numeric(10,2),
  estatus_retorno          text        NOT NULL DEFAULT 'PENDIENTE', -- 'PENDIENTE', 'RETORNADO', 'EXTRAVIADO', 'DAÑADO'
  observaciones_retorno    text,

  -- Auditoría de Modificaciones
  timestamp_create         timestamptz NOT NULL,
  timestamp_update         timestamptz
);

CREATE INDEX IF NOT EXISTS idx_cocina_despachos_detalles_despacho ON public.cocina_despachos_detalles(id_despacho);
CREATE INDEX IF NOT EXISTS idx_cocina_despachos_detalles_item_inv ON public.cocina_despachos_detalles(id_item_inventario_comedor);
CREATE INDEX IF NOT EXISTS idx_cocina_despachos_detalles_receta ON public.cocina_despachos_detalles(id_receta);
