import { supabase } from '../lib/supabase';
import { Now } from './nowService';

/**
 * Obtiene los IDs de tipos de merma asociados a una categoría
 */
export async function getMermasByCategoria(id_categoria) {
  if (!id_categoria) return [];

  const { data, error } = await supabase
    .from('almacen_categorias_merma')
    .select('id_tipo_merma')
    .eq('id_categoria', id_categoria);

  if (error) {
    console.error('Error obteniendo mermas de categoría:', error);
    return [];
  }

  return data.map(m => m.id_tipo_merma);
}

/**
 * Guarda la asociación de mermas para una categoría (Limpia e inserta)
 */
export async function saveMermasCategoria(id_categoria, ids_mermas, id_usuario) {
  if (!id_categoria) throw new Error('ID de categoría es requerido');

  const now = await Now();

  // 1. Eliminar asociaciones anteriores
  const { error: deleteError } = await supabase
    .from('almacen_categorias_merma')
    .delete()
    .eq('id_categoria', id_categoria);

  if (deleteError) throw deleteError;

  // 2. Si no hay mermas seleccionadas, terminamos
  if (!ids_mermas || ids_mermas.length === 0) return true;

  // 3. Insertar nuevas asociaciones
  const insPayload = ids_mermas.map(id_tipo => ({
    id_categoria,
    id_tipo_merma: id_tipo,
    id_usuario_create: id_usuario,
    timestamp_create: now
  }));

  const { error: insertError } = await supabase
    .from('almacen_categorias_merma')
    .insert(insPayload);

  if (insertError) throw insertError;

  return true;
}
