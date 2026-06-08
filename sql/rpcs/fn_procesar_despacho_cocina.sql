-- sql/rpcs/fn_procesar_despacho_cocina.sql
-- Última modificación: 2026-05-20
-- Propósito: RPC para procesar la salida (Goods Issue / GI) de un despacho de cocina.
-- Cambia estatus a DESPACHADO y descuenta del inventario del comedor (almacen_comedor_inventario)
-- los ítems físicos (utensilios y consumibles). Los ingredientes de receta se descuentan en un proceso separado.

CREATE OR REPLACE FUNCTION public.fn_procesar_despacho_cocina(
  p_id_despacho int8,
  p_id_usuario  int8,
  p_timestamp   timestamptz
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_despacho_estatus text;
  v_det              record;
  v_cant_actual      numeric;
BEGIN
  -- 1. Validar existencia y estatus (solo BORRADOR puede procesarse)
  SELECT estatus INTO v_despacho_estatus
  FROM public.cocina_despachos
  WHERE id = p_id_despacho;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'El despacho no existe.');
  END IF;

  IF v_despacho_estatus <> 'BORRADOR' THEN
    RETURN json_build_object('success', false, 'message', 'Solo un despacho en BORRADOR puede ser procesado.');
  END IF;

  -- 2. Goods Issue (GI): Descontar del inventario del comedor los ítems físicos despachados
  FOR v_det IN
    SELECT
      d.id_item_inventario_comedor,
      d.cantidad_despachada,
      d.bloque_tipo
    FROM public.cocina_despachos_detalles d
    WHERE d.id_despacho = p_id_despacho
      AND d.id_item_inventario_comedor IS NOT NULL
      AND d.bloque_tipo IN ('UTENSILIO', 'CONSUMIBLE')
  LOOP
    -- Verificar stock disponible antes de descontar
    SELECT cantidad_actual INTO v_cant_actual
    FROM public.almacen_comedor_inventario
    WHERE id = v_det.id_item_inventario_comedor;

    IF v_cant_actual IS NULL THEN
      RETURN json_build_object('success', false, 'message',
        format('Ítem de inventario %s no encontrado.', v_det.id_item_inventario_comedor));
    END IF;

    IF v_cant_actual < v_det.cantidad_despachada THEN
      RETURN json_build_object('success', false, 'message',
        format('Stock insuficiente para el ítem de inventario %s. Disponible: %s, Requerido: %s',
          v_det.id_item_inventario_comedor, v_cant_actual, v_det.cantidad_despachada));
    END IF;

    -- Aplicar el descuento (GI)
    UPDATE public.almacen_comedor_inventario
    SET
      cantidad_actual  = cantidad_actual - v_det.cantidad_despachada,
      timestamp_update = p_timestamp,
      id_usuario_update = p_id_usuario
    WHERE id = v_det.id_item_inventario_comedor;
  END LOOP;

  -- 3. Actualizar cabecera del despacho a DESPACHADO
  UPDATE public.cocina_despachos
  SET
    estatus          = 'DESPACHADO',
    timestamp_salida = COALESCE(timestamp_salida, p_timestamp),
    timestamp_procesa = p_timestamp,
    id_usuario_procesa = p_id_usuario,
    timestamp_update = p_timestamp,
    id_usuario_update = p_id_usuario
  WHERE id = p_id_despacho;

  RETURN json_build_object(
    'success', true,
    'message', 'Despacho procesado exitosamente. Inventario del comedor actualizado (GI).'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'message', SQLERRM);
END;
$$;
