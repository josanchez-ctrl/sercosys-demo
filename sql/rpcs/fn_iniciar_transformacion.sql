-- Propósito: Iniciar proceso de transformación, descontar insumos de los racks y establecer saldo pendiente en mesa
-- Con soporte para control de unidades (UND) y variación de peso (catch weight) por hielo/humedad
-- Última modificación: 2026-05-27

CREATE OR REPLACE FUNCTION public.fn_iniciar_transformacion(
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
BEGIN
    -- 1. Obtener y bloquear cabecera de la orden
    SELECT id_empresa, id_almacen, id_sucursal, estatus INTO v_id_empresa, v_id_almacen, v_id_sucursal, v_estatus
    FROM public.almacen_ordenes_transformacion
    WHERE id = p_id_transformacion
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Orden de transformación no encontrada.';
    END IF;

    IF v_estatus != 'BORRADOR' THEN
        RAISE EXCEPTION 'La orden debe estar en estatus BORRADOR para poder iniciarse.';
    END IF;

    -- 2. Validar que la orden tenga al menos un insumo
    IF NOT EXISTS (
        SELECT 1 FROM public.almacen_orden_transformacion_entradas 
        WHERE id_transformacion = p_id_transformacion
    ) THEN
        RAISE EXCEPTION 'La orden no tiene ningún insumo o materia prima agregada.';
    END IF;

    -- 3. Procesar consumos (Entradas de la Orden)
    FOR rec_in IN 
        SELECT 
            e.id, 
            e.id_item_inventario, 
            e.cantidad_consumida, 
            e.cantidad_presentacion,
            e.id_presentacion_logistica,
            e.cantidad_mesa,
            i.id_producto, 
            i.lote, 
            i.cantidad_actual 
        FROM public.almacen_orden_transformacion_entradas e
        JOIN public.almacen_inventario i ON i.id = e.id_item_inventario
        WHERE e.id_transformacion = p_id_transformacion
    LOOP
        DECLARE
            v_factor numeric := 1.0;
            v_teorico_consumo numeric;
            v_cantidad_deducir numeric;
            v_nota_movimiento text;
        BEGIN
            -- Obtener factor de la presentación seleccionada (por ejemplo, factor = 2.1 para UNIDAD de pollo)
            IF rec_in.id_presentacion_logistica IS NOT NULL THEN
                SELECT COALESCE(factor, 1.0) INTO v_factor 
                FROM public.almacen_productos_codigos 
                WHERE id = rec_in.id_presentacion_logistica;
            END IF;

            -- Calcular el consumo teórico (unidades * factor)
            IF rec_in.cantidad_presentacion IS NOT NULL THEN
                v_teorico_consumo := rec_in.cantidad_presentacion * v_factor;
            ELSE
                v_teorico_consumo := rec_in.cantidad_consumida;
            END IF;

            -- Limitar el descuento al stock disponible del lote físico
            v_teorico_consumo := COALESCE(v_teorico_consumo, rec_in.cantidad_consumida);
            v_cantidad_deducir := LEAST(rec_in.cantidad_actual, v_teorico_consumo);

            -- Descontar del rack físico el peso teórico deducido (evita saldos negativos)
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

            -- Registrar en la mesa de trabajo (cantidad_pendiente) el peso real recibido en báscula (neto reposo)
            UPDATE public.almacen_orden_transformacion_entradas
            SET cantidad_pendiente = COALESCE(rec_in.cantidad_mesa, rec_in.cantidad_consumida)
            WHERE id = rec_in.id;

            -- Crear nota explicativa si hubo variación por congelación/hielo
            IF rec_in.cantidad_consumida > v_cantidad_deducir THEN
                v_nota_movimiento := 'Insumo trasladado a mesa de trabajo para orden #' || p_id_transformacion || 
                                     ' (Variación de peso registrada: +' || (rec_in.cantidad_consumida - v_cantidad_deducir) || ' KG)';
            ELSE
                v_nota_movimiento := 'Insumo trasladado a mesa de trabajo para orden #' || p_id_transformacion;
            END IF;

            -- Registrar Kardex (Salida de inventario) con la cantidad de stock físico descontado
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

    -- 4. Actualizar estatus de la cabecera a EN_PROCESO
    UPDATE public.almacen_ordenes_transformacion
    SET 
        estatus = 'EN_PROCESO',
        timestamp_update = p_timestamp,
        id_usuario_update = p_id_usuario
    WHERE id = p_id_transformacion;

END;
$function$;
