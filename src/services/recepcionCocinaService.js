import { supabase } from '../lib/supabase';

/**
 * SERVICIO DE RECEPCIÓN (COTEJO EN COCINA)
 * Maneja la entrada de mercancía enviada desde almacén.
 */

// Obtiene los despachos (remisiones) realizados a un comedor en una fecha
export const getDespachosRecepcion = async (id_comedor, dateStart, dateEnd) => {
    try {
        let query = supabase
            .from('comedor_despacho_ejecucion')
            .select(`
                *,
                ejecucion:id_ejecucion!inner (
                    id,
                    id_comedor,
                    fecha_ejecucion,
                    servicio:id_tipo_servicio (nombre)
                ),
                usuario_despacho:usuarios!id_usuario_despacho(id, nombres, apellidos),
                usuario_recepciona:usuarios!id_usuario_recepcion(id, nombres, apellidos),
                detalles:comedor_despacho_ejecucion_detalle (
                    id,
                    id_insumo,
                    lote,
                    fecha_vencimiento,
                    cantidad_entregada,
                    cantidad_recibida,
                    presentacion_logistica:id_presentacion_logistica (
                        factor,
                        presentacion:id_presentacion (nombre)
                    ),
                    producto:id_producto (
                        id,
                        variedad,
                        marca:id_marca (nombre),
                        rubro:id_rubro (
                            id,
                            nombre,
                            unidad:id_unidad_medida (abreviatura)
                        )
                    )
                )
            `);

        if (dateStart && dateEnd) {
            query = query.gte('timestamp_despacho', `${dateStart}T00:00:00.000Z`)
                .lte('timestamp_despacho', `${dateEnd}T23:59:59.999Z`);
        } else if (dateStart) {
            query = query.gte('timestamp_despacho', `${dateStart}T00:00:00.000Z`)
                .lte('timestamp_despacho', `${dateStart}T23:59:59.999Z`);
        }

        // Filtro por comedor a través de la relación inner join
        if (id_comedor) {
            query = query.eq('ejecucion.id_comedor', id_comedor);
        }

        const { data, error } = await query.order('id', { ascending: false });

        if (error) throw error;

        return data || [];
    } catch (error) {
        console.error('Error en getDespachosRecepcion:', error);
        throw error;
    }
};

// Procesa la recepción de una remisión vía RPC
export const procesarRecepcionRemision = async (id_despacho, id_usuario, timestamp, detalles) => {
    const { data, error } = await supabase.rpc('fn_recibir_despacho_cocina', {
        p_id_despacho: id_despacho,
        p_id_usuario: id_usuario,
        p_timestamp: timestamp,
        p_detalles: detalles
    });
    if (error) throw error;
    return data;
};
