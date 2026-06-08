import { supabase } from '../lib/supabase';
import { Now } from './nowService';

export const getProveedores = async (id_empresa) => {
  const { data, error } = await supabase
    .from('almacen_proveedores')
    .select('*, letrasdni(*)')
    .eq('id_empresa', id_empresa)
    .order('nombre', { ascending: true });

  if (error) throw error;
  return data || [];
};

export const createProveedor = async (payload) => {
  const now = await Now();
  const { data, error } = await supabase
    .from('almacen_proveedores')
    .insert([{ ...payload, timestamp_create: now }])
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updateProveedor = async (id, payload) => {
  const now = await Now();
  const { id_usuario_create: _, timestamp_create: __, ...rest } = payload;
  const { data, error } = await supabase
    .from('almacen_proveedores')
    .update({ ...rest, timestamp_update: now })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
};
