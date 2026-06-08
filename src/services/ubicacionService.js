import { supabase } from '../lib/supabase';

/**
 * Obtiene todas las ubicaciones de un almacén específico.
 */
export const getUbicaciones = async (id_almacen) => {
  const { data, error } = await supabase
    .from('almacen_ubicaciones')
    .select('*, tipoalmacen:tipo_almacen(nombre)')
    .eq('id_almacen', id_almacen)
    .eq('estatus', true)
    .order('codigo', { ascending: true });

  if (error) throw error;
  return data || [];
};

/**
 * Crea una nueva ubicación (Rack/Slot).
 */
export const createUbicacion = async (payload) => {
  const { data, error } = await supabase
    .from('almacen_ubicaciones')
    .insert([payload])
    .select()
    .single();

  if (error) throw error;
  return data;
};

/**
 * Asigna una ubicación a un ítem del inventario específico usando el RPC para trazabilidad.
 */
export const asignarUbicacionInventario = async (id_inventario, id_ubicacion, id_usuario) => {
  const { data, error } = await supabase.rpc('fn_ubicar_producto_inventario', {
    p_id_inventario: id_inventario,
    p_id_ubicacion: id_ubicacion,
    p_id_usuario: id_usuario
  });

  if (error) throw error;
  return data;
};

