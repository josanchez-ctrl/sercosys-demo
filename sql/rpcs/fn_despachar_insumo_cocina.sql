-- Propósito: Despacho de insumos desde inventario de comedor hacia saldos de cocina
-- Genera una remisión (comedor_despacho_ejecucion) para ser recibida en cocina.
-- Última modificación: 2026-05-14

CREATE OR REPLACE FUNCTION public.fn_despachar_insumo_cocina(
    p_id_insumo_ejecucion bigint,
    p_id_comedor bigint,
    p_id_rubro bigint,
    p_detalles_lotes jsonb, -- [{id_inventario, cantidad_presentacion, factor, id_producto}]
    p_id_usuario bigint,
    p_volumen_total_base numeric, -- Suma de cantidad * factor
    p_timestamp_ahora timestamp with time zone
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_lote jsonb;
    v_inv RECORD;
    v_id_despacho bigint;
    v_id_ejecucion bigint;
BEGIN
    -- 1. Validar existencia del insumo y obtener ID de ejecución
    SELECT id_ejecucion INTO v_id_ejecucion FROM public.comedor_ejecucion_insumos WHERE id = p_id_insumo_ejecucion;
    
    IF v_id_ejecucion IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Ítem de ejecución no encontrado');
    END IF;

    -- 2. Crear Cabecera de Despacho (Remisión)
    -- Si ya existe un despacho 'PENDIENTE' para esta ejecución y este usuario hoy, podríamos reusarlo, 
    -- pero lo estándar en logística es generar una remisión por cada acción de "Registrar Entrega".
    INSERT INTO public.comedor_despacho_ejecucion (
        id_ejecucion,
        estatus,
        timestamp_despacho,
        id_usuario_despacho,
        timestamp_create,
        id_usuario_create
    ) VALUES (
        v_id_ejecucion,
        'PENDIENTE',
        p_timestamp_ahora,
        p_id_usuario,
        p_timestamp_ahora,
        p_id_usuario
    ) RETURNING id INTO v_id_despacho;

    -- 3. Procesar cada lote
    FOR v_lote IN SELECT jsonb_array_elements(p_detalles_lotes) LOOP
        
        -- Obtener datos del inventario
        SELECT * INTO v_inv FROM public.almacen_comedor_inventario WHERE id = (v_lote->>'id_inventario')::int8;
        
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Lote de inventario % no encontrado', v_lote->>'id_inventario';
        END IF;

        IF v_inv.cantidad_actual < (v_lote->>'cantidad_presentacion')::numeric THEN
            RAISE EXCEPTION 'Stock insuficiente en lote %. Disponible: %, Requerido: %', v_inv.lote, v_inv.cantidad_actual, v_lote->>'cantidad_presentacion';
        END IF;

        -- A. Descontar del Inventario de Comedor (En presentaciones físicas convertidas a volumen base)
        UPDATE public.almacen_comedor_inventario
        SET cantidad_actual = cantidad_actual - ((v_lote->>'cantidad_presentacion')::numeric * (v_lote->>'factor')::numeric),
            timestamp_update = p_timestamp_ahora,
            id_usuario_update = p_id_usuario
        WHERE id = v_inv.id;

        INSERT INTO public.comedor_despacho_ejecucion_detalle (
            id_despacho,
            id_insumo,
            id_producto,
            id_presentacion_logistica,
            lote,
            cantidad_entregada,
            fecha_vencimiento,
            timestamp_create,
            id_usuario_create
        ) VALUES (
            v_id_despacho,
            p_id_insumo_ejecucion,
            v_inv.id_producto,
            v_inv.id_presentacion_logistica,
            v_inv.lote,
            (v_lote->>'cantidad_presentacion')::numeric,
            v_inv.fecha_vencimiento,
            p_timestamp_ahora,
            p_id_usuario
        );

        -- C. Registrar Movimiento (Kardex) - Siempre en unidades base para reportes unificados
        INSERT INTO public.almacen_inventario_movimientos (
            id_empresa, id_comedor, id_producto, tipo_movimiento, cantidad, lote, id_referencia, timestamp_create, id_usuario_create
        ) VALUES (
            v_inv.id_empresa, p_id_comedor, v_inv.id_producto, 'DESPACHO_A_COCINA', 
            ((v_lote->>'cantidad_presentacion')::numeric * (v_lote->>'factor')::numeric), 
            v_inv.lote, v_id_despacho, p_timestamp_ahora, p_id_usuario
        );

    END LOOP;

    -- 4. Actualizar el ítem de la ejecución (Acumulado de despacho)
    UPDATE public.comedor_ejecucion_insumos
    SET cantidad_despachada = COALESCE(cantidad_despachada, 0) + p_volumen_total_base,
        estatus_item = 'DESPACHANDO',
        timestamp_despacho = p_timestamp_ahora,
        id_usuario_despacho = p_id_usuario,
        timestamp_update = p_timestamp_ahora,
        id_usuario_update = p_id_usuario
    WHERE id = p_id_insumo_ejecucion;

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Despacho registrado correctamente. Remisión #' || v_id_despacho,
        'id_despacho', v_id_despacho
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$function$;
