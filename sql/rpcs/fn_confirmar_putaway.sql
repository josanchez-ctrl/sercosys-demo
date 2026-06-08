-- Propósito: Confirmar tarea de ubicación (Put-Away), mover inventario y cerrar tarea atómicamente
-- Última modificación: 2026-05-10

CREATE OR REPLACE FUNCTION public.fn_confirmar_putaway(
    p_id_tarea bigint,
    p_id_ubicacion_destino bigint,
    p_id_usuario bigint,
    p_timestamp_audit timestamp with time zone DEFAULT now()
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_id_item_inventario bigint;
    v_id_empresa bigint;
    v_id_almacen bigint;
    v_id_producto bigint;
    v_cantidad numeric;
    v_lote text;
BEGIN
    -- 1. Obtener y bloquear la tarea
    SELECT id_item_inventario, id_empresa, id_almacen, cantidad
    INTO v_id_item_inventario, v_id_empresa, v_id_almacen, v_cantidad
    FROM public.almacen_tareas
    WHERE id = p_id_tarea
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Tarea no encontrada.';
    END IF;

    -- Validar estatus actual
    IF (SELECT estatus FROM public.almacen_tareas WHERE id = p_id_tarea) != 'PENDIENTE' THEN
        RAISE EXCEPTION 'La tarea ya no está pendiente.';
    END IF;

    -- 2. Obtener datos del inventario para el movimiento
    SELECT id_producto, lote INTO v_id_producto, v_lote
    FROM public.almacen_inventario
    WHERE id = v_id_item_inventario;

    -- 3. Actualizar Ubicación en Inventario
    UPDATE public.almacen_inventario SET
        id_ubicacion = p_id_ubicacion_destino,
        timestamp_update = p_timestamp_audit,
        id_usuario_update = p_id_usuario
    WHERE id = v_id_item_inventario;

    -- 4. Cerrar Tarea
    UPDATE public.almacen_tareas SET
        id_ubicacion_destino = p_id_ubicacion_destino,
        estatus = 'CONFIRMADA',
        timestamp_confirm = p_timestamp_audit,
        id_usuario_confirm = p_id_usuario
    WHERE id = p_id_tarea;

    -- 5. Registrar Movimiento para Trazabilidad
    INSERT INTO public.almacen_inventario_movimientos (
        id_empresa, id_almacen, id_producto, tipo_movimiento, cantidad, 
        lote, id_referencia, timestamp_create, id_usuario_create, notas
    ) VALUES (
        v_id_empresa, v_id_almacen, v_id_producto, 'PUTAWAY_CONFIRMADO', v_cantidad,
        v_lote, p_id_tarea, p_timestamp_audit, p_id_usuario,
        'Movimiento de Put-Away confirmado (Tarea #' || p_id_tarea || ')'
    );

END;
$function$;
