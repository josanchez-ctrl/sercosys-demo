-- Propósito: Upsert de ejecución diaria (Versión Consolidada con Explosión Automática y Auditoría Total)
-- Última modificación: 2026-05-04

CREATE OR REPLACE FUNCTION public.upsert_ejecucion_diaria(
    p_header jsonb, 
    p_detalle jsonb, 
    p_id_usuario bigint,
    p_timestamp_ahora timestamp with time zone DEFAULT now()
)
 RETURNS bigint
 LANGUAGE plpgsql
 AS $function$
 DECLARE
   v_id_ejecucion int8;
   v_id_detalle int8;
   v_receta record;
 BEGIN
   -- 1. Upsert de Cabecera
   IF (p_header->>'id') IS NOT NULL AND (p_header->>'id') <> '' THEN
     v_id_ejecucion := (p_header->>'id')::int8;
     UPDATE public.comedor_ejecucion_diaria
     SET 
       id_tipo_servicio = (p_header->>'id_tipo_servicio')::int8,
       estatus = (p_header->>'estatus'),
       observaciones = (p_header->>'observaciones'),
       comensales_reales = COALESCE((p_header->>'comensales_reales')::int4, 0),
       timestamp_update = p_timestamp_ahora,
       id_usuario_update = p_id_usuario
     WHERE id = v_id_ejecucion;
   ELSE
     INSERT INTO public.comedor_ejecucion_diaria (
       id_empresa, id_comedor, fecha_ejecucion, id_tipo_servicio, estatus, observaciones, comensales_reales,
       timestamp_create, id_usuario_create, timestamp_update, id_usuario_update
     ) VALUES (
       (p_header->>'id_empresa')::int8,
       (p_header->>'id_comedor')::int8,
       (p_header->>'fecha_ejecucion')::date,
       (p_header->>'id_tipo_servicio')::int8,
       (p_header->>'estatus'),
       (p_header->>'observaciones'),
       COALESCE((p_header->>'comensales_reales')::int4, 0),
       p_timestamp_ahora, p_id_usuario, p_timestamp_ahora, p_id_usuario
     ) RETURNING id INTO v_id_ejecucion;
   END IF;
 
   -- 2. Limpieza de Detalle e Insumos antiguos
   DELETE FROM public.comedor_ejecucion_insumos WHERE id_ejecucion = v_id_ejecucion;
   DELETE FROM public.comedor_ejecucion_detalle WHERE id_ejecucion = v_id_ejecucion;
 
   -- 3. Inserción de Detalle (Recetas) y Explosión de Insumos
   FOR v_receta IN SELECT * FROM jsonb_to_recordset(p_detalle) AS x(id_receta int8, id_estructura_slot int8, comensales int4)
   LOOP
     IF v_receta.id_receta IS NOT NULL THEN
       -- Insertar detalle de receta con auditoría
       INSERT INTO public.comedor_ejecucion_detalle (
         id_ejecucion, id_receta, id_estructura_slot, comensales, 
         timestamp_create, id_usuario_create, timestamp_update, id_usuario_update
       )
       VALUES (
         v_id_ejecucion, v_receta.id_receta, v_receta.id_estructura_slot, v_receta.comensales,
         p_timestamp_ahora, p_id_usuario, p_timestamp_ahora, p_id_usuario
       )
       RETURNING id INTO v_id_detalle;
 
       -- Explosión de insumos con auditoría
       INSERT INTO public.comedor_ejecucion_insumos (
         id_ejecucion, id_rubro, cantidad_requerida, id_unidad_medida, id_ejecucion_receta,
         timestamp_create, id_usuario_create, timestamp_update, id_usuario_update
       )
       SELECT 
         v_id_ejecucion,
         ri.id_rubro,
         (ri.cantidad * COALESCE(v_receta.comensales, 0)) as cantidad_total,
         r.id_unidad_medida,
         v_id_detalle,
         p_timestamp_ahora, p_id_usuario, p_timestamp_ahora, p_id_usuario
       FROM public.maestro_receta_ingredientes ri
       JOIN public.almacen_rubros r ON r.id = ri.id_rubro
       WHERE ri.id_receta_padre = v_receta.id_receta;
     END IF;
   END LOOP;
 
   RETURN v_id_ejecucion;
 END;
 $function$;
