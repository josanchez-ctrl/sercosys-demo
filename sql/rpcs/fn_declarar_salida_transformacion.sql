-- Propósito: Declarar una salida parcial (fraccionada) de reenvasado, heredar lote, generar tracking_id y actualizar saldos en mesa
-- Última modificación: 2026-05-28

CREATE OR REPLACE FUNCTION public.fn_declarar_salida_transformacion(
    p_id_transformacion bigint,
    p_id_entrada_transformacion bigint,
    p_id_producto_salida bigint,
    p_cantidad_obtenida numeric,
    p_unidad_medida text,
    p_cantidad_insumo_descontar numeric,
    p_id_ubicacion_destino bigint,
    p_costo_unitario_salida numeric,
    p_id_usuario bigint,
    p_timestamp timestamp with time zone DEFAULT now(),
    p_id_presentacion_logistica bigint DEFAULT NULL,
    p_cantidad_presentacion numeric DEFAULT NULL
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_id_empresa int8;
    v_id_almacen int8;
    v_id_sucursal int8;
    v_estatus text;
    v_cantidad_pendiente numeric;
    v_lote_origen text;
    v_fecha_vencimiento date;
    v_id_item_inventario_orig int8;
    v_id_item_salida int8;
    v_stock_anterior numeric;
    v_costo_actual numeric;
    v_stock_previo numeric;
    v_nuevo_costo_ponderado numeric;
BEGIN
    -- 1. Obtener y bloquear cabecera de la orden
    SELECT id_empresa, id_almacen, id_sucursal, estatus INTO v_id_empresa, v_id_almacen, v_id_sucursal, v_estatus
    FROM public.almacen_ordenes_transformacion
    WHERE id = p_id_transformacion
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Orden de transformación no encontrada.';
    END IF;

    IF v_estatus != 'EN_PROCESO' THEN
        RAISE EXCEPTION 'La orden debe estar en estatus EN_PROCESO para poder declarar salidas parciales.';
    END IF;

    -- 2. Obtener y validar el insumo en mesa (entrada)
    SELECT cantidad_pendiente, id_item_inventario INTO v_cantidad_pendiente, v_id_item_inventario_orig
    FROM public.almacen_orden_transformacion_entradas
    WHERE id = p_id_entrada_transformacion AND id_transformacion = p_id_transformacion
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El insumo especificado no pertenece a esta orden.';
    END IF;

    IF v_cantidad_pendiente < p_cantidad_insumo_descontar THEN
        RAISE EXCEPTION 'Cantidad insuficiente en mesa. Pendiente: %, Solicitado descontar: %',
            v_cantidad_pendiente, p_cantidad_insumo_descontar;
    END IF;

    -- 3. Obtener lote y vencimiento del item original para heredar
    SELECT lote, fecha_vencimiento INTO v_lote_origen, v_fecha_vencimiento
    FROM public.almacen_inventario
    WHERE id = v_id_item_inventario_orig;

    -- 4. Descontar del saldo pendiente en mesa
    UPDATE public.almacen_orden_transformacion_entradas
    SET cantidad_pendiente = cantidad_pendiente - p_cantidad_insumo_descontar
    WHERE id = p_id_entrada_transformacion;

    -- 5. Registrar salida obtenida en el detalle
    INSERT INTO public.almacen_orden_transformacion_salidas (
        id_transformacion,
        id_producto,
        cantidad_obtenida,
        unidad_medida,
        lote_generado,
        costo_unitario,
        es_scrap,
        id_ubicacion,
        id_entrada_transformacion,
        id_presentacion_logistica,
        cantidad_presentacion,
        timestamp_create,
        id_usuario_create
    ) VALUES (
        p_id_transformacion,
        p_id_producto_salida,
        p_cantidad_obtenida,
        p_unidad_medida,
        COALESCE(v_lote_origen, 'SIN-LOTE'),
        p_costo_unitario_salida,
        false,
        p_id_ubicacion_destino,
        p_id_entrada_transformacion,
        p_id_presentacion_logistica,
        p_cantidad_presentacion,
        p_timestamp,
        p_id_usuario
    );

    -- 6. Agregar stock al inventario en la ubicación destino
    SELECT id INTO v_id_item_salida
    FROM public.almacen_inventario
    WHERE id_empresa = v_id_empresa
      AND id_almacen = v_id_almacen
      AND id_producto = p_id_producto_salida
      AND COALESCE(id_ubicacion, 0) = COALESCE(p_id_ubicacion_destino, 0)
      AND COALESCE(lote, '') = COALESCE(v_lote_origen, '');

    IF v_id_item_salida IS NOT NULL THEN
        -- Actualizar stock existente
        UPDATE public.almacen_inventario
        SET 
            cantidad_actual = cantidad_actual + p_cantidad_obtenida,
            id_presentacion_logistica = COALESCE(p_id_presentacion_logistica, id_presentacion_logistica),
            cantidad_presentacion = COALESCE(cantidad_presentacion, 0) + COALESCE(p_cantidad_presentacion, 0),
            costo_unidad_base = p_costo_unitario_salida,
            fecha_vencimiento = COALESCE(fecha_vencimiento, v_fecha_vencimiento),
            timestamp_update = p_timestamp,
            id_usuario_update = p_id_usuario
        WHERE id = v_id_item_salida;
    ELSE
        -- Crear nuevo registro de stock
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
            p_cantidad_obtenida, 
            p_costo_unitario_salida,
            p_id_presentacion_logistica,
            p_cantidad_presentacion,
            p_timestamp, 
            p_id_usuario
        )
        RETURNING id INTO v_id_item_salida;
    END IF;

    -- Generar Tracking ID único para este nuevo stock
    UPDATE public.almacen_inventario 
    SET tracking_id = 'TRK-' || LPAD(id::text, 8, '0')
    WHERE id = v_id_item_salida AND tracking_id IS NULL;

    -- 7. Registrar Kardex (Entrada de inventario)
    INSERT INTO public.almacen_inventario_movimientos (
        id_empresa, 
        id_almacen, 
        id_producto, 
        tipo_movimiento, 
        cantidad, 
        lote, 
        id_referencia, 
        id_presentacion_logistica,
        cantidad_presentacion,
        timestamp_create, 
        id_usuario_create, 
        notas
    ) VALUES (
        v_id_empresa, 
        v_id_almacen, 
        p_id_producto_salida, 
        'TRANSFORMACION_ENTRADA', 
        p_cantidad_obtenida, 
        COALESCE(v_lote_origen, 'SIN-LOTE'), 
        p_id_transformacion, 
        p_id_presentacion_logistica,
        p_cantidad_presentacion,
        p_timestamp, 
        p_id_usuario,
        'Fraccionamiento parcial obtenido en orden #' || p_id_transformacion
    );

    -- 8. Recalcular costo ponderado (PMP) del producto de salida
    -- Bloquear maestro
    PERFORM 1 FROM public.almacen_productos WHERE id = p_id_producto_salida FOR UPDATE;

    -- Costo ponderado actual
    SELECT COALESCE(costo_ponderado, 0) INTO v_costo_actual
    FROM public.almacen_productos
    WHERE id = p_id_producto_salida;

    -- Stock actual total del producto en la empresa
    SELECT COALESCE(SUM(cantidad_actual), 0) INTO v_stock_anterior
    FROM public.almacen_inventario 
    WHERE id_producto = p_id_producto_salida AND id_empresa = v_id_empresa;

    v_stock_previo := GREATEST(0, v_stock_anterior - p_cantidad_obtenida);

    IF (v_stock_anterior > 0) THEN
        v_nuevo_costo_ponderado := ROUND(
            ((v_stock_previo * v_costo_actual) + (p_cantidad_obtenida * p_costo_unitario_salida))
            / (v_stock_previo + p_cantidad_obtenida), 
            6
        );
    ELSE
        v_nuevo_costo_ponderado := ROUND(p_costo_unitario_salida, 6);
    END IF;

    -- Actualizar maestro de productos
    UPDATE public.almacen_productos 
    SET
        ultimo_costo = CASE WHEN p_cantidad_obtenida > 0 THEN p_costo_unitario_salida ELSE ultimo_costo END,
        costo_ponderado = v_nuevo_costo_ponderado,
        timestamp_update = p_timestamp,
        id_usuario_update = p_id_usuario
    WHERE id = p_id_producto_salida;

    -- Registrar historial de costos si varió
    IF v_costo_actual != v_nuevo_costo_ponderado THEN
        INSERT INTO public.almacen_productos_costos_historial (
            id_empresa, 
            id_producto, 
            costo_anterior, 
            costo_nuevo, 
            tipo_movimiento, 
            id_referencia, 
            timestamp_create, 
            id_usuario_create
        ) VALUES (
            v_id_empresa, 
            p_id_producto_salida, 
            v_costo_actual, 
            v_nuevo_costo_ponderado,
            'TRANSFORMACION', 
            p_id_transformacion, 
            p_timestamp, 
            p_id_usuario
        );
    END IF;

END;
$function$;
