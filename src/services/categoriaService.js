import { supabase } from '../lib/supabase';
import { Now } from './nowService';

// ─────────────────────────────────────────────
// CATEGORÍAS
// ─────────────────────────────────────────────
export const getCategorias = async (id_empresa, id_almacen) => {
    const query = supabase
        .from('almacen_categorias')
        .select(`
            *,
            almacenes:id_almacen (
                id,nombre
            ),
            mermas:almacen_categorias_merma (
                tipo_merma:id_tipo_merma (
                    nombre,
                    letra
                )
            )
        `)
        .eq('id_empresa', id_empresa);

    if (id_almacen) {
        query.eq('id_almacen', id_almacen);
    }

    const { data, error } = await query.order('nombre', { ascending: true });
    if (error) throw error;
    return data;
};

export const createCategoria = async (payload, id_usuario) => {
    const now = await Now();
    const { data, error } = await supabase
        .from('almacen_categorias')
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

export const updateCategoria = async (id, payload, id_usuario) => {
    const now = await Now();
    const { id_usuario_create: _, timestamp_create: __, ...rest } = payload;
    const { data, error } = await supabase
        .from('almacen_categorias')
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