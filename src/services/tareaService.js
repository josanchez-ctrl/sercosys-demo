import { supabase } from '../lib/supabase';

/**
 * Obtiene la lista de tareas pendientes para un almacén específico
 */
export const getTareasPendientes = async (id_empresa, id_almacen, tipo = 'PUTAWAY') => {
  const { data, error } = await supabase
    .from('almacen_tareas')
    .select(`
      *,
      inventario:id_item_inventario (
        id,
        lote,
        tracking_id,
        fecha_vencimiento,
        cantidad_actual,
        producto:id_producto (
          id,
          rubro:id_rubro (nombre, unidades_medida:id_unidad_medida(abreviatura)),
          marca:id_marca (nombre),
          variedad
        )
      ),
      origen:id_ubicacion_origen (id, codigo, nombre)
    `)
    .eq('id_empresa', id_empresa)
    .eq('id_almacen', id_almacen)
    .eq('tipo_tarea', tipo)
    .eq('estatus', 'PENDIENTE')
    .order('prioridad', { ascending: false })
    .order('timestamp_create', { ascending: true });

  if (error) throw error;
  return data;
};

/**
 * Confirma una tarea de ubicación (Putaway) utilizando RPC para atomicidad
 */
export const confirmarTareaUbicacion = async (id_tarea, id_ubicacion_destino, id_usuario) => {
  const { data, error } = await supabase.rpc('fn_confirmar_putaway', {
    p_id_tarea: id_tarea,
    p_id_ubicacion_destino: id_ubicacion_destino,
    p_id_usuario: id_usuario
  });

  if (error) throw error;
  return true;
};
