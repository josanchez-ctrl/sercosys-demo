import { supabase } from '../lib/supabase';
import { Now } from './nowService';

/**
 * Obtiene todas las recetas de la empresa con su tipología
 */
export async function getRecetas(id_empresa) {
  if (!id_empresa) return [];
  const { data, error } = await supabase
    .from('maestro_recetas')
    .select(`
      *,
      tipologia: receta_tipologias(nombre, abreviatura),
      unidad_porcion: almacen_unidades_medida(id, abreviatura, nombre),
      ingredientes: maestro_receta_ingredientes!maestro_receta_ingredientes_id_receta_padre_fkey (
        *,
        rubro: almacen_rubros(nombre, id_unidad_medida, unidad: almacen_unidades_medida(abreviatura), categoria: almacen_categorias(nombre)),
        sub_receta: maestro_recetas!maestro_receta_ingredientes_id_sub_receta_fkey(nombre, codigo_ficha)
      )
    `)
    .eq('id_empresa', id_empresa)
    .order('nombre', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Guarda una receta completa (Cabecera + Ingredientes)
 */
export async function saveRecetaCompleta(recetaPayload, ingredientes, userId) {
  const now = await Now();
  const { id, ingredientes: _, tipologia: __, ...rest } = recetaPayload;
  const isNew = !id;

  let savedReceta;

  // 1. Guardar Cabecera
  const recetaData = {
    id_empresa: rest.id_empresa,
    id_tipologia: rest.id_tipologia,
    id_unidad_medida: rest.id_unidad_medida || null,
    codigo_ficha: rest.codigo_ficha.toUpperCase(),
    nombre: rest.nombre.toUpperCase(),
    rendimiento: rest.rendimiento || 1,
    peso_porcion_base: rest.peso_porcion_base || 0,
    estatus: rest.estatus ?? true,
  };

  if (isNew) {
    recetaData.id_usuario_create = userId;
    recetaData.timestamp_create = now;
    const { data, error } = await supabase.from('maestro_recetas').insert(recetaData).select().single();
    if (error) throw error;
    savedReceta = data;
  } else {
    recetaData.id_usuario_update = userId;
    recetaData.timestamp_update = now;
    const { data, error } = await supabase.from('maestro_recetas').update(recetaData).eq('id', id).select().single();
    if (error) throw error;
    savedReceta = data;
  }

  // 2. Guardar Ingredientes (Sync)
  if (!isNew) {
    await supabase.from('maestro_receta_ingredientes').delete().eq('id_receta_padre', savedReceta.id);
  }

  if (ingredientes && ingredientes.length > 0) {
    const ingredientesToSave = ingredientes.map(ing => ({
      id_receta_padre: savedReceta.id,
      id_rubro: ing.id_rubro || null,
      id_sub_receta: ing.id_sub_receta || null,
      cantidad: ing.cantidad,
      es_opcional: ing.es_opcional || false,
      es_escalable: ing.es_escalable !== undefined ? ing.es_escalable : true,
      id_usuario_create: userId,
      timestamp_create: now
    }));

    const { error: ingError } = await supabase.from('maestro_receta_ingredientes').insert(ingredientesToSave);
    if (ingError) throw ingError;
  }

  return savedReceta;
}

/**
 * Elimina una receta (Solo si no está siendo usada como sub-receta)
 */
export async function deleteReceta(id) {
  // Verificar si se usa como sub-receta
  const { data, error: checkError } = await supabase
    .from('maestro_receta_ingredientes')
    .select('id')
    .eq('id_sub_receta', id)
    .limit(1);
    
  if (checkError) throw checkError;
  if (data && data.length > 0) {
    throw new Error('No se puede eliminar la receta porque está siendo utilizada como ingrediente en otra receta.');
  }

  const { error } = await supabase.from('maestro_recetas').delete().eq('id', id);
  if (error) throw error;
  return true;
}
