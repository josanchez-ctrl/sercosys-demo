import { supabase } from '../lib/supabase';

export async function Now() {
    const { data, error } = await supabase.rpc('get_current_time_caracas');
    if (error) console.error(error);
    return data
}   