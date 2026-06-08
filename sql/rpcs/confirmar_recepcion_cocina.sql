-- Propósito: Confirmación de recepción en cocina y descuento de inventario del comedor
-- Última modificación: 2026-05-04

CREATE OR REPLACE FUNCTION public.confirmar_recepcion_cocina(p_id_insumo bigint, p_cantidad numeric, p_id_usuario bigint)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_id_ejecucion int8;
    v_id_comedor int8;
    v_id_rubro int8;
    v_stock_actual numeric;
BEGIN
    -- 1. Obtener datos básicos del insumo
    SELECT id_ejecucion, id_rubro 
    INTO v_id_ejecucion, v_id_rubro
    FROM public.comedor_ejecucion_insumos
    WHERE id = p_id_insumo;

    -- 2. Obtener el comedor asociado a la ejecución
    SELECT id_comedor INTO v_id_comedor
    FROM public.comedor_ejecucion_diaria
    WHERE id = v_id_ejecucion;

    -- 3. Verificar y descontar inventario del comedor
    -- (Asumimos que la tabla almacen_comedor_inventario tiene id_comedor e id_rubro)
    UPDATE public.almacen_comedor_inventario
    SET stock = stock - p_cantidad,
        timestamp_update = now(),
        id_usuario_update = p_id_usuario
    WHERE id_comedor = v_id_comedor AND id_rubro = v_id_rubro;

    -- 4. Registrar movimiento de salida
    INSERT INTO public.almacen_inventario_movimientos (
        id_comedor,
        id_rubro,
        tipo_movimiento, -- 'SALIDA_EJECUCION' o similar
        cantidad,
        id_referencia, -- id_ejecucion
        timestamp_create,
        id_usuario_create
    ) VALUES (
        v_id_comedor,
        v_id_rubro,
        'SALIDA_EJECUCION',
        p_cantidad,
        v_id_ejecucion,
        now(),
        p_id_usuario
    );

    -- 5. Actualizar el rastreo del insumo
    UPDATE public.comedor_ejecucion_insumos
    SET cantidad_recibida = p_cantidad,
        estatus_item = 'RECIBIDO_TOTAL',
        timestamp_recepcion = now(),
        id_usuario_recepcion = p_id_usuario
    WHERE id = p_id_insumo;

END;
$function$
;
