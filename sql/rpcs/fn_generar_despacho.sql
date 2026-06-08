-- Propósito: Generar despacho considerando factores de conversión logística, cestas retornables y empaques de peso variable
-- Última modificación: 2026-05-28 - Se agrega propagación de cestas (jsonb) y cantidad_presentacion desde picking a despacho

CREATE OR REPLACE FUNCTION public.fn_generar_despacho(
    p_id_empresa bigint,
    p_id_sucursal bigint,
    p_id_comedor bigint,
    p_id_almacen_origen bigint,
    p_transporte jsonb,
    p_items jsonb,
    p_cestas jsonb,
    p_id_usuario bigint,
    p_timestamp_ahora timestamp with time zone
)
 RETURNS jsonb
 LANGUAGE plpgsql
 AS $function$
 DECLARE
     v_despacho_id int8;
     v_item jsonb;
     v_picking_detalle RECORD;
     v_stock numeric;
     v_cant_enviada numeric;
     v_cant_base numeric;
     v_cant_pres numeric;
 BEGIN
     -- A. Crear Cabecera de Despacho
     --    Las cestas del picking se heredan como cestas_enviadas; retornadas empieza vacío
     INSERT INTO public.almacen_despacho (
         id_empresa, id_sucursal, id_comedor, id_almacen_origen,
         transporte_chofer, transporte_dni, transporte_letradni,
         transporte_vehiculo, transporte_placa, transporte_precinto,
         cestas_enviadas, cestas_retornadas,
         estatus, timestamp_create, id_usuario_create, timestamp_procesa, id_usuario_procesa
     ) VALUES (
         p_id_empresa, p_id_sucursal, p_id_comedor, p_id_almacen_origen,
         p_transporte->>'chofer',
         p_transporte->>'dni',
         (p_transporte->>'letradni')::int8,
         (p_transporte->>'vehiculo')::int8,
         p_transporte->>'placa',
         p_transporte->>'precinto',
         COALESCE(p_cestas, '[]'::jsonb), '[]'::jsonb,
         'EN TRÁNSITO', p_timestamp_ahora, p_id_usuario, p_timestamp_ahora, p_id_usuario
     ) RETURNING id INTO v_despacho_id;

     -- B. Procesar Ítems
     FOR v_item IN SELECT jsonb_array_elements(p_items) LOOP

         v_cant_enviada := (v_item->>'cantidad_enviada')::numeric;

         -- Obtener detalle del picking original (usando el factor registrado en el picking)
         SELECT d.* INTO v_picking_detalle
         FROM public.almacen_picking_detalle d
         WHERE d.id = (v_item->>'id_picking_detalle')::int8;

         IF NOT FOUND THEN CONTINUE; END IF;

         -- Cantidad real en unidades base
         v_cant_base := v_cant_enviada * v_picking_detalle.factor;

         -- Empaques físicos (aplica solo a peso variable; si no viene en el ítem, hereda del picking_detalle)
         v_cant_pres := COALESCE(
             (v_item->>'cantidad_presentacion')::numeric,
             v_picking_detalle.cantidad_presentacion
         );

         -- 1. Validar Stock en Almacén Principal (Unidades Base)
         SELECT cantidad_actual INTO v_stock
         FROM public.almacen_inventario
         WHERE id_almacen = p_id_almacen_origen
           AND id_producto = v_picking_detalle.id_producto
           AND lote IS NOT DISTINCT FROM v_picking_detalle.lote;

         IF v_stock IS NULL OR v_stock < v_cant_base THEN
             RAISE EXCEPTION 'Stock insuficiente para producto % lote % (Disponible: %, Requerido: %)',
                 v_picking_detalle.id_producto, v_picking_detalle.lote, COALESCE(v_stock, 0), v_cant_base;
         END IF;

         -- 2. Restar de Inventario Principal (Unidades Base y Empaques)
         UPDATE public.almacen_inventario
         SET cantidad_actual = cantidad_actual - v_cant_base,
             cantidad_presentacion = COALESCE(cantidad_presentacion, 0) - COALESCE(v_cant_pres, 0),
             timestamp_update = p_timestamp_ahora,
             id_usuario_update = p_id_usuario
         WHERE id_almacen = p_id_almacen_origen
           AND id_producto = v_picking_detalle.id_producto
           AND lote IS NOT DISTINCT FROM v_picking_detalle.lote;

         -- 3. Crear Detalle de Despacho (propagando cantidad_presentacion)
         INSERT INTO public.almacen_despacho_detalle (
             id_despacho, id_picking_detalle, cantidad_enviada, cantidad_presentacion,
             timestamp_create, id_usuario_create
         ) VALUES (
             v_despacho_id, v_picking_detalle.id, v_cant_enviada, v_cant_pres,
             p_timestamp_ahora, p_id_usuario
         );

         -- 4. Registrar Movimiento (Auditoría en unidades base)
         INSERT INTO public.almacen_inventario_movimientos (
             id_empresa, id_almacen, id_producto, tipo_movimiento, cantidad, lote, id_referencia, timestamp_create, id_usuario_create
         ) VALUES (
             p_id_empresa, p_id_almacen_origen, v_picking_detalle.id_producto, 'DESPACHO_SALIDA', -v_cant_base, v_picking_detalle.lote, v_despacho_id, p_timestamp_ahora, p_id_usuario
         );

         -- 5. Actualizar status del picking original a PROCESADO
         UPDATE public.almacen_picking
         SET estatus = 'PROCESADO',
             timestamp_update = p_timestamp_ahora,
             id_usuario_update = p_id_usuario
         WHERE id = v_picking_detalle.id_picking;

         -- 6. ACTUALIZACIÓN DE LA REQUISICIÓN (Vínculo Crítico - Ya usa base units)
         IF v_picking_detalle.id_requisicion_detalle IS NOT NULL THEN
             UPDATE public.almacen_requisiciones_detalle
             SET cantidad_despachada = COALESCE(cantidad_despachada, 0) + v_cant_base,
                 estatus_item = CASE
                     WHEN (COALESCE(cantidad_despachada, 0) + v_cant_base) >= cantidad_solicitada THEN 'PROCESADO'
                     ELSE 'PARCIAL'
                 END,
                 timestamp_update = p_timestamp_ahora,
                 id_usuario_update = p_id_usuario
             WHERE id = v_picking_detalle.id_requisicion_detalle;
         END IF;

     END LOOP;

     RETURN jsonb_build_object('success', true, 'id_despacho', v_despacho_id);

 EXCEPTION WHEN OTHERS THEN
     RETURN jsonb_build_object('success', false, 'message', SQLERRM);
 END;
 $function$;
