import { supabase } from '../lib/supabase';

export async function getValidaciones() {
    const { data, error } = await supabase
        .from('validaciones')
        .select('*')
        .order('id');

    if (error) throw error;
    return data || [];
}