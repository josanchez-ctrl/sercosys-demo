-- Propósito: Consolidar saldos de cocina de víveres históricos bajo id_producto = NULL
-- Última modificación: 2026-05-22
-- Contexto: Agrupa los registros de comedor_cocina_saldos que no son desechables/consumibles y tienen id_producto asignado.
--   Suma sus cantidades al saldo consolidado (id_producto = NULL) y limpia el historial de movimientos de cocina.

DO $$
DECLARE
  v_rec RECORD;
BEGIN
  -- Iterar por cada fila de comedor_cocina_saldos que tenga id_producto asignado y no sea desechable/consumible
  FOR v_rec IN 
    SELECT s.id, s.id_empresa, s.id_comedor, s.id_rubro, s.id_producto, s.cantidad, s.timestamp_create, s.id_usuario_create
    FROM public.comedor_cocina_saldos s
    JOIN public.almacen_rubros r ON r.id = s.id_rubro
    LEFT JOIN public.almacen_categorias c ON c.id = r.id_categoria
    WHERE s.id_producto IS NOT NULL
      AND (c.nombre IS NULL OR (UPPER(c.nombre) NOT LIKE 'DESECHABLE%' AND UPPER(c.nombre) NOT LIKE 'CONSUMIBLE%'))
  LOOP
    -- Insertar o sumar al registro consolidado (id_producto = NULL)
    INSERT INTO public.comedor_cocina_saldos (
      id_empresa, id_comedor, id_rubro, id_producto, cantidad,
      timestamp_create, id_usuario_create, timestamp_update, id_usuario_update
    )
    VALUES (
      v_rec.id_empresa, v_rec.id_comedor, v_rec.id_rubro, NULL, v_rec.cantidad,
      v_rec.timestamp_create, v_rec.id_usuario_create, now(), v_rec.id_usuario_create
    )
    ON CONFLICT (id_comedor, id_rubro, COALESCE(id_producto, 0))
    DO UPDATE SET
      cantidad = public.comedor_cocina_saldos.cantidad + EXCLUDED.cantidad,
      timestamp_update = now();

    -- Actualizar los movimientos de este comedor/rubro/producto para que también apunten a id_producto = NULL
    UPDATE public.comedor_cocina_movimientos
    SET id_producto = NULL
    WHERE id_comedor = v_rec.id_comedor 
      AND id_rubro = v_rec.id_rubro 
      AND id_producto = v_rec.id_producto;

    -- Eliminar la fila que estaba separada por id_producto
    DELETE FROM public.comedor_cocina_saldos WHERE id = v_rec.id;
  END LOOP;
END $$;
