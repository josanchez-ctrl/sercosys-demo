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

  // 2. Sincronizar Configuración de Servicios (Upsert inteligente para preservar IDs)
  const { data: actuales, error: errActuales } = await supabase
    .from('comedor_servicios_config')
    .select('id, id_tipo_servicio')
    .eq('id_comedor', savedComedor.id);
  if (errActuales) throw errActuales;

  const actualesMap = new Map(actuales?.map(a => [Number(a.id_tipo_servicio), a.id]) || []);

  if (serviciosConfig && serviciosConfig.length > 0) {
    for (const cfg of serviciosConfig) {
      const idTipo = Number(cfg.id_tipo_servicio);
      const existeId = actualesMap.get(idTipo);

      const serviceData = {
        id_comedor: savedComedor.id,
        id_tipo_servicio: idTipo,
        id_estructura_menu: cfg.id_estructura_menu,
        precio_menu: Number(cfg.precio_menu) || 0,
        estatus: true, // Asegurar que esté activo
        id_usuario_update: userId,
        timestamp_update: now
      };

      let savedServiceId;

      if (existeId) {
        // Actualizar existente (preserva el ID y evita romper claves foráneas de planificación)
        const { data: updated, error: updateError } = await supabase
          .from('comedor_servicios_config')
          .update(serviceData)
          .eq('id', existeId)
          .select()
          .single();
        if (updateError) throw updateError;
        savedServiceId = updated.id;
      } else {
        // Insertar nuevo
        serviceData.id_usuario_create = userId;
        serviceData.timestamp_create = now;
        const { data: inserted, error: insertError } = await supabase
          .from('comedor_servicios_config')
          .insert(serviceData)
          .select()
          .single();
        if (insertError) throw insertError;
        savedServiceId = inserted.id;
      }

      // Sincronizar slots asociados al servicio
      // Eliminamos los slots antiguos (los slots no son referenciados de manera externa, por lo que delete físico es seguro)
      await supabase.from('comedor_servicios_slots_config').delete().eq('id_comedor_servicio', savedServiceId);

      if (cfg.slots_config && cfg.slots_config.length > 0) {
        const slotsToSave = cfg.slots_config.map(slot => ({
          id_comedor_servicio: savedServiceId,
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

  // Desactivar lógicamente servicios que no están en el nuevo payload para no romper históricos
  const nuevosIdsTipos = new Set(serviciosConfig?.map(cfg => Number(cfg.id_tipo_servicio)) || []);
  const desactivos = actuales?.filter(a => !nuevosIdsTipos.has(Number(a.id_tipo_servicio))) || [];

  if (desactivos.length > 0) {
    const idsADesactivar = desactivos.map(d => d.id);
    const { error: desactivaError } = await supabase
      .from('comedor_servicios_config')
      .update({ estatus: false, id_usuario_update: userId, timestamp_update: now })
      .in('id', idsADesactivar);
    if (desactivaError) throw desactivaError;
  }

  return savedComedor;
}
