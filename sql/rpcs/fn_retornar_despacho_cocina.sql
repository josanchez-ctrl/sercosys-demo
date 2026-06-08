-- sql/rpcs/fn_retornar_despacho_cocina.sql
-- Última modificación: 2026-05-20
-- Propósito: RPC para registrar el retorno y conciliación de un despacho de cocina (Goods Receipt / GR).
-- Para ítems de categoría UTENSILIOS, aplica GR (reingreso) al inventario del comedor según cantidad devuelta.
-- Los consumibles (CONSUMIBLE) no generan GR ya que son de salida definitiva.

CREATE OR REPLACE FUNCTION public.fn_retornar_despacho_cocina(
  p_id_despacho        int8,
  p_comensales_reales  int4,
  p_personal_serco_real int4,
  p_detalles_retorno   json,
  p_id_usuario         int8,
  p_timestamp          timestamptz
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_despacho_estatus   text;
  v_det                record;
  v_detalle            record;
  v_id_item_inv        int8;
  v_bloque_tipo        text;
  v_categoria_nombre   text;
BEGIN
  -- 1. Validar existencia y estatus (solo DESPACHADO puede retornarse)
  SELECT estatus INTO v_despacho_estatus
  FROM public.cocina_despachos
  WHERE id = p_id_despacho;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'El despacho no existe.');
  END IF;

  IF v_despacho_estatus <> 'DESPACHADO' THEN
    RETURN json_build_object('success', false, 'message', 'El despacho debe estar en estatus DESPACHADO para registrar el retorno.');
  END IF;

  -- 2. Actualizar cabecera con comensales reales
  UPDATE public.cocina_despachos
  SET
    estatus               = 'RETORNADO',
    comensales_reales     = p_comensales_reales,
    personal_serco_real   = p_personal_serco_real,
    timestamp_llegada     = COALESCE(timestamp_llegada, p_timestamp),
    timestamp_update      = p_timestamp,
    id_usuario_update     = p_id_usuario
  WHERE id = p_id_despacho;

  -- 3. Iterar sobre los detalles de retorno enviados desde el frontend
  FOR v_det IN
    SELECT
      (value->>'id_detalle')::int8           AS id_detalle,
      (value->>'cantidad_devuelta')::numeric  AS cantidad_devuelta,
      (value->>'raciones_devueltas')::int4    AS raciones_devueltas,
      (value->>'volumen_devuelto')::numeric   AS volumen_devuelto,
      value->>'estatus_retorno'               AS estatus_retorno,
      value->>'observaciones_retorno'         AS observaciones_retorno
    FROM json_array_elements(p_detalles_retorno)
  LOOP
    -- Obtener id_item_inventario_comedor y bloque_tipo del detalle
    SELECT d.id_item_inventario_comedor, d.bloque_tipo
    INTO v_id_item_inv, v_bloque_tipo
    FROM public.cocina_despachos_detalles d
    WHERE d.id = v_det.id_detalle;

    -- Actualizar el renglón del detalle con los valores del retorno
    UPDATE public.cocina_despachos_detalles
    SET
      cantidad_devuelta    = COALESCE(v_det.cantidad_devuelta, 0.00),
      raciones_devueltas   = v_det.raciones_devueltas,
      volumen_devuelto     = v_det.volumen_devuelto,
      estatus_retorno      = COALESCE(v_det.estatus_retorno, 'RETORNADO'),
      observaciones_retorno = v_det.observaciones_retorno,
      timestamp_update     = p_timestamp
    WHERE id = v_det.id_detalle;

    -- Goods Receipt (GR): Solo se aplica a ítems de tipo UTENSILIO con inventario registrado
    IF v_id_item_inv IS NOT NULL AND v_bloque_tipo = 'UTENSILIO' THEN

      -- Obtener la categoría del producto para confirmar que es retornable
      SELECT c.nombre INTO v_categoria_nombre
      FROM public.almacen_comedor_inventario aci
      JOIN public.almacen_productos p     ON p.id  = aci.id_producto
      JOIN public.almacen_rubros r        ON r.id  = p.id_rubro
      JOIN public.almacen_categorias c    ON c.id  = r.id_categoria
      WHERE aci.id = v_id_item_inv;

      IF UPPER(v_categoria_nombre) = 'UTENSILIOS' THEN
        -- Aplicar GR: reintegrar al inventario del comedor según lo que realmente retornó
        UPDATE public.almacen_comedor_inventario
        SET
          cantidad_actual   = cantidad_actual + COALESCE(v_det.cantidad_devuelta, 0),
          timestamp_update  = p_timestamp,
          id_usuario_update = p_id_usuario
        WHERE id = v_id_item_inv;
      END IF;

    END IF;

  END LOOP;

  RETURN json_build_object(
    'success', true,
    'message', 'Retorno registrado exitosamente. Inventario del comedor actualizado (GR) para ítems retornables.'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'message', SQLERRM);
END;
$$;
