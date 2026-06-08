import { supabase } from '../lib/supabase';
import { Now } from './nowService';

/**
 * SERVICIO DE DESPACHOS DE COCINA (COCINA -> LÍNEA / CATERING)
 * Maneja la salida de alimentos preparados, utensilios y empaques hacia los puntos de servicio.
 * Principio SAP MM: ningún movimiento sin maestro de material registrado en almacen_comedor_inventario.
 */

// 1. Obtener Utensilios del Comedor (categoría UTENSILIOS — ítems retornables)
export const getUtensiliosComedor = async (id_empresa, id_sucursal, id_comedor) => {
    const { data, error } = await supabase
        .from('almacen_comedor_inventario')
        .select(`
            id,
            cantidad_actual,
            lote,
            producto:id_producto (
                id,
                variedad,
                es_recipiente_transporte,
                peso_tara_estandar,
                marca:id_marca(nombre),
                rubro:id_rubro (
                    id,
                    nombre,
                    categoria:id_categoria (id, nombre)
                )
            )
        `)
        .eq('id_empresa', id_empresa)
        .eq('id_sucursal', id_sucursal)
        .eq('id_comedor', id_comedor)
        .eq('is_bloqueado', false)
        .gt('cantidad_actual', 0);

    if (error) throw error;

    // Filtrar solo los ítems cuya categoría sea UTENSILIOS
    const filtered = (data || []).filter(
        item => item.producto?.rubro?.categoria?.nombre?.toUpperCase() === 'UTENSILIOS'
    );

    // Obtener las cantidades comprometidas en despachos de estado BORRADOR
    const { data: drafts, error: errDrafts } = await supabase
        .from('cocina_despachos')
        .select('id')
        .eq('id_comedor_destino', id_comedor)
        .eq('estatus', 'BORRADOR');

    if (errDrafts) throw errDrafts;

    const committedMap = {};
    if (drafts && drafts.length > 0) {
        const draftIds = drafts.map(d => d.id);
        const { data: details, error: errDetails } = await supabase
            .from('cocina_despachos_detalles')
            .select('id_item_inventario_comedor, cantidad_despachada')
            .in('id_despacho', draftIds);

        if (errDetails) throw errDetails;

        (details || []).forEach(det => {
            if (det.id_item_inventario_comedor) {
                const itemId = det.id_item_inventario_comedor;
                const qty = Number(det.cantidad_despachada) || 0;
                committedMap[itemId] = (committedMap[itemId] || 0) + qty;
            }
        });
    }

    return filtered.map(item => {
        const committedQty = committedMap[item.id] || 0;
        return {
            ...item,
            cantidad_actual: Math.max(0, item.cantidad_actual - committedQty)
        };
    });
};

// 2a. Obtener los id_rubro que tienen saldo activo en comedor_cocina_saldos para un comedor dado
export const getRubrosConSaldoCocina = async (id_empresa, id_comedor) => {
    const { data, error } = await supabase
        .from('comedor_cocina_saldos')
        .select('id_rubro, rubro:id_rubro(id,nombre), id_producto, cantidad')
        .eq('id_empresa', id_empresa)
        .eq('id_comedor', id_comedor)
        .gt('cantidad', 0);

    if (error) throw error;
    //return (data || []).map(r => r.id_rubro);
    return data || [];
};

// 2b. Obtener Productos del Inventario del Comedor filtrados por rubros con saldo en cocina
//     Si se pasa rubroIds (array de ids), solo devuelve productos cuyo rubro esté en esa lista.
export const getProductosComedorParaDespacho = async (id_empresa, id_sucursal, id_comedor, rubroIds = null) => {
    let query = supabase
        .from('almacen_comedor_inventario')
        .select(`
            id,
            cantidad_actual,
            lote,
            producto:id_producto (
                id,
                variedad,
                marca:id_marca(nombre),
                rubro:id_rubro (
                    id,
                    nombre,
                    categoria:id_categoria (id, nombre),
                    unidad_medida:id_unidad_medida(id, abreviatura, nombre)
                )
            )
        `)
        .eq('id_empresa', id_empresa)
        .eq('id_sucursal', id_sucursal)
        .eq('id_comedor', id_comedor)
        .eq('is_bloqueado', false)
        .gt('cantidad_actual', 0)
        .order('id', { ascending: true });

    const { data, error } = await query;
    if (error) throw error;

    const items = data || [];

    // Obtener las cantidades comprometidas en despachos de estado BORRADOR
    const { data: drafts, error: errDrafts } = await supabase
        .from('cocina_despachos')
        .select('id')
        .eq('id_comedor_destino', id_comedor)
        .eq('estatus', 'BORRADOR');

    if (errDrafts) throw errDrafts;

    const committedMap = {};
    if (drafts && drafts.length > 0) {
        const draftIds = drafts.map(d => d.id);
        const { data: details, error: errDetails } = await supabase
            .from('cocina_despachos_detalles')
            .select('id_item_inventario_comedor, cantidad_despachada')
            .in('id_despacho', draftIds);

        if (errDetails) throw errDetails;

        (details || []).forEach(det => {
            if (det.id_item_inventario_comedor) {
                const itemId = det.id_item_inventario_comedor;
                const qty = Number(det.cantidad_despachada) || 0;
                committedMap[itemId] = (committedMap[itemId] || 0) + qty;
            }
        });
    }

    const mappedItems = items.map(item => {
        const committedQty = committedMap[item.id] || 0;
        return {
            ...item,
            cantidad_actual: Math.max(0, item.cantidad_actual - committedQty)
        };
    });

    // Si se proporcionó una lista de rubros, filtramos en cliente para no necesitar función RPC
    if (rubroIds && rubroIds.length > 0) {
        const rubroSet = new Set(rubroIds.map(Number));
        return mappedItems.filter(item => {
            const idRubro = item.producto?.rubro?.id;
            return idRubro && rubroSet.has(Number(idRubro));
        });
    }

    return mappedItems;
};

// 2c. Obtener solo Productos Desechables del Inventario del Comedor con saldo en cocina
export const getProductosDesechablesComedor = async (id_empresa, id_sucursal, id_comedor, rubroIds = null) => {
    const todos = await getProductosComedorParaDespacho(id_empresa, id_sucursal, id_comedor, rubroIds);
    return todos.filter(
        item => item.producto?.rubro?.categoria?.nombre?.toUpperCase()?.startsWith('DESECHABLE')
    );
};
// 3. Guardar Despacho (Cabecera + Detalles) en estatus BORRADOR
export const guardarDespachoCocina = async (cabecera, detalles) => {
    const nowStr = await Now();

    const { data: dispatch, error: errInsert } = await supabase
        .from('cocina_despachos')
        .insert({
            id_empresa:             cabecera.id_empresa,
            id_sucursal_origen:     cabecera.id_sucursal_origen,
            id_comedor_destino:     cabecera.id_comedor_destino,
            id_tipo_servicio:       cabecera.id_tipo_servicio,
            tipo_salida:            cabecera.tipo_salida,
            estatus:                'BORRADOR',
            comensales_estimados:   cabecera.comensales_estimados || 0,
            personal_serco_estimado: cabecera.personal_serco_estimado || 0,
            responsable_traslado:   cabecera.responsable_traslado || null,
            cargo_responsable:      cabecera.cargo_responsable || null,
            tipo_vehiculo:          cabecera.tipo_vehiculo || null,
            placa_vehiculo:         cabecera.placa_vehiculo || null,
            ruta_entrega:           cabecera.ruta_entrega || null,
            hora_contratada:        cabecera.hora_contratada || null,
            timestamp_create:       nowStr,
            id_usuario_create:      cabecera.id_usuario_create
        })
        .select()
        .single();

    if (errInsert) throw errInsert;

    const detallesConDespacho = detalles.map(det => ({
        id_despacho:                dispatch.id,
        bloque_tipo:                det.bloque_tipo,
        id_item_inventario_comedor: det.id_item_inventario_comedor || null,
        id_receta:                  det.id_receta || null,
        es_insumo_aparte:           det.es_insumo_aparte || false,
        id_grupo_bandeja:           det.id_grupo_bandeja || null,
        raciones_despachadas:       det.raciones_despachadas || null,
        peso_bruto:                 det.peso_bruto || null,
        tara:                       det.tara || null,
        cantidad_bandejas:          det.cantidad_bandejas || null,
        cantidad_despachada:        det.cantidad_despachada || 1.00,
        volumen_despachado:         det.volumen_despachado || null,
        unidad_volumen:             det.unidad_volumen || null,
        timestamp_create:           nowStr
    }));

    const { error: errDetails } = await supabase
        .from('cocina_despachos_detalles')
        .insert(detallesConDespacho);

    if (errDetails) {
        await supabase.from('cocina_despachos').delete().eq('id', dispatch.id);
        throw errDetails;
    }

    return dispatch;
};

// 4. Obtener Historial de Despachos de Cocina de una Sucursal
export const getDespachosCocinaPorSucursal = async (id_sucursal) => {
    const { data, error } = await supabase
        .from('cocina_despachos')
        .select(`
            *,
            sucursal:id_sucursal_origen (id, nombre),
            comedor:id_comedor_destino (id, nombre),
            servicio:id_tipo_servicio (id, nombre),
            usuario_create:id_usuario_create (id, nombres, apellidos),
            usuario_update:id_usuario_update (id, nombres, apellidos)
        `)
        .eq('id_sucursal_origen', id_sucursal)
        .order('id', { ascending: false });

    if (error) throw error;
    return data || [];
};

// 5. Obtener Detalles de un Despacho Específico
export const getDespachoCocinaDetalles = async (id_despacho) => {
    const { data, error } = await supabase
        .from('cocina_despachos_detalles')
        .select(`
            *,
            receta:id_receta (id, codigo_ficha, nombre),
            item_inventario:id_item_inventario_comedor (
                id,
                cantidad_actual,
                lote,
                producto:id_producto (
                    id,
                    variedad,
                    marca:id_marca(nombre),
                    rubro:id_rubro (
                        id,
                        nombre,
                        categoria:id_categoria (id, nombre)
                    )
                )
            )
        `)
        .eq('id_despacho', id_despacho)
        .order('id_grupo_bandeja', { ascending: true, nullsFirst: true })
        .order('id', { ascending: true });

    if (error) throw error;
    return data || [];
};

// 6. Obtener Recetas Planificadas y el Maestro Flexible
export const getRecetasPlanificadasYMaestro = async (id_empresa, fecha, id_comedor, id_tipo_servicio) => {
    const { data: ejecuciones, error: errEjec } = await supabase
        .from('comedor_ejecucion_diaria')
        .select(`id, comedor_ejecucion_detalle (id_receta)`)
        .eq('id_comedor', id_comedor)
        .eq('fecha_ejecucion', fecha)
        .eq('id_tipo_servicio', id_tipo_servicio)
        .neq('estatus', 'ANULADO');

    const planificadasIds = new Set();
    if (ejecuciones?.length > 0) {
        ejecuciones.forEach(ej => {
            ej.comedor_ejecucion_detalle?.forEach(r => planificadasIds.add(r.id_receta));
        });
    }

    const { data: maestro, error: errMaestro } = await supabase
        .from('maestro_recetas')
        .select(`
            id, codigo_ficha, nombre,
            tipologia:id_tipologia(id, nombre),
            unidad_medida:id_unidad_medida(id, abreviatura, nombre)
        `)
        .eq('id_empresa', id_empresa)
        .eq('estatus', true);

    if (errMaestro) throw errMaestro;

    return (maestro || []).map(r => ({
        ...r,
        // Si no tiene unidad asignada, se asume KG por defecto
        unidad_medida_abreviatura: r.unidad_medida?.abreviatura || 'KG',
        es_planificado: planificadasIds.has(r.id)
    })).sort((a, b) => {
        if (a.es_planificado && !b.es_planificado) return -1;
        if (!a.es_planificado && b.es_planificado) return 1;
        return a.nombre.localeCompare(b.nombre);
    });
};

// 7. Procesar Salida del Despacho — Goods Issue (GI) via RPC
export const procesarSalidaDespacho = async (id_despacho, id_usuario) => {
    const nowStr = await Now();
    const { data, error } = await supabase.rpc('fn_procesar_despacho_cocina', {
        p_id_despacho: id_despacho,
        p_id_usuario:  id_usuario,
        p_timestamp:   nowStr
    });
    if (error) throw error;
    return data;
};

// 8. Registrar Retorno y Conciliación — Goods Receipt (GR) via RPC
export const registrarRetornoDespacho = async (id_despacho, comensalesReales, personalSercoReal, detallesRetorno, id_usuario) => {
    const nowStr = await Now();
    const { data, error } = await supabase.rpc('fn_retornar_despacho_cocina', {
        p_id_despacho:         id_despacho,
        p_comensales_reales:   comensalesReales,
        p_personal_serco_real: personalSercoReal,
        p_detalles_retorno:    detallesRetorno,
        p_id_usuario:          id_usuario,
        p_timestamp:           nowStr
    });
    if (error) throw error;
    return data;
};
