-- Propósito: Procesar orden de transformación, actualizar inventario, registrar Kardex y recalcular costos ponderados con soporte para variación de peso (catch weight)
-- Última modificación: 2026-05-27

CREATE OR REPLACE FUNCTION public.fn_procesar_transformacion_inventario(
    p_id_transformacion bigint,
    p_id_usuario bigint,
    p_timestamp timestamp with time zone DEFAULT now()
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
    v_ubicacion_defecto int8;
    rec_in record;
    rec_out record;
    v_id_item_salida int8;
    v_stock_anterior numeric;
    v_costo_actual numeric;
    v_stock_previo numeric;
    v_nuevo_costo_ponderado numeric;
BEGIN
    -- 1. Obtener y bloquear cabecera
    SELECT id_empresa, id_almacen, id_sucursal, estatus INTO v_id_empresa, v_id_almacen, v_id_sucursal, v_estatus
    FROM public.almacen_ordenes_transformacion
    WHERE id = p_id_transformacion
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Orden de transformación no encontrada.';
    END IF;

    IF v_estatus != 'BORRADOR' THEN
        RAISE EXCEPTION 'La orden de transformación debe estar en estatus BORRADOR para ser procesada.';
    END IF;

    -- 2. Obtener ubicación de destino por defecto (la ubicación del primer consumo si está disponible)
    SELECT id_ubicacion INTO v_ubicacion_defecto
    FROM public.almacen_orden_transformacion_entradas e
    JOIN public.almacen_inventario i ON i.id = e.id_item_inventario
    WHERE e.id_transformacion = p_id_transformacion
    LIMIT 1;

    -- 3. Procesar consumos (Entradas de la Orden)
    FOR rec_in IN 
        SELECT 
            e.id, 
            e.id_item_inventario, 
            e.cantidad_consumida, 
            e.cantidad_presentacion,
            e.id_presentacion_logistica,
            i.id_producto, 
            i.lote, 
            i.id_ubicacion, 
            i.cantidad_actual 
        FROM public.almacen_orden_transformacion_entradas e
        JOIN public.almacen_inventario i ON i.id = e.id_item_inventario
        WHERE e.id_transformacion = p_id_transformacion
    LOOP
        -- Descontar inventario (con tope en el stock disponible para evitar negativos y permitir variaciones por humedad/hielo)
        DECLARE
            v_cantidad_deducir numeric;
            v_variacion_peso numeric;
            v_nota_movimiento text;
        BEGIN
            v_cantidad_deducir := LEAST(rec_in.cantidad_actual, rec_in.cantidad_consumida);
            v_variacion_peso := rec_in.cantidad_consumida - v_cantidad_deducir;
            
            UPDATE public.almacen_inventario
            SET 
                cantidad_actual = cantidad_actual - v_cantidad_deducir,
                cantidad_presentacion = CASE 
                    WHEN cantidad_presentacion IS NOT NULL 
                    THEN GREATEST(0, cantidad_presentacion - COALESCE(rec_in.cantidad_presentacion, 0))
                    ELSE NULL 
                END,
                timestamp_update = p_timestamp,
                id_usuario_update = p_id_usuario
            WHERE id = rec_in.id_item_inventario;

            IF v_variacion_peso > 0 THEN
                v_nota_movimiento := 'Consumo en orden de despote/transformación #' || p_id_transformacion || ' (Variación ajustada: +' || v_variacion_peso || ' KG por hielo/humedad)';
            ELSIF v_variacion_peso < 0 THEN
                v_nota_movimiento := 'Consumo en orden de despote/transformación #' || p_id_transformacion || ' (Variación ajustada: ' || v_variacion_peso || ' KG por deshidratación)';
            ELSE
                v_nota_movimiento := 'Consumo en orden de despote/transformación #' || p_id_transformacion;
            END IF;

            -- Registrar Kardex (Salida de inventario) con la cantidad deducir real
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
                rec_in.id_producto, 
                'TRANSFORMACION_SALIDA', 
                v_cantidad_deducir, 
                rec_in.lote, 
                p_id_transformacion, 
                rec_in.id_presentacion_logistica,
                rec_in.cantidad_presentacion,
                p_timestamp, 
                p_id_usuario,
                v_nota_movimiento
            );
        END;
    END LOOP;

    -- 4. Procesar ingresos (Salidas de la Orden)
    FOR rec_out IN 
        SELECT id_producto, cantidad_obtenida, lote_generado, costo_unitario, es_scrap, id_ubicacion, id_presentacion_logistica, cantidad_presentacion
        FROM public.almacen_orden_transformacion_salidas
        WHERE id_transformacion = p_id_transformacion
    LOOP
        -- Buscar si ya existe lote idéntico para este producto en la ubicación específica elegida en el almacén
        SELECT id INTO v_id_item_salida
        FROM public.almacen_inventario
        WHERE id_empresa = v_id_empresa
          AND id_almacen = v_id_almacen
          AND id_producto = rec_out.id_producto
          AND COALESCE(id_ubicacion, 0) = COALESCE(rec_out.id_ubicacion, v_ubicacion_defecto)
          AND COALESCE(lote, '') = COALESCE(rec_out.lote_generado, '');

        IF v_id_item_salida IS NOT NULL THEN
            -- Actualizar stock existente
            UPDATE public.almacen_inventario
            SET 
                cantidad_actual = cantidad_actual + rec_out.cantidad_obtenida,
                id_presentacion_logistica = COALESCE(rec_out.id_presentacion_logistica, id_presentacion_logistica),
                cantidad_presentacion = COALESCE(cantidad_presentacion, 0) + COALESCE(rec_out.cantidad_presentacion, 0),
                costo_unidad_base = rec_out.costo_unitario,
                id_ubicacion = COALESCE(rec_out.id_ubicacion, id_ubicacion, v_ubicacion_defecto),
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
                cantidad_actual, 
                costo_unidad_base,
                id_presentacion_logistica,
                cantidad_presentacion,
                timestamp_create, 
                id_usuario_create
            ) VALUES (
                v_id_empresa, 
                v_id_almacen, 
                rec_out.id_producto, 
                COALESCE(rec_out.id_ubicacion, v_ubicacion_defecto), 
                rec_out.lote_generado,
                rec_out.cantidad_obtenida, 
                rec_out.costo_unitario,
                rec_out.id_presentacion_logistica,
                rec_out.cantidad_presentacion,
                p_timestamp, 
                p_id_usuario
            )
            RETURNING id INTO v_id_item_salida;
        END IF;

        -- Generar Tracking ID si no existe
        UPDATE public.almacen_inventario 
        SET tracking_id = 'TRK-' || LPAD(id::text, 8, '0')
        WHERE id = v_id_item_salida AND tracking_id IS NULL;

        -- Registrar Kardex (Entrada de inventario)
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
            rec_out.id_producto, 
            'TRANSFORMACION_ENTRADA', 
            rec_out.cantidad_obtenida, 
            rec_out.lote_generado, 
            p_id_transformacion, 
            rec_out.id_presentacion_logistica,
            rec_out.cantidad_presentacion,
            p_timestamp, 
            p_id_usuario,
            'Ingreso por orden de transformación/reenvasado #' || p_id_transformacion
        );

        -- Calcular costo ponderado si no es desecho/scrap
        IF NOT rec_out.es_scrap THEN
            -- Bloquear producto
            PERFORM 1 FROM public.almacen_productos WHERE id = rec_out.id_producto FOR UPDATE;

            -- Costo ponderado actual del producto
            SELECT COALESCE(costo_ponderado, 0) INTO v_costo_actual
            FROM public.almacen_productos
            WHERE id = rec_out.id_producto;

            -- Stock actual total del producto en la empresa
            SELECT COALESCE(SUM(cantidad_actual), 0) INTO v_stock_anterior
            FROM public.almacen_inventario 
            WHERE id_producto = rec_out.id_producto AND id_empresa = v_id_empresa;

            -- Restar la cantidad obtenida para calcular el stock que había antes
            v_stock_previo := GREATEST(0, v_stock_anterior - rec_out.cantidad_obtenida);

            -- Recalcular PMP
            IF (v_stock_anterior > 0) THEN
                v_nuevo_costo_ponderado := ROUND(
                    ((v_stock_previo * v_costo_actual) + (rec_out.cantidad_obtenida * rec_out.costo_unitario))
                    / (v_stock_previo + rec_out.cantidad_obtenida), 
                    6
                );
            ELSE
                v_nuevo_costo_ponderado := ROUND(rec_out.costo_unitario, 6);
            END IF;

            -- Actualizar maestro de productos
            UPDATE public.almacen_productos 
            SET
                ultimo_costo = CASE WHEN rec_out.cantidad_obtenida > 0 THEN rec_out.costo_unitario ELSE ultimo_costo END,
                costo_ponderado = v_nuevo_costo_ponderado,
                timestamp_update = p_timestamp,
                id_usuario_update = p_id_usuario
            WHERE id = rec_out.id_producto;

            -- Registrar historial de costos
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
                    rec_out.id_producto, 
                    v_costo_actual, 
                    v_nuevo_costo_ponderado,
                    'TRANSFORMACION', 
                    p_id_transformacion, 
                    p_timestamp, 
                    p_id_usuario
                );
            END IF;
        END IF;

    END LOOP;

    -- 5. Cambiar estatus de la orden y registrar auditoría
    UPDATE public.almacen_ordenes_transformacion
    SET 
        estatus = 'PROCESADO',
        timestamp_procesa = p_timestamp,
        id_usuario_procesa = p_id_usuario,
        timestamp_update = p_timestamp,
        id_usuario_update = p_id_usuario
    WHERE id = p_id_transformacion;

END;
$function$;
