import { supabase } from '../lib/supabase';
import { Now } from './nowService';

// ─────────────────────────────────────────────
// RUBROS
// ─────────────────────────────────────────────
export const getRubros = async (id_empresa, id_almacen) => {
    const query = supabase
        .from('almacen_rubros')
        .select(`
            *,
            almacen_categorias!inner(id, nombre, id_almacen),
            almacen_unidades_medida(nombre, abreviatura),
            almacen_rubros_merma(
                valor,
                tipo_merma:id_tipo_merma(id, nombre, letra)
            )
        `)
        .eq('id_empresa', id_empresa);

    if (id_almacen) {
        query.eq('almacen_categorias.id_almacen', id_almacen);
    }

    const { data, error } = await query.order('nombre', { ascending: true });
    if (error) throw error;
    return data;
};

export const createRubro = async (payload, id_usuario) => {
    const now = await Now();
    const { data, error } = await supabase
        .from('almacen_rubros')
        .insert([{ 
            ...payload, 
            timestamp_create: now,
            id_usuario_create: id_usuario
        }])
        .select()
        .single();
    if (error) throw error;
    return data;
};

/**
 * Crea múltiples rubros de forma atómica.
 */
export const createRubrosBatch = async (payloads, id_usuario) => {
    const now = await Now();
    const batch = payloads.map(p => ({ 
        ...p, 
        timestamp_create: now,
        id_usuario_create: id_usuario
    }));

    const { data, error } = await supabase
        .from('almacen_rubros')
        .insert(batch)
        .select();

    if (error) throw error;
    return data || [];
};

export const updateRubro = async (id, payload, id_usuario) => {
    const now = await Now();
    const { id_usuario_create: _, timestamp_create: __, ...rest } = payload;
    const { data, error } = await supabase
        .from('almacen_rubros')
        .update({ 
            ...rest, 
            timestamp_update: now,
            id_usuario_update: id_usuario 
        })
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    return data;
};