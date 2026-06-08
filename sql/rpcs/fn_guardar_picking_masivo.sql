-- Propósito: Guardar picking masivo desde mesa de trabajo
-- Última modificación: 2026-05-20 (Eliminada fecha_picking por redundancia con timestamp_create)

CREATE OR REPLACE FUNCTION public.fn_guardar_picking_masivo(p_id_empresa bigint, p_id_almacen bigint, p_id_usuario bigint, p_pickings jsonb, p_timestamp_ahora timestamp with time zone DEFAULT now())
 RETURNS jsonb
 LANGUAGE plpgsql
 AS $function$
DECLARE
    v_picking_row jsonb;
    v_item_row jsonb;
    v_picking_id int8;
    v_req_id int8;
    v_ids_generados int8[] := '{}';
    v_estatus text;
BEGIN
    FOR v_picking_row IN SELECT * FROM jsonb_array_elements(p_pickings) LOOP
        
        -- Obtener estatus del JSON o por defecto PENDIENTE
        v_estatus := COALESCE(v_picking_row->>'estatus', 'PENDIENTE');

        -- A. Insertar Cabecera de Picking
        INSERT INTO public.almacen_picking (
            id_empresa, id_almacen, id_sucursal, id_comedor, 
            id_requisicion, 
            estatus, observaciones,
            timestamp_create, id_usuario_create
        ) VALUES (
            p_id_empresa,
            p_id_almacen,
            (v_picking_row->>'id_sucursal')::int8,
            (v_picking_row->>'id_comedor')::int8,
            (v_picking_row->'ids_requisiciones'), 
            v_estatus,
            COALESCE(v_picking_row->>'observaciones', 'Generado desde Mesa de Trabajo'),
            p_timestamp_ahora,
            p_id_usuario
        ) RETURNING id INTO v_picking_id;

        v_ids_generados := array_append(v_ids_generados, v_picking_id);

        -- B. Insertar Detalles con Trazabilidad Logística
        FOR v_item_row IN SELECT * FROM jsonb_array_elements(v_picking_row->'items') LOOP
            INSERT INTO public.almacen_picking_detalle (
                id_picking, id_producto, cantidad, lote, fecha_vencimiento, 
                id_requisicion_detalle,
                id_presentacion_logistica, factor,
                costo_unidad_base,
                timestamp_create, id_usuario_create
            ) VALUES (
                v_picking_id,
                (v_item_row->>'id_producto')::int8,
                (v_item_row->>'cantidad')::numeric,
                v_item_row->>'lote',
                (v_item_row->>'fecha_vencimiento')::date,
                (v_item_row->>'id_requisicion_detalle')::int8,
                (v_item_row->>'id_presentacion_logistica')::int8,
                COALESCE((v_item_row->>'factor')::numeric, 1),
                COALESCE((v_item_row->>'costo_unidad_base')::numeric, 0),
                p_timestamp_ahora,
                p_id_usuario
            );
        END LOOP;

        -- C. Marcar todas las REQs involucradas (Solo si NO es borrador)
        IF v_estatus <> 'BORRADOR' THEN
            FOR v_req_id IN SELECT jsonb_array_elements_text(v_picking_row->'ids_requisiciones')::int8 LOOP
                UPDATE public.almacen_requisiciones_detalle 
                SET estatus_item = 'PICKING' 
                WHERE id_requisicion = v_req_id AND estatus_item = 'PENDIENTE';
                
                UPDATE public.almacen_requisiciones 
                SET estatus = 'PICKING' 
                WHERE id = v_req_id AND estatus = 'PENDIENTE';
            END LOOP;
        END IF;

    END LOOP;

    RETURN jsonb_build_object('success', true, 'pickings', v_ids_generados);
END;
$function$
;
