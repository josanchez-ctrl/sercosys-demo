-- Propósito: Aprobar planificación y generar requisición automática de insumos (Alimentos + Operativos)
-- Última modificación: 2026-05-05

CREATE OR REPLACE FUNCTION public.fn_aprobar_planificacion(
    p_id_planificacion bigint, 
    p_id_usuario bigint, 
    p_timestamp_audit timestamp with time zone DEFAULT now()
)
 RETURNS bigint
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_plan RECORD;
    v_id_requisicion int8;
    v_id_sucursal int8;
BEGIN
    -- 1. Obtener datos de la planificación y sucursal
    SELECT p.*, c.id_sucursal INTO v_plan
    FROM public.planificacion_semanal p
    JOIN public.comedores c ON c.id = p.id_comedor
    WHERE p.id = p_id_planificacion;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Planificación no encontrada.';
    END IF;

    IF v_plan.estatus = 'APROBADO' THEN
        RAISE EXCEPTION 'Esta planificación ya ha sido aprobada previamente.';
    END IF;

    -- 2. Crear Cabecera de Requisición
    INSERT INTO public.almacen_requisiciones (
        id_empresa, id_sucursal, id_comedor, id_planificacion, 
        estatus, tipo, timestamp_create, id_usuario_create, fecha_solicitud
    ) VALUES (
        v_plan.id_empresa, v_plan.id_sucursal, v_plan.id_comedor, p_id_planificacion,
        'PENDIENTE', 'AUTOMATICA', p_timestamp_audit, p_id_usuario, p_timestamp_audit::date
    ) RETURNING id INTO v_id_requisicion;

    -- 3. Insertar Detalles Consolidados (Alimentos desde Snapshot)
    -- Aplicamos la fórmula de merma: cantidad / (1 - (merma/100))
    -- Usamos CEIL para redondear hacia arriba (mejor que sobre a que falte en cocina)
    INSERT INTO public.almacen_requisiciones_detalle (
        id_requisicion, id_rubro, cantidad_solicitada, timestamp_create, id_usuario_create
    )
    SELECT 
        v_id_requisicion,
        id_rubro,
        CEIL(SUM(cantidad_neta / (1 - (COALESCE(merma_pct, 0) / 100)))),
        p_timestamp_audit,
        p_id_usuario
    FROM public.planificacion_insumos
    WHERE id_planificacion = p_id_planificacion
    GROUP BY id_rubro;

    -- 4. Insertar Detalles de Insumos Operativos
    INSERT INTO public.almacen_requisiciones_detalle (
        id_requisicion, id_rubro, cantidad_solicitada, timestamp_create, id_usuario_create
    )
    SELECT 
        v_id_requisicion,
        id_rubro,
        cantidad,
        p_timestamp_audit,
        p_id_usuario
    FROM public.planificacion_insumos_operativos
    WHERE id_planificacion = p_id_planificacion;

    -- 5. Actualizar Estatus de Planificación
    UPDATE public.planificacion_semanal SET
        estatus = 'APROBADO',
        timestamp_procesa = p_timestamp_audit,
        id_usuario_procesa = p_id_usuario,
        timestamp_update = p_timestamp_audit,
        id_usuario_update = p_id_usuario
    WHERE id = p_id_planificacion;

    RETURN v_id_requisicion;

END;
$function$;
