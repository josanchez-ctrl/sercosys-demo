import { supabase } from '../lib/supabase';

/**
 * Obtiene todos los almacenes de una empresa
 */
export async function getAlmacenes(id_empresa) {
  if (!id_empresa) return [];

  const { data, error } = await supabase
    .from('almacenes')
    .select('*')
    .eq('id_empresa', id_empresa)
    .order('nombre', { ascending: true });

  if (error) {
    console.error('Error obteniendo almacenes:', error);
    return [];
  }

  return data || [];
}
