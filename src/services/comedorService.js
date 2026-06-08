import { supabase } from '../lib/supabase';
import { Now } from './nowService';

/**
 * Obtiene todos los comedores de la empresa con su sucursal y configuraciones completas
 */
export async function getComedores(id_empresa) {
  if (!id_empresa) return [];
  const { data, error } = await supabase
    .from('comedores')
    .select(`
      *,
      sucursal: sucursales(nombre),
      servicios_config: comedor_servicios_config (
        *,
        tipo_servicio: tipos_servicios_comida(nombre),
        estructura: estructura_menu_base(nombre, slots: estructura_menu_base_slots(*)),
        slots_config: comedor_servicios_slots_config (*)
      )
    `)
    .eq('id_empresa', id_empresa)
    .order('nombre', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Obtiene los comedores activos de una sucursal específica
 */
export async function getComedoresActivos(id_sucursal) {
  if (!id_sucursal) return [];
  const { data, error } = await supabase
    .from('comedores')
    .select('id, nombre')
    .eq('id_sucursal', id_sucursal)
    .eq('estatus', true)
    .order('nombre', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Guarda un comedor y su configuración de servicios con gramajes por renglón
 */
export async function saveComedorCompleto(comedorPayload, serviciosConfig, userId) {
  const now = await Now();
  const { id, servicios: _, servicios_config: __, sucursal: ___, ...rest } = comedorPayload;
  const isNew = !id;

  let savedComedor;

  // 1. Guardar Comedor
  const comedorData = {
    id_empresa: comedorPayload.id_empresa,
    id_sucursal: comedorPayload.id_sucursal,
    nombre: comedorPayload.nombre.toUpperCase(),
    estatus: comedorPayload.estatus ?? true,
  };

  if (isNew) {
    comedorData.id_usuario_create = userId;
    comedorData.timestamp_create = now;
    const { data, error } = await supabase.from('comedores').insert(comedorData).select().single();
    if (error) throw error;
    savedComedor = data;
  } else {
    comedorData.id_usuario_update = userId;
    comedorData.timestamp_update = now;
    const { data, error } = await supabase.from('comedores').update(comedorData).eq('id', id).select().single();
    if (error) throw error;
    savedComedor = data;
  }

  // 2. Guardar Configuración de Servicios y Slots (Sync)
  if (!isNew) {
    // El cascaded delete se encarga de comedor_servicios_slots_config
    await supabase.from('comedor_servicios_config').delete().eq('id_comedor', savedComedor.id);
  }

  if (serviciosConfig && serviciosConfig.length > 0) {
    for (const cfg of serviciosConfig) {
      // Guardar el servicio
      const serviceData = {
        id_comedor: savedComedor.id,
        id_tipo_servicio: cfg.id_tipo_servicio,
        id_estructura_menu: cfg.id_estructura_menu,
        id_usuario_create: userId,
        timestamp_create: now
      };

      const { data: savedService, error: cfgError } = await supabase
        .from('comedor_servicios_config')
        .insert(serviceData)
        .select()
        .single();
      
      if (cfgError) throw cfgError;

      // Guardar los ajustes de slots (si existen)
      if (cfg.slots_config && cfg.slots_config.length > 0) {
        const slotsToSave = cfg.slots_config.map(slot => ({
          id_comedor_servicio: savedService.id,
          id_slot: slot.id_slot,
          cantidad_objetivo: slot.cantidad_objetivo || 0,
          id_unidad_medida: slot.id_unidad_medida || null,
          id_usuario_create: userId,
          timestamp_create: now
        }));

        const { error: slotError } = await supabase.from('comedor_servicios_slots_config').insert(slotsToSave);
        if (slotError) throw slotError;
      }
    }
  }

  return savedComedor;
}
