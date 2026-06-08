import { supabase } from '../lib/supabase';

/**
 * Obtiene lista de despachos (guías) EN TRÁNSITO para la recepción
 */
export const getDespachosPendientes = async (id_empresa, dateStart, dateEnd, perfil) => {
  if (!id_empresa) return [];

  let query = supabase
    .from('almacen_despacho')
    .select(`
      *,
      sucursal:sucursales (nombre),
      comedor:comedores (nombre),
      almacen:almacenes (nombre),
      usuario_procesa:usuarios!id_usuario_procesa(id, nombres, apellidos),
      almacen_despacho_detalle (
        *,
        picking_detalle:almacen_picking_detalle (
            *,
            presentacion_logistica:id_presentacion_logistica (
                id,
                factor,
                presentacion:id_presentacion(nombre)
            ),
            producto:almacen_productos (
                id,
                variedad,
                marca:almacen_marcas (nombre),
                rubro:almacen_rubros (
                    nombre,
                    unidad:almacen_unidades_medida (abreviatura)
                ),
                presentaciones:almacen_productos_codigos!id_producto (
                    id,
                    factor,
                    es_base,
                    presentacion:id_presentacion (nombre)
                )
            )
        )
      )
    `)
    .eq('id_empresa', id_empresa)
    .in('estatus', ['EN TRÁNSITO', 'ENTREGADO', 'RECIBIDO_TOTAL', 'RECIBIDO_PARCIAL']);

  // Filtros de fecha
  if (dateStart && typeof dateStart === 'string' && dateStart.length > 5) {
    query = query.gte('timestamp_procesa', dateStart);
  }
  if (dateEnd && typeof dateEnd === 'string' && dateEnd.length > 5) {
    query = query.lte('timestamp_procesa', dateEnd);
  }

  // Filtro por perfil
  const isSuperAdmin = perfil?.F_ALL === true;
  if (!isSuperAdmin) {
    if (Array.isArray(perfil?.ids_sucursales) && perfil.ids_sucursales.length > 0) {
      query = query.in('id_sucursal', perfil.ids_sucursales);
    }
    if (Array.isArray(perfil?.ids_comedores) && perfil.ids_comedores.length > 0) {
      query = query.in('id_comedor', perfil.ids_comedores);
    }
  }

  const { data, error } = await query.order('id', { ascending: false });
  
  if (error) throw error;
  return data || [];
};

/**
 * Recibe un despacho y aplica los ingresos al comedor
 */
export async function recibirDespacho(id_despacho, userId, detalles, timestampAhora) {
  const { data, error } = await supabase.rpc('fn_recibir_despacho_comedor', {
    p_id_despacho: id_despacho,
    p_id_usuario: userId,
    p_detalles: detalles,
    p_timestamp_ahora: timestampAhora
  });

  if (error) {
    console.error('Error en RPC fn_recibir_despacho_comedor:', error);
    return { success: false, error: error.message };
  }

  if (data?.success === false) {
    return { success: false, error: data.message };
  }

  return { success: true, data };
}
