import { supabase } from '../lib/supabase';
import { Now } from './nowService';

export const getUnidadesMedida = async (id_empresa) => {
    const query = supabase
        .from('almacen_unidades_medida')
        .select('*')
        .eq('id_empresa', id_empresa);

    const { data, error } = await query.order('nombre', { ascending: true });
    if (error) throw error;
    return data || [];
};

export const createUnidadMedida = async (payload, id_usuario) => {
    const now = await Now();
    const { data, error } = await supabase
        .from('almacen_unidades_medida')
        .insert([{ 
            ...payload, 
            timestamp_create: now,
            id_usuario_create: id_usuario
        }])
        .select()
        .single();
    if (error) throw error;
    return data || [];
};

export const updateUnidadMedida = async (id, payload, id_usuario) => {
    const now = await Now();
    const { id_usuario_create: _, timestamp_create: __, ...rest } = payload;
    const { data, error } = await supabase
        .from('almacen_unidades_medida')
        .update({ 
            ...rest, 
            timestamp_update: now,
            id_usuario_update: id_usuario
        })
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    return data || [];
};