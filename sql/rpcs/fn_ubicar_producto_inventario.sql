-- Propósito: Realizar el movimiento físico de un producto (lote) a una ubicación (Rack) específica.
-- Esta función actualiza el id_ubicacion en almacen_inventario y registra el movimiento en el historial.
-- Última modificación: 2026-05-06

CREATE OR REPLACE FUNCTION public.fn_ubicar_producto_inventario(
    p_id_inventario bigint,
    p_id_ubicacion bigint,
    p_id_usuario bigint,
    p_notas text DEFAULT NULL
)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_id_empresa int8;
    v_id_almacen int8;
    v_id_producto int8;
    v_cantidad numeric;
    v_lote text;
    v_ubicacion_ant_id int8;
    v_ubicacion_ant_cod text;
    v_ubicacion_new_cod text;
    v_now timestamptz := now();
BEGIN
    -- 1. Obtener datos actuales del registro de inventario y BLOQUEAR
    SELECT id_empresa, id_almacen, id_producto, cantidad_actual, lote, id_ubicacion
    INTO v_id_empresa, v_id_almacen, v_id_producto, v_cantidad, v_lote, v_ubicacion_ant_id
    FROM public.almacen_inventario
    WHERE id = p_id_inventario
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Registro de inventario no encontrado.';
    END IF;

    -- 2. Obtener códigos de ubicación para el log
    SELECT codigo INTO v_ubicacion_ant_cod FROM public.almacen_ubicaciones WHERE id = v_ubicacion_ant_id;
    SELECT codigo INTO v_ubicacion_new_cod FROM public.almacen_ubicaciones WHERE id = p_id_ubicacion;

    -- 3. Actualizar la ubicación en el inventario
    UPDATE public.almacen_inventario SET
        id_ubicacion = p_id_ubicacion,
        id_usuario_update = p_id_usuario,
        timestamp_update = v_now
    WHERE id = p_id_inventario;

    -- 4. Registrar el movimiento en el historial
    INSERT INTO public.almacen_inventario_movimientos (
        id_empresa, 
        id_almacen, 
        id_producto, 
        tipo_movimiento, 
        cantidad, 
        lote, 
        id_referencia, 
        id_usuario_create, 
        timestamp_create,
        notas
    ) VALUES (
        v_id_empresa,
        v_id_almacen,
        v_id_producto,
        'UBICACION_RACK',
        v_cantidad,
        v_lote,
        p_id_inventario,
        p_id_usuario,
        v_now,
        COALESCE(p_notas, 'Movimiento de Ubicación: ' || COALESCE(v_ubicacion_ant_cod, 'RECEPCION') || ' -> ' || v_ubicacion_new_cod)
    );

END;
$function$;
