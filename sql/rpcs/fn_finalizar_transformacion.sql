-- Propósito: Finalizar proceso de transformación, liquidar saldos remanentes en mesa como merma (scrap), prorratear costos de insumos entre salidas no-scrap y cerrar la orden
-- Última modificación: 2026-06-02 - Soporte para costo proporcional al peso en cortes/deshuese (costo heredado)

CREATE OR REPLACE FUNCTION public.fn_finalizar_transformacion(
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
    rec_in record;
    rec_out_prod record;
    v_lote_origen text;
    v_id_producto_insumo int8;
    v_unidad_medida_insumo text;
    v_costo_total_insumo numeric;
    v_peso_total_destino numeric;
    v_peso_total_comercial numeric;
    v_porcentaje_costo numeric;
    v_porcentaje_corte numeric;
    v_costo_asignado_destino numeric;
    v_costo_unitario_calculado numeric;
    v_costo_actual_pmp numeric;
    v_stock_total_empresa numeric;
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
        RAISE EXCEPTION 'La orden debe estar en estatus EN_PROCESO para poder finalizarse.';
    END IF;

    -- 2. Liquidar saldos pendientes (remanentes) de los insumos en mesa
    FOR rec_in IN 
        SELECT 
            e.id, 
            e.cantidad_pendiente, 
            e.unidad_medida,
            i.id_producto,
            i.lote
        FROM public.almacen_orden_transformacion_entradas e
        JOIN public.almacen_inventario i ON i.id = e.id_item_inventario
        WHERE e.id_transformacion = p_id_transformacion AND e.cantidad_pendiente > 0
    LOOP
        -- Registrar la merma en el detalle de salidas
        INSERT INTO public.almacen_orden_transformacion_salidas (
            id_transformacion,
            id_producto,
            cantidad_obtenida,
            unidad_medida,
            lote_generado,
            costo_unitario,
            es_scrap,
            id_entrada_transformacion,
            timestamp_create,
            id_usuario_create
        ) VALUES (
            p_id_transformacion,
            rec_in.id_producto,
            rec_in.cantidad_pendiente,
            rec_in.unidad_medida,
            COALESCE(rec_in.lote, 'SIN-LOTE'),
            0, -- El scrap tiene un costo asignado de $0
            true, -- Marcado como scrap
            rec_in.id,
            p_timestamp,
            p_id_usuario
        );

        -- Establecer el saldo pendiente en la mesa a 0
        UPDATE public.almacen_orden_transformacion_entradas
        SET cantidad_pendiente = 0
        WHERE id = rec_in.id;
    END LOOP;

    -- 3. Recalcular y distribuir costos reales entre las salidas (excluyendo scrap)
    FOR rec_in IN 
        SELECT 
            e.id AS id_entrada,
            e.cantidad_consumida,
            e.costo_unitario AS costo_unitario_insumo,
            i.id_producto AS id_producto_insumo,
            i.lote AS lote_insumo,
            r.porcentaje_costo_indirecto,
            p.costo_proporcional_peso
        FROM public.almacen_orden_transformacion_entradas e
        JOIN public.almacen_inventario i ON i.id = e.id_item_inventario
        JOIN public.almacen_productos p ON p.id = i.id_producto
        JOIN public.almacen_rubros r ON r.id = p.id_rubro
        WHERE e.id_transformacion = p_id_transformacion
    LOOP
        -- Costo total del insumo (con recargo indirecto)
        v_costo_total_insumo := (rec_in.cantidad_consumida * rec_in.costo_unitario_insumo) * (1 + COALESCE(rec_in.porcentaje_costo_indirecto, 0) / 100);

        -- Si el prorrateo es proporcional al peso, calculamos el peso comercial total acumulado
        IF rec_in.costo_proporcional_peso THEN
            SELECT COALESCE(SUM(s.cantidad_obtenida), 0) INTO v_peso_total_comercial
            FROM public.almacen_orden_transformacion_salidas s
            LEFT JOIN public.almacen_productos_derivados d 
              ON d.id_producto_origen = rec_in.id_producto_insumo 
             AND d.id_producto_destino = s.id_producto
            WHERE s.id_transformacion = p_id_transformacion
              AND s.id_entrada_transformacion = rec_in.id_entrada
              AND s.es_scrap = false
              AND COALESCE(d.porcentaje_costo, 100.00) > 0;
        END IF;

        -- Recorrer los productos destino que se obtuvieron de este insumo específico
        FOR rec_out_prod IN 
            SELECT DISTINCT id_producto
            FROM public.almacen_orden_transformacion_salidas
            WHERE id_transformacion = p_id_transformacion 
              AND id_entrada_transformacion = rec_in.id_entrada
              AND es_scrap = false
        LOOP
            -- Obtener el peso total obtenido de este producto
            SELECT COALESCE(SUM(cantidad_obtenida), 0) INTO v_peso_total_destino
            FROM public.almacen_orden_transformacion_salidas
            WHERE id_transformacion = p_id_transformacion
              AND id_entrada_transformacion = rec_in.id_entrada
              AND id_producto = rec_out_prod.id_producto
              AND es_scrap = false;

            IF v_peso_total_destino > 0 THEN
                -- Obtener el porcentaje de costo configurado para la relación
                SELECT porcentaje_costo, porcentaje_corte INTO v_porcentaje_costo, v_porcentaje_corte
                FROM public.almacen_productos_derivados
                WHERE id_producto_origen = rec_in.id_producto_insumo
                  AND id_producto_destino = rec_out_prod.id_producto;

                -- Si no está configurado (ej: absorciones de cascada), verificar si es desperdicio (0%)
                -- para algún otro insumo activo en esta orden de transformación
                IF v_porcentaje_costo IS NULL THEN
                    SELECT COALESCE(MIN(porcentaje_costo), 100.00), COALESCE(MIN(porcentaje_corte), 100.00)
                    INTO v_porcentaje_costo, v_porcentaje_corte
                    FROM public.almacen_productos_derivados
                    WHERE id_producto_destino = rec_out_prod.id_producto
                      AND id_producto_origen IN (
                          SELECT i.id_producto
                          FROM public.almacen_orden_transformacion_entradas e
                          JOIN public.almacen_inventario i ON i.id = e.id_item_inventario
                          WHERE e.id_transformacion = p_id_transformacion
                      );
                END IF;

                -- Calcular costo unitario según el tipo de prorrateo
                IF rec_in.costo_proporcional_peso THEN
                    IF v_porcentaje_costo = 0 THEN
                        -- Es desperdicio físico (grasa, huesos a costo $0.00)
                        v_costo_unitario_calculado := 0;
                    ELSE
                        -- Es corte comercial heredable
                        IF v_peso_total_comercial > 0 THEN
                            v_costo_unitario_calculado := ROUND(v_costo_total_insumo / v_peso_total_comercial, 6);
                        ELSE
                            v_costo_unitario_calculado := 0;
                        END IF;
                    END IF;
                ELSE
                    -- Prorrateo estático por plantilla ("Torta") - Ahora basado en rendimiento estándar esperado (Opción B)
                    IF COALESCE(v_porcentaje_corte, 0) > 0 THEN
                        -- Costo unitario esperado = costo_unitario_insumo_con_indirectos * (porcentaje_costo / porcentaje_corte)
                        v_costo_unitario_calculado := ROUND(
                            (rec_in.costo_unitario_insumo * (1 + COALESCE(rec_in.porcentaje_costo_indirecto, 0) / 100)) * (v_porcentaje_costo / v_porcentaje_corte),
                            6
                        );
                    ELSE
                        -- Fallback si no hay porcentaje de corte definido
                        v_costo_asignado_destino := v_costo_total_insumo * (v_porcentaje_costo / 100);
                        v_costo_unitario_calculado := ROUND(v_costo_asignado_destino / v_peso_total_destino, 6);
                    END IF;
                END IF;

                -- A. Actualizar el costo unitario en el detalle de salidas
                UPDATE public.almacen_orden_transformacion_salidas
                SET costo_unitario = v_costo_unitario_calculado
                WHERE id_transformacion = p_id_transformacion
                  AND id_entrada_transformacion = rec_in.id_entrada
                  AND id_producto = rec_out_prod.id_producto
                  AND es_scrap = false;

                -- B. Actualizar el costo de unidad base en el inventario físico correspondiente (usando promedio ponderado del lote)
                UPDATE public.almacen_inventario inv
                SET costo_unidad_base = COALESCE(
                        (
                            SELECT SUM(s.cantidad_obtenida * s.costo_unitario) / NULLIF(SUM(s.cantidad_obtenida), 0)
                            FROM public.almacen_orden_transformacion_salidas s
                            WHERE s.id_producto = inv.id_producto
                              AND s.lote_generado = inv.lote
                              AND COALESCE(s.id_ubicacion, 0) = COALESCE(inv.id_ubicacion, 0)
                              AND s.es_scrap = false
                        ),
                        v_costo_unitario_calculado
                    ),
                    timestamp_update = p_timestamp,
                    id_usuario_update = p_id_usuario
                WHERE inv.id_producto = rec_out_prod.id_producto
                  AND inv.id_almacen = v_id_almacen
                  AND inv.lote IS NOT DISTINCT FROM rec_in.lote_insumo
                  AND inv.id_ubicacion IN (
                      SELECT id_ubicacion 
                      FROM public.almacen_orden_transformacion_salidas
                      WHERE id_transformacion = p_id_transformacion
                        AND id_entrada_transformacion = rec_in.id_entrada
                        AND id_producto = rec_out_prod.id_producto
                        AND es_scrap = false
                  );

                -- C. Recalcular el PMP (Costo Ponderado) del producto de salida en la empresa
                -- Bloquear producto
                PERFORM 1 FROM public.almacen_productos WHERE id = rec_out_prod.id_producto FOR UPDATE;

                -- Costo ponderado actual
                SELECT COALESCE(costo_ponderado, 0) INTO v_costo_actual_pmp
                FROM public.almacen_productos
                WHERE id = rec_out_prod.id_producto;

                -- Calcular el nuevo costo ponderado con los costos actualizados
                SELECT COALESCE(
                    SUM(cantidad_actual * costo_unidad_base) / NULLIF(SUM(cantidad_actual), 0),
                    v_costo_actual_pmp
                ) INTO v_nuevo_costo_ponderado
                FROM public.almacen_inventario
                WHERE id_producto = rec_out_prod.id_producto AND id_empresa = v_id_empresa AND cantidad_actual > 0;

                v_nuevo_costo_ponderado := ROUND(COALESCE(v_nuevo_costo_ponderado, v_costo_actual_pmp), 6);

                -- Actualizar maestro de productos
                UPDATE public.almacen_productos 
                SET
                    ultimo_costo = CASE WHEN v_peso_total_destino > 0 THEN v_costo_unitario_calculado ELSE ultimo_costo END,
                    costo_ponderado = v_nuevo_costo_ponderado,
                    timestamp_update = p_timestamp,
                    id_usuario_update = p_id_usuario
                WHERE id = rec_out_prod.id_producto;

                -- Registrar historial de costos si varió
                IF v_costo_actual_pmp != v_nuevo_costo_ponderado THEN
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
                        rec_out_prod.id_producto, 
                        v_costo_actual_pmp, 
                        v_nuevo_costo_ponderado,
                        'TRANSFORMACION', 
                        p_id_transformacion, 
                        p_timestamp, 
                        p_id_usuario
                    );
                END IF;
            END IF;
        END LOOP;
    END LOOP;

    -- 4. Actualizar estatus de la cabecera a PROCESADO
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
