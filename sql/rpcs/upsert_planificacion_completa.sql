-- Propósito: Upsert de planificación semanal completa (cabecera, detalle, insumos operativos y snapshot)
-- Última modificación: 2026-05-04

CREATE OR REPLACE FUNCTION public.upsert_planificacion_completa(
    p_header jsonb, 
    p_detalle jsonb, 
    p_insumos_operativos jsonb, 
    p_snapshot jsonb,
    p_id_usuario bigint,
    p_timestamp_ahora timestamp with time zone DEFAULT now()
)
 RETURNS bigint
 LANGUAGE plpgsql
 AS $function$
 DECLARE
   v_plan_id int8;
   v_is_edit boolean;
 BEGIN
   v_plan_id := (p_header->>'id')::int8;
   v_is_edit := v_plan_id IS NOT NULL;
 
   -- 1. Upsert Cabecera con auditoría externa
   IF v_is_edit THEN
     UPDATE public.planificacion_semanal SET
       id_empresa = (p_header->>'id_empresa')::int8,
       id_comedor = (p_header->>'id_comedor')::int8,
       id_servicio_config = (p_header->>'id_servicio_config')::int8,
       semana_inicio = (p_header->>'semana_inicio')::date,
       semana_fin = (p_header->>'semana_fin')::date,
       observaciones = COALESCE(p_header->>'observaciones', ''),
       estatus = p_header->>'estatus',
       id_usuario_update = p_id_usuario,
       timestamp_update = p_timestamp_ahora
     WHERE id = v_plan_id;
   ELSE
     INSERT INTO public.planificacion_semanal (
       id_empresa, id_comedor, id_servicio_config, semana_inicio, semana_fin, 
       observaciones, estatus, id_usuario_create, timestamp_create, 
       id_usuario_update, timestamp_update
     ) VALUES (
       (p_header->>'id_empresa')::int8,
       (p_header->>'id_comedor')::int8,
       (p_header->>'id_servicio_config')::int8,
       (p_header->>'semana_inicio')::date,
       (p_header->>'semana_fin')::date,
       COALESCE(p_header->>'observaciones', ''),
       p_header->>'estatus',
       p_id_usuario,
       p_timestamp_ahora,
       p_id_usuario,
       p_timestamp_ahora
     ) RETURNING id INTO v_plan_id;
   END IF;
 
   -- 2. Limpieza de detalles e insumos antiguos
   DELETE FROM public.planificacion_detalle WHERE id_planificacion = v_plan_id;
   DELETE FROM public.planificacion_insumos_operativos WHERE id_planificacion = v_plan_id;
   DELETE FROM public.planificacion_insumos WHERE id_planificacion = v_plan_id;
 
   -- 3. Insertar Detalle Menú con auditoría
   INSERT INTO public.planificacion_detalle (
     id_planificacion, fecha, id_servicio, id_estructura_slot, id_receta, 
     comensales, ajustes_ingredientes, id_usuario_create, timestamp_create,
     id_usuario_update, timestamp_update
   )
   SELECT 
     v_plan_id, 
     (d->>'fecha')::date, 
     (d->>'id_servicio')::int8, 
     (d->>'id_estructura_slot')::int8, 
     (d->>'id_receta')::int8, 
     (d->>'comensales')::int, 
     COALESCE(d->'ajustes_ingredientes', '{}'::jsonb),
     p_id_usuario,
     p_timestamp_ahora,
     p_id_usuario,
     p_timestamp_ahora
   FROM jsonb_array_elements(p_detalle) AS d;
 
   -- 4. Insertar Insumos Operativos con auditoría
   INSERT INTO public.planificacion_insumos_operativos (
     id_planificacion, id_rubro, cantidad, id_usuario_create, timestamp_create,
     id_usuario_update, timestamp_update
   )
   SELECT 
     v_plan_id, 
     (i->>'id_rubro')::int8, 
     (i->>'cantidad')::numeric,
     p_id_usuario,
     p_timestamp_ahora,
     p_id_usuario,
     p_timestamp_ahora
   FROM jsonb_array_elements(p_insumos_operativos) AS i;
 
   -- 5. Insertar Snapshot de Explosión con auditoría
   INSERT INTO public.planificacion_insumos (
     id_planificacion, fecha, id_rubro, id_receta_raiz, cantidad_neta, 
     merma_pct, id_usuario_create, timestamp_create,
     id_usuario_update, timestamp_update
   )
   SELECT 
     v_plan_id, 
     (s->>'fecha')::date, 
     (s->>'id_rubro')::int8, 
     (s->>'id_receta_raiz')::int8, 
     (s->>'cantidad_neta')::float8,
     (s->>'merma_pct')::float8,
     p_id_usuario,
     p_timestamp_ahora,
     p_id_usuario,
     p_timestamp_ahora
   FROM jsonb_array_elements(p_snapshot) AS s;
 
   RETURN v_plan_id;
 END;
 $function$;
