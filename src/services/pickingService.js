import { supabase } from '../lib/supabase';
import { Now } from './nowService';

/**
 * Obtiene la lista de pickings filtrada por empresa, almacén y rango de fechas
 */
export const getPickings = async (id_empresa, dateStart, dateEnd, id_almacen) => {
  let query = supabase
    .from('almacen_picking')
    .select(`
      *,
      sucursales (nombre),
      comedores (nombre),
      usuario_create:usuarios!id_usuario_create(id, nombres, apellidos),
      usuario_update:usuarios!id_usuario_update(id, nombres, apellidos),
      usuario_procesa:usuarios!id_usuario_procesa(id, nombres, apellidos),
      usuario_anula:usuarios!id_usuario_anula(id, nombres, apellidos)
    `)
    .eq('id_empresa', id_empresa)
    .order('id', { ascending: false });

  if (id_almacen) query = query.eq('id_almacen', id_almacen);
  if (dateStart) query = query.gte('timestamp_create', `${dateStart}T00:00:00`);
  if (dateEnd) query = query.lte('timestamp_create', `${dateEnd}T23:59:59`);

  const { data, error } = await query;
  if (error) throw error;
  return data;
};

/**
 * Obtiene un picking completo con sus detalles
 */
export const getPickingById = async (id) => {
  const { data, error } = await supabase
    .from('almacen_picking')
    .select(`
      *,
      almacen:id_almacen(nombre),
      sucursal:id_sucursal(nombre),
      comedor:id_comedor(nombre),
      detalle:almacen_picking_detalle (
        *,
        presentacion_logistica:almacen_productos_codigos!id_presentacion_logistica (
          *,
          presentacion:almacen_presentaciones (nombre)
        ),
        producto:almacen_productos (
          *,
          rubro:id_rubro (
            *,
            unidad:id_unidad_medida(abreviatura),
            categoria:id_categoria(nombre)
          ),
          marca:id_marca(nombre)
        )
      )
    `)
    .eq('id', id)
    .single();

  if (error) throw error;

  // Cargar data de requisiciones vinculadas para ver el requerido original
  if (data && Array.isArray(data.id_requisicion) && data.id_requisicion.length > 0) {
    const { data: reqData, error: reqErr } = await supabase
      .from('almacen_requisiciones')
      .select(`
        id, 
        codigo_requisicion, 
        detalle:almacen_requisiciones_detalle(
          id, 
          id_rubro, 
          cantidad_solicitada, 
          cantidad_despachada
        )
      `)
      .in('id', data.id_requisicion);

    if (!reqErr) {
      data.id_requisicion_data = reqData;
    }
  }

  return data;
};

/**
 * Guarda un picking (Cabecera + Detalles)
 */
export const savePicking = async (header, details, id_usuario) => {
  const now = await Now();

  // Limpieza de campos que no existen en la tabla (Joins o IDs temporales)
  const cleanHeader = {
    id_empresa: header.id_empresa,
    id_almacen: header.id_almacen,
    id_sucursal: header.id_sucursal,
    id_comedor: header.id_comedor,
    estatus: header.estatus || 'BORRADOR',
    id_requisicion: header.id_requisicion || [],
    observaciones: header.observaciones || null
  };

  let pickingId = header.id;

  if (pickingId) {
    // Actualizar
    const { error: updErr } = await supabase
      .from('almacen_picking')
      .update({
        ...cleanHeader,
        timestamp_update: now,
        id_usuario_update: id_usuario
      })
      .eq('id', pickingId);
    if (updErr) throw updErr;

    // Limpiar detalles anteriores para re-insertar
    const { error: delErr } = await supabase
      .from('almacen_picking_detalle')
      .delete()
      .eq('id_picking', pickingId);
    if (delErr) throw delErr;
  } else {
    // Crear
    const { data: insData, error: insErr } = await supabase
      .from('almacen_picking')
      .insert([{
        ...cleanHeader,
        timestamp_create: now,
        id_usuario_create: id_usuario
      }])
      .select()
      .single();
    if (insErr) throw insErr;
    pickingId = insData.id;
  }

  // Insertar detalles
  if (details && details.length > 0) {
    const cleanDetails = details.map(d => ({
      id_picking: pickingId,
      id_producto: d.id_producto,
      cantidad: d.cantidad,
      lote: d.lote || null,
      fecha_vencimiento: d.fecha_vencimiento || null,
      id_requisicion_detalle: d.id_requisicion_detalle || null,
      factor: d.factor || d.producto_info?.factor || 1,
      id_presentacion_logistica: d.id_presentacion_logistica || null,
      // Empaques físicos para productos de peso variable (NULL si no aplica)
      cantidad_presentacion: d.cantidad_presentacion ?? null,
      costo_unidad_base: d.costo_unidad_base || 0,
      timestamp_create: now,
      id_usuario_create: id_usuario
    }));

    const { error: detErr } = await supabase
      .from('almacen_picking_detalle')
      .insert(cleanDetails);
    if (detErr) throw detErr;
  }

  return pickingId;
};

/**
 * Procesa un picking (Afecta inventario o estatus final)
 */
export const procesarPicking = async (id, id_usuario) => {
  const now = await Now();
  const { error } = await supabase
    .from('almacen_picking')
    .update({
      estatus: 'PROCESADO',
      timestamp_procesa: now,
      id_usuario_procesa: id_usuario
    })
    .eq('id', id);

  if (error) throw error;
  
  // Auditoría en detalles del picking
  await supabase.from('almacen_picking_detalle').update({
    timestamp_procesa: now,
    id_usuario_procesa: id_usuario
  }).eq('id_picking', id);

  // --- SINCRONIZACIÓN CON REQUISICIONES ---
  // Obtenemos los rubros/cantidades de este picking y sus links a REQs
  const { data: detalles } = await supabase
    .from('almacen_picking_detalle')
    .select(`
      cantidad,
      id_requisicion_detalle,
      requisicion_detalle:id_requisicion_detalle (
        id,
        cantidad_solicitada,
        cantidad_despachada
      )
    `)
    .eq('id_picking', id);

  if (detalles && detalles.length > 0) {
    for (const det of detalles) {
      if (!det.id_requisicion_detalle || !det.requisicion_detalle) continue;

      const totalGestionado = Number(det.requisicion_detalle.cantidad_despachada || 0) + Number(det.cantidad);
      const solicitado = Number(det.requisicion_detalle.cantidad_solicitada);
      
      // Si ya cubrimos lo solicitado (o muy cerca por decimales), marcamos como PROCESADO
      // Si no, lo dejamos como PARCIAL para que siga en el monitor de demandas
      const nuevoEstatus = (totalGestionado >= (solicitado - 0.001)) ? 'PROCESADO' : 'PARCIAL';

      await supabase
        .from('almacen_requisiciones_detalle')
        .update({ estatus_item: nuevoEstatus })
        .eq('id', det.id_requisicion_detalle);
    }
  }

  return true;
};

/**
 * Actualiza la cantidad recolectada físicamente para un ítem del picking
 */
export const actualizarRecoleccionPicking = async (id_detalle, cantidad, id_usuario) => {
  const now = await Now();
  const { error } = await supabase
    .from('almacen_picking_detalle')
    .update({
      cantidad_recolectada: cantidad,
      timestamp_update: now,
      id_usuario_update: id_usuario
    })
    .eq('id', id_detalle);

  if (error) throw error;
  return true;
};

/**
 * Cambia el estatus del picking a RECOLECTADO indicando que la validación física terminó
 */
export const finalizarTrackingPicking = async (id_picking, id_usuario) => {
  const now = await Now();
  const { error } = await supabase
    .from('almacen_picking')
    .update({
      estatus: 'RECOLECTADO',
      timestamp_update: now,
      id_usuario_update: id_usuario
    })
    .eq('id', id_picking);

  if (error) throw error;
  return true;
};

/**
 * Anula un picking
 */
export const anularPicking = async (id, id_usuario, motivo) => {
  const now = await Now();
  const { error } = await supabase
    .from('almacen_picking')
    .update({
      estatus: 'ANULADO',
      observacion_anula: motivo,
      timestamp_anula: now,
      id_usuario_anula: id_usuario
    })
    .eq('id', id);

  if (error) throw error;

  // Auditoría en detalles
  await supabase.from('almacen_picking_detalle').update({
    timestamp_anula: now,
    id_usuario_anula: id_usuario
  }).eq('id_picking', id);

  return true;
};

/**
 * Obtiene el detalle de un picking (usado por Despacho)
 */
export const getPickingDetalle = async (id_picking) => {
  const { data, error } = await supabase
    .from('almacen_picking_detalle')
    .select(`
      *,
      almacen_productos (*)
    `)
    .eq('id_picking', id_picking);

  if (error) throw error;
  return data;
};

/**
 * Obtiene las requisiciones aprobadas para un destino que tienen items pendientes del almacén actual
 */
export const getRequisicionesParaPicking = async (id_empresa, id_sucursal, id_comedor, id_almacen) => {
  const { data, error } = await supabase
    .from('almacen_requisiciones')
    .select(`
      id,
      codigo_requisicion,
      fecha_solicitud,
      detalle:almacen_requisiciones_detalle(
        id,
        id_rubro,
        cantidad_solicitada,
        cantidad_despachada,
        estatus_item,
        rubro:almacen_rubros!inner(
          id,
          nombre,
          id_categoria,
          unidad:almacen_unidades_medida(abreviatura),
          categoria:almacen_categorias!inner(
            id,
            nombre,
            id_almacen
          ),
          tipo_fraccionamiento
        )
      )
    `)
    .eq('id_empresa', id_empresa)
    .eq('id_sucursal', id_sucursal)
    .eq('id_comedor', id_comedor)
    .in('estatus', ['PENDIENTE', 'PARCIAL', 'PICKING'])
    .eq('detalle.rubro.categoria.id_almacen', id_almacen);

  if (error) throw error;

  // Filtrar requisiciones que tengan al menos un item pendiente después de aplicar el filtro de almacén en el inner join
  return (data || []).filter(req => req.detalle && req.detalle.length > 0);
};

/**
 * Obtiene el inventario disponible en un almacén con info de rubro para la matriz de picking
 */
export const getInventarioParaPicking = async (id_almacen) => {
  const { data, error } = await supabase
    .from('almacen_inventario')
    .select(`
      *,
      producto:id_producto (
        id,
        id_rubro,
        variedad,
        peso_variable,
        rubro:id_rubro (nombre, tipo_fraccionamiento, unidad_medida:id_unidad_medida(abreviatura), categoria:id_categoria(nombre)),
        marca:id_marca (nombre),
        presentaciones:almacen_productos_codigos!id_producto (
          id,
          factor,
          es_base,
          codigo_barras,
          codigo_interno,
          presentacion:id_presentacion (nombre)
        )
      )
    `)
    .eq('id_almacen', id_almacen)
    .gt('cantidad_actual', 0)
    .order('fecha_vencimiento', { ascending: true });

  if (error) throw error;
  return data || [];
};

/**
 * Busca un picking borrador para un destino específico
 */
export const findDraftPicking = async (id_empresa, id_almacen, id_sucursal, id_comedor) => {
  const { data, error } = await supabase
    .from('almacen_picking')
    .select('*')
    .eq('id_empresa', id_empresa)
    .eq('id_almacen', id_almacen)
    .eq('id_sucursal', id_sucursal)
    .eq('id_comedor', id_comedor)
    .eq('estatus', 'BORRADOR')
    .maybeSingle();

  if (error) throw error;
  return data;
};

/**
 * Obtiene las cantidades comprometidas en pickings PENDIENTES para un set de requisiciones
 */
export const getCommittedQuantities = async (id_requisiciones) => {
  if (!id_requisiciones || id_requisiciones.length === 0) return [];

  // Al ser id_requisicion una columna JSONB, traemos los pendientes y filtramos en JS
  const { data, error } = await supabase
    .from('almacen_picking_detalle')
    .select(`
      id_producto,
      cantidad,
      lote,
      id_requisicion_detalle,
      producto:id_producto (
        id_rubro
      ),
      picking:id_picking!inner (
        id,
        estatus,
        id_requisicion
      )
    `)
    .eq('picking.estatus', 'PENDIENTE');

  if (error) throw error;

  // Filtrar los detalles cuyos pickings contengan alguna de nuestras requisiciones
  return (data || []).filter(item => {
    const pickingReqs = item.picking?.id_requisicion;
    if (Array.isArray(pickingReqs)) {
      return pickingReqs.some(id => id_requisiciones.includes(parseInt(id)));
    }
    return false;
  });
};

/**
 * Guarda múltiples pickings de forma atómica usando RPC
 */
export const guardarPickingMasivo = async (id_empresa, id_almacen, id_usuario, pickings) => {
  try {
    const now = await Now();
    const { data, error } = await supabase.rpc('fn_guardar_picking_masivo', {
      p_id_empresa: id_empresa,
      p_id_almacen: id_almacen,
      p_id_usuario: id_usuario,
      p_pickings: pickings,
      p_timestamp_ahora: now
    });

    if (error) throw error;
    return { success: true, count: data.pickings?.length || 0 };
  } catch (error) {
    console.error("Error en guardarPickingMasivo RPC:", error);
    return { success: false, message: error.message };
  }
};

/**
 * Obtiene el total comprometido por producto y lote en un almacén (pickings BORRADOR/PENDIENTE)
 * Retorna un mapa: { "idProducto_lote": pesoTotalEnBase }
 */
export const getCommittedStockByAlmacen = async (id_almacen) => {
  const { data, error } = await supabase
    .from('almacen_picking_detalle')
    .select(`
      id_producto,
      lote,
      cantidad,
      factor,
      picking:id_picking!inner(id_almacen, estatus)
    `)
    .eq('picking.id_almacen', id_almacen)
    .in('picking.estatus', ['BORRADOR', 'PENDIENTE']);

  if (error) throw error;
  
  const map = {};
  (data || []).forEach(item => {
    const key = `${item.id_producto}_${item.lote || 'null'}`;
    const weight = Number(item.cantidad) * Number(item.factor || 1);
    map[key] = (map[key] || 0) + weight;
  });
  return map;
};
