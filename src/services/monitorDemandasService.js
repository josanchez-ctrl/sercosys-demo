import { supabase } from '../lib/supabase';
import { Now } from './nowService';

/**
 * Obtiene las requisiciones PENDIENTES que contienen rubros de un almacén específico
 */
export async function getRequisicionesByAlmacen(id_empresa, id_almacen, dateStart, dateEnd, p_estatus = 'PENDIENTE') {
    if (!id_empresa || !id_almacen || !dateStart || !dateEnd) return [];

    // La lógica cambia: No filtramos por el estatus global de la REQ, sino por el contenido relativo al almacén
    let query = supabase
        .from('almacen_requisiciones')
        .select(`
            *,
            comedor:id_comedor(nombre),
            sucursal:id_sucursal(nombre),
            detalle:almacen_requisiciones_detalle!inner(
                id,
                id_rubro,
                cantidad_solicitada,
                cantidad_despachada,
                estatus_item,
                rubro:id_rubro!inner(
                    id,
                    nombre,
                    categoria:id_categoria!inner(
                        id,
                        nombre,
                        id_almacen
                    )
                )
            ),
            usuario_create:usuarios!id_usuario_create(id, nombres, apellidos),
            usuario_update:usuarios!id_usuario_update(id, nombres, apellidos),
            usuario_procesa:usuarios!id_usuario_procesa(id, nombres, apellidos),
            usuario_anula:usuarios!id_usuario_anula(id, nombres, apellidos)
        `)
        .eq('id_empresa', id_empresa)
        .gte('timestamp_create', `${dateStart}T00:00:00`)
        .lte('timestamp_create', `${dateEnd}T23:59:59`)
        .eq('almacen_requisiciones_detalle.rubro.categoria.id_almacen', id_almacen);

    if (p_estatus === 'PENDIENTE') {
        // DEMANDAS ACTIVAS: Al menos un ítem de este almacén debe estar PENDIENTE/PARCIAL/PICKING
        // Y además, su cantidad despachada debe ser menor a la solicitada (para evitar inconsistencias)
        query = query
            .in('almacen_requisiciones_detalle.estatus_item', ['PENDIENTE', 'PARCIAL', 'PICKING']);
        // Nota: El filtro de cantidad se aplica en JS para mayor precisión con decimales
    } else {
        // HISTORIAL: Ítems de este almacén que ya NO están pendientes (SURTIDO o ANULADO)
        // Nota: El estatus global de la REQ puede ser PENDIENTE o PROCESADA, no nos importa.
        query = query.not('almacen_requisiciones_detalle.estatus_item', 'in', '("PENDIENTE","PARCIAL","PICKING")');
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error obteniendo requisiciones por almacén:', error);
        return [];
    }

    // Filtro final en JS para asegurar consistencia
    if (p_estatus === 'PENDIENTE') {
        // En PENDIENTE, solo mostramos si al menos UN ítem de este almacén todavía debe mercancía
        // Y ese ítem NO está anulado ni procesado.
        return data?.filter(req =>
            req.detalle.some(d =>
                d.estatus_item !== 'ANULADO' &&
                d.estatus_item !== 'PROCESADO' &&
                (Number(d.cantidad_despachada || 0)) < (Number(d.cantidad_solicitada) - 0.001)
            )
        ) || [];
    } else {
        // En HISTORIAL (o cualquier otro), mostramos solo si TODOS los ítems de este almacén ya fueron surtidos o anulados
        return data?.filter(req =>
            req.detalle.every(d =>
                d.estatus_item === 'ANULADO' ||
                d.estatus_item === 'PROCESADO' ||
                (Number(d.cantidad_despachada || 0)) >= (Number(d.cantidad_solicitada) - 0.001)
            )
        ) || [];
    }
}

/**
 * Obtiene el detalle de una requisición filtrado por un almacén específico
 */
export async function getRequisicionDetalleByAlmacen(id_requisicion, id_almacen) {
    if (!id_requisicion || !id_almacen) return null;

    const { data, error } = await supabase
        .from('almacen_requisiciones')
        .select(`
            *,
            comedor:id_comedor(nombre),
            sucursal:id_sucursal(nombre),
            detalle:almacen_requisiciones_detalle(
                *,
                rubro:id_rubro(
                    id,
                    nombre,
                    unidad:id_unidad_medida(abreviatura),
                    categoria:id_categoria(
                        id,
                        nombre,
                        id_almacen
                    )
                )
            )
        `)
        .eq('id', id_requisicion)
        .single();

    if (error) {
        console.error('Error obteniendo detalle de REQ por almacén:', error);
        return null;
    }

    // Filtrar manualmente el detalle para asegurar que solo mostramos lo del almacén seleccionado
    if (data && data.detalle) {
        data.detalle = data.detalle.filter(item =>
            item.rubro?.categoria?.id_almacen?.toString() === id_almacen.toString()
        );
    }

    return data;
}

/**
 * Obtiene el stock disponible consolidado por RUBRO para un almacén
 * Esto es vital para saber si podemos surtir una requisición (que pide rubros genéricos)
 */
export async function getStockByAlmacen(id_almacen) {
    if (!id_almacen) return {};

    // Traemos el inventario con su rubro asociado
    const { data, error } = await supabase
        .from('almacen_inventario')
        .select(`
            cantidad_actual,
            producto:id_producto (
                id_rubro
            )
        `)
        .eq('id_almacen', id_almacen)
        .gt('cantidad_actual', 0);

    if (error) {
        console.error('Error calculando stock por rubro:', error);
        return {};
    }

    // Consolidamos por id_rubro
    const stockMap = {};
    data?.forEach(item => {
        const id_rubro = item.producto?.id_rubro;
        if (id_rubro) {
            stockMap[id_rubro] = (stockMap[id_rubro] || 0) + Number(item.cantidad_actual);
        }
    });

    return stockMap;
}

/**
 * Obtiene el stock comprometido (en pickings no procesados) para un almacén
 * Consolidado por producto y lote.
 */
export async function getStockComprometido(id_almacen) {
    if (!id_almacen) return {};

    const { data, error } = await supabase
        .from('almacen_picking_detalle')
        .select(`
            cantidad,
            lote,
            id_producto,
            picking:id_picking!inner(estatus, id_almacen)
        `)
        .eq('picking.id_almacen', id_almacen)
        .in('picking.estatus', ['BORRADOR', 'PENDIENTE']);

    if (error) {
        console.error('Error obteniendo stock comprometido:', error);
        return {};
    }

    const comprometido = {};
    data?.forEach(c => {
        const key = `${c.id_producto}_${c.lote || ''}`;
        comprometido[key] = (comprometido[key] || 0) + Number(c.cantidad);
    });

    return comprometido;
}

/**
 * Obtiene los datos completos para la Mesa de Trabajo de Despacho
 * 1. Trae las REQs seleccionadas con su detalle
 * 2. Trae el inventario detallado (Lotes, Marcas) solo de los rubros involucrados
 */
export async function getDatosMesaTrabajo(ids_requisiciones, id_almacen) {
    if (!ids_requisiciones?.length || !id_almacen) return { reqs: [], inventario: [] };

    try {
        // 1. Obtener Requisiciones con Detalle (Similar al get principal pero filtrado por IDs)
        const { data: reqs, error: errorReqs } = await supabase
            .from('almacen_requisiciones')
            .select(`
                *,
                sucursal:id_sucursal (id, nombre),
                comedor:id_comedor (id, nombre),
                detalle:almacen_requisiciones_detalle!inner(
                    id,
                    id_rubro,
                    cantidad_solicitada,
                    cantidad_despachada,
                    estatus_item,
                    rubro:id_rubro (
                        id,
                        nombre,
                        unidad:id_unidad_medida (abreviatura),
                        tipo_fraccionamiento,
                        categoria:id_categoria (id, nombre, id_almacen)
                    )
                )
            `)
            .in('id', ids_requisiciones)
            .in('almacen_requisiciones_detalle.estatus_item', ['PENDIENTE', 'PARCIAL', 'PICKING'])
            .eq('almacen_requisiciones_detalle.rubro.categoria.id_almacen', id_almacen);

        if (errorReqs) throw errorReqs;

        // Filtrar manualmente el detalle de cada REQ para asegurar atomicidad por almacén y estado
        const reqsFiltradas = reqs?.map(req => ({
            ...req,
            detalle: req.detalle?.filter(item =>
                item.rubro?.categoria?.id_almacen?.toString() === id_almacen.toString() &&
                ['PENDIENTE', 'PARCIAL', 'PICKING'].includes(item.estatus_item)
            ) || []
        })).filter(req => req.detalle.length > 0) || [];

        // Extraer IDs de rubros únicos para buscar solo el inventario necesario
        const rubrosIds = new Set();
        reqs?.forEach(req => {
            req.detalle?.forEach(item => rubrosIds.add(item.id_rubro));
        });

        // 2. Obtener Inventario Detallado (FEFO: Ordenado por fecha_vencimiento)
        let inventario = [];
        if (rubrosIds.size > 0) {
            const { data: invData, error: errorInv } = await supabase
                .from('almacen_inventario')
                .select(`
                    id,
                    id_almacen,
                    id_producto,
                    cantidad_actual,
                    lote,
                    fecha_vencimiento,
                    id_ubicacion,
                    costo_unidad_base,
                    ubicacion:id_ubicacion (nombre),
                    producto:id_producto!inner (
                        id,
                        id_rubro,
                        variedad,
                        rubro:id_rubro (
                            id,
                            nombre,
                            tipo_fraccionamiento,
                            unidad:id_unidad_medida (abreviatura)
                        ),
                        marca:id_marca (nombre),
                        presentaciones:almacen_productos_codigos!id_producto (
                            id,
                            factor,
                            es_base,
                            presentacion:id_presentacion (nombre)
                        )
                    )
                `)
                .eq('id_almacen', id_almacen)
                .in('producto.id_rubro', Array.from(rubrosIds))
                .gt('cantidad_actual', 0)
                .order('fecha_vencimiento', { ascending: true, nullsFirst: false }); // FEFO

            inventario = invData || [];
        }

        // 3. Obtener Stock Comprometido y Restarlo
        const comprometido = await getStockComprometido(id_almacen);

        const inventarioDisponible = inventario.map(inv => {
            const key = `${inv.id_producto}_${inv.lote || ''}`;
            const qtyComprometida = comprometido[key] || 0;

            // Buscamos el factor de la presentación marcada como BASE (que ahora es el peso del envase real)
            const baseRecord = inv.producto?.presentaciones?.find(p => p.es_base);
            const factorBase = Number(baseRecord?.factor || 1);

            return {
                ...inv,
                factor_base: factorBase,
                presentaciones: inv.producto?.presentaciones || [],
                cantidad_actual: Math.max(0, Number(inv.cantidad_actual) - qtyComprometida)
            };
        }).filter(inv => inv.cantidad_actual > 0);

        return { reqs: reqsFiltradas, inventario: inventarioDisponible };

    } catch (error) {
        console.error('Error obteniendo datos para mesa de trabajo:', error);
        return { reqs: [], inventario: [] };
    }
}

/**
 * Suscribe al realtime para cambios en el inventario de un almacén
 */
export function subscribeToInventario(id_almacen, onUpdate) {
    return supabase
        .channel(`inv_changes_${id_almacen}`)
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'almacen_inventario',
                filter: `id_almacen=eq.${id_almacen}`
            },
            (payload) => {
                onUpdate(payload);
            }
        )
        .subscribe();
}

/**
 * Suscribe al realtime para cambios en los pickings (importante para stock comprometido)
 */
export function subscribeToPickings(id_almacen, onUpdate) {
    return supabase
        .channel(`picking_changes_${id_almacen}`)
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'almacen_picking_detalle'
            },
            (payload) => {
                // Como no tenemos filtro directo por almacén en el detalle (vía rls/payload), 
                // el componente decidirá si refrescar o no, o podemos hacer un fetch ligero.
                onUpdate(payload);
            }
        )
        .subscribe();
}
/**
 * Anula un ítem de una requisición (corte de saldo)
 */
export async function anularItemDemanda(id_item, id_usuario, motivo) {
    if (!id_item || !id_usuario) return { success: false, message: 'Faltan parámetros' };

    const { data, error } = await supabase.rpc('fn_anular_item_demanda', {
        p_id_item: id_item,
        p_id_usuario: id_usuario,
        p_motivo: motivo
    });

    if (error) {
        console.error('Error anulando ítem:', error);
        return { success: false, message: error.message };
    }

    return data;
}

/**
 * Anula varios ítems de una requisición (corte de saldo masivo)
 */
export async function anularItemsDemandaMasivo(ids_items, id_usuario, motivo) {
    if (!ids_items?.length || !id_usuario) return { success: false, message: 'Faltan parámetros' };

    const { data, error } = await supabase.rpc('fn_anular_items_demanda_masivo', {
        p_ids_items: ids_items,
        p_id_usuario: id_usuario,
        p_motivo: motivo
    });

    if (error) {
        console.error('Error anulando ítems masivamente:', error);
        return { success: false, message: error.message };
    }

    // --- REFUERZO DE SEGURIDAD ---
    // Si el RPC no lo hizo (o para asegurar), forzamos el estatus a ANULADO desde JS
    await supabase
        .from('almacen_requisiciones_detalle')
        .update({
            estatus_item: 'ANULADO',
            id_usuario_anula: id_usuario,
            timestamp_anula: await Now()
        })
        .in('id', ids_items);

    return { success: true, ...data };
}
