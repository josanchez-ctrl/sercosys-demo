import { supabase } from '../lib/supabase';
import { Now } from './nowService';

/**
 * SERVICIO DE INVENTARIO DE COCINA (DESPENSA)
 */

// Obtiene los saldos actuales por comedor
export const getSaldosCocina = async (id_comedor) => {
    const { data, error } = await supabase
        .from('comedor_cocina_saldos')
        .select(`
            *,
            rubro:id_rubro (
                id, 
                nombre, 
                unidad:id_unidad_medida (abreviatura),
                categoria:id_categoria (nombre)
            ),
            producto:id_producto (
                id,
                variedad,
                marca:id_marca (nombre)
            )
        `)
        .eq('id_comedor', id_comedor)
        .order('cantidad', { ascending: false });

    if (error) throw error;
    return data;
};

// Obtiene el historial de movimientos de un rubro específico en un comedor
export const getMovimientosCocina = async (id_comedor, id_rubro) => {
    const { data, error } = await supabase
        .from('comedor_cocina_movimientos')
        .select(`
            *,
            usuario:id_usuario_create (nombres, apellidos)
        `)
        .eq('id_comedor', id_comedor)
        .eq('id_rubro', id_rubro)
        .order('timestamp_create', { ascending: false })
        .limit(50);

    if (error) throw error;
    return data;
};

// Realiza un ajuste manual de inventario
export const realizarAjusteCocina = async (payload) => {
    const { id_empresa, id_comedor, id_rubro, id_producto, cantidad, tipo_movimiento, observaciones, id_usuario } = payload;
    const now = await Now();

    const { data, error } = await supabase.rpc('fn_actualizar_saldo_cocina', {
        p_id_empresa: id_empresa,
        p_id_comedor: id_comedor,
        p_id_rubro: id_rubro,
        p_cantidad: cantidad,
        p_tipo_movimiento: tipo_movimiento,
        p_id_referencia: null,
        p_id_usuario: id_usuario,
        p_timestamp_audit: now,
        p_observaciones: observaciones,
        p_id_producto: id_producto || null
    });

    if (error) throw error;
    return data;
};
