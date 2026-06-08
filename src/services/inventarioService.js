import { supabase } from '../lib/supabase';

/**
 * Obtiene los lotes disponibles para un producto en un almacén específico
 */
export async function getLotesPorProducto(id_almacen, id_producto) {
  if (!id_almacen || !id_producto) return [];

  const { data, error } = await supabase
    .from('almacen_inventario')
    .select('*, ubicacion:id_ubicacion(*)')
    .eq('id_almacen', id_almacen)
    .eq('id_producto', id_producto)
    .gt('cantidad_actual', 0)
    .order('fecha_vencimiento', { ascending: true }); // FEFO by default

  if (error) {
    console.error('Error obteniendo lotes:', error);
    return [];
  }

  return data || [];
}

/**
 * Obtiene el inventario consolidado de un almacén
 */
export async function getInventarioAlmacen(id_almacen) {
  if (!id_almacen) return [];

  const { data, error } = await supabase
    .from('almacen_inventario')
    .select(`
      *,
      usuario_bloqueo:id_usuario_bloqueo(nombres, apellidos),
      detalle:id_cotejo_detalle(
        factor,
        id_presentacion_logistica
      ),
      producto: id_producto (
        id,
        variedad,
        peso_variable,
        es_insumo_transformacion,
        es_resultado_transformacion,
        es_reprocesable,
        rubro: id_rubro (nombre, tipo_fraccionamiento, porcentaje_costo_indirecto, permite_merma_reposo, unidad:id_unidad_medida(abreviatura), categoria:id_categoria(nombre)),
        marca: id_marca (nombre),
        logistica: almacen_productos_codigos!almacen_productos_codigos_id_producto_fkey (
          id,
          factor,
          es_base,
          orden,
          id_presentacion,
          presentacion: id_presentacion (nombre)
        )
      ),
      ubicacion:id_ubicacion(*)
    `)
    .eq('id_almacen', id_almacen)
    .order('timestamp_create', { ascending: false });

  if (error) {
    console.error('Error obteniendo inventario:', error);
    return [];
  }

  return data || [];
}

/**
 * Ajuste manual de inventario físico
 */
export async function ajustarInventarioAlmacen(id_inventario, nueva_cantidad, motivo, id_usuario) {
  if (!id_inventario || nueva_cantidad < 0 || !motivo || !id_usuario) return { success: false, message: 'Faltan parámetros o cantidad inválida' };

  const { data, error } = await supabase.rpc('fn_ajustar_inventario_almacen', {
    p_id_inventario: id_inventario,
    p_nueva_cantidad: nueva_cantidad,
    p_motivo: motivo,
    p_id_usuario: id_usuario
  });

  if (error) {
    console.error('Error ajustando inventario:', error);
    return { success: false, message: error.message };
  }

  return data;
}

/**
 * Bloquea o desbloquea un lote
 */
export async function bloquearLoteAlmacen(id_inventario, is_bloqueado, motivo, id_usuario) {
  if (!id_inventario || !id_usuario || (is_bloqueado && !motivo)) return { success: false, message: 'Faltan parámetros obligatorios' };

  const { data, error } = await supabase.rpc('fn_bloquear_lote_almacen', {
    p_id_inventario: id_inventario,
    p_is_bloqueado: is_bloqueado,
    p_motivo: motivo || null,
    p_id_usuario: id_usuario
  });

  if (error) {
    console.error('Error bloqueando lote:', error);
    return { success: false, message: error.message };
  }

  return data;
}

/**
 * Obtiene todos los lotes disponibles para cualquier producto de un rubro específico
 */
export async function getLotesPorRubro(id_almacen, id_rubro) {
  if (!id_almacen || !id_rubro) return [];

  const { data, error } = await supabase
    .from('almacen_inventario')
    .select(`
      *,
      producto: id_producto!inner (
        id,
        variedad,
        id_rubro,
        rubro: id_rubro (id, nombre, unidad_medida:id_unidad_medida(id,nombre, abreviatura)),
        marca: id_marca (id, nombre)
      ),
      ubicacion:id_ubicacion(*)
    `)
    .eq('id_almacen', id_almacen)
    .eq('producto.id_rubro', id_rubro)
    .gt('cantidad_actual', 0)
    .order('fecha_vencimiento', { ascending: true });

  if (error) {
    console.error('Error obteniendo lotes por rubro:', error);
    return [];
  }

  // Filtrar nulos si la relación no se cumplió en PostgREST
  return (data || []).filter(item => item.producto !== null);
}

/**
 * Obtiene los lotes disponibles en el inventario de un COMEDOR específico para un rubro
 */
export async function getLotesPorRubroComedor(id_comedor, id_rubro) {
  if (!id_comedor || !id_rubro) return [];

  const { data, error } = await supabase
    .from('almacen_comedor_inventario')
    .select(`
      *,
      presentacion: id_presentacion_logistica (
        id,
        factor,
        presentacion: id_presentacion (nombre)
      ),
      producto: id_producto!inner (
        id,
        variedad,
        id_rubro,
        rubro: id_rubro (
          id, 
          nombre, 
          tipo_fraccionamiento,
          unidad_medida:id_unidad_medida(id,nombre, abreviatura)
        ),
        marca: id_marca (id, nombre)
      )
    `)
    .eq('id_comedor', id_comedor)
    .eq('producto.id_rubro', id_rubro)
    .gt('cantidad_actual', 0)
    .order('fecha_vencimiento', { ascending: true });

  if (error) {
    console.error('Error obteniendo lotes de comedor:', error);
    return [];
  }

  return (data || []).filter(item => item.producto !== null);
}

/**
 * Obtiene el inventario detallado de un COMEDOR específico
 */
export async function getInventarioComedor(id_comedor) {
  if (!id_comedor) return [];

  const { data, error } = await supabase
    .from('almacen_comedor_inventario')
    .select(`
      *,
      usuario_bloqueo:usuarios!id_usuario_bloqueo(nombres, apellidos),
      producto: id_producto (
        id,
        variedad,
        rubro: id_rubro (nombre, tipo_fraccionamiento, unidad:id_unidad_medida(abreviatura), categoria:id_categoria(nombre)),
        marca: id_marca (nombre),
        logistica: almacen_productos_codigos!almacen_productos_codigos_id_producto_fkey (
          id,
          factor,
          es_base,
          orden,
          id_presentacion,
          presentacion: id_presentacion (nombre)
        )
      )
    `)
    .eq('id_comedor', id_comedor)
    .order('timestamp_create', { ascending: false });

  if (error) {
    console.error('Error obteniendo inventario de comedor:', error);
    return [];
  }

  return data || [];
}

/**
 * Ajuste manual de inventario físico en COMEDOR
 */
export async function ajustarInventarioComedor(id_inventario, nueva_cantidad, motivo, id_usuario) {
  if (!id_inventario || nueva_cantidad < 0 || !motivo || !id_usuario) return { success: false, message: 'Faltan parámetros o cantidad inválida' };

  const { data, error } = await supabase.rpc('fn_ajustar_inventario_comedor', {
    p_id_inventario: id_inventario,
    p_nueva_cantidad: nueva_cantidad,
    p_motivo: motivo,
    p_id_usuario: id_usuario
  });

  if (error) {
    console.error('Error ajustando inventario de comedor:', error);
    return { success: false, message: error.message };
  }

  return data;
}

/**
 * Bloquea o desbloquea un lote en COMEDOR
 */
export async function bloquearLoteComedor(id_inventario, is_bloqueado, motivo, id_usuario) {
  if (!id_inventario || !id_usuario || (is_bloqueado && !motivo)) return { success: false, message: 'Faltan parámetros obligatorios' };

  const { data, error } = await supabase.rpc('fn_bloquear_lote_comedor', {
    p_id_inventario: id_inventario,
    p_is_bloqueado: is_bloqueado,
    p_motivo: motivo || null,
    p_id_usuario: id_usuario
  });

  if (error) {
    console.error('Error bloqueando lote de comedor:', error);
    return { success: false, message: error.message };
  }

  return data;
}
