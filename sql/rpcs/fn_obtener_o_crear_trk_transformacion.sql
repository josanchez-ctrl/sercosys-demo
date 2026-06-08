-- Propósito: Obtener o pre-crear un registro de inventario con stock cero y retornar su tracking_id (TRK) para impresión de etiquetas en caliente
-- Última modificación: 2026-06-06

CREATE OR REPLACE FUNCTION public.fn_obtener_o_crear_trk_transformacion(
    p_id_transformacion bigint,
    p_id_entrada_transformacion bigint,
    p_id_producto_salida bigint,
    p_id_presentacion_logistica bigint,
    p_id_ubicacion_destino bigint,
    p_id_usuario bigint
)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_id_empresa int8;
    v_id_almacen int8;
    v_estatus text;
    v_lote_origen text;
    v_fecha_vencimiento date;
    v_id_item_inventario_orig int8;
    v_id_item_salida int8;
    v_tracking_id text;
BEGIN
    -- 1. Obtener datos de la orden
    SELECT id_empresa, id_almacen, estatus INTO v_id_empresa, v_id_almacen, v_estatus
    FROM public.almacen_ordenes_transformacion
    WHERE id = p_id_transformacion;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Orden de transformación no encontrada.';
    END IF;

    IF v_estatus != 'EN_PROCESO' THEN
        RAISE EXCEPTION 'La orden debe estar en estatus EN_PROCESO para poder generar etiquetas en caliente.';
    END IF;

    -- 2. Obtener y validar el insumo en mesa (entrada)
    SELECT id_item_inventario INTO v_id_item_inventario_orig
    FROM public.almacen_orden_transformacion_entradas
    WHERE id = p_id_entrada_transformacion AND id_transformacion = p_id_transformacion;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El insumo especificado no pertenece a esta orden.';
    END IF;

    -- 3. Obtener lote y vencimiento del item original para heredar
    SELECT lote, fecha_vencimiento INTO v_lote_origen, v_fecha_vencimiento
    FROM public.almacen_inventario
    WHERE id = v_id_item_inventario_orig;

    -- 4. Buscar si ya existe el registro en el inventario
    SELECT id, tracking_id INTO v_id_item_salida, v_tracking_id
    FROM public.almacen_inventario
    WHERE id_empresa = v_id_empresa
      AND id_almacen = v_id_almacen
      AND id_producto = p_id_producto_salida
      AND COALESCE(id_ubicacion, 0) = COALESCE(p_id_ubicacion_destino, 0)
      AND COALESCE(id_presentacion_logistica, 0) = COALESCE(p_id_presentacion_logistica, 0)
      AND COALESCE(lote, '') = COALESCE(v_lote_origen, '');

    -- 5. Si no existe, crear el registro con stock cero y generar TRK
    IF v_id_item_salida IS NULL THEN
        INSERT INTO public.almacen_inventario (
            id_empresa, 
            id_almacen, 
            id_producto, 
            id_ubicacion, 
            lote, 
            fecha_vencimiento,
            cantidad_actual, 
            costo_unidad_base,
            id_presentacion_logistica,
            cantidad_presentacion,
            timestamp_create, 
            id_usuario_create
        ) VALUES (
            v_id_empresa, 
            v_id_almacen, 
            p_id_producto_salida, 
            p_id_ubicacion_destino, 
            COALESCE(v_lote_origen, 'SIN-LOTE'),
            v_fecha_vencimiento,
            0, -- Stock inicial cero
            0, -- Costo provisional cero
            p_id_presentacion_logistica,
            0, -- Empaques iniciales cero
            now(), 
            p_id_usuario
        )
        RETURNING id INTO v_id_item_salida;

        -- Generar el tracking_id
        UPDATE public.almacen_inventario 
        SET tracking_id = 'TRK-' || LPAD(id::text, 8, '0')
        WHERE id = v_id_item_salida
        RETURNING tracking_id INTO v_tracking_id;
    END IF;

    RETURN v_tracking_id;
END;
$function$;
