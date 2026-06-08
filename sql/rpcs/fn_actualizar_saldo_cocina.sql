-- Propósito: Actualizar saldo de cocina (UPSERT) y registrar movimiento en historial
-- Última modificación: 2026-05-21
-- Cambio: se agrega p_id_producto DEFAULT NULL para soportar tracking por producto específico
--   (desechables). El conflict target cambia al índice uq_cocina_saldos_comedor_rubro_producto.
--   La versión v1 (3 parámetros) fue eliminada por ser huérfana y generar ambigüedad.

-- DROP FUNCTION IF EXISTS public.fn_actualizar_saldo_cocina(bigint, bigint, numeric); -- eliminar v1 huérfana

CREATE OR REPLACE FUNCTION public.fn_actualizar_saldo_cocina(
  p_id_empresa       bigint,
  p_id_comedor       bigint,
  p_id_rubro         bigint,
  p_cantidad         numeric,
  p_tipo_movimiento  text,
  p_id_referencia    bigint,
  p_id_usuario       bigint,
  p_timestamp_audit  timestamptz DEFAULT now(),
  p_observaciones    text        DEFAULT NULL,
  p_id_producto      bigint      DEFAULT NULL  -- NULL = ingrediente (rubro), valor = desechable específico
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- 1. Actualizar o Crear Saldo en la despensa de cocina
  --    El índice único uq_cocina_saldos_comedor_rubro_producto maneja el conflicto con COALESCE(id_producto, 0)
  INSERT INTO public.comedor_cocina_saldos (
    id_empresa, id_comedor, id_rubro, id_producto, cantidad,
    timestamp_create, id_usuario_create, timestamp_update, id_usuario_update
  )
  VALUES (
    p_id_empresa, p_id_comedor, p_id_rubro, p_id_producto, p_cantidad,
    p_timestamp_audit, p_id_usuario, p_timestamp_audit, p_id_usuario
  )
  ON CONFLICT (id_comedor, id_rubro, COALESCE(id_producto, 0))
  DO UPDATE SET
    cantidad          = public.comedor_cocina_saldos.cantidad + EXCLUDED.cantidad,
    timestamp_update  = p_timestamp_audit,
    id_usuario_update = p_id_usuario;

  -- 2. Registrar Movimiento en el Historial (Auditoría)
  INSERT INTO public.comedor_cocina_movimientos (
    id_empresa, id_comedor, id_rubro, id_producto, tipo_movimiento,
    cantidad, id_referencia, observaciones,
    timestamp_create, id_usuario_create
  ) VALUES (
    p_id_empresa, p_id_comedor, p_id_rubro, p_id_producto, p_tipo_movimiento,
    p_cantidad, p_id_referencia, p_observaciones,
    p_timestamp_audit, p_id_usuario
  );
END;
$$;
