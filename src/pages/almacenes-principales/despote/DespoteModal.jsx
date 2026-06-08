import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Formik, Form } from 'formik';
import { X, Layers, Plus, Trash2, Scale, Package, AlertCircle, Eye, Play, CheckCircle2, Clock, FileEdit, Printer, Percent, Thermometer } from 'lucide-react';
import { 
  getOrdenDespoteById, 
  saveOrdenDespote, 
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
import { getEquivalenciasCostos } from '../../../util/auxiliares';

export default function DespoteModal({ empresaActiva, sucursalActiva, perfil, almacenId, nombreAlmacen, ordenId, modoVisualizacion, onClose, onUpdate }) {
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
  
  // Para la Fase 2 (Salida de Cortes)
  const [outputPesoBruto, setOutputPesoBruto] = useState('');
  const [outputTarasSeleccionadas, setOutputTarasSeleccionadas] = useState([]); // [{taraId, cantidad}]

  // Temporales de carga (Fase Borrador)
  const [tempEntrada, setTempEntrada] = useState({ id_item_inventario: '', cantidad_neto: 0, cantidad_unidades: '' });
  
  // Temporales de Declaración Parcial (Fase En Proceso)
  const [tempDeclarar, setTempDeclarar] = useState({
    id_entrada_transformacion: '',
    id_producto_salida: '',
    id_presentacion_logistica: '',
    cantidad_presentacion: '',
    cantidad_neto_salida: '',
    cantidad_insumo_descontar: '',
    porcentaje_costo: '',
    id_ubicacion_destino: ''
  });

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
      // Filtrar lotes activos del almacén frigorífico que sean insumos
      setInventario((inv || []).filter(item => 
        Number(item.cantidad_actual) > 0 && 
        !item.is_bloqueado && 
        item.producto?.es_insumo_transformacion === true
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
      toast.error('Error al cargar catálogos de despote');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const refrescarDatosOrden = async (id, ubsList = null) => {
    const ubs = ubsList || ubicaciones;
    const orden = await getOrdenDespoteById(id);
    console.log(orden.salidas)
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
    if (!tempDeclarar.id_entrada_transformacion || !tempDeclarar.id_producto_salida || !tempDeclarar.id_presentacion_logistica || !tempDeclarar.id_ubicacion_destino || !tempDeclarar.cantidad_presentacion) {
      toast.error('Complete todos los campos de salida (materia prima, corte, presentación, ubicación de destino y cantidad de envases) para imprimir en caliente');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        id_transformacion: currentOrdenId,
        id_entrada_transformacion: Number(tempDeclarar.id_entrada_transformacion),
        id_producto_salida: Number(tempDeclarar.id_producto_salida),
        id_presentacion_logistica: Number(tempDeclarar.id_presentacion_logistica),
        id_ubicacion_destino: Number(tempDeclarar.id_ubicacion_destino)
      };

      const trackingId = await obtenerOCrearTrkDespote(payload, perfil.id);
      
      const pInfo = productos.find(p => p.id == tempDeclarar.id_producto_salida);
      const presLogistica = presentacionesSalidaDisponibles.find(p => p.id == tempDeclarar.id_presentacion_logistica);
      const presentacionNombre = presLogistica?.presentacion?.nombre || 'UNIDAD';
      const bultosReales = parseInt(tempDeclarar.cantidad_presentacion) || 1;
      const selectEntrada = entradas.find(e => e.id == tempDeclarar.id_entrada_transformacion);

      const itemVirtual = {
        id: tempDeclarar.id_producto_salida,
        tracking_id: trackingId,
        lote: selectEntrada?.lote || 'SIN-LOTE',
        fecha_vencimiento: selectEntrada?.inventario?.fecha_vencimiento || null,
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
    console.log('Obteniendo nombre para item de inventario:', item);
    if (!item?.producto) return '';
    const categoria = item.producto.rubro.categoria?.nombre || '';
    const marca = item.producto.marca?.nombre || '';
    const variedad = item.producto.variedad || '';
    const rubro = item.producto.rubro?.nombre || '';
    return [categoria,rubro, marca, variedad].filter(Boolean).join(' · ') + ` (Lote: ${item.lote || 'N/A'})`;
  };

  const getNombreProducto = (prod) => {
    if (!prod) return '';
    const categoria = prod.rubro.categoria?.nombre || '';
    const marca = prod.marca?.nombre || '';
    const variedad = prod.variedad || '';
    const rubro = prod.rubro?.nombre || '';
    return [categoria, rubro, marca, variedad].filter(Boolean).join(' · ');
  };

  // --- CALCULADORA DE TARAS EN CALIENTE ---

  // Cálculo de tara para Entrada de Insumo (Fase 1)
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

  // Actualizar el valor neto temporal al calcular tara de entrada
  useEffect(() => {
    setTempEntrada(prev => ({
      ...prev,
      cantidad_neto: inputPesoNeto
    }));
  }, [inputPesoNeto]);

  // Manejo de taras en lista
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

  // Cálculo de tara para Salida de Cortes (Fase 2)
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

  // Actualizar el valor neto temporal al calcular tara de salida
  useEffect(() => {
    setTempDeclarar(prev => ({
      ...prev,
      cantidad_neto_salida: outputPesoNeto > 0 ? outputPesoNeto.toString() : ''
    }));
  }, [outputPesoNeto]);

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

    // Si es peso variable, mostramos el stock real de empaques físicos del inventario
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

  // Limpiar unidades y peso al cambiar de item seleccionado
  useEffect(() => {
    setTempEntrada(prev => ({
      ...prev,
      cantidad_unidades: '',
      cantidad_neto: 0
    }));
    setInputPesoBruto('');
    setInputTarasSeleccionadas([]);
  }, [tempEntrada.id_item_inventario]);

  // Memoización para el insumo seleccionado en Borrador
  const selectedItemInventario = useMemo(() => {
    return inventario.find(i => i.id == tempEntrada.id_item_inventario);
  }, [inventario, tempEntrada.id_item_inventario]);

  const theoreticalWeight = useMemo(() => {
    if (!selectedItemInventario || !tempEntrada.cantidad_unidades) return 0;
    const undInfo = getUnidadesDeItem(selectedItemInventario);
    if (!undInfo) return 0;
    return Number(tempEntrada.cantidad_unidades) * undInfo.factor;
  }, [selectedItemInventario, tempEntrada.cantidad_unidades]);

  // --- LÓGICA DE FORMULARIO EN MESA (Fase EN_PROCESO) ---
  const selectedInsumoMesa = useMemo(() => {
    return entradas.find(e => e.id == tempDeclarar.id_entrada_transformacion);
  }, [entradas, tempDeclarar.id_entrada_transformacion]);

  const deMesaExcedido = useMemo(() => {
    if (!selectedInsumoMesa) return false;
    const descontar = parseFloat(tempDeclarar.cantidad_insumo_descontar) || 0;
    const disponible = Number(selectedInsumoMesa.cantidad_pendiente) || 0;
    return descontar > disponible;
  }, [selectedInsumoMesa, tempDeclarar.cantidad_insumo_descontar]);

  const selectedProductoSalida = useMemo(() => {
    return productos.find(p => p.id == tempDeclarar.id_producto_salida);
  }, [productos, tempDeclarar.id_producto_salida]);

  const presentacionesSalidaDisponibles = useMemo(() => {
    return selectedProductoSalida?.logistica || [];
  }, [selectedProductoSalida]);

  const selectedPresentacionSalida = useMemo(() => {
    return presentacionesSalidaDisponibles.find(p => p.id == tempDeclarar.id_presentacion_logistica);
  }, [presentacionesSalidaDisponibles, tempDeclarar.id_presentacion_logistica]);

  // Autoseleccionar presentación de salida base y precargar porcentaje de costo recomendado
  useEffect(() => {
    if (selectedProductoSalida) {
      const basePres = (selectedProductoSalida.logistica || []).find(l => l.es_base);
      
      const mapping = derivadosRel.find(d => 
        Number(d.id_producto_origen) === Number(selectedInsumoMesa?.inventario?.producto?.id) &&
        Number(d.id_producto_destino) === Number(selectedProductoSalida.id)
      );
      const defaultPct = mapping && Number(mapping.porcentaje_costo) > 0 ? mapping.porcentaje_costo.toString() : '';

      setTempDeclarar(prev => ({
        ...prev,
        id_presentacion_logistica: basePres ? basePres.id.toString() : '',
        cantidad_presentacion: '',
        cantidad_neto_salida: '',
        porcentaje_costo: defaultPct
      }));
    } else {
      setTempDeclarar(prev => ({
        ...prev,
        id_presentacion_logistica: '',
        cantidad_presentacion: '',
        cantidad_neto_salida: '',
        cantidad_insumo_descontar: '',
        porcentaje_costo: ''
      }));
    }
  }, [selectedProductoSalida, selectedInsumoMesa, derivadosRel]);

  // Al ingresar cantidad, descontamos el mismo peso del insumo
  useEffect(() => {
    const pesoNeto = parseFloat(tempDeclarar.cantidad_neto_salida) || 0;
    setTempDeclarar(prev => ({
      ...prev,
      cantidad_insumo_descontar: pesoNeto > 0 ? pesoNeto.toString() : ''
    }));
  }, [tempDeclarar.cantidad_neto_salida]);

  // Calcular el costo distribuido en caliente basado en el porcentaje asignado
  const costoUnitarioCorteCalculado = useMemo(() => {
    const pesoNeto = parseFloat(tempDeclarar.cantidad_neto_salida) || 0;
    const porcentaje = parseFloat(tempDeclarar.porcentaje_costo) || 0;
    if (pesoNeto <= 0 || !selectedInsumoMesa) return 0;
    
    // Costo total del insumo cargado a mesa (para esta orden) con recargo por costo indirecto
    const recargo = Number(selectedInsumoMesa?.inventario?.producto?.rubro?.porcentaje_costo_indirecto) || 0;
    
    // Si la distribución de costo es proporcional al peso (porcionado/deshuese)
    if (selectedInsumoMesa?.inventario?.producto?.costo_proporcional_peso) {
      if (porcentaje === 0) {
        return 0; // Desperdicio de costo $0.00
      }
      // Hereda el costo base unitario del insumo incrementado por costos indirectos
      return Number(selectedInsumoMesa.costo_unitario) * (1 + recargo / 100);
    }
    
    // De lo contrario, prorrateo por plantilla fija ("Torta")
    if (porcentaje <= 0) return 0;
    const costoTotalConsumoMesa = (Number(selectedInsumoMesa.cantidad_consumida) * Number(selectedInsumoMesa.costo_unitario)) * (1 + recargo / 100);
    const costoAsignado = costoTotalConsumoMesa * (porcentaje / 100);
    return costoAsignado / pesoNeto;
  }, [tempDeclarar.cantidad_neto_salida, tempDeclarar.porcentaje_costo, selectedInsumoMesa]);

  // Porcentaje acumulado ya distribuido en la orden actual
  const porcentajeCostoDistribuidoAcumulado = useMemo(() => {
    // Suma de costo total de insumos (entradas) con sus respectivos recargos por costo indirecto
    const totalCostoEntradas = entradas.reduce((sum, e) => {
      const eRecargo = Number(e.inventario?.producto?.rubro?.porcentaje_costo_indirecto) || 0;
      return sum + (Number(e.cantidad_consumida) * Number(e.costo_unitario) * (1 + eRecargo / 100));
    }, 0);
    if (totalCostoEntradas <= 0) return 0;
    
    // Suma de costo total de salidas obtenidas
    const totalCostoSalidas = salidas.reduce((sum, s) => sum + (Number(s.cantidad_obtenida) * Number(s.costo_unitario)), 0);
    
    // Calcular porcentaje real
    const pct = (totalCostoSalidas / totalCostoEntradas) * 100;
    return Math.round(pct * 100) / 100; // Redondeado a 2 decimales
  }, [entradas, salidas]);

  const porcentajeRestanteCosto = useMemo(() => {
    return Math.max(0, 100 - porcentajeCostoDistribuidoAcumulado);
  }, [porcentajeCostoDistribuidoAcumulado]);

  // Filtrar productos resultantes del despote en base al insumo en mesa (derivados configurados)
  const productosResultantesFiltrados = useMemo(() => {
    if (!selectedInsumoMesa?.inventario?.producto?.id) return [];
    
    const idsValidos = derivadosRel
      .filter(d => Number(d.id_producto_origen) === Number(selectedInsumoMesa.inventario.producto.id))
      .map(d => d.id_producto_destino);
      
    if (idsValidos.length === 0) {
      // Fallback si no hay mapeo registrado para este producto origen
      return productos.filter(prod => prod.es_resultado_transformacion === true);
    }
    
    return productos.filter(prod => idsValidos.includes(prod.id));
  }, [productos, selectedInsumoMesa, derivadosRel]);


  // --- ACCIONES Y SUBMITS ---

  // Agregar consumo inicial (Borrador)
  const addEntrada = () => {
    if (!tempEntrada.id_item_inventario) { toast.error('Seleccione un lote con stock de canal/pollo'); return; }
    if (tempEntrada.cantidad_neto <= 0) { toast.error('Ingrese un peso neto de entrada válido (mayor a 0 KG)'); return; }

    const item = inventario.find(i => i.id == tempEntrada.id_item_inventario);
    if (!item) return;

    // Buscar si ya está agregado
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
      cantidad_mesa:      tempEntrada.cantidad_neto,
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

    // Limpiar calculadora y temporales
    setTempEntrada({ id_item_inventario: '', cantidad_neto: 0, cantidad_unidades: '' });
    setInputPesoBruto('');
    setInputTarasSeleccionadas([]);
  };

  // Guardar en Borrador
  const handleGuardarBorrador = async (values, setSubmitting) => {
    if (entradas.length === 0) { toast.error('Debe agregar la materia prima (canal/pollo entero)'); setSubmitting(false); return; }
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

      await saveOrdenDespote(cabecera, entradas, [], perfil.id);
      toast.success('Orden de despote guardada como BORRADOR');
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

  // Iniciar Proceso (Cargar materia prima a la mesa de despote)
  const handleIniciarDespoteProceso = async (values) => {
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
      
      const finalId = await saveOrdenDespote(cabecera, entradas, [], perfil.id);
      setCurrentOrdenId(finalId);
      await iniciarDespote(finalId, perfil.id);
      toast.success('Despote Iniciado. Insumo cárnico cargado en la mesa de deshuese.');
      
      await refrescarDatosOrden(finalId);
      onUpdate();
    } catch (e) {
      toast.error('Error al iniciar proceso de despote: ' + e.message);
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  // Registrar salida parcial de un corte
  const handleDeclararSalidaParcial = async () => {
    if (!tempDeclarar.id_entrada_transformacion) { toast.error('Seleccione la materia prima en mesa'); return; }
    if (!tempDeclarar.id_producto_salida) { toast.error('Seleccione el corte de salida a obtener'); return; }
    if (!tempDeclarar.id_presentacion_logistica) { toast.error('Seleccione la presentación de salida'); return; }
    const pesoNeto = parseFloat(tempDeclarar.cantidad_neto_salida) || 0;
    const insumoDescontar = parseFloat(tempDeclarar.cantidad_insumo_descontar) || 0;

    if (pesoNeto <= 0) { toast.error('Ingrese el peso neto del corte obtenido'); return; }
    if (!tempDeclarar.id_ubicacion_destino) { toast.error('Seleccione la cava/ubicación de destino'); return; }

    if (insumoDescontar > Number(selectedInsumoMesa.cantidad_pendiente)) {
      toast.error(`Cantidad en mesa insuficiente (${selectedInsumoMesa.cantidad_pendiente} KG)`);
      return;
    }

    setSaving(true);
    try {
      const factorSalida = selectedPresentacionSalida ? Number(selectedPresentacionSalida.factor) : 1;
      const cantidadBaseObtenida = pesoNeto; // Se registra en KG directamente
      
      const payload = {
        id_transformacion:         currentOrdenId,
        id_entrada_transformacion: Number(tempDeclarar.id_entrada_transformacion),
        id_producto_salida:        Number(tempDeclarar.id_producto_salida),
        cantidad_obtenida:         cantidadBaseObtenida,
        unidad_medida:             'KG',
        cantidad_insumo_descontar: insumoDescontar,
        id_ubicacion_destino:      Number(tempDeclarar.id_ubicacion_destino),
        costo_unitario_salida:     0, // Costo unitario provisional (se calcula al cerrar la orden)
        id_presentacion_logistica: tempDeclarar.id_presentacion_logistica ? Number(tempDeclarar.id_presentacion_logistica) : null,
        cantidad_presentacion:     tempDeclarar.cantidad_presentacion ? parseFloat(tempDeclarar.cantidad_presentacion) : null
      };

      // Guardamos la declaración
      await declararSalidaDespote(payload, perfil.id);

      toast.success('Pesaje de corte registrado e ingresado al stock de cava.');

      // Limpiar temporal y calculadora
      setTempDeclarar({
        id_entrada_transformacion: '',
        id_producto_salida: '',
        id_presentacion_logistica: '',
        cantidad_presentacion: '',
        cantidad_neto_salida: '',
        cantidad_insumo_descontar: '',
        porcentaje_costo: '',
        id_ubicacion_destino: ''
      });
      setOutputPesoBruto('');
      setOutputTarasSeleccionadas([]);

      await refrescarDatosOrden(currentOrdenId);
      onUpdate();
    } catch (e) {
      toast.error('Error al registrar corte: ' + e.message);
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  // Revertir y anular un pesaje parcial
  const handleRevertirSalida = async (salidaId) => {
    toast('¿Desea revertir y eliminar este pesaje?', {
      description: 'El stock ingresado se eliminará de la cava y la materia prima volverá a estar pendiente en la mesa.',
      duration: 8000,
      action: {
        label: 'Revertir Pesaje',
        onClick: async () => {
          setSaving(true);
          try {
            await revertirSalidaDespote(salidaId, perfil.id);
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

  // Finalizar despote definitivo
  const handleFinalizarDespoteOrden = () => {
    toast('¿Desea finalizar la orden de despote?', {
      description: 'Esto consolidará la merma definitiva y cerrará la orden de proceso cárnico.',
      duration: 8000,
      action: {
        label: 'Finalizar y Cerrar',
        onClick: async () => {
          setSaving(true);
          try {
            await finalizarDespote(currentOrdenId, perfil.id);
            toast.success('Orden de despote cerrada con éxito.');
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

  const expectedYieldPercent = useMemo(() => {
    const insumoIds = [...new Set(entradas.map(e => Number(e.inventario?.producto?.id || e.id_producto)))].filter(Boolean);
    if (insumoIds.length === 0) return 0;
    const filtrados = derivadosRel.filter(d => insumoIds.includes(Number(d.id_producto_origen)));
    return filtrados.reduce((sum, d) => sum + Number(d.porcentaje_corte || 0), 0);
  }, [entradas, derivadosRel]);

  // KPIs de Balance de Masa
  const balanceMasa = useMemo(() => {
    const totalEntrada = entradas.reduce((sum, e) => sum + Number(e.cantidad_consumida), 0);
    const totalEntradaMesa = entradas.reduce((sum, e) => sum + Number(e.cantidad_mesa !== undefined && e.cantidad_mesa !== null ? e.cantidad_mesa : e.cantidad_consumida), 0);
    
    const totalCortesComerciales = salidas.filter(s => {
      if (s.es_scrap) return false;
      const pInfo = productos.find(p => p.id == s.id_producto);
      const isSub = pInfo ? pInfo.es_subproducto : (s.producto?.es_subproducto || false);
      return !isSub;
    }).reduce((sum, s) => sum + Number(s.cantidad_obtenida), 0);

    const totalSubproductosFisicos = salidas.filter(s => {
      if (s.es_scrap) return false;
      const pInfo = productos.find(p => p.id == s.id_producto);
      const isSub = pInfo ? pInfo.es_subproducto : (s.producto?.es_subproducto || false);
      return isSub;
    }).reduce((sum, s) => sum + Number(s.cantidad_obtenida), 0);

    const totalMermaReposo = Math.max(0, totalEntrada - totalEntradaMesa);

    const scrapReal = salidas.filter(s => s.es_scrap).reduce((sum, s) => sum + Number(s.cantidad_obtenida), 0);
    const mermaProceso = scrapReal > 0 ? scrapReal : (estatus === 'EN_PROCESO' ? Math.max(0, totalEntradaMesa - (totalCortesComerciales + totalSubproductosFisicos)) : 0);
    const rendimiento = totalEntradaMesa > 0 ? (totalCortesComerciales / totalEntradaMesa) * 100 : 0;

    return {
      totalEntrada,
      totalEntradaMesa,
      totalCortesComerciales,
      totalSubproductosFisicos,
      totalMermaReposo,
      mermaProceso,
      rendimiento
    };
  }, [entradas, salidas, estatus, derivadosRel, productos]);

  const statusConfig = {
    BORRADOR: { label: 'Borrador', color: 'bg-slate-50 text-slate-500 border-slate-200', icon: <FileEdit size={12} /> },
    EN_PROCESO: { label: 'Despostando (Mesa)', color: 'bg-amber-50 text-amber-600 border-amber-200', icon: <Clock size={12} /> },
    PROCESADO: { label: 'Cerrado', color: 'bg-emerald-50 text-emerald-600 border-emerald-200 shadow-sm', icon: <CheckCircle2 size={12} /> },
    ANULADO: { label: 'Anulado', color: 'bg-red-50 text-red-600 border-red-200', icon: <X size={12} /> },
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-in fade-in duration-300" onClick={onClose}>
      <div className="bg-white rounded-md w-full h-full max-w-[96vw] max-h-[92vh] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
        
        {/* CABECERA */}
        <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between bg-white relative shrink-0">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-brand-500 to-brand-900" />
          <div className="flex items-center gap-4">
            <div className="p-3 bg-brand-50 rounded-xl text-brand-900">
              <Layers size={22} />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-black uppercase tracking-tight text-slate-800">
                  {modoVisualizacion ? 'Detalle de Despote' : ordenId ? 'Gestionar Despote' : 'Crear Orden de Despote'}
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
            <div className="w-12 h-12 border-4 border-brand-900/10 border-t-brand-900 rounded-full animate-spin" />
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cargando datos del despote...</p>
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
                  
                  {/* PANELES DE KPIs DE BALANCE DE MASA (Solo si hay proceso) */}
                  {estatus !== 'BORRADOR' && (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Entrada Original (KG)</span>
                        <span className="text-xl font-black text-slate-800 mt-1 tabular-nums">{formatNumber(balanceMasa.totalEntrada, 2)} KG</span>
                      </div>
                      <div className="bg-white p-4 rounded-2xl border border-blue-100 shadow-sm flex flex-col">
                        <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest">Merma Reposo (KG)</span>
                        <span className="text-xl font-black text-blue-600 mt-1 tabular-nums">{formatNumber(balanceMasa.totalMermaReposo, 2)} KG</span>
                      </div>
                      <div className="bg-white p-4 rounded-2xl border border-brand-100 shadow-sm flex flex-col">
                        <span className="text-[9px] font-black text-brand-600 uppercase tracking-widest">Cortes Obtenidos (KG)</span>
                        <span className="text-xl font-black text-brand-900 mt-1 tabular-nums">{formatNumber(balanceMasa.totalCortesComerciales, 2)} KG</span>
                      </div>
                      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Subproductos (KG)</span>
                        <span className="text-xl font-black text-slate-600 mt-1 tabular-nums">{formatNumber(balanceMasa.totalSubproductosFisicos, 2)} KG</span>
                      </div>
                      <div className="bg-white p-4 rounded-2xl border border-red-100 shadow-sm flex flex-col">
                        <span className="text-[9px] font-black text-red-500 uppercase tracking-widest">Merma Proceso (KG)</span>
                        <span className="text-xl font-black text-red-600 mt-1 tabular-nums">{formatNumber(balanceMasa.mermaProceso, 2)} KG</span>
                      </div>
                      <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-sm flex flex-col justify-center">
                        <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Rendimiento Cárnico</span>
                        <span className="text-xl font-black text-emerald-600 mt-1 tabular-nums">{formatNumber(balanceMasa.rendimiento, 1)}%</span>
                      </div>
                    </div>
                  )}

                  {/* ALERTA DE DESVIACIÓN DE RENDIMIENTO */}
                  {estatus !== 'BORRADOR' && balanceMasa.totalEntradaMesa > 0 && expectedYieldPercent > 0 && (
                    (() => {
                      const rendimientoEsperado = expectedYieldPercent;
                      const rendimientoReal = balanceMasa.rendimiento;
                      const desviacion = rendimientoReal - rendimientoEsperado;
                      const kilosDesviacion = balanceMasa.totalEntradaMesa * (desviacion / 100);
                      const esNegativo = desviacion < -0.5; // Tolerancia de 0.5%
                      
                      return (
                        <div className={`p-4 rounded-2xl border flex items-center gap-3 transition-all animate-in fade-in duration-500 mt-2 ${
                          esNegativo 
                            ? 'bg-red-50 border-red-200 text-red-700' 
                            : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        }`}>
                          <div className={`p-2 rounded-xl ${esNegativo ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                            <AlertCircle size={18} />
                          </div>
                          <div className="flex-1">
                            <h5 className="text-[10px] font-black uppercase tracking-widest">
                              {esNegativo ? 'Advertencia de Rendimiento Cárnico' : 'Rendimiento Cárnico Conforme'}
                            </h5>
                            <p className="text-[11px] font-medium mt-0.5 italic">
                              {esNegativo 
                                ? `El rendimiento real (${formatNumber(rendimientoReal, 1)}%) estuvo por debajo del estándar esperado (${formatNumber(rendimientoEsperado, 1)}%). Desviación de ${formatNumber(Math.abs(desviacion), 2)}% (${formatNumber(Math.abs(kilosDesviacion), 2)} KG menos de producto comercial).`
                                : `El rendimiento real (${formatNumber(rendimientoReal, 1)}%) cumple o supera el estándar esperado (${formatNumber(rendimientoEsperado, 1)}%). Desviación de +${formatNumber(desviacion, 2)}% (${formatNumber(kilosDesviacion, 2)} KG adicionales).`
                              }
                            </p>
                          </div>
                        </div>
                      );
                    })()
                  )}

                  {/* ========================================================
                      FASE A: INSUMOS / CANAL (ENTRADAS)
                     ======================================================== */}
                  <div className="bg-white p-4 rounded-md border border-slate-100 shadow-sm space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-100 pb-2 flex items-center gap-2">
                      <Scale size={14} className="text-brand-900" /> 1. Ingreso de Materia Prima (Canal / Lote)
                    </h4>

                    {entradas.length > 0 ? (
                      <div className="border border-slate-100 rounded-2xl overflow-hidden">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-50/50 text-[9px] font-black uppercase text-slate-400 border-b">
                              <th className="px-4 py-3">Insumo Cárnico</th>
                              <th className="px-4 py-3 text-right">Lote</th>
                              <th className="px-4 py-3 text-right">Peso Recibido</th>
                              <th className="px-4 py-3 text-right bg-blue-50/40 text-blue-800">Peso en Mesa (Neto)</th>
                              <th className="px-4 py-3 text-right bg-amber-50/40 text-amber-800">Pendiente en Mesa</th>
                              <th className="px-4 py-3 text-right">Costo Unitario Base</th>
                              {estatus === 'BORRADOR' && !modoVisualizacion && <th className="px-4 py-3 text-center">Quitar</th>}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {entradas.map((e, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/30 transition-colors">
                                <td className="px-4 py-3 font-bold text-slate-700 uppercase">{e.producto_nombre}</td>
                                <td className="px-4 py-3 text-right font-bold text-slate-500">{e.lote}</td>
                                <td className="px-4 py-3 text-right font-black text-slate-850">
                                  {e.cantidad_consumida} KG
                                  {e.cantidad_presentacion && (
                                    <span className="text-[10px] font-normal text-slate-400 block">
                                      {e.cantidad_presentacion} UND
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right font-black bg-blue-50/10 text-blue-900">
                                  {estatus === 'BORRADOR' && !modoVisualizacion && (e.inventario?.producto?.rubro?.permite_merma_reposo || e.producto?.rubro?.permite_merma_reposo) ? (
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      value={e.cantidad_mesa !== undefined && e.cantidad_mesa !== null ? e.cantidad_mesa : e.cantidad_consumida}
                                      onChange={(evt) => {
                                        const val = evt.target.value === '' ? '' : parseFloat(evt.target.value);
                                        setEntradas(prev => prev.map((item, i) => i === idx ? { ...item, cantidad_mesa: val } : item));
                                      }}
                                      className="w-24 px-2 py-1 border border-blue-200 rounded text-right font-black focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                                    />
                                  ) : (
                                    <span>
                                      {formatNumber(e.cantidad_mesa !== undefined && e.cantidad_mesa !== null ? e.cantidad_mesa : e.cantidad_consumida, 2)} KG
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right font-black bg-amber-50/10 text-amber-850">
                                  {estatus === 'BORRADOR' ? '--' : `${formatNumber(e.cantidad_pendiente, 2)} KG`}
                                  {estatus !== 'BORRADOR' && e.cantidad_presentacion && (
                                    <span className="text-[10px] font-normal text-slate-400 block">
                                      {Math.round((Number(e.cantidad_pendiente) / (Number(e.cantidad_consumida) || 1)) * Number(e.cantidad_presentacion))} UND
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right font-black text-emerald-600">$ {formatNumber(e.costo_unitario, 2)}</td>
                                {estatus === 'BORRADOR' && !modoVisualizacion && (
                                  <td className="px-4 py-3 text-center">
                                    <button type="button" onClick={() => setEntradas(prev => prev.filter((_, i) => i !== idx))}
                                      className="text-red-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-xl transition-all">
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
                      <div className="flex items-center gap-2 text-amber-600 bg-amber-50/50 p-4 rounded-2xl text-xs font-bold border border-amber-100">
                        <AlertCircle size={14} />
                        <span>Añada la materia prima cárnica que se va a despostar en esta orden.</span>
                      </div>
                    )}

                    {estatus === 'BORRADOR' && !modoVisualizacion && (
                      <div className="bg-slate-50/50 px-4 py-2 rounded-md border border-slate-100 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                          <div className="flex flex-col gap-1 col-span-1 md:col-span-8">
                            <label className="text-[9px] font-black text-slate-400 uppercase">Seleccionar Insumo del Stock</label>
                            <select
                              value={tempEntrada.id_item_inventario}
                              onChange={e => setTempEntrada(prev => ({ ...prev, id_item_inventario: e.target.value }))}
                              className="text-xs font-bold text-slate-700 bg-white p-3 rounded-xl border border-slate-150 outline-none focus:border-brand-500 shadow-sm w-full"
                            >
                              <option value="">-- SELECCIONE STOCK DISPONIBLE --</option>
                              {inventario.map(item => {
                                const undInfo = getUnidadesDeItem(item);
                                const cantidadActualNum = Number(item.cantidad_actual);
                                const cantidadFormateada = formatNumber(cantidadActualNum, getDecimalPlaces(cantidadActualNum));
                                const stockDisplay = undInfo 
                                  ? `Stock: ${cantidadFormateada} KG / ${undInfo.cantidad} ${undInfo.unidad}`
                                  : `Stock: ${cantidadFormateada} KG`;
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
                                className="text-xs font-bold text-slate-700 bg-white p-3 rounded-xl border border-slate-150 outline-none focus:border-brand-500 disabled:opacity-50 shadow-sm w-full"
                              />
                            </div>

                            <div className="flex flex-col gap-1">
                              <label className="text-[9px] font-black text-slate-400 uppercase">Peso Bruto (Báscula KG)</label>
                              <input
                                type="number"
                                step="0.01"
                                placeholder={theoreticalWeight > 0 ? `Teórico: ${formatNumber(theoreticalWeight, 2)}` : "Ej: 641.2"}
                                value={inputPesoBruto}
                                disabled={!tempEntrada.id_item_inventario}
                                onChange={e => setInputPesoBruto(e.target.value)}
                                className="text-xs font-bold text-slate-700 bg-white p-3 rounded-xl border border-slate-150 outline-none focus:border-brand-500 shadow-sm w-full"
                              />
                            </div>
                          </div>


                          <div className="flex flex-col justify-end col-span-1 md:col-span-2">
                            <button
                              type="button"
                              disabled={!tempEntrada.id_item_inventario || inputPesoNeto <= 0}
                              onClick={addEntrada}
                              className="flex items-center justify-center gap-1.5 px-4 py-3.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-black uppercase active:scale-95 transition-all w-full shadow-lg shadow-orange-500/20 disabled:opacity-50"
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
                                className="text-[9px] font-black uppercase text-brand-900 hover:text-brand-950 flex items-center gap-1"
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
                                      className="text-red-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Resultados de tara de entrada */}
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


                  {/* ========================================================
                      FASE B: FORMULARIO DE FRACCIONAMIENTO PARCIAL (EN PROCESO)
                     ======================================================== */}
                  {estatus === 'EN_PROCESO' && !modoVisualizacion && (
                    <div className="bg-white px-6 py-1 rounded-md border border-amber-100 shadow-sm space-y-1 animate-in slide-in-from-bottom-2 duration-300">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-600 border-b border-amber-50 pb-1 flex items-center gap-1">
                        <Scale size={14} /> 2. Registrar Declaración de Salida de Cortes
                      </h4>

                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center bg-slate-50/40 p-5 rounded-md border border-slate-100">
                        {/* Selector Insumo */}
                        <div className="md:col-span-7 flex flex-col gap-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase">1. Insumo Origen (Mesa)</label>
                          <select
                            value={tempDeclarar.id_entrada_transformacion}
                            onChange={e => setTempDeclarar(prev => ({ ...prev, id_entrada_transformacion: e.target.value }))}
                            className="text-xs font-bold text-slate-700 bg-white p-3 rounded-xl border border-slate-150 outline-none focus:border-brand-500 shadow-sm"
                          >
                            <option value="">-- SELECCIONE INSUMO EN MESA --</option>
                            {entradas.filter(e => Number(e.cantidad_pendiente) > 0).map(e => (
                              <option key={e.id} value={e.id}>
                                {e.producto_nombre} [Disponible: {(Number(e.cantidad_pendiente) || 0).toFixed(2)} KG]
                              </option>
                            ))}
                          </select>
                        </div>
                        
                        <div className="md:col-span-5 flex flex-col gap-1">
                          {/* Selector Producto Salida */}
                          <div className="flex flex-col gap-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase">2. Producto Obtenido (Corte / Merma)</label>
                            <select
                              value={tempDeclarar.id_producto_salida}
                              disabled={!tempDeclarar.id_entrada_transformacion}
                              onChange={e => setTempDeclarar(prev => ({ ...prev, id_producto_salida: e.target.value }))}
                              className="text-xs font-bold text-slate-700 bg-white p-3 rounded-xl border border-slate-150 outline-none focus:border-brand-500 disabled:opacity-50 shadow-sm"
                            >
                              <option value="">-- SELECCIONE PRODUCTO --</option>
                              {productosResultantesFiltrados.map(prod => (
                                <option key={prod.id} value={prod.id}>
                                  {getNombreProducto(prod)}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Destino en Cava */}
                          <div className="flex flex-col gap-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase">3. Destino en Frigorífico (Cava)</label>
                            <select
                              value={tempDeclarar.id_ubicacion_destino}
                              disabled={!tempDeclarar.id_producto_salida}
                              onChange={e => setTempDeclarar(prev => ({ ...prev, id_ubicacion_destino: e.target.value }))}
                              className="text-xs font-bold text-slate-700 bg-white p-3 rounded-xl border border-slate-150 outline-none focus:border-brand-500 disabled:opacity-50 shadow-sm"
                            >
                              <option value="">-- SELECCIONE CAVA --</option>
                              {ubicaciones.map(u => (
                                <option key={u.id} value={u.id}>
                                  {u.tipoalmacen?.nombre} [{u.codigo}] {u.nombre}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Sección de Pesaje y Calculadora de Taras de Salida */}
                      {tempDeclarar.id_producto_salida && (
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start bg-slate-50/20 p-5 rounded-2xl border border-slate-100 animate-in fade-in">
                          
                          {/* Columna Pesaje */}
                          <div className="md:col-span-4 space-y-4">
                            <div className="flex flex-col gap-1">
                              <label className="text-[9px] font-black text-slate-400 uppercase">Peso Bruto del Corte (Báscula KG)</label>
                              <input
                                type="number"
                                step="0.01"
                                placeholder="Ej: 22.4"
                                value={outputPesoBruto}
                                onChange={e => setOutputPesoBruto(e.target.value)}
                                className="text-xs font-bold text-slate-700 bg-white p-3 rounded-xl border border-slate-150 outline-none focus:border-brand-500 shadow-sm w-full"
                              />
                            </div>

                             <div className="flex flex-col gap-1">
                              <label className="text-[9px] font-black text-slate-400 uppercase">Distribución de Costo (%)</label>
                              <div className="relative">
                                <input
                                  type="number"
                                  readOnly
                                  placeholder="Plantilla"
                                  value={tempDeclarar.porcentaje_costo}
                                  className="text-xs font-bold text-slate-500 bg-slate-100/70 p-3 pr-10 rounded-xl border border-slate-150 outline-none w-full cursor-not-allowed"
                                />
                                <Percent size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                              </div>
                              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tight ml-1">
                                Porcentaje de costo asignado por plantilla.
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div className="flex flex-col gap-1">
                                <label className="text-[9px] font-black text-slate-400 uppercase">Empaque / Envase</label>
                                <select
                                  value={tempDeclarar.id_presentacion_logistica}
                                  onChange={e => setTempDeclarar(prev => ({ ...prev, id_presentacion_logistica: e.target.value }))}
                                  className="text-xs font-bold text-slate-700 bg-white p-3 rounded-xl border border-slate-150 outline-none focus:border-brand-500 shadow-sm w-full"
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
                                  placeholder="Ej: 10"
                                  value={tempDeclarar.cantidad_presentacion}
                                  onChange={e => setTempDeclarar(prev => ({ ...prev, cantidad_presentacion: e.target.value }))}
                                  className="text-xs font-bold text-slate-700 bg-white p-3 rounded-xl border border-slate-150 outline-none focus:border-brand-500 shadow-sm w-full"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Columna Calculadora de Tara */}
                          <div className="md:col-span-5 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Taras de Embalaje Utilizadas</span>
                              <button
                                type="button"
                                onClick={handleAddOutputTara}
                                className="text-[9px] font-black uppercase text-brand-900 hover:text-brand-950 flex items-center gap-1"
                              >
                                <Plus size={12} /> Añadir Cesta/Paleta
                              </button>
                            </div>

                            {outputTarasSeleccionadas.length > 0 ? (
                              <div className="grid grid-cols-1 gap-2 bg-white p-3 rounded-xl border border-slate-100 max-h-40 overflow-y-auto">
                                {outputTarasSeleccionadas.map((tSel, idx) => (
                                  <div key={idx} className="flex items-center gap-2">
                                    <select
                                      value={tSel.taraId}
                                      onChange={e => handleUpdateOutputTara(idx, 'taraId', e.target.value)}
                                      className="text-xs font-bold text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-150 outline-none flex-1"
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
                                      className="text-xs font-bold text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-150 outline-none w-14 text-center"
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
                              <div className="text-[9px] text-slate-400 italic">No se han agregado taras al pesaje (el peso bruto será tomado como neto).</div>
                            )}
                          </div>

                          {/* Columna Totales y Botón */}
                          <div className="md:col-span-3 space-y-4">
                            <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-100 space-y-2 text-xs font-bold">
                              <div>Peso Bruto: <span className="font-black text-slate-900">{parseFloat(outputPesoBruto) || 0} KG</span></div>
                              <div>Total Tara: <span className="font-black text-red-600">-{formatNumber(outputTotalTara, 2)} KG</span></div>
                              <div className="border-t border-dashed border-amber-200 pt-2">
                                Peso Neto / Descuento: <span className="font-black text-emerald-600 text-sm">{formatNumber(outputPesoNeto, 2)} KG</span>
                              </div>
                              {costoUnitarioCorteCalculado > 0 && (
                                <div className="border-t border-amber-150 pt-2 text-emerald-700 text-[10px] font-black">
                                  Costo Calculado: $ {formatNumber(costoUnitarioCorteCalculado, 4)} / KG
                                </div>
                              )}
                            </div>

                            <button
                              type="button"
                              disabled={saving || !tempDeclarar.id_ubicacion_destino || outputPesoNeto <= 0 || deMesaExcedido}
                              onClick={handleDeclararSalidaParcial}
                              className="flex items-center justify-center gap-1.5 px-4 py-3 bg-brand-900 hover:bg-brand-950 text-white rounded-xl text-xs font-black uppercase active:scale-95 transition-all w-full shadow-lg shadow-brand-900/10 disabled:opacity-50"
                            >
                              <Plus size={14} /> Registrar Pesaje Corte
                            </button>

                            <button
                              type="button"
                              disabled={saving || !tempDeclarar.id_entrada_transformacion || !tempDeclarar.id_producto_salida || !tempDeclarar.id_presentacion_logistica || !tempDeclarar.id_ubicacion_destino || !tempDeclarar.cantidad_presentacion || parseInt(tempDeclarar.cantidad_presentacion) <= 0}
                              onClick={handlePrintCaliente}
                              className="flex items-center justify-center gap-1.5 px-4 py-3 bg-white border-2 border-brand-900 text-brand-900 hover:bg-brand-50 rounded-xl text-xs font-black uppercase active:scale-95 transition-all w-full shadow-md disabled:opacity-50 mt-2"
                            >
                              <Printer size={14} /> Imprimir Etiquetas
                            </button>
                          </div>

                        </div>
                      )}
                    </div>
                  )}


                  {/* ========================================================
                      FASE C: PRODUCTOS OBTENIDOS (HISTORIAL/SALIDAS)
                     ======================================================== */}
                  {(salidas.length > 0 || estatus !== 'BORRADOR') && (
                    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-100 pb-2 flex items-center gap-2">
                        <Package size={14} className="text-brand-900" /> {estatus === 'BORRADOR' ? '2. Cortes y Porciones Declaradas' : '3. Historial de Cortes Producidos'}
                      </h4>

                      {salidas.length > 0 ? (
                        <div className="border border-slate-100 rounded-2xl overflow-hidden">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-slate-50/50 text-[9px] font-black uppercase text-slate-400 border-b">
                                <th className="px-4 py-3">Corte Obtenido</th>
                                <th className="px-4 py-3">Lote</th>
                                <th className="px-4 py-3">Ubicación (Cava)</th>
                                <th className="px-4 py-3 text-right">Peso Neto</th>
                                <th className="px-4 py-3 text-right">Costo Asignado / KG</th>
                                <th className="px-4 py-3 text-right">Valor Total</th>
                                <th className="px-4 py-3 text-center">Acciones</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-150">
                              {salidas.map((s, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/30 transition-colors">
                                  <td className="px-4 py-3 font-bold text-slate-700 uppercase">
                                    <div className="flex flex-col gap-1">
                                      <span>{s.es_scrap ? 'Mermas de proceso' : (s.producto_nombre || getNombreProducto(s.producto))}</span>
                                      <span>{formatDateSystemToDDMMYYYYHHMMSS(s.timestamp_create)}</span>
                                      <span>{s.tracking_id || '--'}</span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 font-bold text-slate-500">{s.lote_generado}</td>
                                  <td className="px-4 py-3 font-medium text-slate-600">{s.ubicacion_codigo || 'Cava 1'}</td>
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
                                          className="text-slate-400 hover:text-brand-900 p-1.5 hover:bg-brand-50 rounded-xl transition-all"
                                          title="Imprimir etiqueta">
                                          <Printer size={15} />
                                        </button>
                                      )}
                                      {estatus === 'EN_PROCESO' && !modoVisualizacion && (
                                        <button type="button" onClick={() => handleRevertirSalida(s.id)}
                                          className="text-red-400 hover:text-red-650 p-1.5 hover:bg-red-50 rounded-xl transition-all"
                                          title="Revertir y eliminar pesaje">
                                          <Trash2 size={14} />
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="text-[10px] text-slate-400 italic text-center py-6">Aún no se han registrado pesajes de cortes en la mesa de deshuese.</div>
                      )}
                    </div>
                  )}
 
                  {/* OBSERVACIONES */}
                  <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Observaciones y Notas Operativas</label>
                    <textarea
                      name="observaciones"
                      placeholder="Ingrese detalles sobre el despote, estado de la canal o desviaciones detectadas..."
                      value={values.observaciones}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      disabled={estatus !== 'BORRADOR' || modoVisualizacion}
                      className="w-full text-xs font-bold text-slate-700 bg-slate-50 p-4 rounded-2xl border border-slate-150 outline-none focus:border-brand-500 focus:bg-white transition-all shadow-inner"
                      rows="2"
                    />
                  </div>
 
                </div>
 
                {/* BOTONES / PIE DE PÁGINA (STICKY) */}
                <div className="px-8 py-5 border-t border-slate-100 flex items-center justify-between bg-white relative shrink-0">
                  <div>
                    {estatus === 'EN_PROCESO' && (
                      <span className="text-[10px] font-black uppercase text-brand-900 tracking-wider flex items-center gap-1">
                        <AlertCircle size={12} className="text-brand-600" /> Los costos unitarios definitivos se calcularán de forma prorrateada al finalizar el desposte.
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
                              className="px-6 py-2.5 rounded-xl border border-brand-900 text-brand-900 hover:bg-brand-50 text-xs font-black uppercase transition-colors"
                            >
                              Guardar Borrador
                            </button>
                            <button
                              type="button"
                              onClick={() => handleIniciarDespoteProceso(values)}
                              disabled={saving || entradas.length === 0}
                              className="px-6 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-black uppercase shadow-lg shadow-orange-500/20 active:scale-95 transition-all"
                            >
                              Iniciar Despote (Mesa)
                            </button>
                          </>
                        )}

                        {estatus === 'EN_PROCESO' && (
                          <button
                            type="button"
                            onClick={handleFinalizarDespoteOrden}
                            disabled={saving}
                            className="px-6 py-2.5 rounded-xl bg-brand-900 hover:bg-brand-950 text-white text-xs font-black uppercase shadow-xl shadow-brand-900/10 active:scale-95 transition-all"
                          >
                            Finalizar y Cerrar Despote
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