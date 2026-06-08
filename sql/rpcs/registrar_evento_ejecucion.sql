-- Propósito: Registro de eventos (movimientos) en la ejecución diaria (Despacho, Recepción, Anulación)
-- Última modificación: 2026-05-04

CREATE OR REPLACE FUNCTION public.registrar_evento_ejecucion(p_id_insumo bigint, p_tipo text, p_cantidad numeric, p_id_usuario bigint)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_id_ejecucion int8;
    v_id_comedor int8;
    v_id_rubro int8;
    v_id_sucursal int8;
    v_id_empresa int8;
BEGIN
    -- 1. Obtener datos de la demanda y contexto
    SELECT id_ejecucion, id_rubro 
    INTO v_id_ejecucion, v_id_rubro
    FROM public.comedor_ejecucion_insumos
    WHERE id = p_id_insumo;

    SELECT id_comedor, id_empresa INTO v_id_comedor, v_id_empresa
    FROM public.comedor_ejecucion_diaria
    WHERE id = v_id_ejecucion;

    -- 2. Registrar el movimiento en el log (Trazabilidad)
    INSERT INTO public.comedor_ejecucion_movimientos (
        id_insumo, id_ejecucion, tipo, cantidad, id_usuario_create
    ) VALUES (
        p_id_insumo, v_id_ejecucion, p_tipo, p_cantidad, p_id_usuario
    );

    -- 3. Caso ANULACIÓN: Limpiamos cantidades y marcamos como anulado
    IF p_tipo = 'ANULACION' THEN
        UPDATE public.comedor_ejecucion_insumos
        SET estatus_item = 'ANULADO',
            cantidad_despachada = 0,
            cantidad_recibida = 0,
            timestamp_despacho = NULL,
            id_usuario_despacho = NULL
        WHERE id = p_id_insumo;
        
        RETURN; -- Terminamos aquí para anulación
    END IF;

    -- 4. Caso DESPACHO: Actualizamos la demanda
    IF p_tipo = 'DESPACHO' THEN
        UPDATE public.comedor_ejecucion_insumos
        SET estatus_item = 'DESPACHADO_TOTAL',
            cantidad_despachada = p_cantidad,
            timestamp_despacho = now(),
            id_usuario_despacho = p_id_usuario
        WHERE id = p_id_insumo;
    END IF;

    -- 5. Caso RECEPCIÓN: Actualizamos demanda y disparamos lógica de inventario
    IF p_tipo = 'RECEPCION' THEN
        UPDATE public.comedor_ejecucion_insumos
        SET estatus_item = 'RECIBIDO_TOTAL',
            cantidad_recibida = p_cantidad,
            timestamp_recepcion = now(),
            id_usuario_recepcion = p_id_usuario
        WHERE id = p_id_insumo;

        -- Nota: El descuento de inventario por Lote/Marca se implementará con la lógica de Picking
        -- Por ahora, aseguramos que el estatus cambie correctamente.
    END IF;

END;
$function$
;
