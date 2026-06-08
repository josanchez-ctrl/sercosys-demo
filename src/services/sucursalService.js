import { supabase } from '../lib/supabase';
import { Now } from './nowService';

/**
 * Obtiene todas las sucursales
 */
export async function getSucursales(id_empresa) {

  const { data, error } = await supabase
    .from('sucursales')
    .select('*, clientes(nombre)')
    .order('nombre')
    .eq('id_empresa', id_empresa);

  if (error) {
    console.error('Error obteniendo sucursales:', error);
    return [];
  }

  return data || [];
}

/**
 * Obtiene las sucursales activas
 */
export async function getSucursalesActivas(id_empresa) {
  const { data, error } = await supabase
    .from('sucursales')
    .select('id, nombre')
    .eq('id_empresa', id_empresa)
    .eq('estatus', true)
    .order('nombre');

  if (error) {
    console.error('Error obteniendo sucursales activas:', error);
    return [];
  }

  return data || [];
}

/**
 * Obtiene una sucursal por su ID
 * @param {number} id - ID de la sucursal
 */
export async function getSucursalById(id) {
  const { data, error } = await supabase
    .from('sucursales')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error obteniendo sucursal:', error);
    return null;
  }

  return data;
}

/**
 * Crea una nueva sucursal
 */
export async function createSucursal(sucursal) {
  const now = await Now();
  const { data, error } = await supabase
    .from('sucursales')
    .insert({
      nombre: sucursal.nombre?.toUpperCase(),
      direccion: sucursal.direccion?.toUpperCase() || null,
      telefono: sucursal.telefono || null,
      email: sucursal.email?.toUpperCase() || null,
      id_empresa: sucursal.id_empresa || null,
      id_cliente: sucursal.id_cliente || null,
      estatus: sucursal.estatus !== false,
      id_usuario_create: sucursal.id_usuario,
      timestamp_create: now,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creando sucursal:', error);
    throw error;
  }

  return data || [];
}

/**
 * Actualiza una sucursal existente
 */
export async function updateSucursal(id, sucursal) {
  const now = await Now();
  const { data, error } = await supabase
    .from('sucursales')
    .update({
      nombre: sucursal.nombre?.toUpperCase(),
      direccion: sucursal.direccion?.toUpperCase() || null,
      nombre_responsable: sucursal.nombre_responsable?.toUpperCase() || null,
      telefono_responsable: sucursal.telefono_responsable || null,
      email_responsable: sucursal.email_responsable?.toUpperCase() || null,
      id_empresa: sucursal.id_empresa || null,
      id_cliente: sucursal.id_cliente || null,
      estatus: sucursal.estatus,
      id_usuario_update: sucursal.id_usuario,
      timestamp_update: now,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error actualizando sucursal:', error);
    throw error;
  }

  return data || [];
}
