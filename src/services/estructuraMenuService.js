import { supabase } from '../lib/supabase';
import { Now } from './nowService';

/**
 * Obtiene las estructuras base con sus slots y tipologías asociadas
 */
export async function getEstructurasMenu(id_empresa) {
  if (!id_empresa) return [];
  const { data, error } = await supabase
    .from('estructura_menu_base')
    .select(`
      *,
      slots: estructura_menu_base_slots (
        *,
        tipologias: estructura_menu_base_slots_tipologias (
          id_tipologia,
          tipologia_info: receta_tipologias (*)
        )
      )
    `)
    .eq('id_empresa', id_empresa)
    .order('nombre', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Guarda una estructura completa (Cabecera + Slots + Mapeos)
 * Se recomienda usar una transacción o manejar con cuidado las eliminaciones
 */
export async function saveEstructuraCompleta(estructura, slots, userId) {
  const now = await Now();
  const isNew = !estructura.id;

  // 1. Guardar Cabecera (Excluimos id y slots que no son columnas)
  const { id: _, slots: __, ...headerRest } = estructura;
  const headerData = {
    ...headerRest,
    nombre: estructura.nombre.toUpperCase(),
  };

  let savedHeader;
  if (isNew) {
    headerData.id_usuario_create = userId;
    headerData.timestamp_create = now;
    const { data, error } = await supabase
      .from('estructura_menu_base')
      .insert(headerData)
      .select()
      .single();
    if (error) throw error;
    savedHeader = data;
  } else {
    headerData.id_usuario_update = userId;
    headerData.timestamp_update = now;
    const { data, error } = await supabase
      .from('estructura_menu_base')
      .update(headerData)
      .eq('id', estructura.id)
      .select()
      .single();
    if (error) throw error;
    savedHeader = data;
  }

  // 2. Gestionar Slots (Actualización inteligente para preservar IDs)
  // Obtenemos los IDs actuales para saber cuáles desactivar
  const { data: existingSlots } = await supabase
    .from('estructura_menu_base_slots')
    .select('id')
    .eq('id_estructura_base', savedHeader.id);

  const existingIds = existingSlots?.map(s => s.id) || [];
  const currentSlotsIds = slots.filter(s => s.id).map(s => s.id);

  // Desactivar slots que ya no vienen en la lista
  const idsToDeactivate = existingIds.filter(id => !currentSlotsIds.includes(id));
  if (idsToDeactivate.length > 0) {
    await supabase
      .from('estructura_menu_base_slots')
      .update({ estatus: false, timestamp_update: now, id_usuario_update: userId })
      .in('id', idsToDeactivate);
  }

  for (const slot of slots) {
    let savedSlot;
    const slotData = {
      id_estructura_base: savedHeader.id,
      nombre: slot.nombre.toUpperCase(),
      orden: slot.orden,
      id_unidad_medida: slot.id_unidad_medida || null,
      estatus: slot.estatus ?? true,
    };

    if (slot.id) {
      // Actualizar existente
      slotData.timestamp_update = now;
      slotData.id_usuario_update = userId;
      const { data, error } = await supabase
        .from('estructura_menu_base_slots')
        .update(slotData)
        .eq('id', slot.id)
        .select()
        .single();
      if (error) throw error;
      savedSlot = data;
    } else {
      // Insertar nuevo
      slotData.id_usuario_create = userId;
      slotData.timestamp_create = now;
      const { data, error } = await supabase
        .from('estructura_menu_base_slots')
        .insert(slotData)
        .select()
        .single();
      if (error) throw error;
      savedSlot = data;
    }

    // 3. Gestionar Tipologías asociadas (Limpieza y Recarga por slot es seguro)
    await supabase.from('estructura_menu_base_slots_tipologias').delete().eq('id_slot', savedSlot.id);
    
    if (slot.tipologiasIds && slot.tipologiasIds.length > 0) {
      const mapping = slot.tipologiasIds.map(tid => ({
        id_slot: savedSlot.id,
        id_tipologia: tid
      }));
      const { error: mapError } = await supabase
        .from('estructura_menu_base_slots_tipologias')
        .insert(mapping);
      
      if (mapError) throw mapError;
    }
  }

  return savedHeader;
}
