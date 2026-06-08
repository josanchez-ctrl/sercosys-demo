-- Propósito: Saldos actuales de insumos en la cocina (disponibles para producción)
-- Última modificación: 2026-05-21
-- Cambio: se agrega id_producto (nullable) para tracking por producto específico en desechables.
--   id_producto = NULL  → saldo consolidado por rubro (ingredientes: azúcar, arroz, etc.)
--   id_producto = valor → saldo por producto específico (desechables: envase anime #5, vaso 6oz, etc.)
-- La UNIQUE cambia de (id_comedor, id_rubro) a un índice con COALESCE para manejar NULLs.

CREATE TABLE public.comedor_cocina_saldos (
  id int8 PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  id_empresa int8 NOT NULL REFERENCES public.empresas(id),
  id_comedor int8 NOT NULL REFERENCES public.comedores(id),
  id_rubro int8 NOT NULL REFERENCES public.almacen_rubros(id),
  id_producto int8 REFERENCES public.almacen_productos(id), -- NULL para ingredientes, valor para desechables
  cantidad numeric NOT NULL DEFAULT 0,
  id_ejecucion int8 REFERENCES public.comedor_ejecucion_diaria(id),
  -- Auditoría
  timestamp_create timestamptz NOT NULL,
  timestamp_update timestamptz,
  id_usuario_create int8 REFERENCES public.usuarios(id),
  id_usuario_update int8 REFERENCES public.usuarios(id)
);

-- Índice único que permite id_producto NULL (cada NULL se trata como 0 para efectos del índice)
CREATE UNIQUE INDEX uq_cocina_saldos_comedor_rubro_producto
  ON public.comedor_cocina_saldos (id_comedor, id_rubro, COALESCE(id_producto, 0));

-- Migración sobre tabla existente:
-- ALTER TABLE public.comedor_cocina_saldos ADD COLUMN id_producto int8 REFERENCES public.almacen_productos(id);
-- ALTER TABLE public.comedor_cocina_saldos DROP CONSTRAINT comedor_cocina_saldos_id_comedor_id_rubro_key;
-- CREATE UNIQUE INDEX uq_cocina_saldos_comedor_rubro_producto ON public.comedor_cocina_saldos (id_comedor, id_rubro, COALESCE(id_producto, 0));

-- Seguridad RLS
ALTER TABLE public.comedor_cocina_saldos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acceso total a usuarios autenticados" 
ON public.comedor_cocina_saldos 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
