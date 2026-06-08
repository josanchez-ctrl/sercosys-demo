import { supabase } from '../lib/supabase';

export const getTasa = async () => {
    const { data, error } = await supabase
        .from('configuracion_tasas')
        .select('*')
        .order('fecha', { ascending: false })
        .limit(1);

    if (error) throw error;
    return data[0];
};