-- Función para cerrar definitivamente una ejecución diaria
-- Realiza la descarga de stock de cocina basada en la RECETA vs DISPONIBILIDAD (Lógica del Mínimo)
-- 2026-05-05: Se implementa lógica de "LEAST" para evitar saldos negativos injustos.

CREATE OR REPLACE FUNCTION public.fn_cerrar_ejecucion_diaria(
    p_id_ejecucion int8,
    p_id_usuario int8,
    p_timestamp_audit timestamptz
)
RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
    v_ejec record;
    v_ins record;
    v_saldo_actual numeric;
    v_disponible numeric;
    v_a_restar numeric;
BEGIN
    -- 1. Obtener datos de la ejecución
    SELECT id_comedor, id_empresa, id_tipo_servicio INTO v_ejec 
    FROM public.comedor_ejecucion_diaria 
    WHERE id = p_id_ejecucion;

    -- 2. Recorrer insumos calculados que no estén anulados
    FOR v_ins IN 
        SELECT 
            id_rubro, 
            cantidad_requerida,
            COALESCE(cantidad_recibida, 0) as cantidad_recibida
        FROM public.comedor_ejecucion_insumos 
        WHERE id_ejecucion = p_id_ejecucion 
        AND estatus_item <> 'ANULADO'
    LOOP
        -- A. Consultar el saldo actual en la despensa de cocina para ese rubro
        SELECT COALESCE(cantidad, 0) INTO v_saldo_actual 
        FROM public.comedor_cocina_saldos 
        WHERE id_comedor = v_ejec.id_comedor 
        AND id_rubro = v_ins.id_rubro;

        -- B. Calcular lo disponible real para este servicio (Lo que llegó hoy + lo que ya había)
        v_disponible := v_ins.cantidad_recibida + v_saldo_actual;

        -- C. LÓGICA DEL MÍNIMO: Restamos lo que pide la receta, 
        -- PERO nunca más de lo que físicamente hay disponible.
        v_a_restar := LEAST(v_ins.cantidad_requerida, v_disponible);
        
        -- D. Solo ejecutamos movimiento si hay algo que restar
        IF v_a_restar > 0 THEN
            PERFORM public.fn_actualizar_saldo_cocina(
                v_ejec.id_empresa,
                v_ejec.id_comedor,
                v_ins.id_rubro,
                -v_a_restar, -- Delta negativo para restar
                'CONSUMO',
                p_id_ejecucion,
                p_id_usuario,
                p_timestamp_audit,
                'Consumo servicio: ' || v_ejec.id_tipo_servicio || ' (Deducción ajustada a disponibilidad)'
            );
        END IF;

    END LOOP;

    -- 3. Marcar como CERRADO
    UPDATE public.comedor_ejecucion_diaria SET
        estatus = 'CERRADO',
        timestamp_update = p_timestamp_audit,
        id_usuario_update = p_id_usuario
    WHERE id = p_id_ejecucion;

END;
$function$;
