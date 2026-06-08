import { supabase } from '../lib/supabase';
import { Now } from './nowService';

/**
 * Obtiene los valores de merma registrados para un rubro específico.
 */
export const getValoresMermaRubro = async (id_rubro) => {
    const { data, error } = await supabase
        .from('almacen_rubros_merma')
        .select(`
            id_tipo_merma,
            valor,
            tipo_merma:id_tipo_merma(nombre, letra)
        `)
        .eq('id_rubro', id_rubro);

    if (error) throw error;
    return data || [];
};

/**
 * Guarda los valores de merma para un rubro.
 * Sigue el patrón de limpieza e inserción para atomicidad.
 */
export const saveValoresMermaRubro = async (id_rubro, valores, id_usuario) => {
    const now = await Now();

    // 1. Eliminar anteriores
    const { error: delError } = await supabase
        .from('almacen_rubros_merma')
        .delete()
        .eq('id_rubro', id_rubro);

    if (delError) throw delError;

    // 2. Insertar nuevos si hay valores
    if (valores && valores.length > 0) {
        const payload = valores.map(v => ({
            id_rubro,
            id_tipo_merma: v.id_tipo_merma,
            valor: parseFloat(v.valor) || 0,
            id_usuario_create: id_usuario,
            timestamp_create: now
        }));

        const { error: insError } = await supabase
            .from('almacen_rubros_merma')
            .insert(payload);

        if (insError) throw insError;
    }

    return true;
};

/**
 * Guarda los valores de merma para múltiples rubros de forma masiva.
 * @param {Array} batch Array de objetos { id_rubro, mermas: [{id_tipo_merma, valor}] }
 */
export const saveValoresMermaBatch = async (batch, id_usuario) => {
    const now = await Now();
    
    // 1. Recopilar todos los IDs de rubros para limpiar
    const rubroIds = batch.map(b => b.id_rubro);
    
    const { error: delError } = await supabase
        .from('almacen_rubros_merma')
        .delete()
        .in('id_rubro', rubroIds);

    if (delError) throw delError;

    // 2. Preparar gran inserción masiva
    const allMermas = [];
    batch.forEach(item => {
        item.mermas.forEach(m => {
            allMermas.push({
                id_rubro: item.id_rubro,
                id_tipo_merma: m.id_tipo_merma,
                valor: parseFloat(m.valor) || 0,
                id_usuario_create: id_usuario,
                timestamp_create: now
            });
        });
    });

    if (allMermas.length > 0) {
        const { error: insError } = await supabase
            .from('almacen_rubros_merma')
            .insert(allMermas);
            
        if (insError) throw insError;
    }

    return true;
};
