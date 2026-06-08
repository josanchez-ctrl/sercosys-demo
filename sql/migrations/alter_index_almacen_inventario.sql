-- Propósito: Modificar el índice único idx_almacen_inventario_lote para incluir la ubicación (id_ubicacion)
-- Esto permite almacenar el mismo lote de un producto en múltiples ubicaciones del almacén sin violar la restricción.
-- Última modificación: 2026-05-27

DROP INDEX IF EXISTS public.idx_almacen_inventario_lote;

CREATE UNIQUE INDEX IF NOT EXISTS idx_almacen_inventario_lote 
ON public.almacen_inventario (id_empresa, id_almacen, id_producto, COALESCE(id_ubicacion, 0), COALESCE(lote, ''));
