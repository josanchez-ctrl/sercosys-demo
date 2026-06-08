import { supabase } from '../lib/supabase';

export const getTiposDepreciacion = async () => {
    const { data, error } = await supabase
        .from('logistica_activos_tipos_depreciacion')
        .select('*')
        .eq('estatus', true)
        .order('id', { ascending: true });

    if (error) throw error;
    return data;
};
