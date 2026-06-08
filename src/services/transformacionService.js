import { supabase } from '../lib/supabase';
import { Now } from './nowService';

/**
 * SERVICIO PARA ÓRDENES DE TRANSFORMACIÓN / REENVASADO / DESPOSTE
 */

// 1. Obtener órdenes de transformación filtradas por empresa y tipo
export const getOrdenesTransformacion = async (id_empresa, tipo_proceso = 'REENVASADO', fechaInicio = null, fechaFin = null) => {
  let query = supabase
    .from('almacen_ordenes_transformacion')
    .select(`
      *,
      almacen:id_almacen (id, nombre),
      usuario_create:id_usuario_create (id, nombres, apellidos),
      usuario_update:id_usuario_update (id, nombres, apellidos),
      usuario_procesa:id_usuario_procesa (id, nombres, apellidos),
      usuario_anula:id_usuario_anula (id, nombres, apellidos)
    `)
    .eq('id_empresa', id_empresa)
    .eq('tipo_proceso', tipo_proceso)
    .order('timestamp_create', { ascending: false });

  if (fechaInicio) {
    query = query.gte('timestamp_create', `${fechaInicio}T00:00:00`);
  }
  if (fechaFin) {
    query = query.lte('timestamp_create', `${fechaFin}T23:59:59`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};
export const getOrdenTransformacionById = async (id) => {
  const { data: header, error: headerErr } = await supabase
    .from('almacen_ordenes_transformacion')
    .select(`
      *,
      almacen:id_almacen (id, nombre)
    `)
    .eq('id', id)
    .single();

  if (headerErr) throw headerErr;

  // Cargar Entradas (Consumos)
  const { data: entradas, error: entradasErr } = await supabase
    .from('almacen_orden_transformacion_entradas')
    .select(`
      *,
      inventario:id_item_inventario (
        id,
        lote,
        cantidad_actual,
        producto:id_producto (
          id,
          id_rubro,
          id_marca,
          variedad,
          rubro:id_rubro (id, nombre, porcentaje_costo_indirecto, permite_merma_reposo, categoria:id_categoria (id, nombre)),
          marca:id_marca (id, nombre)
        )
      )
    `)
    .eq('id_transformacion', id);

  if (entradasErr) throw entradasErr;

  // Cargar Salidas (Ingresos)
  const { data: salidas, error: salidasErr } = await supabase
    .from('almacen_orden_transformacion_salidas')
    .select(`
      *,
      producto:id_producto (
        id,
        variedad,
        es_subproducto,
        rubro:id_rubro (id, nombre, id_unidad_medida, requiere_marca, categoria:id_categoria (id, nombre)),
        marca:id_marca (id, nombre)
      ),
      presentacion_logistica:id_presentacion_logistica (
        id,
        factor,
        presentacion:id_presentacion (
          id,
          nombre
        )
      )
    `)
    .eq('id_transformacion', id);

  if (salidasErr) throw salidasErr;

  let invItems = [];
  if (salidas && salidas.length > 0) {
    const productIds = salidas.map(s => s.id_producto);
    const lotes = salidas.map(s => s.lote_generado);
    const { data: invData } = await supabase
      .from('almacen_inventario')
      .select('id_producto, lote, id_ubicacion, tracking_id, fecha_vencimiento')
      .eq('id_almacen', header.id_almacen)
      .in('id_producto', productIds)
      .in('lote', lotes);
    invItems = invData || [];
  }

  return { 
    ...header, 
    entradas: (entradas || []).map(e => ({
      ...e,
      // Desarmar estructura para facilitar uso en interfaz Formik
      producto_nombre: e.inventario?.producto ? [
        e.inventario.producto.rubro?.categoria?.nombre,
        e.inventario.producto.rubro?.nombre,
        e.inventario.producto.marca?.nombre,
        e.inventario.producto.variedad
      ].filter(Boolean).join(' · ') : 'Desconocido',
      lote: e.inventario?.lote || ''
    })), 
    salidas: (salidas || []).map(s => {
      const matchedInv = invItems.find(inv => 
        inv.id_producto == s.id_producto && 
        inv.lote == s.lote_generado && 
        inv.id_ubicacion == s.id_ubicacion
      );
      return {
        ...s,
        tracking_id: matchedInv ? matchedInv.tracking_id : null,
        fecha_vencimiento: matchedInv ? matchedInv.fecha_vencimiento : null,
        producto_nombre: s.producto ? [
          s.producto.rubro?.categoria?.nombre,
          s.producto.rubro?.nombre,
          s.producto.marca?.nombre,
          s.producto.variedad
        ].filter(Boolean).join(' · ') : 'Desconocido'
      };
    })
  };
};

// 3. Guardar orden de transformación (Cabecera + Entradas + Salidas)
export const saveOrdenTransformacion = async (header, entradas, salidas, id_usuario) => {
  const now = await Now();
  let headerId = header.id;
  const isEdit = !!headerId;

  const headerPayload = {
    id_empresa:   header.id_empresa,
    id_sucursal:  header.id_sucursal,
    id_almacen:   header.id_almacen,
    tipo_proceso: header.tipo_proceso || 'REENVASADO',
    estatus:      header.estatus || 'BORRADOR',
    observaciones: header.observaciones || null
  };

  if (isEdit) {
    const { error: upErr } = await supabase
      .from('almacen_ordenes_transformacion')
      .update({
        ...headerPayload,
        timestamp_update: now,
        id_usuario_update: id_usuario
      })
      .eq('id', headerId);
    if (upErr) throw upErr;
  } else {
    const { data: newHeader, error: insErr } = await supabase
      .from('almacen_ordenes_transformacion')
      .insert([{
        ...headerPayload,
        timestamp_create: now,
        id_usuario_create: id_usuario
      }])
      .select()
      .single();
    if (insErr) throw insErr;
    headerId = newHeader.id;
  }

  // Sincronizar entradas (consumos) - Borrar y re-insertar
  if (isEdit) {
    const { error: delEntradasErr } = await supabase
      .from('almacen_orden_transformacion_entradas')
      .delete()
      .eq('id_transformacion', headerId);
    if (delEntradasErr) throw delEntradasErr;
  }

  if (entradas && entradas.length > 0) {
    const cleanEntradas = entradas.map(e => ({
      id_transformacion:  headerId,
      id_item_inventario: e.id_item_inventario,
      cantidad_consumida: parseFloat(e.cantidad_consumida) || 0,
      unidad_medida:      e.unidad_medida || '--',
      costo_unitario:     parseFloat(e.costo_unitario) || 0,
      id_presentacion_logistica: e.id_presentacion_logistica || null,
      cantidad_presentacion:      parseFloat(e.cantidad_presentacion) || null,
      cantidad_mesa:      e.cantidad_mesa !== undefined && e.cantidad_mesa !== null ? parseFloat(e.cantidad_mesa) : null,
      timestamp_create:   now,
      id_usuario_create:  id_usuario
    }));

    const { error: insEntradasErr } = await supabase
      .from('almacen_orden_transformacion_entradas')
      .insert(cleanEntradas);
    if (insEntradasErr) throw insEntradasErr;
  }

  // Sincronizar salidas (ingresos) - Borrar y re-insertar
  if (isEdit) {
    const { error: delSalidasErr } = await supabase
      .from('almacen_orden_transformacion_salidas')
      .delete()
      .eq('id_transformacion', headerId);
    if (delSalidasErr) throw delSalidasErr;
  }

  if (salidas && salidas.length > 0) {
    const cleanSalidas = salidas.map(s => ({
      id_transformacion:  headerId,
      id_producto:        s.id_producto,
      cantidad_obtenida:  parseFloat(s.cantidad_obtenida) || 0,
      unidad_medida:      s.unidad_medida || '--',
      lote_generado:      s.lote_generado || '',
      costo_unitario:     parseFloat(s.costo_unitario) || 0,
      es_scrap:           !!s.es_scrap,
      id_ubicacion:       s.id_ubicacion || null,
      id_presentacion_logistica: s.id_presentacion_logistica || null,
      cantidad_presentacion:      s.cantidad_presentacion ? parseFloat(s.cantidad_presentacion) : null,
      timestamp_create:   now,
      id_usuario_create:  id_usuario
    }));

    const { error: insSalidasErr } = await supabase
      .from('almacen_orden_transformacion_salidas')
      .insert(cleanSalidas);
    if (insSalidasErr) throw insSalidasErr;
  }

  return headerId;
};

// 4. Procesar orden (invocar RPC atómico)
export const procesarOrdenTransformacion = async (id, id_usuario) => {
  const now = await Now();
  const { error } = await supabase.rpc('fn_procesar_transformacion_inventario', {
    p_id_transformacion: id,
    p_id_usuario:        id_usuario,
    p_timestamp:         now
  });

  if (error) throw error;
  return true;
};

// 5. Anular orden
export const anularOrdenTransformacion = async (id, id_usuario) => {
  const now = await Now();
  const { error } = await supabase
    .from('almacen_ordenes_transformacion')
    .update({
      estatus:            'ANULADO',
      timestamp_anula:    now,
      id_usuario_anula:   id_usuario,
      timestamp_update:   now,
      id_usuario_update:  id_usuario
    })
    .eq('id', id);

  if (error) throw error;
  return true;
};

// 6. Iniciar reenvasado (pasar de Borrador a En Proceso)
export const iniciarTransformacion = async (id, id_usuario) => {
  const now = await Now();
  const { error } = await supabase.rpc('fn_iniciar_transformacion', {
    p_id_transformacion: id,
    p_id_usuario:        id_usuario,
    p_timestamp:         now
  });

  if (error) throw error;
  return true;
};

// 7. Declarar salida parcial/fraccionada
export const declararSalidaTransformacion = async (payload, id_usuario) => {
  const now = await Now();
  const { error } = await supabase.rpc('fn_declarar_salida_transformacion', {
    p_id_transformacion:         payload.id_transformacion,
    p_id_entrada_transformacion: payload.id_entrada_transformacion,
    p_id_producto_salida:        payload.id_producto_salida,
    p_cantidad_obtenida:         parseFloat(payload.cantidad_obtenida) || 0,
    p_unidad_medida:             payload.unidad_medida,
    p_cantidad_insumo_descontar: parseFloat(payload.cantidad_insumo_descontar) || 0,
    p_id_ubicacion_destino:      payload.id_ubicacion_destino || null,
    p_costo_unitario_salida:     parseFloat(payload.costo_unitario_salida) || 0,
    p_id_usuario:                id_usuario,
    p_timestamp:                 now,
    p_id_presentacion_logistica: payload.id_presentacion_logistica || null,
    p_cantidad_presentacion:     payload.cantidad_presentacion ? parseFloat(payload.cantidad_presentacion) : null
  });

  if (error) throw error;
  return true;
};

// 8. Finalizar y cerrar orden
export const finalizarTransformacion = async (id, id_usuario) => {
  const now = await Now();
  const { error } = await supabase.rpc('fn_finalizar_transformacion', {
    p_id_transformacion: id,
    p_id_usuario:        id_usuario,
    p_timestamp:         now
  });

  if (error) throw error;
  return true;
};

// 9. Revertir/anular una salida parcial
export const revertirSalidaTransformacion = async (idSalida, idUsuario) => {
  const now = await Now();
  const { error } = await supabase.rpc('fn_revertir_salida_transformacion', {
    p_id_salida:  idSalida,
    p_id_usuario: idUsuario,
    p_timestamp:  now
  });

  if (error) throw error;
  return true;
};

// 10. Obtener o crear TRK en caliente para etiquetas bajo demanda
export const obtenerOCrearTrkTransformacion = async (payload, id_usuario) => {
  const { data, error } = await supabase.rpc('fn_obtener_o_crear_trk_transformacion', {
    p_id_transformacion:         payload.id_transformacion,
    p_id_entrada_transformacion: payload.id_entrada_transformacion,
    p_id_producto_salida:        payload.id_producto_salida,
    p_id_presentacion_logistica: payload.id_presentacion_logistica || null,
    p_id_ubicacion_destino:      payload.id_ubicacion_destino || null,
    p_id_usuario:                id_usuario
  });

  if (error) throw error;
  return data; // Retorna el tracking_id
};


