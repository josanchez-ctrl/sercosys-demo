import { supabase } from '../lib/supabase';
import { Now } from './nowService';

export async function getTipoCliente(){
  const { data, error } = await supabase
    .from('tipos_clientes')
    .select(`
      *
    `)
    .order('orden');

  if (error) {
   throw('Error obteniendo clientes:', error);
  }

  return data || [];
}

/* todos los clientes */
export async function getClientes() {
  const { data, error } = await supabase
    .from('clientes')
    .select(`
      *,
      letradni: clientes_id_letradni_fkey(
        id,
        nombre
      ),
      tipocliente: clientes_id_tipocliente_fkey(
        id,nombre
      )
    `)
    .order('nombre');

  if (error) {
    console.error('Error obteniendo clientes:', error);
    return [];
  }

  return data || [];
}

export async function createCliente(cliente, id_usuario) {
  const now = await Now();
  const { data, error } = await supabase
    .from('clientes')
    .insert({
      id_letradni: cliente.id_letradni,
      dni: cliente.dni,
      nombre: cliente.nombre,
      contacto_nombre: cliente.contacto_nombre || null,
      contacto_email: cliente.contacto_email || null,
      contacto_telefono: cliente.contacto_telefono || null,
      direccion: cliente.direccion || null,
      id_empresa: cliente.id_empresa,
      id_tipocliente: cliente.id_tipocliente,
      id_usuario_create: id_usuario,
      timestamp_create: now,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creando cliente:', error);
    throw error;
  }

  return data || [];
}

export async function updateCliente(id, cliente, id_usuario) {
  const now = await Now();

  const { data, error } = await supabase
    .from('clientes')
    .update({
      id_letradni: cliente.id_letradni,
      dni: cliente.dni,
      nombre: cliente.nombre,
      contacto_nombre: cliente.contacto_nombre || null,
      contacto_email: cliente.contacto_email || null,
      contacto_telefono: cliente.contacto_telefono || null,
      direccion: cliente.direccion || null,
      estatus: cliente.estatus,
      id_empresa: cliente.id_empresa,
      id_tipocliente: cliente.id_tipocliente,
      id_usuario_update: id_usuario,
      timestamp_update: now,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error actualizando cliente:', error);
    throw error;
  }

  return data || [];
}