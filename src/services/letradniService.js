import { supabase } from '../lib/supabase';

/**
 * Obtiene todos los clientes activos
 */
export async function getLetrasDni() {
  const { data, error } = await supabase
    .from('letrasdni')
    .select(`
      id,
      nombre
    `)
    .order('orden');

  if (error) {
    throw console.error('Error obteniendo letras DNI:', error);
  }

  return data || [];
}