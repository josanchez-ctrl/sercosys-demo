import { supabase } from '../lib/supabase';
import { Now } from './nowService';

/**
 * SERVICIO DE GESTIÓN DE ACTIVOS LOGÍSTICOS
 */

export const getAlmacenActivosConfig = async (id_empresa) => {
    // 1. Obtener el ID del almacén "ACTIVO FIJO"
    const { data: almacen, error: errorAlmacen } = await supabase
        .from('almacenes')
        .select('id')
        .eq('id_empresa', id_empresa)
        .ilike('nombre', '%ACTIVO%')
        .limit(1)
        .single();
        
    if (errorAlmacen) throw errorAlmacen;
    if (!almacen) throw new Error("No se encontró un almacén de Activos Fijos.");

    // 2. Traer las categorías de ese almacén
    const { data: categorias, error: errorCategorias } = await supabase
        .from('almacen_categorias')
        .select('*')
        .eq('id_almacen', almacen.id)
        .order('nombre', { ascending: true });
        
    if (errorCategorias) throw errorCategorias;

    // 3. Traer los rubros de esas categorías
    const categoriasIds = categorias.map(c => c.id);
    const { data: rubros, error: errorRubros } = await supabase
        .from('almacen_rubros')
        .select('*, categoria:id_categoria(nombre)')
        .in('id_categoria', categoriasIds)
        .order('nombre', { ascending: true });
        
    if (errorRubros) throw errorRubros;

    // 4. Traer los productos asociados a esos rubros
    const rubrosIds = rubros.map(r => r.id);
    const { data: productos, error: errorProductos } = await supabase
        .from('almacen_productos')
        .select('*, marca:id_marca(nombre)')
        .in('id_rubro', rubrosIds)
        .order('variedad', { ascending: true });

    if (errorProductos) throw errorProductos;

    return { categorias, rubros, productos, id_almacen: almacen.id };
};

export const getActivos = async (id_empresa, filters = {}) => {
    let query = supabase
        .from('logistica_activos')
        .select(`
            *,
            producto:id_producto(
                *,
                marca:id_marca(nombre),
                rubro:id_rubro(
                    *,
                    categoria:id_categoria(nombre)
                )
            ),
            sucursal:id_sucursal_actual(nombre),
            departamento:id_departamento_actual(nombre)
        `)
        .eq('id_empresa', id_empresa);

    if (filters.id_sucursal) query = query.eq('id_sucursal_actual', filters.id_sucursal);
    if (filters.estatus_logistico) query = query.eq('estatus_logistico', filters.estatus_logistico);

    const { data, error } = await query.order('codigo_inventario', { ascending: true });

    if (error) throw error;
    return data;
};

export const saveActivo = async (payload) => {
    const { id, id_empresa, id_usuario, ...campos } = payload;
    const now = await Now();

    // Sanitizar strings vacíos a null para campos FK o numéricos
    Object.keys(campos).forEach(key => {
        if (campos[key] === '') campos[key] = null;
    });

    // Si la condición es RESGUARDO, no se debe asociar a sucursal ni departamento
    if (campos.condicion === 'RESGUARDO') {
        campos.id_sucursal_actual = null;
        campos.id_departamento_actual = null;
    }

    // Remover campos que solo sirven para UI (filtros en cascada)
    delete campos.id_categoria;
    delete campos.id_rubro;

    if (id) {
        // Obtener el registro actual para comparar si hubo cambios físicos o operativos
        const { data: oldActivo } = await supabase
            .from('logistica_activos')
            .select('*')
            .eq('id', id)
            .single();

        const locationOrStatusChanged = 
            oldActivo.id_sucursal_actual !== (campos.id_sucursal_actual ? parseInt(campos.id_sucursal_actual) : null) ||
            oldActivo.id_departamento_actual !== (campos.id_departamento_actual ? parseInt(campos.id_departamento_actual) : null) ||
            oldActivo.condicion !== campos.condicion ||
            oldActivo.estatus_operativo !== campos.estatus_operativo;

        if (locationOrStatusChanged) {
            // Determinar tipo de movimiento según el cambio detectado
            let tipoMov = 'TRASLADO';
            if (oldActivo.estatus_operativo !== campos.estatus_operativo) {
                if (campos.estatus_operativo === 'MANTENIMIENTO') tipoMov = 'MANTENIMIENTO';
                else if (campos.estatus_operativo === 'BAJA') tipoMov = 'BAJA';
                else if (oldActivo.estatus_operativo === 'BAJA' && campos.estatus_operativo === 'ACTIVO') tipoMov = 'REACTIVACION';
                else tipoMov = 'REASIGNACION';
            } else if (oldActivo.id_departamento_actual !== (campos.id_departamento_actual ? parseInt(campos.id_departamento_actual) : null)) {
                tipoMov = 'REASIGNACION';
            }

            // Realizar el movimiento y la actualización del estado de forma atómica en BD
            const { data, error } = await supabase.rpc('fn_registrar_movimiento_activo', {
                p_id_activo: id,
                p_id_empresa: id_empresa,
                p_tipo_movimiento: tipoMov,
                p_id_sucursal_destino: campos.id_sucursal_actual ? parseInt(campos.id_sucursal_actual) : null,
                p_id_departamento_destino: campos.id_departamento_actual ? parseInt(campos.id_departamento_actual) : null,
                p_condicion_destino: campos.condicion,
                p_estatus_operativo_destino: campos.estatus_operativo,
                p_observaciones: campos.observaciones || 'Actualización de estado o ubicación de activo',
                p_id_usuario: id_usuario,
                p_timestamp: now
            });
            if (error) throw error;

            // Adicionalmente actualizamos otros campos no estructurales (serial, peso, observaciones)
            const { error: updError } = await supabase
                .from('logistica_activos')
                .update({
                    serial: campos.serial,
                    peso: campos.peso,
                    observaciones: campos.observaciones,
                    id_usuario_update: id_usuario,
                    timestamp_update: now
                })
                .eq('id', id);
            if (updError) throw updError;

            return { id };
        } else {
            // Si no cambiaron campos geográficos ni de estado, es una actualización normal
            const { data, error } = await supabase
                .from('logistica_activos')
                .update({
                    ...campos,
                    id_usuario_update: id_usuario,
                    timestamp_update: now
                })
                .eq('id', id)
                .select().single();
            if (error) throw error;
            return data;
        }
    } else {
        const { data, error } = await supabase
            .from('logistica_activos')
            .insert({
                ...campos,
                id_empresa,
                id_usuario_create: id_usuario,
                timestamp_create: now
            })
            .select().single();
        if (error) throw error;
        return data;
    }
};

/**
 * Obtiene el historial de movimientos de un activo
 */
export const getHistorialActivo = async (id_activo) => {
    const { data, error } = await supabase
        .from('logistica_activos_movimientos')
        .select(`
            *,
            sucursal_origen:id_sucursal_origen(nombre),
            sucursal_destino:id_sucursal_destino(nombre),
            departamento_origen:id_departamento_origen(nombre),
            departamento_destino:id_departamento_destino(nombre),
            usuario:id_usuario_create(nombres, apellidos)
        `)
        .eq('id_activo', id_activo)
        .order('timestamp_create', { ascending: false });

    if (error) throw error;
    return data;
};

/**
 * Registro masivo de activos (Capitalización)
 */
export const registerBatchActivos = async (payload) => {
    const { cantidad, id_empresa, id_usuario, ...campos } = payload;
    const now = await Now();
    const batch = [];

    // Sanitizar strings vacíos a null para campos FK o numéricos
    Object.keys(campos).forEach(key => {
        if (campos[key] === '') campos[key] = null;
    });

    // Si la condición es RESGUARDO, no se debe asociar a sucursal ni departamento
    if (campos.condicion === 'RESGUARDO') {
        campos.id_sucursal_actual = null;
        campos.id_departamento_actual = null;
    }

    delete campos.id_categoria;
    delete campos.id_rubro;

    for (let i = 0; i < cantidad; i++) {
        batch.push({
            ...campos,
            id_empresa,
            id_usuario_create: id_usuario,
            timestamp_create: now
        });
    }

    const { data, error } = await supabase
        .from('logistica_activos')
        .insert(batch)
        .select();

    if (error) throw error;
    return data;
};
