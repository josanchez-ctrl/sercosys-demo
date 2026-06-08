import { supabase } from '../lib/supabase';
import { Now } from './nowService';

/**
 * Obtiene todos los empresas activos
 */
export async function getEmpresas() {
  const { data, error } = await supabase
    .from('empresas')
    .select(`
      *,
      letradni: empresas_id_letradni_fkey(
        id,
        nombre
      )
    `)
    .order('nombre');

  if (error) {
    console.error('Error obteniendo empresas:', error);
    return [];
  }

  return data;
}

/**
 * Obtiene empresas por IDs específicos
 * @param {number[]} ids - Array de IDs de empresas
 */
export async function getEmpresasByIds(ids) {
  const { data, error } = await supabase
    .from('empresas')
    .select(`
      id,
      id_letradni,
      dni,
      nombre,
      ids_funciones,
      letradni:empresas_id_letradni_fkey(
        id,
        nombre
      )
    `)
    .in('id', ids)
    .eq('estatus', true)
    .order('nombre');

  if (error) {
    console.error('Error obteniendo empresas por IDs:', error);
    return [];
  }

  return data;
}

/**
 * Obtiene un empresa por su ID
 * @param {number} id - ID del empresa
 */
export async function getEmpresaById(id) {
  const { data, error } = await supabase
    .from('empresas')
    .select(`
      id,
      id_letradni,
      dni,
      nombre,
      contacto_nombre,
      contacto_email,
      contacto_telefono,
      direccion,
      ids_funciones,
      letradni:empresas_id_letradni_fkey (
        id,
        nombre
      )
    `)
    .eq('id', id)
    .eq('estatus', true)
    .single();

  return data;
}

/**
 * Crea un nuevo empresa
 */
export async function createEmpresa(empresa) {
  const now = await Now();
  const { data, error } = await supabase
    .from('empresas')
    .insert({
      id_letradni: empresa.id_letradni,
      dni: empresa.dni,
      nombre: empresa.nombre,
      contacto_nombre: empresa.contacto_nombre || null,
      contacto_email: empresa.contacto_email || null,
      contacto_telefono: empresa.contacto_telefono || null,
      direccion: empresa.direccion || null,
      estatus: empresa.estatus,
      ids_funciones: empresa.ids_funciones || [],
      id_usuario_create: empresa.id_usuario,
      timestamp_create: now,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creando empresa:', error);
    throw error;
  }

  return data || [];
}

/**
 * Actualiza un empresa existente
 */
export async function updateEmpresa(id, empresa) {
  const now = await Now();
  const { data, error } = await supabase
    .from('empresas')
    .update({
      id_letradni: empresa.id_letradni,
      dni: empresa.dni,
      nombre: empresa.nombre,
      contacto_nombre: empresa.contacto_nombre || null,
      contacto_email: empresa.contacto_email || null,
      contacto_telefono: empresa.contacto_telefono || null,
      direccion: empresa.direccion || null,
      estatus: empresa.estatus,
      ids_funciones: empresa.ids_funciones || [],
      id_usuario_update: empresa.id_usuario,
      timestamp_update: now,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error actualizando empresa:', error);
    throw error;
  }

  return data || [];
}

