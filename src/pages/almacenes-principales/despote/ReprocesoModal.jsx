import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Formik, Form } from 'formik';
import { X, Layers, Plus, Trash2, Scale, Package, AlertCircle, Eye, Play, CheckCircle2, Clock, FileEdit, Printer, Percent } from 'lucide-react';
import { 
  getOrdenDespoteById, 
  saveOrdenReproceso, 
  iniciarDespote, 
  declararSalidaDespote, 
  finalizarDespote,
  getTarasCestas,
  getProductosDerivados,
  revertirSalidaDespote,
  obtenerOCrearTrkDespote
} from '../../../services/despoteService';
import { getInventarioAlmacen } from '../../../services/inventarioService';
import { getProductos } from '../../../services/productoService';
import { getUbicaciones } from '../../../services/ubicacionService';
import { getSucursalesActivas } from '../../../services/sucursalService';
import { toast } from 'sonner';
import { formatDateSystemToDDMMYYYYHHMMSS } from '../../../util/workDate';
import { formatNumber, getDecimalPlaces } from '../../../util/workDecimales';
import EtiquetasTrackingRecepcionModal from '../../../components/modals/EtiquetasTrackingRecepcionModal';

export default function ReprocesoModal({ empresaActiva, sucursalActiva, perfil, almacenId, nombreAlmacen, ordenId, modoVisualizacion, onClose, onUpdate }) {
  const [inventario, setInventario] = useState([]);
  const [productos, setProductos] = useState([]);
  const [ubicaciones, setUbicaciones] = useState([]);
  const [tarasCatalog, setTarasCatalog] = useState([]);
  const [derivadosRel, setDerivadosRel] = useState([]);
  const [sucursalIdDefault, setSucursalIdDefault] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Estados de la Orden
  const [currentOrdenId, setCurrentOrdenId] = useState(ordenId);
  const [entradas, setEntradas] = useState([]);
  const [salidas, setSalidas] = useState([]);
  const [estatus, setEstatus] = useState('BORRADOR');
  const [observaciones, setObservaciones] = useState('');

  // Estados para el flujo de Reproceso (Fase 2)
  const [outputProductoId, setOutputProductoId] = useState('');
  const [outputUbicacionId, setOutputUbicacionId] = useState('');
  const [outputPresentacionId, setOutputPresentacionId] = useState('');
  const [outputCantPresentaciones, setOutputCantPresentaciones] = useState('');

  useEffect(() => {
    setCurrentOrdenId(ordenId);
  }, [ordenId]);

  // Estados para impresión de etiquetas de tracking
  const [etiquetaPrintOpen, setEtiquetaPrintOpen] = useState(false);
  const [itemEtiquetaPrint, setItemEtiquetaPrint] = useState([]);

  // Calculadoras de Tara
  // Para la Fase 1 (Entrada de Insumo)
  const [inputPesoBruto, setInputPesoBruto] = useState('');
  const [inputTarasSeleccionadas, setInputTarasSeleccionadas] = useState([]); // [{taraId, cantidad}]
  
  // Para la Fase 2 (Salida de Cortes / Reproceso)
  const [outputPesoBruto, setOutputPesoBruto] = useState('');
  const [outputTarasSeleccionadas, setOutputTarasSeleccionadas] = useState([]); // [{taraId, cantidad}]

  // Temporales de carga (Fase Borrador)
  const [tempEntrada, setTempEntrada] = useState({ id_item_inventario: '', cantidad_neto: 0, cantidad_unidades: '' });

  // Cargar catálogos iniciales
  useEffect(() => {
    cargarCatalogos();
  }, [empresaActiva?.id, almacenId, currentOrdenId]);

  const cargarCatalogos = async () => {
    setLoading(true);
    try {
      const prods = await getProductos(empresaActiva.id);
      setProductos(prods || []);

      const inv = await getInventarioAlmacen(almacenId);
      // Filtrar lotes activos del almacén que puedan ser reprocesados (marcados como reprocesables)
      setInventario((inv || []).filter(item => 
        Number(item.cantidad_actual) > 0 && 
        !item.is_bloqueado && 
        item.producto?.es_reprocesable === true
      ));

      const ubs = await getUbicaciones(almacenId);
      setUbicaciones(ubs || []);

      const tarasData = await getTarasCestas();
      setTarasCatalog(tarasData || []);

      const derivadosData = await getProductosDerivados();
      setDerivadosRel(derivadosData || []);

      try {
        const sucs = await getSucursalesActivas(empresaActiva.id);
        if (sucs && sucs.length > 0) {
          setSucursalIdDefault(sucs[0].id);
        }
      } catch (err) {
        console.warn('Error al obtener sucursal activa:', err);
      }

      if (currentOrdenId) {
        await refrescarDatosOrden(currentOrdenId, ubs);
      }
    } catch (e) {
      toast.error('Error al cargar catálogos de reproceso');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const refrescarDatosOrden = async (id, ubsList = null) => {
    const ubs = ubsList || ubicaciones;
    const orden = await getOrdenDespoteById(id);
    setEstatus(orden.estatus);
    setObservaciones(orden.observaciones || '');
    setEntradas(orden.entradas || []);
    setSalidas((orden.salidas || []).map(s => ({
      ...s,
      ubicacion_codigo: s.id_ubicacion ? (ubs.find(u => u.id == s.id_ubicacion)?.codigo || '--') : '--'
    })));
  };

  const handlePrintEtiqueta = (salida) => {
    const pInfo = productos.find(p => p.id == salida.id_producto);
    const presLogistica = salida.presentacion_logistica || pInfo?.logistica?.find(l => !l.es_base) || pInfo?.logistica?.find(l => l.es_base) || pInfo?.logistica?.[0];
    const presentacionNombre = presLogistica?.presentacion?.nombre || 'UNIDAD';

    const bultosReales = (salida.cantidad_presentacion && Number(salida.cantidad_presentacion) > 0)
      ? Number(salida.cantidad_presentacion)
      : Math.max(1, Math.floor(Number(salida.cantidad_obtenida) / (presLogistica ? Number(presLogistica.factor) : 1)));

    const itemVirtual = {
      id: salida.id_producto,
      tracking_id: salida.tracking_id,
      lote: salida.lote_generado,
      fecha_vencimiento: salida.fecha_vencimiento,
      cantidad_actual: Number(salida.cantidad_obtenida),
      producto: pInfo || salida.producto,
      detalle: {
        cantidad: bultosReales,
        logistica: {
          presentacion: {
            nombre: presentacionNombre
          }
        },
        cotejo: {
          timestamp_create: salida.timestamp_create || new Date().toISOString(),
          proveedor: {
            nombre: 'PRODUCCIÓN INTERNA'
          }
        }
      }
    };
    setItemEtiquetaPrint([itemVirtual]);
    setEtiquetaPrintOpen(true);
  };

  const handlePrintCaliente = async () => {
    if (!outputProductoId || !outputPresentacionId || !outputUbicacionId || !outputCantPresentaciones) {
      toast.error('Complete todos los campos de salida (producto, presentación, ubicación de destino y cantidad de envases) para imprimir en caliente');
      return;
    }

    const entradasConSaldo = entradas.filter(e => Number(e.cantidad_pendiente) > 0);
    // Buscar la primera entrada compatible
    const firstPreferredInput = entradasConSaldo.find(e => {
      const prodId = e.inventario?.producto?.id;
      return derivadosRel.some(rel => 
        Number(rel.id_producto_destino) === Number(outputProductoId) && 
        Number(rel.id_producto_origen) === Number(prodId)
      );
    });

    if (!firstPreferredInput) {
      toast.error('No hay materia prima compatible pendiente en la mesa para este subproducto');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        id_transformacion: currentOrdenId,
        id_entrada_transformacion: Number(firstPreferredInput.id),
        id_producto_salida: Number(outputProductoId),
        id_presentacion_logistica: Number(outputPresentacionId),
        id_ubicacion_destino: Number(outputUbicacionId)
      };

      const trackingId = await obtenerOCrearTrkDespote(payload, perfil.id);
      
      const pInfo = productos.find(p => p.id == outputProductoId);
      const presLogistica = presentacionesSalidaDisponibles.find(p => p.id == outputPresentacionId);
      const presentacionNombre = presLogistica?.presentacion?.nombre || 'UNIDAD';
      const bultosReales = parseInt(outputCantPresentaciones) || 1;

      const itemVirtual = {
        id: outputProductoId,
        tracking_id: trackingId,
        lote: firstPreferredInput.lote || 'SIN-LOTE',
        fecha_vencimiento: firstPreferredInput.inventario?.fecha_vencimiento || null,
        cantidad_actual: 0,
        producto: pInfo,
        detalle: {
          cantidad: bultosReales,
          logistica: {
            presentacion: {
              nombre: presentacionNombre
            }
          },
          cotejo: {
            timestamp_create: new Date().toISOString(),
            proveedor: {
              nombre: 'PRODUCCIÓN INTERNA'
            }
          }
        }
      };
      
      setItemEtiquetaPrint([itemVirtual]);
      setEtiquetaPrintOpen(true);
      toast.success('Etiquetas de trazabilidad generadas y listas para imprimir.');
    } catch (e) {
      toast.error('Error al generar etiquetas en caliente: ' + e.message);
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const getNombreItemInventario = (item) => {
    if (!item?.producto) return '';
    const categoria = item.producto.rubro.categoria?.nombre || '';
    const marca = item.producto.marca?.nombre || '';
    const variedad = item.producto.variedad || '';
    const rubro = item.producto.rubro?.nombre || '';
    return [categoria, rubro, marca, variedad].filter(Boolean).join(' · ') + ` (Lote: ${item.lote || 'N/A'})`;
  };

  const getNombreProducto = (prod) => {
    if (!prod) return '';
    const categoria = prod.rubro.categoria?.nombre || '';
    const marca = prod.marca?.nombre || '';
    const variedad = prod.variedad || '';
    const rubro = prod.rubro?.nombre || '';
    return [categoria, rubro, marca, variedad].filter(Boolean).join(' · ');
  };


  // --- CALCULADORA DE TARAS EN CALIENTE (ENTRADAS) ---
  const inputTotalTara = useMemo(() => {
    return inputTarasSeleccionadas.reduce((sum, current) => {
      const taraInfo = tarasCatalog.find(t => t.id == current.taraId);
      if (!taraInfo) return sum;
      return sum + (Number(taraInfo.peso) * (parseInt(current.cantidad) || 0));
    }, 0);
  }, [inputTarasSeleccionadas, tarasCatalog]);

  const inputPesoNeto = useMemo(() => {
    const bruto = parseFloat(inputPesoBruto) || 0;
    return Math.max(0, bruto - inputTotalTara);
  }, [inputPesoBruto, inputTotalTara]);

  useEffect(() => {
    setTempEntrada(prev => ({
      ...prev,
      cantidad_neto: inputPesoNeto
    }));
  }, [inputPesoNeto]);

  const handleAddInputTara = () => {
    setInputTarasSeleccionadas(prev => [...prev, { taraId: '', cantidad: 1 }]);
  };

  const handleRemoveInputTara = (idx) => {
    setInputTarasSeleccionadas(prev => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateInputTara = (idx, field, value) => {
    setInputTarasSeleccionadas(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      return { ...item, [field]: value };
    }));
  };

  // --- CALCULADORA DE TARAS EN CALIENTE (SALIDAS/REPROCESO) ---
  const outputTotalTara = useMemo(() => {
    return outputTarasSeleccionadas.reduce((sum, current) => {
      const taraInfo = tarasCatalog.find(t => t.id == current.taraId);
      if (!taraInfo) return sum;
      return sum + (Number(taraInfo.peso) * (parseInt(current.cantidad) || 0));
    }, 0);
  }, [outputTarasSeleccionadas, tarasCatalog]);

  const outputPesoNeto = useMemo(() => {
    const bruto = parseFloat(outputPesoBruto) || 0;
    return Math.max(0, bruto - outputTotalTara);
  }, [outputPesoBruto, outputTotalTara]);

  const handleAddOutputTara = () => {
    setOutputTarasSeleccionadas(prev => [...prev, { taraId: '', cantidad: 1 }]);
  };

  const handleRemoveOutputTara = (idx) => {
    setOutputTarasSeleccionadas(prev => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateOutputTara = (idx, field, value) => {
    setOutputTarasSeleccionadas(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      return { ...item, [field]: value };
    }));
  };

  const getUnidadesDeItem = (item) => {
    if (!item?.producto?.logistica) return null;

    if (item.producto?.peso_variable && item.cantidad_presentacion !== null && item.cantidad_presentacion !== undefined) {
      const pres = item.producto.logistica.find(l => l.id == item.id_presentacion_logistica);
      return {
        cantidad: Number(item.cantidad_presentacion),
        unidad: pres?.presentacion?.nombre || 'BOLSA',
        id_presentacion_logistica: item.id_presentacion_logistica,
        factor: pres?.factor || 1
      };
    }

    const pres = item.producto.logistica.find(l => l.presentacion?.nombre?.toUpperCase() === 'UNIDAD') || item.producto.logistica.find(l => l.es_base) || item.producto.logistica[0];
    if (!pres) return null;
    const factor = Number(pres.factor) || 1;
    const und = Math.round(Number(item.cantidad_actual) / factor);
    return {
      cantidad: und,
      unidad: pres.presentacion?.nombre || 'UND',
      id_presentacion_logistica: pres.id,
      factor: factor
    };
  };

  useEffect(() => {
    setTempEntrada(prev => ({
      ...prev,
      cantidad_unidades: '',
      cantidad_neto: 0
    }));
    setInputPesoBruto('');
    setInputTarasSeleccionadas([]);
  }, [tempEntrada.id_item_inventario]);

  const selectedItemInventario = useMemo(() => {
    return inventario.find(i => i.id == tempEntrada.id_item_inventario);
  }, [inventario, tempEntrada.id_item_inventario]);

  const theoreticalWeight = useMemo(() => {
    if (!selectedItemInventario || !tempEntrada.cantidad_unidades) return 0;
    const undInfo = getUnidadesDeItem(selectedItemInventario);
    if (!undInfo) return 0;
    return Number(tempEntrada.cantidad_unidades) * undInfo.factor;
  }, [selectedItemInventario, tempEntrada.cantidad_unidades]);

  // --- LÓGICA DE REPROCESO (Fase EN_PROCESO) ---
  const selectedProductoSalida = useMemo(() => {
    return productos.find(p => p.id == outputProductoId);
  }, [productos, outputProductoId]);

  const presentacionesSalidaDisponibles = useMemo(() => {
    return selectedProductoSalida?.logistica || [];
  }, [selectedProductoSalida]);

  const selectedPresentacionSalida = useMemo(() => {
    return presentacionesSalidaDisponibles.find(p => p.id == outputPresentacionId);
  }, [presentacionesSalidaDisponibles, outputPresentacionId]);

  // Autoseleccionar presentación de salida base
  useEffect(() => {
    if (selectedProductoSalida) {
      const basePres = (selectedProductoSalida.logistica || []).find(l => l.es_base);
      setOutputPresentacionId(basePres ? basePres.id.toString() : '');
      setOutputCantPresentaciones('');
    } else {
      setOutputPresentacionId('');
      setOutputCantPresentaciones('');
    }
  }, [selectedProductoSalida]);
  const productosEnMesaIds = useMemo(() => {
    return [...new Set(entradas.map(e => e.inventario?.producto?.id).filter(Boolean))];
  }, [entradas]);

  const subproductosValidosIds = useMemo(() => {
    if (productosEnMesaIds.length === 0) return [];
    const destinos = derivadosRel
      .filter(rel => productosEnMesaIds.includes(Number(rel.id_producto_origen)))
      .map(rel => Number(rel.id_producto_destino));
    return [...new Set(destinos)];
  }, [productosEnMesaIds, derivadosRel]);

  const productosResultantesFiltrados = useMemo(() => {
    const basicFiltered = productos.filter(prod => prod.es_resultado_transformacion === true);
    if (productosEnMesaIds.length === 0) return [];
    return basicFiltered.filter(prod => subproductosValidosIds.includes(Number(prod.id)));
  }, [productos, productosEnMesaIds, subproductosValidosIds]);

  const tieneInsumosCompatibles = useMemo(() => {
    if (!outputProductoId) return false;
    return entradas.some(e => {
      if (Number(e.cantidad_pendiente) <= 0) return false;
      const prodId = e.inventario?.producto?.id;
      return derivadosRel.some(rel => 
        Number(rel.id_producto_destino) === Number(outputProductoId) && 
        Number(rel.id_producto_origen) === Number(prodId)
      );
    });
  }, [entradas, outputProductoId, derivadosRel]);

  const totalConsumido = outputPesoNeto;
  const mermaMolienda = 0;

  const salidasAgrupadas = useMemo(() => {
    const grupos = {};
    
    salidas.forEach(s => {
      // Usamos una combinación de producto y el timestamp formateado (sin milisegundos)
      const formattedTime = formatDateSystemToDDMMYYYYHHMMSS(s.timestamp_create);
      const key = `${s.id_producto}_${formattedTime}`;
      
      // Obtener el nombre del insumo de origen
      const inputOrigen = entradas.find(e => e.id == s.id_entrada_transformacion);
      
      // Verificar compatibilidad del insumo con el producto de salida para mostrarlo visualmente
      const prodOrigenId = inputOrigen?.inventario?.producto?.id;
      const esCompatible = s.es_scrap || (prodOrigenId && derivadosRel.some(rel => 
        Number(rel.id_producto_destino) === Number(s.id_producto) && 
        Number(rel.id_producto_origen) === Number(prodOrigenId)
      ));

      let insumoNombre = null;
      if (s.es_scrap) {
        insumoNombre = 'Mermas de proceso';
      } else if (inputOrigen && esCompatible) {
        insumoNombre = inputOrigen.producto_nombre;
      }
      
      if (!grupos[key]) {
        grupos[key] = {
          ...s,
          cantidad_obtenida: Number(s.cantidad_obtenida),
          cantidad_presentacion: s.cantidad_presentacion ? Number(s.cantidad_presentacion) : null,
          insumos_origen: new Set(insumoNombre ? [insumoNombre] : []),
          ids_salidas_originales: [s.id]
        };
      } else {
        grupos[key].cantidad_obtenida += Number(s.cantidad_obtenida);
        if (s.cantidad_presentacion) {
          grupos[key].cantidad_presentacion = (grupos[key].cantidad_presentacion || 0) + Number(s.cantidad_presentacion);
        }
        // Conservar presentacion_logistica si el primer registro no la tenía
        if (!grupos[key].id_presentacion_logistica && s.id_presentacion_logistica) {
          grupos[key].id_presentacion_logistica = s.id_presentacion_logistica;
          grupos[key].presentacion_logistica = s.presentacion_logistica;
        }
        if (insumoNombre) {
          grupos[key].insumos_origen.add(insumoNombre);
        }
        grupos[key].ids_salidas_originales.push(s.id);
      }
    });
    
    return Object.values(grupos).map(g => ({
      ...g,
      insumos_origen_list: Array.from(g.insumos_origen).filter(Boolean)
    }));
  }, [salidas, entradas, derivadosRel]);


  // --- ACCIONES Y SUBMITS ---

  // Agregar consumo inicial (Borrador)
  const addEntrada = () => {
    if (!tempEntrada.id_item_inventario) { toast.error('Seleccione un lote con stock de pollo/corte'); return; }
    if (tempEntrada.cantidad_neto <= 0) { toast.error('Ingrese un peso neto de entrada válido (mayor a 0 KG)'); return; }

    const item = inventario.find(i => i.id == tempEntrada.id_item_inventario);
    if (!item) return;

    const yaAgregado = entradas.some(e => e.id_item_inventario == item.id);
    if (yaAgregado) { toast.error('Este insumo ya se encuentra asignado a la mesa'); return; }

    const undInfo = getUnidadesDeItem(item);
    const inputUnits = parseInt(tempEntrada.cantidad_unidades) || 0;

    if (undInfo) {
      if (inputUnits <= 0) {
        toast.error('Ingrese la cantidad de unidades (UND) a procesar');
        return;
      }
      if (inputUnits > undInfo.cantidad) {
        toast.error(`Excede las unidades disponibles en el lote (${undInfo.cantidad} ${undInfo.unidad})`);
        return;
      }
    } else {
      if (tempEntrada.cantidad_neto > Number(item.cantidad_actual)) {
        toast.error(`Excede el stock disponible del lote (${item.cantidad_actual} KG)`);
        return;
      }
    }

    setEntradas(prev => [...prev, {
      id_item_inventario: item.id,
      cantidad_consumida: tempEntrada.cantidad_neto,
      unidad_medida:      'KG',
      costo_unitario:     Number(item.costo_unidad_base) || 0,
      producto_nombre:    getNombreItemInventario(item),
      lote:               item.lote,
      id_presentacion_logistica: undInfo ? undInfo.id_presentacion_logistica : null,
      cantidad_presentacion:      undInfo ? inputUnits : null,
      cantidad_pendiente:         0,
      inventario: {
        id: item.id,
        lote: item.lote,
        producto: {
          id: item.producto?.id,
          id_rubro: item.producto?.id_rubro,
          id_marca: item.producto?.id_marca,
          variedad: item.producto?.variedad,
          rubro: item.producto?.rubro,
          marca: item.producto?.marca,
          categoria: item.producto?.rubro?.categoria
        }
      }
    }]);

    setTempEntrada({ id_item_inventario: '', cantidad_neto: 0, cantidad_unidades: '' });
    setInputPesoBruto('');
    setInputTarasSeleccionadas([]);
  };

  // Guardar en Borrador
  const handleGuardarBorrador = async (values, setSubmitting) => {
    if (entradas.length === 0) { toast.error('Debe agregar los insumos cárnicos a reprocesar'); setSubmitting(false); return; }
    setSaving(true);
    try {
      const sucursalId = sucursalActiva?.id || (perfil?.ids_sucursales && perfil.ids_sucursales[0]) || sucursalIdDefault || null;
      const cabecera = {
        id: currentOrdenId || null,
        id_empresa: empresaActiva.id,
        id_sucursal: sucursalId,
        id_almacen: almacenId,
        estatus: 'BORRADOR',
        observaciones: values.observaciones
      };

      await saveOrdenReproceso(cabecera, entradas, [], perfil.id);
      toast.success('Orden de reproceso guardada como BORRADOR');
      onUpdate();
      onClose();
    } catch (e) {
      toast.error('Error al guardar borrador: ' + e.message);
      console.error(e);
    } finally {
      setSaving(false);
      setSubmitting(false);
    }
  };

  // Iniciar Proceso (Cargar materia prima a la mesa de reproceso)
  const handleIniciarReprocesoProceso = async (values) => {
    if (entradas.length === 0) { toast.error('Debe agregar al menos un insumo antes de iniciar'); return; }
    setSaving(true);
    try {
      const sucursalId = sucursalActiva?.id || (perfil?.ids_sucursales && perfil.ids_sucursales[0]) || sucursalIdDefault || null;
      const cabecera = {
        id: currentOrdenId || null,
        id_empresa: empresaActiva.id,
        id_sucursal: sucursalId,
        id_almacen: almacenId,
        estatus: 'BORRADOR',
        observaciones: values.observaciones
      };
      
      const finalId = await saveOrdenReproceso(cabecera, entradas, [], perfil.id);
      setCurrentOrdenId(finalId);
      await iniciarDespote(finalId, perfil.id);
      toast.success('Reproceso Iniciado. Insumos cargados en la mesa de molienda.');
      
      await refrescarDatosOrden(finalId);
      onUpdate();
    } catch (e) {
      toast.error('Error al iniciar proceso de reproceso: ' + e.message);
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  // Registrar salida proporcional de la molienda (prorrateo automático)
  // Registrar salida con consumo en cascada (prioriza origen real y absorbe diferencias)
  const handleDeclararSalidaReproceso = async () => {
    if (!outputProductoId) { toast.error('Seleccione el producto de salida a obtener'); return; }
    if (!outputUbicacionId) { toast.error('Seleccione la cava/ubicación de destino'); return; }
    const neto = outputPesoNeto;
    if (neto <= 0) { toast.error('Ingrese el peso neto obtenido'); return; }

    setSaving(true);
    try {
      const entradasConSaldo = entradas.filter(e => Number(e.cantidad_pendiente) > 0);

      // 1. Identificar insumos preferidos (compatibles) en la mesa
      const preferredInputs = entradasConSaldo.filter(e => {
        const prodId = e.inventario?.producto?.id;
        return derivadosRel.some(rel => 
          Number(rel.id_producto_destino) === Number(outputProductoId) && 
          Number(rel.id_producto_origen) === Number(prodId)
        );
      });

      if (preferredInputs.length === 0) {
        toast.error('No hay materia prima compatible pendiente en la mesa para este subproducto');
        setSaving(false);
        return;
      }

      // 2. Separar insumos no preferidos (no compatibles)
      const otherInputs = entradasConSaldo.filter(e => !preferredInputs.some(pe => pe.id === e.id));

      // 3. Calcular totales de stock
      const totalPreferredPendiente = preferredInputs.reduce((sum, e) => sum + Number(e.cantidad_pendiente), 0);
      const totalMesaPendiente = entradasConSaldo.reduce((sum, e) => sum + Number(e.cantidad_pendiente), 0);

      // 4. Validar que la salida no exceda el total de la mesa
      if (neto > Number(totalMesaPendiente.toFixed(2))) {
        toast.error(`El peso neto a registrar (${neto} KG) excede la materia prima total disponible en la mesa (${formatNumber(totalMesaPendiente, 2)} KG)`);
        setSaving(false);
        return;
      }

      // 5. Asignar consumos en cascada
      const allocations = [];
      let acumuladoConsumo = 0;

      if (neto <= Number(totalPreferredPendiente.toFixed(2))) {
        // Todo se consume proporcionalmente de los preferidos
        preferredInputs.forEach((e, index) => {
          let consumido = 0;
          if (index === preferredInputs.length - 1) {
            consumido = Number((neto - acumuladoConsumo).toFixed(4));
          } else {
            consumido = Number((neto * (Number(e.cantidad_pendiente) / totalPreferredPendiente)).toFixed(4));
            acumuladoConsumo += consumido;
          }
          if (consumido > 0) {
            allocations.push({ entrada: e, consumido });
          }
        });
      } else {
        // Se consumen todos los preferidos a su límite
        preferredInputs.forEach(e => {
          const consumido = Number(Number(e.cantidad_pendiente).toFixed(4));
          acumuladoConsumo += consumido;
          allocations.push({ entrada: e, consumido });
        });

        // El resto se consume de los otros insumos de la mesa
        const resto = Number((neto - totalPreferredPendiente).toFixed(4));
        const totalOtherPendiente = otherInputs.reduce((sum, e) => sum + Number(e.cantidad_pendiente), 0);

        if (resto > 0 && otherInputs.length > 0) {
          let acumuladoResto = 0;
          otherInputs.forEach((e, index) => {
            let consumido = 0;
            if (index === otherInputs.length - 1) {
              consumido = Number((resto - acumuladoResto).toFixed(4));
            } else {
              consumido = Number((resto * (Number(e.cantidad_pendiente) / totalOtherPendiente)).toFixed(4));
              acumuladoResto += consumido;
            }
            if (consumido > 0) {
              allocations.push({ entrada: e, consumido });
            }
          });
        }
      }

      let pesoAcumulado = 0;
      let cantPresentacionAcumulada = 0;
      const totalCantPresentacion = parseFloat(outputCantPresentaciones) || 0;

      const promesas = allocations.map((item, index) => {
        const ratio = item.consumido / neto;
        
        // Peso proporcional
        let pesoProporcional = 0;
        if (index === allocations.length - 1) {
          pesoProporcional = Number((neto - pesoAcumulado).toFixed(2));
        } else {
          pesoProporcional = Number((neto * ratio).toFixed(2));
          pesoAcumulado += pesoProporcional;
        }

        // Cantidad de empaques proporcionales
        let presProporcional = null;
        if (totalCantPresentacion > 0) {
          if (index === allocations.length - 1) {
            presProporcional = Math.round(totalCantPresentacion - cantPresentacionAcumulada);
          } else {
            presProporcional = Math.round(totalCantPresentacion * ratio);
            cantPresentacionAcumulada += presProporcional;
          }
        }

        const payload = {
          id_transformacion:         currentOrdenId,
          id_entrada_transformacion: item.entrada.id,
          id_producto_salida:        Number(outputProductoId),
          cantidad_obtenida:         pesoProporcional,
          unidad_medida:             'KG',
          cantidad_insumo_descontar: item.consumido,
          id_ubicacion_destino:      Number(outputUbicacionId),
          costo_unitario_salida:     0,
          id_presentacion_logistica: outputPresentacionId ? Number(outputPresentacionId) : null,
          cantidad_presentacion:     presProporcional
        };

        return declararSalidaDespote(payload, perfil.id);
      });

      await Promise.all(promesas);

      toast.success('Pesaje de molienda registrado correctamente en cava.');

      // Limpiar campos de salida y taras
      setOutputProductoId('');
      setOutputUbicacionId('');
      setOutputPresentacionId('');
      setOutputCantPresentaciones('');
      setOutputPesoBruto('');
      setOutputTarasSeleccionadas([]);

      await refrescarDatosOrden(currentOrdenId);
      onUpdate();
    } catch (e) {
      toast.error('Error al registrar molienda: ' + e.message);
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  // Revertir y anular un pesaje parcial (soporta lote/array de IDs)
  const handleRevertirSalida = async (salidaIdOrIds) => {
    const ids = Array.isArray(salidaIdOrIds) ? salidaIdOrIds : [salidaIdOrIds];

    toast('¿Desea revertir y eliminar este pesaje?', {
      description: 'El stock ingresado se eliminará de la cava y la materia prima volverá a estar pendiente en la mesa.',
      duration: 8000,
      action: {
        label: 'Revertir Pesaje',
        onClick: async () => {
          setSaving(true);
          try {
            const promesas = ids.map(id => revertirSalidaDespote(id, perfil.id));
            await Promise.all(promesas);

            toast.success('Pesaje revertido correctamente. Stock devuelto a la mesa.');
            await refrescarDatosOrden(currentOrdenId);
            onUpdate();
          } catch (e) {
            toast.error('Error al revertir pesaje: ' + e.message);
            console.error(e);
          } finally {
            setSaving(false);
          }
        }
      }
    });
  };

  // Finalizar reproceso definitivo
  const handleFinalizarReprocesoOrden = () => {
    toast('¿Desea finalizar la orden de reproceso?', {
      description: 'Esto consolidará la merma definitiva y cerrará la orden de molienda.',
      duration: 8000,
      action: {
        label: 'Finalizar y Cerrar',
        onClick: async () => {
          setSaving(true);
          try {
            await finalizarDespote(currentOrdenId, perfil.id);
            toast.success('Orden de reproceso cerrada con éxito.');
            onUpdate();
            onClose();
          } catch (e) {
            toast.error('Error al finalizar orden: ' + e.message);
            console.error(e);
          } finally {
            setSaving(false);
          }
        }
      }
    });
  };

  // KPIs de Balance de Masa
  const balanceMasa = useMemo(() => {
    const totalEntrada = entradas.reduce((sum, e) => sum + Number(e.cantidad_consumida), 0);
    const totalCortesComerciales = salidas.filter(s => !s.es_scrap).reduce((sum, s) => sum + Number(s.cantidad_obtenida), 0);
    const scrapReal = salidas.filter(s => s.es_scrap).reduce((sum, s) => sum + Number(s.cantidad_obtenida), 0);
    const mermaProceso = scrapReal > 0 ? scrapReal : (estatus === 'EN_PROCESO' ? Math.max(0, totalEntrada - totalCortesComerciales) : 0);
    const rendimiento = totalEntrada > 0 ? (totalCortesComerciales / totalEntrada) * 100 : 0;

    return {
      totalEntrada,
      totalCortesComerciales,
      totalSubproductosFisicos: 0,
      mermaProceso,
      rendimiento
    };
  }, [entradas, salidas, estatus]);

  const statusConfig = {
    BORRADOR: { label: 'Borrador', color: 'bg-slate-50 text-slate-500 border-slate-200', icon: <FileEdit size={12} /> },
    EN_PROCESO: { label: 'En Proceso', color: 'bg-amber-50 text-amber-600 border-amber-200', icon: <Clock size={12} /> },
    PROCESADO: { label: 'Cerrado', color: 'bg-emerald-50 text-emerald-600 border-emerald-200 shadow-sm', icon: <CheckCircle2 size={12} /> },
    ANULADO: { label: 'Anulado', color: 'bg-red-50 text-red-600 border-red-200', icon: <X size={12} /> },
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-in fade-in duration-300" onClick={onClose}>
      <div className="bg-white rounded-md w-full h-full max-w-[96vw] max-h-[92vh] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
        
        {/* CABECERA */}
        <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between bg-white relative shrink-0">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-orange-500 to-orange-700" />
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-50 rounded-xl text-orange-600">
              <Layers size={22} />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-black uppercase tracking-tight text-slate-800">
                  {modoVisualizacion ? 'Detalle de Reproceso' : ordenId ? 'Gestionar Reproceso' : 'Crear Orden de Reproceso'}
                </h3>
                <div className={`px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${statusConfig[estatus]?.color}`}>
                  {statusConfig[estatus]?.icon}
                  {statusConfig[estatus]?.label}
                </div>
              </div>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest italic mt-0.5">
                Almacén Frigorífico: {nombreAlmacen ? nombreAlmacen : 'Frigorífico Principal'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 gap-4 bg-slate-50/20">
            <div className="w-12 h-12 border-4 border-orange-500/10 border-t-orange-500 rounded-full animate-spin" />
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cargando datos del reproceso...</p>
          </div>
        ) : (
          <Formik
            initialValues={{ observaciones: observaciones }}
            enableReinitialize
            onSubmit={(values, { setSubmitting }) => handleGuardarBorrador(values, setSubmitting)}
          >
            {({ values, handleChange, handleBlur, setSubmitting, handleSubmit }) => (
              <Form className="flex flex-col flex-1 overflow-hidden" onSubmit={handleSubmit}>
                
                <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1 bg-slate-50/30">
                  
                  {/* KPIs DE BALANCE DE MASA */}
                  {estatus !== 'BORRADOR' && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Entrada (KG)</span>
                        <span className="text-xl font-black text-slate-800 mt-1 tabular-nums">{formatNumber(balanceMasa.totalEntrada, 2)} KG</span>
                      </div>
                      <div className="bg-white p-4 rounded-2xl border border-orange-100 shadow-sm flex flex-col">
                        <span className="text-[9px] font-black text-orange-600 uppercase tracking-widest">Producto Obtenido (KG)</span>
                        <span className="text-xl font-black text-orange-950 mt-1 tabular-nums">{formatNumber(balanceMasa.totalCortesComerciales, 2)} KG</span>
                      </div>
                      <div className="bg-white p-4 rounded-2xl border border-red-100 shadow-sm flex flex-col">
                        <span className="text-[9px] font-black text-red-500 uppercase tracking-widest">Merma Proceso (KG)</span>
                        <span className="text-xl font-black text-red-600 mt-1 tabular-nums">{formatNumber(balanceMasa.mermaProceso, 2)} KG</span>
                      </div>
                      <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-sm flex flex-col justify-center">
                        <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Rendimiento</span>
                        <span className="text-xl font-black text-emerald-600 mt-1 tabular-nums">{formatNumber(balanceMasa.rendimiento, 1)}%</span>
                      </div>
                    </div>
                  )}

                  {/* ALERTA DE RENDIMIENTO DE REPROCESO */}
                  {estatus !== 'BORRADOR' && balanceMasa.totalEntrada > 0 && (
                    (() => {
                      const rendimientoReal = balanceMasa.rendimiento;
                      const mermaFisica = 100 - rendimientoReal;
                      const esNegativo = mermaFisica > 2.0; // Alerta si hay más de 2% de merma en molienda
                      
                      return (
                        <div className={`p-4 rounded-2xl border flex items-center gap-3 transition-all duration-300 animate-in fade-in duration-500 mt-2 ${
                          esNegativo 
                            ? 'bg-amber-50 border-amber-200 text-amber-700' 
                            : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        }`}>
                          <div className={`p-2 rounded-xl ${esNegativo ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
                            <AlertCircle size={18} />
                          </div>
                          <div className="flex-1">
                            <h5 className="text-[10px] font-black uppercase tracking-widest">
                              {esNegativo ? 'Desviación de Rendimiento en Molienda' : 'Rendimiento de Reproceso Conforme'}
                            </h5>
                            <p className="text-[11px] font-medium mt-0.5 italic">
                              {esNegativo 
                                ? `Se detectó una merma física de ${formatNumber(mermaFisica, 1)}% (${formatNumber(balanceMasa.mermaProceso, 2)} KG), superando la tolerancia esperada (2.0%). Rendimiento final: ${formatNumber(rendimientoReal, 1)}%.`
                                : `Rendimiento de molienda óptimo con merma física mínima de ${formatNumber(mermaFisica, 1)}% (${formatNumber(balanceMasa.mermaProceso, 2)} KG). Rendimiento final: ${formatNumber(rendimientoReal, 1)}%.`
                              }
                            </p>
                          </div>
                        </div>
                      );
                    })()
                  )}

                  {/* FASE A: MATERIA PRIMA (ENTRADAS) */}
                  <div className="bg-white p-4 rounded-md border border-slate-100 shadow-sm space-y-1">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-100 pb-2 flex items-center gap-2">
                      <Scale size={14} className="text-orange-600" /> 1. Ingreso de Materia Prima a Reprocesar
                    </h4>

                    {entradas.length > 0 ? (
                      <div className="border border-slate-100 rounded-2xl overflow-hidden">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-50/50 text-[9px] font-black uppercase text-slate-400 border-b">
                              <th className="px-4 py-3">Corte / Insumo</th>
                              <th className="px-4 py-3 text-right">Lote</th>
                              <th className="px-4 py-3 text-right">Peso Recibido</th>
                              <th className="px-4 py-3 text-right">Costo Unitario</th>
                              {estatus === 'BORRADOR' && !modoVisualizacion && <th className="px-4 py-3 text-center">Quitar</th>}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {entradas.map((e, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/30 transition-colors">
                                <td className="px-4 py-1 font-bold text-slate-700 uppercase">{e.producto_nombre}</td>
                                <td className="px-4 py-1 text-right font-bold text-slate-500">{e.lote}</td>
                                <td className="px-4 py-1 text-right font-black text-slate-850">
                                  {e.cantidad_consumida} KG
                                  {e.cantidad_presentacion && (
                                    <span className="text-[10px] font-normal text-slate-400 block">
                                      {e.cantidad_presentacion} UND
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-1 text-right font-black text-emerald-600">$ {formatNumber(e.costo_unitario, 2)}</td>
                                {estatus === 'BORRADOR' && !modoVisualizacion && (
                                  <td className="px-4 py-3 text-center">
                                    <button type="button" onClick={() => setEntradas(prev => prev.filter((_, i) => i !== idx))}
                                      className="text-red-400 hover:text-red-650 p-1.5 hover:bg-red-50 rounded-xl transition-all">
                                      <Trash2 size={14} />
                                    </button>
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-orange-600 bg-orange-50/50 p-4 rounded-2xl text-xs font-bold border border-orange-100">
                        <AlertCircle size={14} />
                        <span>Añada los insumos cárnicos que se colocarán en la mesa para ser molidos/reprocesados.</span>
                      </div>
                    )}

                    {estatus === 'BORRADOR' && !modoVisualizacion && (
                      <div className="bg-slate-50/50 px-4 py-2 rounded-md border border-slate-100 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                          <div className="flex flex-col gap-1 col-span-1 md:col-span-8">
                            <label className="text-[9px] font-black text-slate-400 uppercase">Seleccionar Stock para Reprocesar</label>
                            <select
                              value={tempEntrada.id_item_inventario}
                              onChange={e => setTempEntrada(prev => ({ ...prev, id_item_inventario: e.target.value }))}
                              className="text-xs font-bold text-slate-700 bg-white p-3 rounded-xl border border-slate-150 outline-none focus:border-orange-500 shadow-sm w-full"
                            >
                              <option value="">-- SELECCIONE STOCK DISPONIBLE --</option>
                              {inventario
                                .filter(item => !entradas.some(e => e.id_item_inventario == item.id))
                                .map(item => {
                                const undInfo = getUnidadesDeItem(item);
                                const stockDisplay = undInfo 
                                  ? `Stock: ${formatNumber(item.cantidad_actual, 2)} KG / ${undInfo.cantidad} ${undInfo.unidad}`
                                  : `Stock: ${formatNumber(item.cantidad_actual, 2)} KG`;
                                return (
                                  <option key={item.id} value={item.id}>
                                    {getNombreItemInventario(item)} [{stockDisplay}]
                                  </option>
                                );
                              })}
                            </select>
                          </div>

                          <div className="flex flex-col gap-1 col-span-1 md:col-span-2">
                            <div className="flex flex-col gap-1">
                              <label className="text-[9px] font-black text-slate-400 uppercase">Unidades (UND)</label>
                              <input
                                type="number"
                                min="1"
                                disabled={!tempEntrada.id_item_inventario || !getUnidadesDeItem(selectedItemInventario)}
                                placeholder={selectedItemInventario && getUnidadesDeItem(selectedItemInventario) 
                                  ? `Máx: ${getUnidadesDeItem(selectedItemInventario)?.cantidad}` 
                                  : "--"}
                                value={tempEntrada.cantidad_unidades}
                                onChange={e => setTempEntrada(prev => ({ ...prev, cantidad_unidades: e.target.value }))}
                                className="text-xs font-bold text-slate-700 bg-white p-3 rounded-xl border border-slate-150 outline-none focus:border-orange-500 disabled:opacity-50 shadow-sm w-full"
                              />
                            </div>

                            <div className="flex flex-col gap-1">
                              <label className="text-[9px] font-black text-slate-400 uppercase">Peso Bruto (Báscula KG)</label>
                              <input
                                type="number"
                                step="0.01"
                                placeholder={theoreticalWeight > 0 ? `Teórico: ${formatNumber(theoreticalWeight, 2)}` : "Ej: 15.4"}
                                value={inputPesoBruto}
                                disabled={!tempEntrada.id_item_inventario}
                                onChange={e => setInputPesoBruto(e.target.value)}
                                className="text-xs font-bold text-slate-700 bg-white p-3 rounded-xl border border-slate-150 outline-none focus:border-orange-500 shadow-sm w-full"
                              />
                            </div>
                          </div>

                          <div className="flex flex-col justify-end col-span-1 md:col-span-2">
                            <button
                              type="button"
                              disabled={!tempEntrada.id_item_inventario || inputPesoNeto <= 0}
                              onClick={addEntrada}
                              className="flex items-center justify-center gap-1.5 px-4 py-3.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-black uppercase active:scale-95 transition-all w-full shadow-lg shadow-orange-600/20 disabled:opacity-50"
                            >
                              <Plus size={14} /> Cargar a la Mesa
                            </button>
                          </div>
                        </div>

                        {/* Calculadora de Taras Múltiples de Entrada */}
                        {tempEntrada.id_item_inventario && (
                          <div className="border-t border-slate-100 pt-4 space-y-3 animate-in fade-in">
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Descuento de Taras (Cestas / Paletas)</span>
                              <button
                                type="button"
                                onClick={handleAddInputTara}
                                className="text-[9px] font-black uppercase text-orange-600 hover:text-orange-700 flex items-center gap-1"
                              >
                                <Plus size={12} /> Añadir Cesta/Paleta
                              </button>
                            </div>

                            {inputTarasSeleccionadas.length > 0 && (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-white p-4 rounded-xl border border-slate-100">
                                {inputTarasSeleccionadas.map((tSel, idx) => (
                                  <div key={idx} className="flex items-center gap-2">
                                    <select
                                      value={tSel.taraId}
                                      onChange={e => handleUpdateInputTara(idx, 'taraId', e.target.value)}
                                      className="text-xs font-bold text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-150 outline-none flex-1"
                                    >
                                      <option value="">-- SELECCIONE TARA --</option>
                                      {tarasCatalog.map(t => (
                                        <option key={t.id} value={t.id}>{t.descripcion} ({t.peso} KG)</option>
                                      ))}
                                    </select>
                                    <input
                                      type="number"
                                      min="1"
                                      value={tSel.cantidad}
                                      onChange={e => handleUpdateInputTara(idx, 'cantidad', e.target.value)}
                                      className="text-xs font-bold text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-150 outline-none w-16 text-center"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveInputTara(idx)}
                                      className="text-red-400 hover:text-red-650 p-1.5 rounded-lg hover:bg-red-50"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}

                            <div className="flex items-center gap-4 bg-orange-50/50 p-3 rounded-xl border border-orange-100 text-xs font-bold text-slate-750">
                              <div>Peso Bruto: <span className="font-black text-slate-900">{parseFloat(inputPesoBruto) || 0} KG</span></div>
                              <div className="w-px h-4 bg-orange-200" />
                              <div>Total Tara: <span className="font-black text-red-600">-{formatNumber(inputTotalTara, 2)} KG</span></div>
                              <div className="w-px h-4 bg-orange-200" />
                              <div>Peso Neto Real: <span className="font-black text-emerald-600 text-sm">{formatNumber(inputPesoNeto, 2)} KG</span></div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* FASE B: REGISTRAR DECLARACIÓN DE REPROCESO (EN PROCESO) */}
                  {estatus === 'EN_PROCESO' && !modoVisualizacion && (
                    <div className="bg-white px-6 py-4 rounded-md border border-orange-100 shadow-sm space-y-4 animate-in slide-in-from-bottom-2 duration-300">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-orange-600 border-b border-orange-50 pb-1 flex items-center gap-1">
                        <Scale size={14} /> 2. Registrar Declaración de Reproceso (Salida)
                      </h4>

                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2">
                        
                        {/* PANEL IZQUIERDO: SELECCIÓN DEL SUBPRODUCTO Y PESAJE */}
                        <div className="lg:col-span-5 space-y-4 bg-slate-50/40 p-2 rounded-2xl border border-slate-100">
                          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block border-b border-slate-200 pb-1">DATOS DE LA SALIDA</span>
                          
                          <div className="flex flex-col gap-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase">Subproducto a Obtener</label>
                            <select
                              value={outputProductoId}
                              onChange={e => setOutputProductoId(e.target.value)}
                              className="text-xs font-bold text-slate-700 bg-white p-3 rounded-xl border border-slate-150 outline-none focus:border-orange-500 shadow-sm w-full"
                            >
                              <option value="">-- SELECCIONE PRODUCTO --</option>
                              {productosResultantesFiltrados.map(prod => (
                                <option key={prod.id} value={prod.id}>
                                  {getNombreProducto(prod)}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="flex flex-col gap-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase">Destino en Cava</label>
                            <select
                              value={outputUbicacionId}
                              disabled={!outputProductoId}
                              onChange={e => setOutputUbicacionId(e.target.value)}
                              className="text-xs font-bold text-slate-700 bg-white p-3 rounded-xl border border-slate-150 outline-none focus:border-orange-500 disabled:opacity-50 shadow-sm w-full"
                            >
                              <option value="">-- SELECCIONE CAVA --</option>
                              {ubicaciones.map(u => (
                                <option key={u.id} value={u.id}>
                                  {u.tipoalmacen?.nombre} [{u.codigo}] {u.nombre}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="flex flex-col gap-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase">Peso Bruto Báscula (KG)</label>
                            <input
                              type="number"
                              step="0.01"
                              disabled={!outputProductoId}
                              placeholder="Ej: 19.5"
                              value={outputPesoBruto}
                              onChange={e => setOutputPesoBruto(e.target.value)}
                              className="text-xs font-bold text-slate-700 bg-white p-3 rounded-xl border border-slate-150 outline-none focus:border-orange-500 disabled:opacity-50 shadow-sm w-full"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div className="flex flex-col gap-1">
                              <label className="text-[9px] font-black text-slate-400 uppercase">Empaque</label>
                              <select
                                value={outputPresentacionId}
                                disabled={!outputProductoId}
                                onChange={e => setOutputPresentacionId(e.target.value)}
                                className="text-xs font-bold text-slate-700 bg-white p-3 rounded-xl border border-slate-150 outline-none focus:border-orange-500 disabled:opacity-50 shadow-sm w-full"
                              >
                                <option value="">-- SELECCIONE --</option>
                                {presentacionesSalidaDisponibles.map(p => (
                                  <option key={p.id} value={p.id}>
                                    {p.presentacion?.nombre || 'UNIDAD'}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="flex flex-col gap-1">
                              <label className="text-[9px] font-black text-slate-400 uppercase">Cant. Envases</label>
                              <input
                                type="number"
                                min="1"
                                disabled={!outputProductoId}
                                placeholder="Ej: 10"
                                value={outputCantPresentaciones}
                                onChange={e => setOutputCantPresentaciones(e.target.value)}
                                className="text-xs font-bold text-slate-700 bg-white p-3 rounded-xl border border-slate-150 outline-none focus:border-orange-500 disabled:opacity-50 shadow-sm w-full"
                              />
                            </div>
                          </div>
                        </div>

                        {/* PANEL CENTRAL: SALDOS DE MATERIA PRIMA EN MESA */}
                        <div className="lg:col-span-4 space-y-1 bg-slate-50/40 px-2 py-1 rounded-2xl border border-slate-100 flex flex-col">
                          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block border-b border-slate-200 pb-1">SALDOS DE MATERIA PRIMA EN MESA</span>
                          
                          <div className="flex-1 overflow-y-auto space-y-2 max-h-80 pr-1">
                            {entradas.filter(e => Number(e.cantidad_pendiente) > 0).map(e => {
                              const prodId = e.inventario?.producto?.id;
                              const esOrigenValido = !outputProductoId || derivadosRel.some(rel => 
                                Number(rel.id_producto_destino) === Number(outputProductoId) && 
                                Number(rel.id_producto_origen) === Number(prodId)
                              );

                              return (
                                <div key={e.id} className={`bg-white p-3 rounded-xl border border-slate-100 flex items-center justify-between gap-4 transition-all duration-200 ${!esOrigenValido ? 'opacity-40 bg-slate-50/50' : 'shadow-sm'}`}>
                                  <div className="flex-1 min-w-0">
                                    <span className="text-[10px] font-black text-slate-700 uppercase block truncate">{e.producto_nombre}</span>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <span className="text-[8px] font-bold text-slate-400 uppercase bg-slate-50 px-1.5 py-0.5 rounded">Lote: {e.lote}</span>
                                    </div>
                                  </div>
                                  
                                  <div>
                                    {esOrigenValido ? (
                                      <span className="px-2.5 py-1 rounded-full text-[8px] font-black bg-emerald-50 text-emerald-700 uppercase tracking-widest">Apto</span>
                                    ) : (
                                      <span className="px-2.5 py-1 rounded-full text-[8px] font-black bg-slate-100 text-slate-400 uppercase tracking-widest">Excluido</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                            {entradas.filter(e => Number(e.cantidad_pendiente) > 0).length === 0 && (
                              <div className="text-[10px] text-slate-400 italic text-center py-10">
                                No queda materia prima pendiente en la mesa.
                              </div>
                            )}
                          </div>
                        </div>

                        {/* PANEL DERECHO: TARAS, TOTALES Y ACCIÓN DE GUARDADO */}
                        <div className="lg:col-span-3 space-y-1 flex flex-col justify-between">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Taras de Embalaje</span>
                              <button
                                type="button"
                                disabled={!outputProductoId}
                                onClick={handleAddOutputTara}
                                className="text-[9px] font-black uppercase text-orange-600 hover:text-orange-700 flex items-center gap-1 disabled:opacity-50"
                              >
                                <Plus size={12} /> Añadir Cesta/Paleta
                              </button>
                            </div>

                            {outputTarasSeleccionadas.length > 0 ? (
                              <div className="grid grid-cols-1 gap-2 bg-slate-50/20 p-3 rounded-xl border border-slate-100 max-h-32 overflow-y-auto">
                                {outputTarasSeleccionadas.map((tSel, idx) => (
                                  <div key={idx} className="flex items-center gap-2">
                                    <select
                                      value={tSel.taraId}
                                      onChange={e => handleUpdateOutputTara(idx, 'taraId', e.target.value)}
                                      className="text-[10px] font-bold text-slate-700 bg-white p-1.5 rounded-lg border border-slate-150 outline-none flex-1"
                                    >
                                      <option value="">-- SELECCIONE TARA --</option>
                                      {tarasCatalog.map(t => (
                                        <option key={t.id} value={t.id}>{t.tipotara?.nombre} {t.descripcion} ({t.peso} KG)</option>
                                      ))}
                                    </select>
                                    <input
                                      type="number"
                                      min="1"
                                      value={tSel.cantidad}
                                      onChange={e => handleUpdateOutputTara(idx, 'cantidad', e.target.value)}
                                      className="text-[10px] font-bold text-slate-700 bg-white p-1.5 rounded-lg border border-slate-150 outline-none w-10 text-center"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveOutputTara(idx)}
                                      className="text-red-400 hover:text-red-650 p-1 rounded-lg hover:bg-red-50"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-[9px] text-slate-400 italic">No se han descontado taras en la salida de molienda.</div>
                            )}
                          </div>

                          <div className="space-y-4">
                            <div className="bg-orange-50/50 p-4 rounded-2xl border border-orange-100 space-y-2 text-xs font-bold text-slate-700">
                              <div>Peso Bruto: <span className="font-black text-slate-900">{parseFloat(outputPesoBruto) || 0} KG</span></div>
                              <div>Total Tara: <span className="font-black text-red-600">-{formatNumber(outputTotalTara, 2)} KG</span></div>
                              <div className="border-t border-dashed border-orange-200 pt-2 flex justify-between">
                                <span>Peso Neto Salida:</span>
                                <span className="font-black text-emerald-600 text-sm">{formatNumber(outputPesoNeto, 2)} KG</span>
                              </div>
                            </div>

                            <button
                              type="button"
                              disabled={saving || !outputUbicacionId || outputPesoNeto <= 0 || !tieneInsumosCompatibles}
                              onClick={handleDeclararSalidaReproceso}
                              className="flex items-center justify-center gap-1.5 px-4 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-black uppercase active:scale-95 transition-all w-full shadow-lg shadow-orange-600/20 disabled:opacity-50"
                            >
                              <Plus size={14} /> Registrar Molienda
                            </button>

                            <button
                              type="button"
                              disabled={saving || !outputProductoId || !outputPresentacionId || !outputUbicacionId || !outputCantPresentaciones || parseInt(outputCantPresentaciones) <= 0 || !tieneInsumosCompatibles}
                              onClick={handlePrintCaliente}
                              className="flex items-center justify-center gap-1.5 px-4 py-3 bg-white border-2 border-orange-600 text-orange-600 hover:bg-orange-50 rounded-xl text-xs font-black uppercase active:scale-95 transition-all w-full shadow-md disabled:opacity-50 mt-2"
                            >
                              <Printer size={14} /> Imprimir Etiquetas
                            </button>
                          </div>
                        </div>

                      </div>
                    </div>
                  )}

                  {/* FASE C: PRODUCTOS OBTENIDOS (HISTORIAL/SALIDAS) */}
                  {(salidas.length > 0 || estatus !== 'BORRADOR') && (
                    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-100 pb-2 flex items-center gap-2">
                        <Package size={14} className="text-orange-600" /> {estatus === 'BORRADOR' ? '2. Subproductos Declarados' : '3. Historial de Cortes Producidos'}
                      </h4>

                      {salidas.length > 0 ? (
                        <div className="border border-slate-100 rounded-2xl overflow-hidden">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-slate-50/50 text-[9px] font-black uppercase text-slate-400 border-b">
                                <th className="px-4 py-3">Producto Obtenido</th>
                                <th className="px-4 py-3">Insumo Origen</th>
                                <th className="px-4 py-3">Lote</th>
                                <th className="px-4 py-3">Ubicación (Cava)</th>
                                <th className="px-4 py-3 text-right">Peso Neto</th>
                                <th className="px-4 py-3 text-right">Costo Asignado / KG</th>
                                <th className="px-4 py-3 text-right">Valor Total</th>
                                <th className="px-4 py-3 text-center">Acciones</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-150">
                              {salidasAgrupadas.map((s, idx) => {
                                return (
                                  <tr key={idx} className="hover:bg-slate-50/30 transition-colors">
                                    <td className="px-4 py-3 font-bold text-slate-700 uppercase">
                                      <div className="flex flex-col gap-1">
                                        <span>{s.es_scrap ? 'Mermas de proceso' : (s.producto_nombre || getNombreProducto(s.producto))}</span>
                                        <span className="text-[9px] text-slate-400 font-normal">{formatDateSystemToDDMMYYYYHHMMSS(s.timestamp_create)}</span>
                                        <span className="text-[9px] text-slate-400 font-mono">{s.tracking_id || '--'}</span>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 font-bold text-slate-500 uppercase">
                                      {s.es_scrap ? (
                                        '--'
                                      ) : (
                                        <div className="flex flex-col gap-0.5">
                                          {(s.insumos_origen_list || []).map((insumo, i) => (
                                            <span key={i} className="block text-[10px]">{insumo}</span>
                                          ))}
                                        </div>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 font-bold text-slate-500">{s.lote_generado}</td>
                                    <td className="px-4 py-3 font-medium text-slate-600">{s.ubicacion_codigo}</td>
                                    <td className="px-4 py-3 text-right font-black text-slate-800">
                                      {formatNumber(s.cantidad_obtenida, 2)} KG
                                      {s.cantidad_presentacion && (
                                        <span className="text-[10px] font-normal text-slate-400 block">
                                          {s.cantidad_presentacion} {s.presentacion_logistica?.presentacion?.nombre || 'ENV'}
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 text-right font-black text-emerald-600">
                                      {estatus === 'EN_PROCESO' ? (
                                        <span className="text-[10px] text-slate-400 italic">Provisional</span>
                                      ) : (
                                        s.costo_unitario > 0
                                          ?
                                        `$ ${formatNumber(s.costo_unitario, 2)}`
                                          :
                                        <span className="text-[10px] text-slate-400 italic">$ 0.00</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 text-right font-black text-slate-800">
                                      {estatus === 'EN_PROCESO' ? (
                                        <span className="text-[10px] text-slate-400 italic">--</span>
                                      ) : (
                                        s.costo_unitario > 0
                                          ?
                                        `$ ${formatNumber(Number(s.cantidad_obtenida) * Number(s.costo_unitario), 2)}`
                                          :
                                        <span className="text-[10px] text-slate-400 italic">$ 0.00</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      <div className="flex items-center justify-center gap-1.5">
                                        {s.tracking_id && (
                                          <button type="button" onClick={() => handlePrintEtiqueta(s)}
                                            className="text-slate-400 hover:text-orange-600 p-1.5 hover:bg-orange-50 rounded-xl transition-all"
                                            title="Imprimir etiqueta">
                                            <Printer size={15} />
                                          </button>
                                        )}
                                        {estatus === 'EN_PROCESO' && !modoVisualizacion && (
                                          <button type="button" onClick={() => handleRevertirSalida(s.ids_salidas_originales)}
                                            className="text-red-400 hover:text-red-650 p-1.5 hover:bg-red-50 rounded-xl transition-all"
                                            title="Revertir y eliminar pesaje">
                                            <Trash2 size={14} />
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="text-[10px] text-slate-400 italic text-center py-6">Aún no se han registrado moliendas en la mesa.</div>
                      )}
                    </div>
                  )}
 
                  {/* OBSERVACIONES */}
                  <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Observaciones y Notas Operativas</label>
                    <textarea
                      name="observaciones"
                      placeholder="Ingrese detalles sobre el proceso de reproceso o desviaciones detectadas..."
                      value={values.observaciones}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      disabled={estatus !== 'BORRADOR' || modoVisualizacion}
                      className="w-full text-xs font-bold text-slate-700 bg-slate-50 p-4 rounded-2xl border border-slate-150 outline-none focus:border-orange-500 focus:bg-white transition-all shadow-inner"
                      rows="2"
                    />
                  </div>

                </div>

                {/* BOTONES / PIE DE PÁGINA */}
                <div className="px-8 py-5 border-t border-slate-100 flex items-center justify-between bg-white relative shrink-0">
                  <div>
                    {estatus === 'EN_PROCESO' && (
                      <span className="text-[10px] font-black uppercase text-orange-700 tracking-wider flex items-center gap-1">
                        <AlertCircle size={12} className="text-orange-600" /> Los costos unitarios definitivos se calcularán de forma prorrateada al finalizar el reproceso.
                      </span>
                    )}
                  </div>
                  
                  <div className="flex gap-3">
                    <button type="button" onClick={onClose}
                      className="px-6 py-2.5 rounded-xl border border-slate-200 text-xs font-black uppercase text-slate-500 hover:bg-slate-50 transition-colors">
                      {modoVisualizacion ? 'Cerrar Vista' : 'Cancelar'}
                    </button>
                    
                    {!modoVisualizacion && (
                      <>
                        {estatus === 'BORRADOR' && (
                          <>
                            <button
                              type="submit"
                              disabled={saving}
                              className="px-6 py-2.5 rounded-xl border border-orange-600 text-orange-600 hover:bg-orange-50 text-xs font-black uppercase transition-colors"
                            >
                              Guardar Borrador
                            </button>
                            <button
                              type="button"
                              onClick={() => handleIniciarReprocesoProceso(values)}
                              disabled={saving || entradas.length === 0}
                              className="px-6 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-black uppercase shadow-lg shadow-orange-600/20 active:scale-95 transition-all"
                            >
                              Iniciar Reproceso (Mesa)
                            </button>
                          </>
                        )}

                        {estatus === 'EN_PROCESO' && (
                          <button
                            type="button"
                            onClick={handleFinalizarReprocesoOrden}
                            disabled={saving}
                            className="px-6 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-black uppercase shadow-xl shadow-orange-600/10 active:scale-95 transition-all"
                          >
                            Finalizar y Cerrar Reproceso
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

              </Form>
            )}
          </Formik>
        )}

        {/* MODAL DE IMPRESIÓN DE ETIQUETAS */}
        <EtiquetasTrackingRecepcionModal
          isOpen={etiquetaPrintOpen}
          onClose={() => {
            setEtiquetaPrintOpen(false);
            setItemEtiquetaPrint([]);
          }}
          inventario={itemEtiquetaPrint}
        />

      </div>
    </div>,
    document.body
  );
}
