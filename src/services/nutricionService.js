import { supabase } from '../lib/supabase';
import { Now } from './nowService';

/**
 * Obtiene el perfil nutricional objetivo de un comedor.
 * Si no está configurado, retorna un perfil por defecto.
 */
export async function getPerfilNutricionalComedor(idComedor, idTipoServicio) {
  if (!idComedor || !idTipoServicio) return null;
  
  const { data, error } = await supabase
    .from('comedor_perfil_nutricional')
    .select('*')
    .eq('id_comedor', idComedor)
    .eq('id_tipo_servicio', idTipoServicio)
    .maybeSingle();

  if (error) {
    console.error('Error fetching perfil nutricional:', error);
    throw error;
  }

  // Fallback si no está configurado
  if (!data) {
    return {
      id: null,
      id_comedor: idComedor,
      id_tipo_servicio: idTipoServicio,
      kcal_objetivo: 800.00,
      carb_min_pct: 50.00,
      carb_max_pct: 60.00,
      prot_min_pct: 15.00,
      prot_max_pct: 20.00,
      grasa_min_pct: 25.00,
      grasa_max_pct: 30.00
    };
  }

  return data;
}

/**
 * Guarda o actualiza el perfil nutricional de un comedor (Upsert)
 */
export async function savePerfilNutricionalComedor(perfilData, userId) {
  const now = await Now();
  const { id, ...rest } = perfilData;

  const payload = {
    ...rest,
    id_usuario_update: userId,
    timestamp_update: now
  };

  if (!id) {
    payload.id_usuario_create = userId;
    payload.timestamp_create = now;
    
    const { data, error } = await supabase
      .from('comedor_perfil_nutricional')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase
      .from('comedor_perfil_nutricional')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}

/**
 * Obtiene las reglas nutricionales y de combinación activas para una empresa
 */
export async function getReglasCompatibilidad(idEmpresa) {
  if (!idEmpresa) return [];

  const { data, error } = await supabase
    .from('menu_reglas_nutricionales')
    .select('*')
    .eq('id_empresa', idEmpresa)
    .eq('estatus', true);

  if (error) {
    console.error('Error fetching reglas nutricionales:', error);
    throw error;
  }

  return data || [];
}
