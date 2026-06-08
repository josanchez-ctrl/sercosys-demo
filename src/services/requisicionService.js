import { supabase } from '../lib/supabase';
import { Now } from './nowService';
import { parseTimestampToDate } from '../util/workDate';

/**
 * Obtiene todas las requisiciones para almacén por empresa, filtradas por fecha y permisos del perfil
 */
export const getRequisicionesAlmacen = async (idEmpresa, dateStart, dateEnd, perfil) => {
  const isSuperAdmin = perfil?.F_ALL === true;

  let query = supabase
    .from('almacen_requisiciones')
    .select(`
      *,
      sucursal:sucursales(nombre),
      comedor:comedores(nombre),
      planificacion:planificacion_semanal(semana_inicio, semana_fin),
      usuario_create:usuarios!id_usuario_create(nombres, apellidos),
      usuario_update:usuarios!id_usuario_update(nombres, apellidos),
      detalle:almacen_requisiciones_detalle(
        *,
        rubro:almacen_rubros(
          nombre,
          unidad:almacen_unidades_medida(abreviatura),
          categoria:almacen_categorias(
            nombre,
            almacen:almacenes(nombre)
          )
        )
      )
    `)
    .eq('id_empresa', idEmpresa)
    .gte('timestamp_create', `${dateStart}T00:00:00`)
    .lte('timestamp_create', `${dateEnd}T23:59:59`);

  // Filtro de seguridad por perfil (Si no es SuperAdmin)
  if (!isSuperAdmin) {
    if (perfil?.ids_sucursales?.length > 0) {
      query = query.in('id_sucursal', perfil.ids_sucursales);
    }
    if (perfil?.ids_comedores?.length > 0) {
      query = query.in('id_comedor', perfil.ids_comedores);
    }
  }

  const { data, error } = await query.order('timestamp_create', { ascending: false });

  if (error) throw error;
  return data;
};

/**
 * Obtiene las requisiciones para consulta en el comedor
 */
export const getRequisicionesComedor = async (idEmpresa, idComedor) => {
  const { data, error } = await supabase
    .from('almacen_requisiciones')
    .select(`
      *,
      detalle:almacen_requisiciones_detalle(
        *,
        rubro:almacen_rubros(
          nombre,
          unidad:almacen_unidades_medida(abreviatura)
        )
      )
    `)
    .eq('id_empresa', idEmpresa)
    .eq('id_comedor', idComedor)
    .order('timestamp_create', { ascending: false });

  if (error) throw error;
  return data;
};

/**
 * Anula una requisición y retorna la planificación a estatus PENDIENTE
 */
export const anularRequisicion = async (requisicionId, userId) => {
  const now = await Now();

  // 1. Obtener datos de la requisición para saber si tiene planificación
  const { data: req, error: reqErr } = await supabase
    .from('almacen_requisiciones')
    .select('id_planificacion')
    .eq('id', requisicionId)
    .single();

  if (reqErr) throw reqErr;

  // 2. Ejecutar cambios en una transacción (o secuencia controlada)
  // Nota: Si se requiere atomicidad estricta, usar RPC. 
  // Por ahora lo hacemos secuencial para mantener visibilidad del flujo.

  // A. Anular Requisición
  const { error: updReqErr } = await supabase
    .from('almacen_requisiciones')
    .update({
      estatus: 'ANULADA',
      timestamp_anula: now,
      id_usuario_anula: userId
    })
    .eq('id', requisicionId);

  if (updReqErr) throw updReqErr;

  // B. Si tiene planificación asociada, retornarla a PENDIENTE
  if (req.id_planificacion) {
    const { error: updPlanErr } = await supabase
      .from('planificacion_semanal')
      .update({
        estatus: 'PENDIENTE',
        timestamp_update: now,
        id_usuario_update: userId,
        // Limpiamos los campos de procesamiento
        timestamp_procesa: null,
        id_usuario_procesa: null
      })
      .eq('id', req.id_planificacion);

    if (updPlanErr) throw updPlanErr;
  }

  return true;
};

/**
 * Obtiene una sola requisición por ID con todos sus detalles y relaciones
 */
export const getRequisicionById = async (id) => {
  const { data, error } = await supabase
    .from('almacen_requisiciones')
    .select(`
      *,
      sucursal:sucursales(nombre),
      comedor:comedores(
        nombre,
        sucursal:sucursales(nombre)
      ),
      planificacion:planificacion_semanal(semana_inicio, semana_fin),
      usuario_create:usuarios!id_usuario_create(nombres, apellidos),
      detalle:almacen_requisiciones_detalle(
        *,
        rubro:almacen_rubros(
          nombre,
          unidad:almacen_unidades_medida(abreviatura),
          categoria:almacen_categorias(
            nombre,
            almacen:almacenes(nombre)
          )
        )
      )
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
};
