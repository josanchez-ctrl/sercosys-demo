import { supabase } from '../lib/supabase';
import { Now } from './nowService';

export const getCotejos = async (id_empresa, fechaInicio = null, fechaFin = null, id_almacen = null) => {
  let query = supabase
    .from('almacen_cotejo')
    .select(`
      *,
      almacen_proveedores (id, nombre, dni, id_letradni, letrasdni(*)),
      usuario_create:id_usuario_create (id, nombres, apellidos),
      usuario_update:id_usuario_update (id, nombres, apellidos),
      usuario_procesa:id_usuario_procesa (id, nombres, apellidos),
      usuario_anula:id_usuario_anula (id, nombres, apellidos)
    `)
    .eq('id_empresa', id_empresa)
    .order('timestamp_create', { ascending: false });

  if (id_almacen) {
    query = query.eq('id_almacen', id_almacen);
  }
  if (fechaInicio) {
    query = query.gte('timestamp_create', `${fechaInicio}T00:00:00`);
  }
  if (fechaFin) {
    query = query.lte('timestamp_create', `${fechaFin}T23:59:59`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

export const getCotejoById = async (id) => {
  const { data: header, error: headerErr } = await supabase
    .from('almacen_cotejo')
    .select(`
      *,
      almacen_proveedores (*)
    `)
    .eq('id', id)
    .single();

  if (headerErr) throw headerErr;

  const { data: details, error: detailsErr } = await supabase
    .from('almacen_cotejo_detalle')
    .select(`
      *,
      logistica:id_presentacion_logistica (
        id,
        codigo_barras,
        factor,
        cantidad_referencia,
        presentacion:id_presentacion (id, nombre),
        referencia:id_referencia (
          id,
          presentacion:id_presentacion (nombre)
        )
      ),
      almacen_productos (
        id, 
        variedad, 
        maneja_lote,
        peso_variable,
        rubro:id_rubro (
          id, 
          nombre, 
          requiere_marca, 
          almacen_unidades_medida(abreviatura),
          categoria:id_categoria(id, id_almacen, almacenes(nombre))
        ),
        marca:id_marca (id, nombre)
      )
    `)
    .eq('id_cotejo', id);

  if (detailsErr) throw detailsErr;

  return { ...header, detalles: details || [] };
};

export const saveCotejo = async (header, details, id_usuario) => {
  const { supabase } = await import('../lib/supabase');
  const now = await Now();
  let headerId = header.id;
  const isEdit = !!headerId;

  // Lista blanca de campos permitidos en la tabla almacen_cotejo
  const finalHeaderPayload = {
    id_proveedor: header.id_proveedor,
    id_empresa: header.id_empresa,
    id_almacen: header.id_almacen,
    id_moneda: header.id_moneda,
    tasa_cambio: header.tasa_cambio,
    tipo_doc_recepcion: header.tipo_doc_recepcion,
    nro_doc_recepcion: header.nro_doc_recepcion,
    fecha_doc_recepcion: header.fecha_doc_recepcion,
    observaciones: header.observaciones,
    estatus: header.estatus || 'BORRADOR'
  };

  if (isEdit) {
    const { error: upErr } = await supabase
      .from('almacen_cotejo')
      .update({
        ...finalHeaderPayload,
        timestamp_update: now,
        id_usuario_update: id_usuario
      })
      .eq('id', headerId);
    if (upErr) throw upErr;
  } else {
    const { data: newHeader, error: insErr } = await supabase
      .from('almacen_cotejo')
      .insert([{
        ...finalHeaderPayload,
        timestamp_create: now,
        id_usuario_create: id_usuario
      }])
      .select()
      .single();
    if (insErr) throw insErr;
    headerId = newHeader.id;
  }

  if (details && details.length > 0) {
    const detailsClean = details.map(d => {
      const { id, producto_info, ...dbData } = d;

      // Calculamos el costo base al vuelo para asegurar integridad en el RPC de procesar
      // Usamos un fallback a 1 si la tasa es 0 para evitar divisiones por cero
      // IMPORTANTE: Si la moneda ya es la BASE (Dólares ID: 1), la tasa para el cálculo base debe ser 1
      const isMonedaBase = parseInt(header.id_moneda) === 1;
      const tasa = isMonedaBase ? 1 : (parseFloat(header.tasa_cambio) || 1);
      const costoUni = parseFloat(d.costo_unitario) || 0;
      const costoBase = costoUni / tasa;

      return {
        ...dbData,
        costo_unitario_base: costoBase,
        id_cotejo: headerId,
        id_almacen: d.id_almacen
      };
    });

    const { error: rpcErr } = await supabase.rpc('sincronizar_cotejo_detalles', {
      p_id_cotejo: headerId,
      p_detalles: detailsClean,
      p_id_usuario: id_usuario,
      p_timestamp_audit: now
    });

    if (rpcErr) throw rpcErr;
  } else if (isEdit) {
    // Si no hay detalles y es edit, borrar los existentes manualmente o manejar según lógica
    const { error: delErr } = await supabase
      .from('almacen_cotejo_detalle')
      .delete()
      .eq('id_cotejo', headerId);
    if (delErr) throw delErr;
  }

  return headerId;
};

export const updateCotejoStatus = async (id, estatus, id_usuario, extra = {}) => {
  const now = await Now();
  const payload = {
    estatus,
    timestamp_anula: now,
    id_usuario_anula: id_usuario,
    ...extra
  };

  const { error } = await supabase
    .from('almacen_cotejo')
    .update(payload)
    .eq('id', id);

  if (error) throw error;
};

export const procesarCotejo = async (id, id_usuario) => {
  const now = await Now();
  const { error } = await supabase.rpc('procesar_cotejo', {
    p_id_cotejo: id,
    p_id_usuario: id_usuario,
    p_timestamp_audit: now
  });

  if (error) throw error;
};

export const anularCotejo = async (id, id_usuario, observacion_anula) => {
  const now = await Now();
  const payload = {
    estatus: 'ANULADO',
    timestamp_anula: now,
    id_usuario_anula: id_usuario,
    observacion_anula: observacion_anula
  };

  const { error } = await supabase
    .from('almacen_cotejo')
    .update(payload)
    .eq('id', id);

  if (error) throw error;

  return true;
};

export const getInventarioByCotejo = async (idCotejo) => {
    // Primero obtenemos los IDs de los detalles del cotejo
    const { data: detalles, error: detErr } = await supabase
        .from('almacen_cotejo_detalle')
        .select('id')
        .eq('id_cotejo', idCotejo);
    
    if (detErr) throw detErr;
    const idsDetalles = detalles.map(d => d.id);

    if (idsDetalles.length === 0) return { data: [] };

    const { data, error } = await supabase
        .from('almacen_inventario')
        .select(`
            *,
            producto:id_producto (
                id,
                variedad,
                rubro:id_rubro (nombre),
                marca:id_marca (nombre)
            ),
            detalle:id_cotejo_detalle (
                cantidad,
                cotejo:id_cotejo (
                    timestamp_create,
                    proveedor:id_proveedor (nombre)
                ),
                logistica:id_presentacion_logistica (
                    id,
                    factor,
                    cantidad_referencia,
                    presentacion:id_presentacion (nombre),
                    referencia:id_referencia (
                        presentacion:id_presentacion (nombre)
                    )
                )
            )
        `)
        .in('id_cotejo_detalle', idsDetalles);

    if (error) throw error;
    return { data };
};
