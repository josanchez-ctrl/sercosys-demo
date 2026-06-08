import { supabase } from '../lib/supabase';
import { Now } from './nowService';

/**
 * SERVICIO DE GESTIÓN DE DEPARTAMENTOS
 */

export const getDepartamentos = async (id_empresa) => {
    const { data, error } = await supabase
        .from('departamentos')
        .select('*')
        .eq('id_empresa', id_empresa)
        .order('orden', { ascending: true })
        .order('nombre', { ascending: true });

    if (error) throw error;
    return data;
};

export const saveDepartamento = async (payload) => {
    const { id, id_empresa, nombre, estatus, orden, id_usuario } = payload;
    const now = await Now();

    if (id) {
        // Update
        const { data, error } = await supabase
            .from('departamentos')
            .update({
                nombre,
                estatus,
                orden,
                id_usuario_update: id_usuario,
                timestamp_update: now
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    } else {
        // Create
        const { data, error } = await supabase
            .from('departamentos')
            .insert({
                id_empresa,
                nombre,
                estatus: estatus ?? true,
                orden: orden ?? 0,
                id_usuario_create: id_usuario,
                timestamp_create: now
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    }
};
