import { supabase } from '../lib/supabase';

export async function getMonedas() {
    const { data, error } = await supabase
        .from('monedas')
        .select('*')
        .eq('estatus', true)
        .order('id');

    if (error) throw error;
    return data || [];
}