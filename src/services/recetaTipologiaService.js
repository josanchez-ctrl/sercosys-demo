import { supabase } from '../lib/supabase';
import { Now } from './nowService';

/**
 * Obtiene todas las tipologías de recetas de la empresa
 */
export async function getRecetaTipologias(id_empresa) {
  if (!id_empresa) return [];
  const { data, error } = await supabase
    .from('receta_tipologias')
    .select('*')
    .eq('id_empresa', id_empresa)
    .order('nombre', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Guarda una tipología de receta
 */
export async function saveRecetaTipologia(payload, userId) {
  const now = await Now();
  const { id, ...rest } = payload;
  const isNew = !id;

  const dataToSave = {
    ...rest,
    nombre: payload.nombre.toUpperCase(),
    id_usuario_update: userId,
    timestamp_update: now
  };

  if (isNew) {
    dataToSave.id_usuario_create = userId;
    dataToSave.timestamp_create = now;
    const { data, error } = await supabase
      .from('receta_tipologias')
      .insert(dataToSave)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase
      .from('receta_tipologias')
      .update(dataToSave)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}
