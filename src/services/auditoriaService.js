import { supabase } from '../lib/supabase';

/**
 * Registra una acción de auditoría
 * @param {string} tabla - Nombre de la tabla afectada
 * @param {number} registroId - ID del registro afectado
 * @param {string} accion - 'INSERT', 'UPDATE', 'DELETE'
 * @param {object} datosAnteriores - Datos antes del cambio (para UPDATE/DELETE)
 * @param {object} datosNuevos - Datos después del cambio (para INSERT/UPDATE)
 * @param {number} idUsuario - ID del usuario que realizó la acción
 */
export async function registrarAuditoria({
  tabla,
  registroId,
  accion,
  datosAnteriores = null,
  datosNuevos = null,
  idUsuario = null
}) {
  try {
    const { error } = await supabase
      .from('auditoria_logs')
      .insert({
        tabla_afectada: tabla,
        registro_id: registroId,
        accion: accion,
        datos_anteriores: datosAnteriores,
        datos_nuevos: datosNuevos,
        id_usuario: idUsuario
      });

    if (error) {
      console.error('Error registrando auditoría:', error);
    }
  } catch (err) {
    console.error('Error en auditoría:', err);
  }
}

/**
 * Obtiene el historial de auditoría de un registro específico
 * @param {string} tabla - Nombre de la tabla
 * @param {number} registroId - ID del registro
 */
export async function getAuditoriaPorRegistro(tabla, registroId) {
  try {
    const { data, error } = await supabase
      .from('auditoria_logs')
      .select(`
        *,
        usuario:usuarios!id_usuario(id, nombres, apellidos)
      `)
      .eq('tabla_afectada', tabla)
      .eq('registro_id', registroId)
      .order('timestamp', { ascending: false });

    if (error) {
      console.error('Error obteniendo auditoría:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Error en auditoría:', err);
    return [];
  }
}

/**
 * Obtiene todos los logs de auditoría con filtros opcionales
 * @param {object} filtros - { tabla, idUsuario, fechaDesde, fechaHasta, accion }
 */
export async function getAuditoriaGeneral(filtros = {}) {
  try {
    let query = supabase
      .from('auditoria_logs')
      .select(`
        *,
        usuario:usuarios!id_usuario(id, nombres, apellidos)
      `)
      .order('timestamp', { ascending: false });

    if (filtros.tabla) {
      query = query.eq('tabla_afectada', filtros.tabla);
    }

    if (filtros.idUsuario) {
      query = query.eq('id_usuario', filtros.idUsuario);
    }

    if (filtros.accion) {
      query = query.eq('accion', filtros.accion);
    }

    if (filtros.fechaDesde) {
      query = query.gte('timestamp', filtros.fechaDesde);
    }

    if (filtros.fechaHasta) {
      query = query.lte('timestamp', filtros.fechaHasta);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error obteniendo auditoría general:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Error en auditoría:', err);
    return [];
  }
}
