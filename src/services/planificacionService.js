import { supabase } from '../lib/supabase';
import { Now } from './nowService';
import { parseTimestampToDate, getDateOnly, formato8Digitos } from '../util/workDate';

/**
 * Obtiene los comedores activos de una empresa
 */
export const getComedores = async (id_empresa) => {
  const { data, error } = await supabase
    .from('comedores')
    .select('*, sucursal:sucursales(id, nombre)')
    .eq('id_empresa', id_empresa)
    .eq('estatus', true)
    .order('nombre', { ascending: true });

  if (error) throw error;
  return data;
};

/**
 * Obtiene las planificaciones semanales para un comedor y rango de fechas
 */
export const getPlanificacionesSemanales = async (id_empresa, id_comedor, fecha_inicio, fecha_fin, id_servicio_config = null) => {
  let query = supabase
    .from('planificacion_semanal')
    .select(`
      *,
      usuario_create:usuarios!id_usuario_create(nombres, apellidos),
      usuario_update:usuarios!id_usuario_update(nombres, apellidos),
      servicio_config:comedor_servicios_config(
        id, 
        tipo_servicio:tipos_servicios_comida(nombre),
        estructura:estructura_menu_base(nombre)
      ),
      detalle:planificacion_detalle(
        *,
        receta:maestro_recetas(
          nombre, 
          codigo_ficha,
          tipologia:receta_tipologias(id, nombre, es_base)
        ),
        slot:estructura_menu_base_slots(nombre)
      ),
      insumos_operativos:planificacion_insumos_operativos(
        *,
        rubro:almacen_rubros(
          nombre, 
          id_unidad_medida, 
          unidad:almacen_unidades_medida(abreviatura),
          categoria:almacen_categorias(nombre, almacenes(id, nombre)),
          mermas:almacen_rubros_merma(valor)
        )
      ),
      requisicion:almacen_requisiciones(id)
    `)
    .eq('id_empresa', id_empresa)
    .eq('id_comedor', id_comedor)
    .gte('semana_inicio', fecha_inicio)
    .lte('semana_inicio', fecha_fin);

  if (id_servicio_config) {
    query = query.eq('id_servicio_config', id_servicio_config);
  }

  const { data, error } = await query.order('timestamp_create', { ascending: false });

  if (error) throw error;
  return data;
};

/**
 * Obtiene la configuración de servicios (Desayuno, Almuerzo...) de un comedor
 */
export const getServiciosConfig = async (id_comedor) => {
  const { data, error } = await supabase
    .from('comedor_servicios_config')
    .select(`
      id,
      id_tipo_servicio,
      id_estructura_menu,
      tipo_servicio:tipos_servicios_comida(id, nombre),
      estructura:estructura_menu_base(id, nombre)
    `)
    .eq('id_comedor', id_comedor)
    .eq('estatus', true);

  if (error) throw error;
  return data;
};

/**
 * Obtiene los slots/niveles de una estructura de menú base
 */
export const getEstructuraSlots = async (id_estructura_base) => {
  const { data, error } = await supabase
    .from('estructura_menu_base_slots')
    .select(`
      *,
      tipologias:estructura_menu_base_slots_tipologias(id_tipologia)
    `)
    .eq('id_estructura_base', id_estructura_base)
    .order('orden', { ascending: true });

  if (error) throw error;
  return data;
};

/**
 * Obtiene todas las recetas disponibles para planificación
 */
export const getRecetasDisponibles = async (id_empresa) => {
  const { data, error } = await supabase
    .from('maestro_recetas')
    .select('id, nombre, codigo_ficha, rendimiento, id_tipologia, tipologia:receta_tipologias(nombre, abreviatura)')
    .eq('id_empresa', id_empresa)
    .eq('estatus', true)
    .order('nombre', { ascending: true });

  if (error) throw error;
  return data;
};

/**
 * Obtiene rubros que NO son ingredientes (Insumos Operativos)
 */
export const getRubrosOperativos = async (id_empresa) => {
  const { data, error } = await supabase
    .from('almacen_rubros')
    .select('id, nombre, id_unidad_medida, unidad:almacen_unidades_medida(abreviatura), categoria:almacen_categorias(nombre)')
    .eq('id_empresa', id_empresa)
    //.eq('es_ingrediente', false)
    .eq('solicitud_manual', true)
    .eq('estatus', true)
    .order('nombre', { ascending: true });

  if (error) throw error;
  return data;
};

/**
 * Obtiene los ingredientes de múltiples recetas para la explosión de insumos
 */
export const getIngredientesMultiplesRecetas = async (ids_recetas) => {
  const { data, error } = await supabase
    .from('maestro_receta_ingredientes')
    .select(`
      id_receta_padre,
      id_rubro,
      cantidad,
      es_opcional,
      rubro:almacen_rubros(
        id, 
        nombre, 
        almacen_unidades_medida(abreviatura)
      )
    `)
    .in('id_receta_padre', ids_recetas);

  if (error) throw error;
  return data;
};

/**
 * Obtiene la explosión completa (recursiva) de ingredientes para una lista de recetas.
 * Mantiene la referencia al id_receta_raiz para poder agrupar en el consolidado.
 */
/**
 * Obtiene la explosión completa (recursiva) de ingredientes.
 * Esta función es el corazón del cálculo industrial.
 */
export const getExplosionCompleta = async (idsRecetasRaiz) => {
  if (!idsRecetasRaiz || idsRecetasRaiz.length === 0) return [];

  const ingredientesFinales = [];
  const cacheRecetas = new Map(); // Para no re-consultar la misma receta

  /**
   * Función interna recursiva para desglosar una receta
   * @param {number} idReceta - ID de la receta a explotar
   * @param {number} multiplicador - Factor acumulado de las recetas padre
   * @param {number} idRaiz - ID de la receta original (para el consolidado)
   */
  const resolverReceta = async (idReceta, multiplicador, idRaiz) => {
    // 1. Obtener datos de la receta (usar cache si es posible)
    let receta = cacheRecetas.get(idReceta);
    if (!receta) {
      const { data, error } = await supabase
        .from('maestro_recetas')
        .select(`
          id, 
          rendimiento,
          peso_porcion_base,
          ingredientes:maestro_receta_ingredientes!maestro_receta_ingredientes_id_receta_padre_fkey(
            id_rubro,
            id_sub_receta,
            cantidad,
            es_escalable,
            rubro:almacen_rubros(
              id, 
              nombre, 
              unidad:almacen_unidades_medida(abreviatura),
              mermas:almacen_rubros_merma(valor)
            )
          )
        `)
        .eq('id', idReceta)
        .single();

      if (error || !data) {
        console.error(`Error al cargar receta ${idReceta}:`, error);
        return;
      }
      receta = data;
      cacheRecetas.set(idReceta, receta);
    }

    const rendimiento = Number(receta.rendimiento) || 1;

    // 2. Recorrer ingredientes
    const ingredientes = receta.ingredientes || [];

    for (const ing of ingredientes) {
      // Factor para este ingrediente = (cantidad en receta / rendimiento) * multiplicador del padre
      const factorActual = (Number(ing.cantidad) / rendimiento) * multiplicador;

      if (ing.id_sub_receta) {
        // ES UNA SUB-RECETA: Seguimos bajando
        await resolverReceta(Number(ing.id_sub_receta), factorActual, idRaiz);
      } else if (ing.id_rubro) {
        // ES UN RUBRO: Es el nivel base, lo guardamos
        ingredientesFinales.push({
          id_receta_raiz: idRaiz,
          id_rubro: Number(ing.id_rubro),
          nombre: ing.rubro?.nombre || 'Desconocido',
          unidad: ing.rubro?.unidad?.abreviatura || 'un',
          merma: (ing.rubro?.mermas || []).reduce((acc, m) => acc + Number(m.valor), 0),
          es_escalable: ing.es_escalable ?? true,
          peso_base_receta: Number(receta.peso_porcion_base) || 0,
          cantidad: factorActual // Cantidad para 1 unidad de la receta raíz
        });
      }
    }
  };

  // Iniciamos la explosión para cada receta raíz solicitada
  for (const id of idsRecetasRaiz) {
    await resolverReceta(Number(id), 1, Number(id));
  }

  return ingredientesFinales;
};

/**
 * Obtiene el consolidado guardado (snapshot) para una planificación
 */
export const getConsolidadoSnapshot = async (idPlanificacion) => {
  // 1. Obtener los insumos de la planificación
  const { data: insumos, error: insError } = await supabase
    .from('planificacion_insumos')
    .select(`
      *,
      rubro:almacen_rubros(
        id, 
        nombre, 
        unidad:almacen_unidades_medida(abreviatura),
        categoria:almacen_categorias(nombre, almacenes(id, nombre))
      )
    `)
    .eq('id_planificacion', idPlanificacion);

  if (insError) throw insError;

  // 2. Obtener los costos globales de la vista (sin relación física necesaria)
  const { data: costos, error: costError } = await supabase
    .from('vw_almacen_rubros_costos')
    .select('*');

  if (costError) {
    console.warn("No se pudieron cargar los costos globales:", costError);
    return insumos; // Devolvemos al menos los insumos
  }

  // 3. Unir los datos en JS
  return insumos.map(item => ({
    ...item,
    rubro: {
      ...item.rubro,
      costo_info: costos.filter(c => Number(c.id_rubro) === Number(item.id_rubro))
    }
  }));
};

/**
 * Guarda una planificación completa (Cabecera + Menú + Insumos) de forma atómica vía RPC
 */
export const upsertPlanificacionCompleta = async (payload) => {
  const { detalle, insumos_operativos, ...rawHeader } = payload;
  const now = await Now();
  const userId = Number(rawHeader.id_usuario_update || rawHeader.id_usuario_create);
  const isEdit = !!rawHeader.id;

  try {
    // 1. Preparar Cabecera (Formato para el RPC)
    const header = {
      id: rawHeader.id ? Number(rawHeader.id) : null,
      id_empresa: Number(rawHeader.id_empresa),
      id_comedor: Number(rawHeader.id_comedor),
      id_servicio_config: Number(rawHeader.id_servicio_config),
      semana_inicio: rawHeader.semana_inicio,
      semana_fin: rawHeader.semana_fin,
      observaciones: rawHeader.observaciones || '',
      estatus: rawHeader.estatus?.toUpperCase() || 'BORRADOR'
    };

    if (isEdit) {
      header.id_usuario_update = userId;
      header.timestamp_update = now;
    } else {
      header.id_usuario_create = userId;
      header.timestamp_create = now;
    }

    // 2. Generar Instantánea de Explosión de Insumos (Snapshot) en memoria
    let insumosSnapshotPayload = [];
    if (detalle && detalle.length > 0) {
      const idsRecetas = [...new Set(detalle.filter(d => d.id_receta).map(d => Number(d.id_receta)))];

      if (idsRecetas.length > 0) {
        // A. Obtener explosión técnica y costos actuales
        const explosion = await getExplosionCompleta(idsRecetas);
        const { data: costosActuales } = await supabase.from('vw_almacen_rubros_costos').select('*');

        // B. Obtener negociación del comedor para este servicio
        const { data: negociaciones } = await supabase
          .from('comedor_servicios_slots_config')
          .select('id_slot, cantidad_objetivo, id_unidad_medida')
          .eq('id_comedor_servicio', Number(header.id_servicio_config));

        detalle.filter(d => d.id_receta).forEach(entry => {
          const comensales = Number(entry.comensales) || 0;
          const rubrosDeEstaReceta = explosion.filter(e => Number(e.id_receta_raiz) === Number(entry.id_receta));

          // C. Calcular Factor de Escala (Porcentaje de ajuste del comedor)
          const nego = negociaciones?.find(n => Number(n.id_slot) === Number(entry.id_estructura_slot));
          const porcentajeAjuste = Number(nego?.cantidad_objetivo || 0);
          
          const factorEscala = 1 + (porcentajeAjuste / 100);

          rubrosDeEstaReceta.forEach(rb => {
            // D. Aplicar factor solo si el ingrediente es escalable
            const multiplicadorFinal = rb.es_escalable ? (Number(rb.cantidad) * factorEscala) : Number(rb.cantidad);
            
            // E. Obtener costo actual del rubro
            const infoCosto = costosActuales?.find(c => Number(c.id_rubro) === Number(rb.id_rubro));
            const costoU = Number(infoCosto?.costo_ponderado_global || 0);
            const cantBruta = multiplicadorFinal * comensales * (1 + (Number(rb.merma) / 100));

            insumosSnapshotPayload.push({
              fecha: entry.fecha,
              id_rubro: Number(rb.id_rubro),
              id_receta_raiz: Number(entry.id_receta),
              cantidad_neta: multiplicadorFinal * comensales,
              merma_pct: Number(rb.merma) || 0,
              costo_unitario: costoU,
              total_estimado: cantBruta * costoU,
              id_usuario_create: userId,
              timestamp_create: now
            });
          });
        });
      }
    }

    // C. Incluir Insumos Operativos (Manuales) en el Snapshot Financiero
    if (insumos_operativos && insumos_operativos.length > 0) {
      // Re-usamos o consultamos costos si no se hizo arriba
      const { data: costosActuales } = await supabase.from('vw_almacen_rubros_costos').select('*');
      
      insumos_operativos.forEach(i => {
        if (!i.id_rubro || !(Number(i.cantidad) > 0)) return;
        
        const infoCosto = costosActuales?.find(c => Number(c.id_rubro) === Number(i.id_rubro));
        const costoU = Number(infoCosto?.costo_ponderado_global || 0);
        
        insumosSnapshotPayload.push({
          fecha: header.semana_inicio, 
          id_rubro: Number(i.id_rubro),
          id_receta_raiz: null, 
          cantidad_neta: Number(i.cantidad),
          merma_pct: 0,
          observacion: i.observacion || '',
          costo_unitario: costoU,
          total_estimado: Number(i.cantidad) * costoU,
          id_usuario_create: userId,
          timestamp_create: now
        });
      });
    }

    // 3. Ejecutar Guardado Atómico vía RPC
    const { data: finalPlanId, error: rpcError } = await supabase.rpc('upsert_planificacion_completa', {
      p_header: header,
      p_detalle: (detalle || []).filter(d => d.id_receta).map(d => ({
        fecha: d.fecha,
        id_servicio: Number(header.id_servicio_config),
        id_estructura_slot: Number(d.id_estructura_slot),
        id_receta: Number(d.id_receta),
        comensales: Number(d.comensales) || 0,
        ajustes_ingredientes: d.ajustes_ingredientes || {}
      })),
      p_insumos_operativos: (insumos_operativos || [])
        .filter(i => i.id_rubro && Number(i.cantidad) > 0)
        .map(i => ({
          id_rubro: Number(i.id_rubro),
          cantidad: Number(i.cantidad) || 0,
          observacion: i.observacion || ''
        })),
      p_snapshot: insumosSnapshotPayload,
      p_id_usuario: userId,
      p_timestamp_ahora: now
    });

    if (rpcError) throw rpcError;
    return finalPlanId;

  } catch (error) {
    console.error('Error en upsertPlanificacionCompleta:', error);
    throw error;
  }
};

/**
 * Aprueba una planificación y genera la requisición automática
 */
export const approvePlanificacion = async (planId, userId) => {
  const now = await Now();
  
  try {
    const { data: reqId, error } = await supabase.rpc('fn_aprobar_planificacion', {
      p_id_planificacion: Number(planId),
      p_id_usuario: Number(userId),
      p_timestamp_audit: now
    });

    if (error) throw error;
    return reqId;
  } catch (error) {
    console.error('Error en approvePlanificacion:', error);
    throw error;
  }
};

/**
 * Obtiene las tipologías de recetas
 */
export const getTipologias = async () => {
  const { data, error } = await supabase
    .from('receta_tipologias')
    .select('id, nombre, es_base')
    .eq('estatus', true)
    .order('nombre', { ascending: true });

  if (error) throw error;
  return data;
};

/**
 * Actualiza el estatus de una planificación
 */
export const updatePlanificacionStatus = async (planId, status, userId) => {
  const now = await Now();
  const updates = {
    estatus: status,
    id_usuario_update: userId,
    timestamp_update: now
  };
  
  if (status === 'BORRADOR') {
    updates.timestamp_procesa = null;
    updates.id_usuario_procesa = null;
  }

  const { error } = await supabase
    .from('planificacion_semanal')
    .update(updates)
    .eq('id', planId);

  if (error) throw error;
};

