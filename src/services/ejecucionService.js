import { supabase } from '../lib/supabase';
import { Now } from './nowService';

/**
 * SERVICIO DE EJECUCIÓN DIARIA Y PLANIFICACIÓN
 * Maneja el registro de menú diario, comensales y cálculo de insumos.
 */

// Obtiene ejecuciones por comedor y rango de fechas
export const getEjecucionesByComedor = async (id_comedor, dateStart, dateEnd) => {
    let query = supabase
        .from('comedor_ejecucion_diaria')
        .select(`
            *,
            servicio:id_tipo_servicio(nombre),
            recetas:comedor_ejecucion_detalle(
                id,
                id_estructura_slot,
                id_receta,
                comensales,
                slot:id_estructura_slot(id, nombre),
                receta_info:id_receta(*, tipologia_receta:id_tipologia(*))
            ),
            usuario_create:usuarios!id_usuario_create(id, nombres, apellidos),
            usuario_update:usuarios!id_usuario_update(id, nombres, apellidos),
            usuario_procesa:usuarios!id_usuario_procesa(id, nombres, apellidos),
            usuario_anula:usuarios!id_usuario_anula(id, nombres, apellidos)
        `);

    if (dateEnd) {
        query = query
            .eq('id_comedor', id_comedor)
            .gte('fecha_ejecucion', dateStart)
            .lte('fecha_ejecucion', dateEnd);
    } else {
        query = query
            .eq('id_comedor', id_comedor)
            .eq('fecha_ejecucion', dateStart);
    }

    const { data, error } = await query.order('fecha_ejecucion', { ascending: false });
    if (error) throw error;
    return data;
};

// Obtiene la planificación base programada
export const getPlanificacionBase = async (id_comedor, fecha, id_tipo_servicio) => {
    // 1. Buscar la planificación semanal que cubra la fecha
    const { data: plan, error: planError } = await supabase
        .from('planificacion_semanal')
        .select('id')
        .eq('id_comedor', id_comedor)
        .eq('estatus', 'APROBADO')
        .lte('semana_inicio', fecha)
        .gte('semana_fin', fecha)
        .single();

    if (planError) return [];

    // 2. Traer el detalle para el servicio y fecha específicos
    const { data, error } = await supabase
        .from('planificacion_detalle')
        .select('id_receta, id_estructura_slot, comensales')
        .eq('id_planificacion', plan.id)
        .eq('fecha', fecha)
        .eq('id_servicio', id_tipo_servicio);

    if (error) throw error;

    return data;
};

// Guarda la ejecución diaria de forma atómica vía RPC (Cabecera, Detalle y Explosión de Insumos)
export const saveEjecucionDiaria = async (payload) => {
    const { cabecera, detalle, id_usuario } = payload;
    const now = await Now();

    // 1. Preparar Cabecera
    const header = {
        id: cabecera.id || null,
        id_empresa: cabecera.id_empresa,
        id_comedor: cabecera.id_comedor,
        fecha_ejecucion: cabecera.fecha_ejecucion,
        id_tipo_servicio: cabecera.id_tipo_servicio,
        estatus: cabecera.estatus || 'BORRADOR',
        observaciones: cabecera.observaciones || '',
        comensales_reales: cabecera.comensales_reales || 0
    };

    // 2. Ejecutar RPC Atómico
    const { data: id_ejecucion, error: rpcError } = await supabase.rpc('upsert_ejecucion_diaria', {
        p_header: header,
        p_detalle: detalle.map(d => ({
            id_receta: d.id_receta,
            id_estructura_slot: d.id_estructura_slot,
            comensales: d.comensales
        })),
        p_id_usuario: id_usuario,
        p_timestamp_ahora: now
    });

    if (rpcError) throw rpcError;
    return id_ejecucion;
};

// Obtiene los datos consolidados de insumos (KPIs y Tabla de Despacho)
export const getEjecucionInsumosConsolidado = async (id_ejecucion) => {
    const { data, error } = await supabase
        .from('comedor_ejecucion_insumos')
        .select(`
            *,
            rubro:id_rubro (
                id, 
                nombre, 
                tipo_fraccionamiento,
                unidad:id_unidad_medida (abreviatura),
                categoria:id_categoria (
                    nombre,
                    id_almacen,
                    almacenes:id_almacen (nombre)
                ),
                mermas:almacen_rubros_merma (valor)
            ),
            ejecucion:id_ejecucion (id_comedor)
        `)
        .eq('id_ejecucion', id_ejecucion)
        .order('id', { ascending: true });

    if (error) throw error;
    return data;
};

// Obtiene detalles de insumos y sus lotes asignados
export const getInsumosEjecucion = async (id_ejecucion) => {
    const { data, error } = await supabase
        .from('comedor_ejecucion_insumos')
        .select(`
            *,
            rubro:id_rubro (id, nombre, unidad:id_unidad_medida (abreviatura)),
            lotes_asignados:comedor_ejecucion_insumos_lotes (
                id,
                cantidad,
                inventario:id_inventario (
                    id,
                    lote,
                    fecha_vencimiento,
                    producto:id_producto (
                        nombre,
                        marca:id_marca (nombre)
                    )
                )
            )
        `)
        .eq('id_ejecucion', id_ejecucion)
        .order('id', { ascending: true });

    if (error) throw error;
    return data;
};

// Eventos manuales (Mermas, etc.)
export const registrarEventoInsumo = async (id_insumo, tipo, cantidad, id_usuario, timestamp) => {
    const { data, error } = await supabase.rpc('registrar_evento_insumo', {
        p_id_insumo: id_insumo,
        p_tipo: tipo,
        p_cantidad: cantidad,
        p_id_usuario: id_usuario,
        p_timestamp: timestamp
    });

    if (error) throw error;
    return data;
};

export const getSaldoCocina = async (id_comedor, id_rubro) => {
    const { data, error } = await supabase
        .from('comedor_cocina_saldos')
        .select('cantidad')
        .eq('id_comedor', id_comedor)
        .eq('id_rubro', id_rubro)
        .is('id_producto', null)
        .maybeSingle();

    if (error) throw error;
    return Number(data?.cantidad || 0);
};

// Obtiene ejecuciones diarias con sus detalles para la gestión de despacho
export const getEjecucionesDespacho = async (id_comedor, dateStart, dateEnd) => {
    const { data, error } = await supabase
        .from('comedor_ejecucion_diaria')
        .select(`
            *,
            servicio:id_tipo_servicio(id, nombre),
            recetas:comedor_ejecucion_detalle(
                id,
                id_estructura_slot,
                id_receta,
                comensales,
                slot:id_estructura_slot(id, nombre),
                receta_info:id_receta(id, nombre)
            ),
            usuario_create:usuarios!id_usuario_create(id, nombres, apellidos),
            usuario_procesa:usuarios!id_usuario_procesa(id, nombres, apellidos),
            usuario_anula:usuarios!id_usuario_anula(id, nombres, apellidos)
        `)
        .eq('id_comedor', id_comedor)
        .gte('timestamp_create', dateStart)
        .lte('timestamp_create', dateEnd)
        .order('fecha_ejecucion', { ascending: true });

    if (error) throw error;
    return data;
};

// Finaliza el despacho de una ejecución completa y anula rubros omitidos
export const finalizarDespachoCabecera = async (id_ejecucion, id_usuario, timestamp) => {
    const { data, error } = await supabase.rpc('fn_finalizar_despacho_ejecucion', {
        p_id_ejecucion: id_ejecucion,
        p_id_usuario: id_usuario,
        p_timestamp_audit: timestamp
    });

    if (error) throw error;
    return data;
};

// Cierra definitivamente una ejecución diaria y descarga el stock de cocina
export const cerrarEjecucion = async (id_ejecucion, id_usuario) => {
    const now = await Now();
    const { data, error } = await supabase.rpc('fn_cerrar_ejecucion_diaria', {
        p_id_ejecucion: id_ejecucion,
        p_id_usuario: id_usuario,
        p_timestamp_audit: now
    });

    if (error) throw error;
    return data;
};
