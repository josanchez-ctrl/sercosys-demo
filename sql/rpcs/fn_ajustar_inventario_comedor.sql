-- Propósito: Ajustar cantidad de inventario en COMEDOR y registrar movimiento
-- Última modificación: 2026-05-14

CREATE OR REPLACE FUNCTION public.fn_ajustar_inventario_comedor(p_id_inventario bigint, p_nueva_cantidad numeric, p_motivo text, p_id_usuario bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_now timestamptz := now();
    v_inv RECORD;
    v_diferencia numeric;
    v_tipo_movimiento text;
BEGIN
    -- 1. Obtener y bloquear registro
    SELECT * INTO v_inv 
    FROM public.almacen_comedor_inventario 
    WHERE id = p_id_inventario 
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Lote de inventario de comedor no encontrado');
    END IF;

    -- 2. Calcular diferencia
    v_diferencia := p_nueva_cantidad - v_inv.cantidad_actual;

    IF v_diferencia = 0 THEN
        RETURN jsonb_build_object('success', true, 'message', 'La cantidad es igual a la actual, sin cambios.');
    END IF;

    -- 3. Actualizar Inventario
    UPDATE public.almacen_comedor_inventario
    SET cantidad_actual = p_nueva_cantidad,
        timestamp_update = v_now,
        id_usuario_update = p_id_usuario
    WHERE id = p_id_inventario;

    -- 4. Registrar Movimiento en Kardex
    IF v_diferencia > 0 THEN
        v_tipo_movimiento := 'AJUSTE_ENTRADA_COMEDOR';
    ELSE
        v_tipo_movimiento := 'AJUSTE_SALIDA_COMEDOR';
    END IF;

    INSERT INTO public.almacen_inventario_movimientos (
        id_empresa, id_comedor, id_producto, tipo_movimiento, cantidad, lote, id_referencia, timestamp_create, id_usuario_create, notas
    ) VALUES (
        v_inv.id_empresa, v_inv.id_comedor, v_inv.id_producto, v_tipo_movimiento, v_diferencia, v_inv.lote, NULL, v_now, p_id_usuario, p_motivo
    );

    RETURN jsonb_build_object('success', true, 'message', 'Inventario de comedor ajustado correctamente.');

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$function$
;
