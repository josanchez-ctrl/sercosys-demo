import { supabase } from '../lib/supabase';
import { Now } from './nowService';

/**
 * Obtiene todos los tipos de servicios de una empresa
 */
export async function getTiposServicios(id_empresa) {
  if (!id_empresa) return [];

  const { data, error } = await supabase
    .from('tipos_servicios_comida')
    .select(`
      *,
      usuario_create:id_usuario_create (id, nombres, apellidos),
      usuario_update:id_usuario_update (id, nombres, apellidos)
    `)
    .eq('id_empresa', id_empresa)
    .order('orden', { ascending: true });

  if (error) {
    console.error('Error obteniendo tipos de servicios:', error);
    return [];
  }

  return data || [];
}

/**
 * Guarda o actualiza un tipo de servicio
 */
export async function saveTipoServicio(payload, userId) {
  const now = await Now();
  const isNew = !payload.id;

  const { id, usuario_create, usuario_update, ...rest } = payload;

  const dataToSave = {
    ...rest,
    nombre: payload.nombre.toUpperCase(),
    abreviatura: payload.abreviatura?.toUpperCase(),
  };

  if (isNew) {
    dataToSave.id_usuario_create = userId;
    dataToSave.timestamp_create = now;
  } else {
    dataToSave.id = id;
    dataToSave.id_usuario_update = userId;
    dataToSave.timestamp_update = now;
  }

  const { data, error } = await supabase
    .from('tipos_servicios_comida')
    .upsert(dataToSave)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Elimina (o anula) un tipo de servicio
 * En este caso, por ser un maestro crítico, podríamos manejar solo estatus
 */
export async function toggleEstatusTipoServicio(id, nuevoEstatus, userId) {
  const now = await Now();
  const { data, error } = await supabase
    .from('tipos_servicios_comida')
    .update({
      estatus: nuevoEstatus,
      id_usuario_update: userId,
      timestamp_update: now
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}
