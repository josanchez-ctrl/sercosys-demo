-- Propósito: Procesar cotejo, valorizar inventario y calcular PMP con soporte para 'Playa de Recepción' (WMS)
-- Última modificación: 2026-05-06

CREATE OR REPLACE FUNCTION public.procesar_cotejo(
    p_id_cotejo bigint, 
    p_id_usuario bigint, 
    p_timestamp_audit timestamp with time zone DEFAULT now()
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_id_empresa int8;
    v_id_almacen int8;
    v_id_ubicacion_playa int8;
    rec record;
    v_stock_anterior numeric;
    v_costo_actual numeric;
    v_nuevo_costo_ponderado numeric;
    v_cantidad_base numeric;
    v_id_item_inventario int8;
BEGIN
    -- 1. Obtener cabecera y BLOQUEARLA
    SELECT id_empresa, id_almacen INTO v_id_empresa, v_id_almacen
    FROM public.almacen_cotejo 
    WHERE id = p_id_cotejo AND estatus = 'PENDIENTE'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cotejo no encontrado, ya fue procesado o no está pendiente.';
    END IF;

    -- 2. Asegurar existencia de ubicación "PLAYA" para este almacén
    SELECT id INTO v_id_ubicacion_playa 
    FROM public.almacen_ubicaciones 
    WHERE id_almacen = v_id_almacen AND (codigo = 'PLAYA' OR nombre ILIKE '%PLAYA%')
    LIMIT 1;

    IF v_id_ubicacion_playa IS NULL THEN
        INSERT INTO public.almacen_ubicaciones (
            id_almacen, codigo, nombre, estatus, timestamp_create, id_usuario_create
        ) VALUES (
            v_id_almacen, 'PLAYA', 'PLAYA DE RECEPCIÓN', true, p_timestamp_audit, p_id_usuario
        ) RETURNING id INTO v_id_ubicacion_playa;
    END IF;

    -- 3. Recorrer detalles del cotejo
    FOR rec IN SELECT * FROM public.almacen_cotejo_detalle WHERE id_cotejo = p_id_cotejo LOOP
        
        -- A. Cantidad convertida a base
        v_cantidad_base := rec.cantidad * rec.factor;

        -- B. BLOQUEO DE PRODUCTO
        PERFORM 1 FROM public.almacen_productos WHERE id = rec.id_producto FOR UPDATE;

        -- C. Validar integridad del costo base
        IF rec.costo_unitario_base IS NULL OR rec.costo_unitario_base < 0 THEN
            RAISE EXCEPTION 'Error de Integridad: El producto (ID: %) no tiene un costo base válido.', rec.id_producto;
        END IF;

        -- D. Calcular Stock Anterior Total del Producto en la Empresa
        SELECT COALESCE(SUM(cantidad_actual), 0) INTO v_stock_anterior
        FROM public.almacen_inventario 
        WHERE id_producto = rec.id_producto AND id_empresa = v_id_empresa;

        -- E. Obtener Costo Ponderado Actual (Siempre en $)
        SELECT COALESCE(costo_ponderado, 0) INTO v_costo_actual 
        FROM public.almacen_productos WHERE id = rec.id_producto;

        -- F. Lógica de PMP (EN $)
        IF (v_cantidad_base > 0) THEN
            IF (v_stock_anterior + v_cantidad_base) > 0 THEN
                v_nuevo_costo_ponderado := ROUND(((v_stock_anterior * v_costo_actual) + (v_cantidad_base * rec.costo_unitario_base)) / (v_stock_anterior + v_cantidad_base), 6);
            ELSE
                v_nuevo_costo_ponderado := ROUND(rec.costo_unitario_base, 6);
            END IF;
        ELSE
            v_nuevo_costo_ponderado := v_costo_actual;
        END IF;

        -- G. Actualizar/Insertar en Inventario (VALORIZADO EN $)
        -- ASIGNAMOS LA UBICACIÓN DE PLAYA POR DEFECTO
        INSERT INTO public.almacen_inventario (
            id_empresa, id_almacen, id_producto, id_ubicacion, lote, fecha_vencimiento, 
            cantidad_actual, costo_unidad_base, id_cotejo_detalle,
            id_presentacion_logistica, cantidad_presentacion,
            timestamp_create, id_usuario_create
        ) VALUES (
            v_id_empresa, COALESCE(rec.id_almacen, v_id_almacen), rec.id_producto, v_id_ubicacion_playa, rec.lote, rec.fecha_vencimiento,
            v_cantidad_base, rec.costo_unitario_base, rec.id,
            rec.id_presentacion_logistica, rec.cantidad,
            p_timestamp_audit, p_id_usuario
        )
        ON CONFLICT (id_cotejo_detalle) 
        DO UPDATE SET 
            id_ubicacion = EXCLUDED.id_ubicacion,
            cantidad_actual = EXCLUDED.cantidad_actual,
            costo_unidad_base = EXCLUDED.costo_unidad_base,
            id_presentacion_logistica = EXCLUDED.id_presentacion_logistica,
            cantidad_presentacion = EXCLUDED.cantidad_presentacion,
            timestamp_update = p_timestamp_audit,
            id_usuario_update = p_id_usuario
        RETURNING id INTO v_id_item_inventario;

        -- G2. Generar Tracking ID (Etiqueta Sercosys)
        UPDATE public.almacen_inventario 
        SET tracking_id = 'TRK-' || LPAD(id::text, 8, '0')
        WHERE id = v_id_item_inventario AND tracking_id IS NULL;

        -- K. CREAR TAREA DE UBICACIÓN (PUTAWAY) - Estándar SAP EWM
        INSERT INTO public.almacen_tareas (
            id_empresa, id_almacen, tipo_tarea, id_item_inventario, 
            id_ubicacion_origen, cantidad, estatus, timestamp_create, id_usuario_create
        ) VALUES (
            v_id_empresa, v_id_almacen, 'PUTAWAY', v_id_item_inventario,
            v_id_ubicacion_playa, v_cantidad_base, 'PENDIENTE', p_timestamp_audit, p_id_usuario
        );

        -- H. Actualizar Producto con nuevos costos (EN $)
        UPDATE public.almacen_productos SET
            ultimo_costo = CASE WHEN v_cantidad_base > 0 THEN rec.costo_unitario_base ELSE ultimo_costo END,
            costo_ponderado = v_nuevo_costo_ponderado,
            timestamp_update = p_timestamp_audit,
            id_usuario_update = p_id_usuario
        WHERE id = rec.id_producto;

        -- I. Registrar Historial de Costos
        IF v_costo_actual != v_nuevo_costo_ponderado THEN
            INSERT INTO public.almacen_productos_costos_historial (
                id_empresa, id_producto, costo_anterior, costo_nuevo, 
                tipo_movimiento, id_referencia, timestamp_create, id_usuario_create
            ) VALUES (
                v_id_empresa, rec.id_producto, v_costo_actual, v_nuevo_costo_ponderado,
                'COTEJO', p_id_cotejo, p_timestamp_audit, p_id_usuario
            );
        END IF;

        -- J. Registrar Movimiento de Inventario para Trazabilidad
        INSERT INTO public.almacen_inventario_movimientos (
            id_empresa, id_almacen, id_producto, tipo_movimiento, cantidad, 
            lote, id_referencia, timestamp_create, id_usuario_create, notas
        ) VALUES (
            v_id_empresa, COALESCE(rec.id_almacen, v_id_almacen), rec.id_producto, 'COTEJO_PROCESADO', v_cantidad_base,
            rec.lote, p_id_cotejo, p_timestamp_audit, p_id_usuario, 
            'Entrada inicial a PLAYA DE RECEPCIÓN (Cotejo #' || p_id_cotejo || ')'
        );

    END LOOP;

    -- 4. Finalizar Cotejo y marcar auditoría
    UPDATE public.almacen_cotejo SET
        estatus = 'PROCESADO',
        timestamp_procesa = p_timestamp_audit,
        id_usuario_procesa = p_id_usuario,
        timestamp_update = p_timestamp_audit,
        id_usuario_update = p_id_usuario
    WHERE id = p_id_cotejo;

    -- K. Marcar detalles como procesados
    UPDATE public.almacen_cotejo_detalle SET
        timestamp_procesa = p_timestamp_audit,
        id_usuario_procesa = p_id_usuario
    WHERE id_cotejo = p_id_cotejo;

END;
$function$;
