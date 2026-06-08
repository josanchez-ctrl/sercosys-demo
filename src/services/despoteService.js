import { 
  getOrdenesTransformacion, 
  getOrdenTransformacionById, 
  saveOrdenTransformacion, 
  procesarOrdenTransformacion, 
  anularOrdenTransformacion, 
  iniciarTransformacion, 
  declararSalidaTransformacion, 
  finalizarTransformacion,
  revertirSalidaTransformacion,
  obtenerOCrearTrkTransformacion
} from './transformacionService';
import { supabase } from '../lib/supabase';

/**
 * Obtener órdenes de despote de una empresa
 */
export const getOrdenesDespote = async (id_empresa, fechaInicio = null, fechaFin = null) => {
  return getOrdenesTransformacion(id_empresa, 'DESPOSTE', fechaInicio, fechaFin);
};

/**
 * Obtener detalle de una orden de despote por ID
 */
export const getOrdenDespoteById = async (id) => {
  return getOrdenTransformacionById(id);
};

/**
 * Guardar cabecera, entradas y salidas de una orden de despote
 */
export const saveOrdenDespote = async (header, entradas, salidas, id_usuario) => {
  const headerConTipo = {
    ...header,
    tipo_proceso: 'DESPOSTE'
  };
  return saveOrdenTransformacion(headerConTipo, entradas, salidas, id_usuario);
};

/**
 * Iniciar el proceso de despote (descontar de inventario y colocar en mesa)
 */
export const iniciarDespote = async (id, id_usuario) => {
  return iniciarTransformacion(id, id_usuario);
};

/**
 * Registrar una salida parcial de la mesa de despote
 */
export const declararSalidaDespote = async (payload, id_usuario) => {
  return declararSalidaTransformacion(payload, id_usuario);
};

/**
 * Revertir/anular una salida parcial de la mesa de despote
 */
export const revertirSalidaDespote = async (idSalida, id_usuario) => {
  return revertirSalidaTransformacion(idSalida, id_usuario);
};

/**
 * Finalizar la orden de despote (procesa remanentes como merma y cierra)
 */
export const finalizarDespote = async (id, id_usuario) => {
  return finalizarTransformacion(id, id_usuario);
};

/**
 * Anular la orden de despote
 */
export const anularOrdenDespote = async (id, id_usuario) => {
  return anularOrdenTransformacion(id, id_usuario);
};

/**
 * Obtener catálogo de taras/cestas configuradas en la base de datos
 */
export const getTarasCestas = async () => {
  const { data, error } = await supabase
    .from('taras')
    .select('*, tipotara:tipo_tara!tipo(nombre)')
    .eq('estatus', true)
    .order('descripcion', { ascending: true });

  if (error) {
    console.error('Error al obtener catálogo de taras:', error);
    // Si la tabla aún no existe o falla, retornamos un array vacío
    return [];
  }
  return data || [];
};

/**
 * Obtener las relaciones de productos derivados (mapeo origen -> destino)
 */
export const getProductosDerivados = async () => {
  const { data, error } = await supabase
    .from('almacen_productos_derivados')
    .select('*');

  if (error) {
    console.error('Error al obtener productos derivados:', error);
    return [];
  }
  return data || [];
};

/**
 * Obtener órdenes unificadas de despote y reproceso ordenadas por fecha de creación descendente
 */
export const getOrdenesDespoteYReproceso = async (id_empresa, fechaInicio = null, fechaFin = null) => {
  const [despote, reproceso] = await Promise.all([
    getOrdenesTransformacion(id_empresa, 'DESPOSTE', fechaInicio, fechaFin),
    getOrdenesTransformacion(id_empresa, 'REPROCESO', fechaInicio, fechaFin)
  ]);
  return [...despote, ...reproceso].sort((a, b) => new Date(b.timestamp_create) - new Date(a.timestamp_create));
};

/**
 * Guardar cabecera, entradas y salidas de una orden de reproceso
 */
export const saveOrdenReproceso = async (header, entradas, salidas, id_usuario) => {
  const headerConTipo = {
    ...header,
    tipo_proceso: 'REPROCESO'
  };
  return saveOrdenTransformacion(headerConTipo, entradas, salidas, id_usuario);
};

/**
 * Obtener o crear TRK en caliente para despote
 */
export const obtenerOCrearTrkDespote = async (payload, id_usuario) => {
  return obtenerOCrearTrkTransformacion(payload, id_usuario);
};



