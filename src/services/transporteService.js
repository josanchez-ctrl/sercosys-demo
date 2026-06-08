import { supabase } from '../lib/supabase';

/**
 * Obtiene las letras para el DNI (V, E, J, G, etc.)
 */
export async function getLetrasDni() {
    const { data, error } = await supabase
        .from('letrasdni')
        .select('id, nombre')
        .order('orden');

    if (error) {
        console.error('Error obteniendo letras DNI:', error);
        return [];
    }
    return data || [];
}

/**
 * Obtiene los tipos de vehículos (SEDÁN, PICKUP, etc.)
 */
export async function getTiposVehiculo() {
    const { data, error } = await supabase
        .from('tipos_vehiculos')
        .select('id, nombre')
        .order('nombre');

    if (error) {
        console.error('Error obteniendo tipos de vehículo:', error);
        return [];
    }
    return data || [];
}
