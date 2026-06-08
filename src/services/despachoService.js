import { supabase } from '../lib/supabase';

/**
 * SERVICIO DE DESPACHOS (ALMACÉN PRINCIPAL -> COMEDOR)
 * Maneja la salida de inventario desde el almacén principal hacia los comedores.
 */

// Genera un despacho logístico (Guía de Despacho) desde Almacén Principal
export const generarDespacho = async (payload, id_usuario, timestamp_ahora) => {
    const { data, error } = await supabase.rpc('fn_generar_despacho', {
        p_id_empresa: payload.id_empresa,
        p_id_sucursal: payload.id_sucursal,
        p_id_comedor: payload.id_comedor,
        p_id_almacen_origen: payload.id_almacen_origen,
        p_id_usuario: id_usuario,
        p_timestamp_ahora: timestamp_ahora,
        p_transporte: payload.transporte,
        p_items: payload.items,
        // Cestas del picking que van en el camión (array [{id_tara, descripcion, cantidad}])
        p_cestas: payload.cestas || []
    });

    if (error) {
        console.error('Error en generarDespacho RPC:', error);
        throw error;
    }
    return data;
};

/**
 * Registra el retorno de cestas al despacho cuando el vehículo regresa
 * Actualiza cestas_retornadas en la cabecera del despacho
 */
export const registrarRetornoCestas = async (id_despacho, cestas_retornadas, id_usuario) => {
    const { error } = await supabase
        .from('almacen_despacho')
        .update({ cestas_retornadas })
        .eq('id', id_despacho);

    if (error) throw error;
    return true;
};

// Obtiene pickings procesados listos para despacho
export const getPickingsListosParaDespacho = async (id_empresa, id_almacen, dateStart, dateEnd) => {
    const { data, error } = await supabase
        .from('almacen_picking')
        .select(`
            *,
            sucursal:id_sucursal(id, nombre),
            comedor:id_comedor(id, nombre),
            usuario_create:id_usuario_create(id, nombres, apellidos),
            usuario_procesa:id_usuario_procesa(id, nombres, apellidos),
            almacen_picking_detalle(
                *,
                presentacion_logistica:id_presentacion_logistica(
                    id,
                    factor,
                    presentacion:id_presentacion(nombre)
                ),
                producto:id_producto(
                    id,
                    variedad,
                    rubro:id_rubro(
                        id,
                        nombre,
                        unidad:id_unidad_medida(abreviatura)
                    ),
                    marca:id_marca(nombre),
                    presentaciones:almacen_productos_codigos!id_producto (
                        id,
                        factor,
                        es_base,
                        presentacion:id_presentacion (nombre)
                    )
                )
            )
        `)
        .eq('id_empresa', id_empresa)
        .eq('id_almacen', id_almacen)
        .eq('estatus', 'RECOLECTADO')
        .gte('timestamp_update', dateStart)
        .lte('timestamp_update', dateEnd)
        .order('timestamp_update', { ascending: false });

    if (error) throw error;
    return data;
};

// Obtiene el historial de despachos (guías)
export const getHistorialDespachos = async (id_empresa, id_almacen_origen, dateStart, dateEnd) => {
    const { data, error } = await supabase
        .from('almacen_despacho')
        .select(`
            *,
            sucursal:id_sucursal(id, nombre),
            comedor:id_comedor(id, nombre),
            usuario_create:id_usuario_create(id, nombres, apellidos),
            usuario_procesa:id_usuario_procesa(id, nombres, apellidos),
            almacen_despacho_detalle(
                *,
                picking_detalle:id_picking_detalle(
                    *,
                    presentacion_logistica:id_presentacion_logistica(
                        id,
                        factor,
                        presentacion:id_presentacion(nombre)
                    ),
                    producto:id_producto(
                        id,
                        variedad,
                        peso_variable,
                        rubro:id_rubro(
                            id,
                            nombre,
                            unidad:id_unidad_medida(abreviatura)
                        ),
                        marca:id_marca(nombre),
                        presentaciones:almacen_productos_codigos!id_producto (
                            id,
                            factor,
                            es_base,
                            presentacion:id_presentacion (nombre)
                        )
                    ),
                    picking:id_picking(
                        *,
                        usuario_procesa:id_usuario_procesa(id, nombres, apellidos)
                    )
                )
            )
        `)
        .eq('id_empresa', id_empresa)
        .eq('id_almacen_origen', id_almacen_origen)
        .gte('timestamp_create', dateStart)
        .lte('timestamp_create', dateEnd)
        .order('timestamp_create', { ascending: false });

    if (error) throw error;
    return data;
};
