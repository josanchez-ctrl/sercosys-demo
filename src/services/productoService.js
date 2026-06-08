import { supabase } from '../lib/supabase';
import { Now } from './nowService';

/**
 * Obtiene todos los productos de la empresa con sus relaciones resueltas.
 */
export const getProductos = async (id_empresa, id_almacen) => {
    const { data, error } = await supabase
        .from('almacen_productos')
        .select(`
            *,
            rubro:almacen_rubros!inner(
                *,
                categoria:almacen_categorias(*),
                almacen_unidades_medida(*)
            ),
            marca:almacen_marcas(*),
            logistica:almacen_productos_codigos!id_producto(
                *,
                presentacion:almacen_presentaciones(nombre),
                referencia:id_referencia (
                    id,
                    presentacion:id_presentacion (nombre)
                )
            )
        `)
        .eq('id_empresa', id_empresa)
        .order('id', { ascending: false })
        .order('orden', { foreignTable: 'almacen_productos_codigos', ascending: true });

    if (error) throw error;
    return data;
};

/**
 * Guarda un producto completo con su configuración logística (códigos de barras).
 */
export const saveProductoCompleto = async (id, payload, logistica, id_usuario) => {
    const now = await Now();
    const { data, error } = await supabase.rpc('guardar_producto_completo', {
        p_id_producto: id || null,
        p_payload: payload,
        p_logistica: logistica || [],
        p_id_usuario: id_usuario,
        p_timestamp_audit: now
    });

    if (error) throw error;
    return data;
};

/**
 * Crea un nuevo producto (DEPRECATED - Usar saveProductoCompleto).
 */
export const createProducto = async (payload, id_usuario) => {
    return saveProductoCompleto(null, payload, [], id_usuario);
};

/**
 * Actualiza un producto existente (DEPRECATED - Usar saveProductoCompleto).
 */
export const updateProducto = async (id, payload, id_usuario) => {
    return saveProductoCompleto(id, payload, [], id_usuario);
};

/**
 * Obtiene los detalles de un producto por ID.
 */
export const getProductoById = async (id) => {
    const { data, error } = await supabase
        .from('almacen_productos')
        .select(`
            *,
            rubro:almacen_rubros(*, almacen_unidades_medida(*)),
            marca:almacen_marcas(*),
            logistica:almacen_productos_codigos!id_producto(
                *,
                presentacion:almacen_presentaciones(nombre),
                referencia:id_referencia (
                    id,
                    presentacion:id_presentacion (nombre)
                )
            )
        `)
        .eq('id', id)
        .order('orden', { foreignTable: 'almacen_productos_codigos', ascending: true })
        .single();

    if (error) throw error;
    return data;
};

/**
 * Resuelve un código de barras (EAN/GS1) a un producto y presentación específica.
 */
export const resolverCodigoBarras = async (id_empresa, codigo) => {
    const { data, error } = await supabase.rpc('fn_resolver_codigo_barras', {
        p_id_empresa: id_empresa,
        p_codigo: codigo
    });

    if (error) throw error;
    return data;
};

/**
 * Obtiene los IDs de los productos de destino (derivados) para un producto origen junto con su porcentaje_costo y porcentaje_corte.
 */
export const getDerivadosPorOrigen = async (id_producto_origen) => {
    const { data, error } = await supabase
        .from('almacen_productos_derivados')
        .select('id_producto_destino, porcentaje_costo, porcentaje_corte')
        .eq('id_producto_origen', id_producto_origen);

    if (error) throw error;
    return data || [];
};

/**
 * Obtiene los IDs de los productos de origen para un producto destino junto con su porcentaje_costo y porcentaje_corte.
 */
export const getDerivadosPorDestino = async (id_producto_destino) => {
    const { data, error } = await supabase
        .from('almacen_productos_derivados')
        .select('id_producto_origen, porcentaje_costo, porcentaje_corte')
        .eq('id_producto_destino', id_producto_destino);

    if (error) throw error;
    return data || [];
};

/**
 * Guarda las relaciones de derivación para un producto origen (borra anteriores e inserta nuevas).
 */
export const saveDerivadosProducto = async (id_producto_origen, derivadosList, id_usuario) => {
    const now = await Now();

    // 1. Eliminar relaciones existentes para este origen
    const { error: deleteError } = await supabase
        .from('almacen_productos_derivados')
        .delete()
        .eq('id_producto_origen', id_producto_origen);

    if (deleteError) throw deleteError;

    // 2. Insertar nuevas relaciones si las hay
    if (derivadosList && derivadosList.length > 0) {
        const rowsToInsert = derivadosList.map(item => ({
            id_producto_origen,
            id_producto_destino: parseInt(item.id_producto_destino),
            porcentaje_costo: parseFloat(item.porcentaje_costo) || 0.00,
            porcentaje_corte: parseFloat(item.porcentaje_corte) || 0.00,
            timestamp_create: now,
            id_usuario_create: id_usuario
        }));

        const { error: insertError } = await supabase
            .from('almacen_productos_derivados')
            .insert(rowsToInsert);

        if (insertError) throw insertError;
    }
    return true;
};

/**
 * Guarda las relaciones de origen para un producto destino (borra anteriores e inserta nuevas).
 */
export const saveDerivadosDestino = async (id_producto_destino, origenesList, id_usuario) => {
    const now = await Now();

    // 1. Eliminar relaciones existentes para este destino
    const { error: deleteError } = await supabase
        .from('almacen_productos_derivados')
        .delete()
        .eq('id_producto_destino', id_producto_destino);

    if (deleteError) throw deleteError;

    // 2. Insertar nuevas relaciones si las hay
    if (origenesList && origenesList.length > 0) {
        const rowsToInsert = origenesList.map(item => ({
            id_producto_origen: parseInt(item.id_producto_origen),
            id_producto_destino,
            porcentaje_costo: parseFloat(item.porcentaje_costo) || 0.00,
            porcentaje_corte: parseFloat(item.porcentaje_corte) || 0.00,
            timestamp_create: now,
            id_usuario_create: id_usuario
        }));

        const { error: insertError } = await supabase
            .from('almacen_productos_derivados')
            .insert(rowsToInsert);

        if (insertError) throw insertError;
    }
    return true;
};

