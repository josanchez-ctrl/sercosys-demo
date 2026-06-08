import { supabase } from '../lib/supabase';
import { Now } from './nowService';

/**
 * SERVICIO DE DESPACHOS COMEDOR (COMEDOR -> COCINA)
 * Maneja la salida de inventario operativo hacia las cocinas.
 */

// RPC para despachar insumos con lotes (CREA LA REMISIÓN)
export const despacharInsumoConLotes = async (id_insumo, id_comedor, id_rubro, lotes, id_usuario, volumenTotalBase, timestamp) => {
    const { data, error } = await supabase.rpc('fn_despachar_insumo_cocina', {
        p_id_insumo_ejecucion: id_insumo,
        p_id_comedor: id_comedor,
        p_id_rubro: id_rubro,
        p_detalles_lotes: lotes, // [{id_inventario, cantidad_presentacion, factor}]
        p_id_usuario: id_usuario,
        p_volumen_total_base: volumenTotalBase,
        p_timestamp_ahora: timestamp
    });

    if (error) throw error;
    return data;
};

// Finaliza el despacho de un rubro específico (Usa RPC inteligente)
export const finalizarDespachoInsumo = async (id_insumo, id_usuario, timestamp) => {
    const { data, error } = await supabase.rpc('fn_finalizar_despacho_insumo', {
        p_id_insumo_ejecucion: id_insumo,
        p_id_usuario: id_usuario,
        p_timestamp: timestamp
    });

    if (error) throw error;
    return data;
};

// Anula un insumo de la ejecución con auditoría estándar
export const anularInsumoEjecucion = async (id_insumo, motivo, id_usuario) => {
    const now = await Now();
    const { data, error } = await supabase.rpc('anular_insumo_ejecucion', {
        p_id_insumo: id_insumo,
        p_motivo: motivo,
        p_id_usuario: id_usuario,
        p_timestamp_ahora: now
    });

    if (error) throw error;
    return data;
};

// Carga los productos de categoría DESECHABLE disponibles en el inventario del comedor
export const getDesechablesParaDespachoManual = async (id_empresa, id_sucursal, id_comedor) => {
    const { data, error } = await supabase
        .from('almacen_comedor_inventario')
        .select(`
            id,
            cantidad_actual,
            lote,
            producto:id_producto (
                id,
                variedad,
                marca:id_marca(nombre),
                rubro:id_rubro (
                    id,
                    nombre,
                    categoria:id_categoria (id, nombre)
                )
            )
        `)
        .eq('id_empresa', id_empresa)
        .eq('id_sucursal', id_sucursal)
        .eq('id_comedor', id_comedor)
        .eq('is_bloqueado', false)
        .gt('cantidad_actual', 0)
        .order('id', { ascending: true });

    if (error) throw error;

    return (data || []).filter(
        item => {
            const catNombre = item.producto?.rubro?.categoria?.nombre?.toUpperCase() || '';
            return catNombre.startsWith('DESECHABLE');
        }
    );
};

// Registra el despacho manual de desechables hacia cocina vía RPC atómica
export const despacharDesechablesManual = async (
    id_empresa, id_sucursal, id_comedor, id_ejecucion, observaciones, detalles, id_usuario
) => {
    const now = await Now();

    // Generar correlativo informativo
    const { count, error: errCount } = await supabase
        .from('comedor_despacho_ejecucion')
        .select('id', { count: 'exact', head: true })
        .eq('id_ejecucion', id_ejecucion);

    if (errCount) throw errCount;
    const correlativo = `DM-COC-${String((count || 0) + 1).padStart(5, '0')}`;

    const { data, error } = await supabase.rpc('fn_despacho_manual_desechable', {
        p_id_empresa:    id_empresa,
        p_id_sucursal:   id_sucursal,
        p_id_comedor:    id_comedor,
        p_id_ejecucion:  id_ejecucion,
        p_correlativo:   correlativo,
        p_observaciones: observaciones || null,
        p_detalles:      detalles, // [{id_item_inventario_comedor, id_producto, id_rubro, cantidad}]
        p_id_usuario:    id_usuario,
        p_timestamp:     now
    });

    if (error) throw error;
    return data;
};

// Carga los desechables despachados (manuales, con id_insumo null) de una ejecución
export const getDesechablesDespachados = async (id_ejecucion) => {
    const { data, error } = await supabase
        .from('comedor_despacho_ejecucion')
        .select(`
            id,
            estatus,
            timestamp_despacho,
            detalles:comedor_despacho_ejecucion_detalle!inner (
                id,
                id_insumo,
                cantidad_entregada,
                cantidad_recibida,
                producto:id_producto (
                    id,
                    variedad,
                    marca:id_marca (nombre),
                    rubro:id_rubro (
                        id,
                        nombre,
                        unidad:id_unidad_medida (abreviatura)
                    )
                )
            )
        `)
        .eq('id_ejecucion', id_ejecucion)
        .is('detalles.id_insumo', null);

    if (error) throw error;

    const result = [];
    (data || []).forEach(desp => {
        desp.detalles.forEach(det => {
            result.push({
                id_detalle: det.id,
                id_despacho: desp.id,
                estatus: desp.estatus,
                timestamp_despacho: desp.timestamp_despacho,
                producto_id: det.producto?.id,
                nombre: [det.producto?.rubro?.nombre, det.producto?.marca?.nombre, det.producto?.variedad].filter(Boolean).join(' · '),
                unidad: det.producto?.rubro?.unidad?.abreviatura || 'und',
                cantidad_entregada: det.cantidad_entregada,
                cantidad_recibida: det.cantidad_recibida
            });
        });
    });

    return result;
};

