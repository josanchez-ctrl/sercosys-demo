import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Formik, Form, Field } from 'formik';
import { X, ClipboardList, Plus, Trash2, Scale, Package, AlertCircle, Eye, MapPin, Play, CheckCircle2, Clock, FileEdit, Printer } from 'lucide-react';
import { 
  getOrdenTransformacionById, 
  saveOrdenTransformacion, 
  iniciarTransformacion, 
  declararSalidaTransformacion, 
  finalizarTransformacion,
  revertirSalidaTransformacion 
} from '../../../services/transformacionService';
import { getInventarioAlmacen } from '../../../services/inventarioService';
import { getProductos } from '../../../services/productoService';
import { getUbicaciones } from '../../../services/ubicacionService';
import { getSucursalesActivas } from '../../../services/sucursalService';
import { toast } from 'sonner';
import { formatNumber } from '../../../util/workDecimales';
import EtiquetasTrackingRecepcionModal from '../../../components/modals/EtiquetasTrackingRecepcionModal';
import { getEquivalenciasLogisticas, getEquivalenciasCostos } from '../../../util/auxiliares';

export default function ReenvasadoModal({ empresaActiva, sucursalActiva, perfil, almacenId, nombreAlmacen, ordenId, modoVisualizacion, onClose, onUpdate }) {
  const [inventario, setInventario] = useState([]);
  const [productos, setProductos] = useState([]);
  const [ubicaciones, setUbicaciones] = useState([]);
  const [sucursalIdDefault, setSucursalIdDefault] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Estados de la Orden
  const [entradas, setEntradas] = useState([]);
  const [salidas, setSalidas] = useState([]);
  const [estatus, setEstatus] = useState('BORRADOR');
  const [observaciones, setObservaciones] = useState('');

  // Estados para impresión de etiquetas de tracking
  const [etiquetaPrintOpen, setEtiquetaPrintOpen] = useState(false);
  const [itemEtiquetaPrint, setItemEtiquetaPrint] = useState([]);

  const handlePrintEtiqueta = (salida) => {
    // 1. Encontrar la información del producto y su presentación
    const pInfo = productos.find(p => p.id == salida.id_producto);
    const presLogistica = salida.presentacion_logistica || pInfo?.logistica?.find(l => !l.es_base) || pInfo?.logistica?.find(l => l.es_base) || pInfo?.logistica?.[0];
    const presentacionNombre = presLogistica?.presentacion?.nombre || 'UNIDAD';

    // 2. Calcular valores
    const totalCantidadVirtual = Number(salida.cantidad_obtenida); // ej: 45 KG
    const bultosReales = (salida.cantidad_presentacion && Number(salida.cantidad_presentacion) > 0)
      ? Number(salida.cantidad_presentacion)
      : Math.max(1, Math.floor(totalCantidadVirtual / (presLogistica ? Number(presLogistica.factor) : 1)));

    // Reconstruir un objeto de inventario virtual compatible con EtiquetasTrackingRecepcionModal
    const itemVirtual = {
      id: salida.id_producto,
      tracking_id: salida.tracking_id,
      lote: salida.lote_generado,
      fecha_vencimiento: salida.fecha_vencimiento,
      cantidad_actual: totalCantidadVirtual,
      producto: pInfo || salida.producto,
      detalle: {
        cantidad: bultosReales, // Generará tantas etiquetas como paquetes declarados
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

  // Temporales de carga (Fase Borrador)
  const [tempEntrada, setTempEntrada] = useState({ id_item_inventario: '', id_presentacion_logistica: '', cantidad_presentacion: '' });
  
  // Temporales de Declaración Parcial (Fase En Proceso)
  const [tempDeclarar, setTempDeclarar] = useState({
    id_entrada_transformacion: '',
    id_producto_salida: '',
    id_presentacion_logistica: '',
    cantidad_obtenida: '',
    cantidad_insumo_descontar: '',
    id_ubicacion_destino: ''
  });

  // Carga inicial
  useEffect(() => {
    cargarCatalogos();
  }, [empresaActiva?.id, almacenId, ordenId]);

  const cargarCatalogos = async () => {
    setLoading(true);
    try {
      // 1. Obtener catálogo general de productos
      const prods = await getProductos(empresaActiva.id);
      setProductos(prods || []);

      // 2. Obtener inventario actual en el almacén (solo lotes con stock, no bloqueados, y configurados como insumos)
      const inv = await getInventarioAlmacen(almacenId);
      setInventario((inv || []).filter(item => 
        Number(item.cantidad_actual) > 0 && 
        !item.is_bloqueado && 
        item.producto?.es_insumo_transformacion === true
      ));

      // 3. Obtener ubicaciones físicas del almacén
      const ubs = await getUbicaciones(almacenId);
      setUbicaciones(ubs || []);

      // 4. Obtener sucursales activas de la empresa para fallback
      try {
        const sucs = await getSucursalesActivas(empresaActiva.id);
        if (sucs && sucs.length > 0) {
          setSucursalIdDefault(sucs[0].id);
        }
      } catch (err) {
        console.warn('Error cargando sucursales de fallback:', err);
      }

      // 5. Cargar datos de la orden si ya existe
      if (ordenId) {
        await refrescarDatosOrden(ordenId, ubs);
      }
    } catch (e) {
      toast.error('Error al cargar datos del reenvasado');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const refrescarDatosOrden = async (id, ubsList = null) => {
    const ubs = ubsList || ubicaciones;
    const orden = await getOrdenTransformacionById(id);
    setEstatus(orden.estatus);
    setObservaciones(orden.observaciones || '');
    setEntradas(orden.entradas || []);
    setSalidas((orden.salidas || []).map(s => ({
      ...s,
      ubicacion_codigo: s.id_ubicacion ? (ubs.find(u => u.id == s.id_ubicacion)?.codigo || 'N/A') : 'N/A'
    })));
  };

  const getNombreItemInventario = (item) => {
    if (!item?.producto) return '';
    const marca = item.producto.marca?.nombre || '';
    const variedad = item.producto.variedad || '';
    const rubro = item.producto.rubro?.nombre || '';
    return [rubro, marca, variedad].filter(Boolean).join(' · ') + ` (Lote: ${item.lote || 'N/A'})`;
  };

  const getNombreProducto = (prod) => {
    if (!prod) return '';
    const marca = prod.marca?.nombre || '';
    const variedad = prod.variedad || '';
    const rubro = prod.rubro?.nombre || '';
    return [rubro, marca, variedad].filter(Boolean).join(' · ');
  };

  // Memoización para el insumo de entrada seleccionado en Borrador
  const selectedItemInventario = useMemo(() => {
    return inventario.find(i => i.id == tempEntrada.id_item_inventario);
  }, [inventario, tempEntrada.id_item_inventario]);

  const presentacionesDisponibles = useMemo(() => {
    return selectedItemInventario?.producto?.logistica || [];
  }, [selectedItemInventario]);

  const selectedPresentacion = useMemo(() => {
    return presentacionesDisponibles.find(p => p.id == tempEntrada.id_presentacion_logistica);
  }, [presentacionesDisponibles, tempEntrada.id_presentacion_logistica]);

  const cantidadBaseCalculada = useMemo(() => {
    const cant = parseFloat(tempEntrada.cantidad_presentacion) || 0;
    const factor = selectedPresentacion ? Number(selectedPresentacion.factor) : 1;
    return cant * factor;
  }, [tempEntrada.cantidad_presentacion, selectedPresentacion]);

  // Autoseleccionar la presentación base al elegir insumo en Borrador
  useEffect(() => {
    if (selectedItemInventario) {
      const basePres = (selectedItemInventario.producto?.logistica || []).find(l => l.es_base);
      setTempEntrada(prev => ({
        ...prev,
        id_presentacion_logistica: basePres ? basePres.id.toString() : '',
        cantidad_presentacion: ''
      }));
    } else {
      setTempEntrada(prev => ({ ...prev, id_presentacion_logistica: '', cantidad_presentacion: '' }));
    }
  }, [selectedItemInventario]);


  // --- LOGICA DE FORMULARIO EN MESA (Fase EN_PROCESO) ---
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

  // Autoseleccionar la presentación base de salida al elegir producto
  useEffect(() => {
    if (selectedProductoSalida) {
      const basePres = (selectedProductoSalida.logistica || []).find(l => l.es_base);
      setTempDeclarar(prev => ({
        ...prev,
        id_presentacion_logistica: basePres ? basePres.id.toString() : '',
        cantidad_obtenida: ''
      }));
    } else {
      setTempDeclarar(prev => ({
        ...prev,
        id_presentacion_logistica: '',
        cantidad_obtenida: '',
        cantidad_insumo_descontar: ''
      }));
    }
  }, [selectedProductoSalida]);

  // Autocalcular sugeridos al cambiar la cantidad obtenida o empaque
  useEffect(() => {
    const cantObtenida = parseFloat(tempDeclarar.cantidad_obtenida) || 0;
    const factorSalida = selectedPresentacionSalida ? Number(selectedPresentacionSalida.factor) : 1;
    
    // Cantidad base obtenida = cantidad * factor de empaque de salida
    const pesoTotalSalida = cantObtenida * factorSalida;

    setTempDeclarar(prev => ({
      ...prev,
      cantidad_insumo_descontar: pesoTotalSalida > 0 ? pesoTotalSalida.toString() : ''
    }));
  }, [tempDeclarar.cantidad_obtenida, selectedPresentacionSalida]);

  // Costo proyectado unitario de salida en caliente para el formulario
  const costoUnitarioDeclaradoProyectado = useMemo(() => {
    const cantObtenida = parseFloat(tempDeclarar.cantidad_obtenida) || 0;
    const insumoDescontar = parseFloat(tempDeclarar.cantidad_insumo_descontar) || 0;
    if (cantObtenida <= 0 || !selectedInsumoMesa) return 0;
    
    // Costo total del insumo cargado a mesa (para esta orden) con recargo por costo indirecto
    const recargo = Number(selectedInsumoMesa?.inventario?.producto?.rubro?.porcentaje_costo_indirecto) || 0;
    const costoTotalConsumo = insumoDescontar * Number(selectedInsumoMesa.costo_unitario) * (1 + recargo / 100);
    return costoTotalConsumo / cantObtenida;
  }, [tempDeclarar.cantidad_obtenida, tempDeclarar.cantidad_insumo_descontar, selectedInsumoMesa]);

  // Filtrar productos maestros resultantes en base al rubro del insumo seleccionado
  const productosResultantesFiltrados = useMemo(() => {
    if (!selectedInsumoMesa?.inventario?.producto) return [];
    const rubroId = selectedInsumoMesa.inventario.producto.id_rubro || selectedInsumoMesa.inventario.producto.rubro?.id;
    return productos.filter(prod => 
      prod.es_resultado_transformacion === true &&
      (prod.id_rubro == rubroId || prod.rubro?.id == rubroId)
    );
  }, [productos, selectedInsumoMesa]);


  // --- BOTONES Y ACCIONES DEL CONTROLADOR ---

  // Agregar consumo preliminar (Fase Borrador)
  const addEntrada = () => {
    if (!tempEntrada.id_item_inventario) { toast.error('Seleccione un lote de inventario'); return; }
    if (!tempEntrada.id_presentacion_logistica) { toast.error('Seleccione la presentación a consumir'); return; }
    const cantPres = Number(tempEntrada.cantidad_presentacion) || 0;
    if (cantPres <= 0) { toast.error('Ingrese una cantidad válida mayor a 0'); return; }

    const item = inventario.find(i => i.id == tempEntrada.id_item_inventario);
    const pres = presentacionesDisponibles.find(p => p.id == tempEntrada.id_presentacion_logistica);
    if (!item || !pres) return;

    const cantBase = cantPres * Number(pres.factor);

    // Validar stock disponible en rack
    const yaAgregado = entradas
      .filter(e => e.id_item_inventario == item.id)
      .reduce((sum, e) => sum + Number(e.cantidad_consumida), 0);

    const disponibleReal = Number(item.cantidad_actual) - yaAgregado;
    if (cantBase > disponibleReal) {
      toast.error(`Stock insuficiente. Disponible real: ${disponibleReal} ${item.producto?.rubro?.unidad?.abreviatura || 'U'}`);
      return;
    }

    setEntradas(prev => [...prev, {
      id_item_inventario: item.id,
      cantidad_consumida: cantBase,
      unidad_medida:      item.producto?.rubro?.unidad?.abreviatura || 'UND',
      costo_unitario:     Number(item.costo_unidad_base) || 0,
      producto_nombre:    getNombreItemInventario(item) + ` (${cantPres} ${pres.presentacion?.nombre || 'U'})`,
      lote:               item.lote,
      id_presentacion_logistica: pres.id,
      cantidad_presentacion:      cantPres,
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
          marca: item.producto?.marca
        }
      }
    }]);

    setTempEntrada({ id_item_inventario: '', id_presentacion_logistica: '', cantidad_presentacion: '' });
  };

  // Guardar preliminarmente en BORRADOR
  const handleGuardarBorrador = async (values, setSubmitting) => {
    if (entradas.length === 0) { toast.error('Debe agregar al menos un insumo de entrada'); setSubmitting(false); return; }
    
    setSaving(true);
    try {
      const sucursalId = sucursalActiva?.id || (perfil?.ids_sucursales && perfil.ids_sucursales[0]) || sucursalIdDefault || null;
      const cabecera = {
        id: ordenId || null,
        id_empresa: empresaActiva.id,
        id_sucursal: sucursalId,
        id_almacen: almacenId,
        tipo_proceso: 'REENVASADO',
        estatus: 'BORRADOR',
        observaciones: values.observaciones
      };

      const finalId = await saveOrdenTransformacion(cabecera, entradas, [], perfil.id);
      toast.success('Orden guardada en BORRADOR');
      onUpdate();
      onClose();
    } catch (e) {
      toast.error('Error al guardar: ' + e.message);
      console.error(e);
    } finally {
      setSaving(false);
      setSubmitting(false);
    }
  };

  // Iniciar Reenvasado (Mover del rack a la mesa de trabajo)
  const handleIniciarReenvasado = async (values) => {
    if (entradas.length === 0) { toast.error('Debe agregar al menos un insumo antes de iniciar'); return; }

    setSaving(true);
    try {
      // 1. Guardar primero por si hubo cambios en la lista de insumos
      const sucursalId = sucursalActiva?.id || (perfil?.ids_sucursales && perfil.ids_sucursales[0]) || sucursalIdDefault || null;
      const cabecera = {
        id: ordenId || null,
        id_empresa: empresaActiva.id,
        id_sucursal: sucursalId,
        id_almacen: almacenId,
        tipo_proceso: 'REENVASADO',
        estatus: 'BORRADOR',
        observaciones: values.observaciones
      };
      
      const finalId = await saveOrdenTransformacion(cabecera, entradas, [], perfil.id);

      // 2. Invocar el RPC para descontar de racks y pasar a mesa
      await iniciarTransformacion(finalId, perfil.id);
      toast.success('Proceso de Reenvasado Iniciado. Producto movido a la mesa de trabajo.');
      
      // Refrescar y cambiar estado a EN_PROCESO
      await refrescarDatosOrden(finalId);
      onUpdate();
    } catch (e) {
      toast.error('Error al iniciar reenvasado: ' + e.message);
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  // Registrar una Declaración de Salida Parcial (Fase EN_PROCESO)
  const handleDeclararSalidaParcial = async () => {
    if (!tempDeclarar.id_entrada_transformacion) { toast.error('Seleccione el insumo de la mesa a fraccionar'); return; }
    if (!tempDeclarar.id_producto_salida) { toast.error('Seleccione el producto a obtener'); return; }
    if (!tempDeclarar.id_presentacion_logistica) { toast.error('Seleccione el empaque de salida'); return; }
    
    const cantObtenida = parseFloat(tempDeclarar.cantidad_obtenida) || 0;
    const insumoDescontar = parseFloat(tempDeclarar.cantidad_insumo_descontar) || 0;
    if (cantObtenida <= 0) { toast.error('Ingrese una cantidad obtenida válida'); return; }
    if (insumoDescontar <= 0) { toast.error('Ingrese la cantidad de insumo consumida de la mesa'); return; }
    if (!tempDeclarar.id_ubicacion_destino) { toast.error('Seleccione la ubicación final de los paquetes'); return; }

    if (insumoDescontar > Number(selectedInsumoMesa.cantidad_pendiente)) {
      toast.error(`Excede la cantidad disponible en mesa (${selectedInsumoMesa.cantidad_pendiente} ${selectedInsumoMesa.unidad_medida})`);
      return;
    }

    setSaving(true);
    try {
      const factorSalida = selectedPresentacionSalida ? Number(selectedPresentacionSalida.factor) : 1;
      const cantidadBaseObtenida = cantObtenida * factorSalida;
      const costoUnitarioBase = costoUnitarioDeclaradoProyectado / factorSalida;

      const payload = {
        id_transformacion:         ordenId,
        id_entrada_transformacion: Number(tempDeclarar.id_entrada_transformacion),
        id_producto_salida:        Number(tempDeclarar.id_producto_salida),
        cantidad_obtenida:         cantidadBaseObtenida,
        unidad_medida:             selectedProductoSalida.rubro?.almacen_unidades_medida?.abreviatura || 'UND',
        cantidad_insumo_descontar: insumoDescontar,
        id_ubicacion_destino:      Number(tempDeclarar.id_ubicacion_destino),
        costo_unitario_salida:     costoUnitarioBase,
        id_presentacion_logistica: Number(tempDeclarar.id_presentacion_logistica),
        cantidad_presentacion:     cantObtenida
      };

      await declararSalidaTransformacion(payload, perfil.id);
      toast.success('Fraccionamiento registrado con éxito en el inventario.');
      
      // Limpiar temporal
      setTempDeclarar({
        id_entrada_transformacion: '',
        id_producto_salida: '',
        id_presentacion_logistica: '',
        cantidad_obtenida: '',
        cantidad_insumo_descontar: '',
        id_ubicacion_destino: ''
      });

      // Refrescar lista de entradas y salidas en caliente
      await refrescarDatosOrden(ordenId);
      onUpdate();
    } catch (e) {
      toast.error('Error al registrar fraccionamiento: ' + e.message);
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  // Revertir y anular un reenvasado parcial
  const handleRevertirSalida = async (salidaId) => {
    toast('¿Desea revertir y eliminar este reenvasado parcial?', {
      description: 'El stock ingresado se eliminará de los racks y el insumo volverá a estar pendiente en la mesa.',
      duration: 8000,
      action: {
        label: 'Revertir Reenvasado',
        onClick: async () => {
          setSaving(true);
          try {
            await revertirSalidaTransformacion(salidaId, perfil.id);
            toast.success('Reenvasado revertido correctamente. Stock devuelto a la mesa.');
            await refrescarDatosOrden(ordenId);
            onUpdate();
          } catch (e) {
            toast.error('Error al revertir reenvasado: ' + e.message);
            console.error(e);
          } finally {
            setSaving(false);
          }
        }
      }
    });
  };

  // Finalizar y cerrar la orden (Cierre definitivo de saldos en mesa como merma)
  const handleFinalizarOrden = () => {
    toast('¿Está seguro de finalizar esta orden de reenvasado?', {
      description: 'Cualquier saldo restante en la mesa se declarará como merma y no se podrán registrar más salidas.',
      duration: 8000,
      action: {
        label: 'Finalizar',
        onClick: async () => {
          setSaving(true);
          try {
            await finalizarTransformacion(ordenId, perfil.id);
            toast.success('Orden de reenvasado finalizada y cerrada con éxito.');
            await refrescarDatosOrden(ordenId);
            onUpdate();
            onClose();
          } catch (e) {
            toast.error('Error al cerrar orden: ' + e.message);
            console.error(e);
          } finally {
            setSaving(false);
          }
        }
      }
    });
  };

  const statusConfig = {
    BORRADOR: { label: 'Borrador', color: 'bg-slate-50 text-slate-500 border-slate-200', icon: <FileEdit size={12} /> },
    EN_PROCESO: { label: 'En Proceso (En Mesa)', color: 'bg-amber-50 text-amber-600 border-amber-200', icon: <Clock size={12} /> },
    PROCESADO: { label: 'Procesado (Cerrado)', color: 'bg-emerald-50 text-emerald-600 border-emerald-200 shadow-sm', icon: <CheckCircle2 size={12} /> },
    ANULADO: { label: 'Anulado', color: 'bg-red-50 text-red-600 border-red-200', icon: <X size={12} /> },
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-in fade-in duration-300" onClick={onClose}>
      <div className="bg-white rounded-md w-full h-full max-w-[98vw] max-h-[95vh] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
        
        {/* CABECERA ESTILIZADA */}
        <div className="px-8 py-5 border-b border-gray-100 flex items-center justify-between bg-white relative shrink-0">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-500 to-brand-900" />
          <div className="flex items-center gap-4">
            <div className="p-3 bg-brand-50 rounded-xl text-brand-900">
              <ClipboardList size={22} />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-black uppercase tracking-tight text-slate-800">
                  {modoVisualizacion ? 'Detalle de Reenvasado' : ordenId ? 'Gestionar Reenvasado' : 'Crear Orden de Reenvasado'}
                </h3>
                <div className={`px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${statusConfig[estatus]?.color}`}>
                  {statusConfig[estatus]?.icon}
                  {statusConfig[estatus]?.label}
                </div>
              </div>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest italic mt-0.5">
                Almacén Origen: {nombreAlmacen ? nombreAlmacen : 'Distribución Principal'}
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
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cargando datos del reenvasado...</p>
          </div>
        ) : (
          <Formik
            initialValues={{
              observaciones: observaciones
            }}
            enableReinitialize
            onSubmit={(values, { setSubmitting }) => handleGuardarBorrador(values, setSubmitting)}
          >
            {({ values, setSubmitting }) => (
              <Form className="flex flex-col flex-1 overflow-hidden">
                <div className="flex-1 overflow-y-auto px-8 py-6 space-y-5 bg-slate-50/40">
                  
                  {/* ========================================================
                      FASE A: INSUMOS (ENTRADAS)
                     ======================================================== */}
                  <div className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-gray-100 pb-2 flex items-center gap-2">
                      <Scale size={13} className="text-orange-500" /> 1. Insumos y Grano a Granel (Mesa de Trabajo)
                    </h4>

                    {/* Tabla de Consumos Agregados */}
                    {entradas.length > 0 ? (
                      <div className="border border-gray-100 rounded-2xl overflow-hidden">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-50 text-[9px] font-black uppercase text-slate-400 border-b">
                              <th className="px-4 py-3">Insumo / Lote de Origen</th>
                              <th className="px-4 py-3 text-right">Costo Base Unitario</th>
                              <th className="px-4 py-3 text-right">Cantidad Mandada a Mesa</th>
                              <th className="px-4 py-3 text-right bg-amber-50/40 text-amber-700">Cantidad Restante en Mesa</th>
                              <th className="px-4 py-3 text-right">Subtotal Costo</th>
                              {estatus === 'BORRADOR' && !modoVisualizacion && <th className="px-4 py-3 text-center">Quitar</th>}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {entradas.map((e, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-4 py-3 font-bold text-slate-700 uppercase">{e.producto_nombre}</td>
                                <td className="px-4 py-3 text-right font-black text-slate-600">$ {formatNumber(e.costo_unitario, 2)}</td>
                                <td className="px-4 py-3 text-right font-black text-slate-850">{e.cantidad_consumida} {e.unidad_medida}</td>
                                <td className="px-4 py-3 text-right font-black bg-amber-50/20 text-amber-700">
                                  {estatus === 'BORRADOR' ? '--' : `${e.cantidad_pendiente} ${e.unidad_medida}`}
                                </td>
                                <td className="px-4 py-3 text-right font-black text-emerald-600">$ {formatNumber(e.cantidad_consumida * e.costo_unitario, 2)}</td>
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
                        <span>Añada los insumos/granos a granel que se consumirán en el proceso de reenvasado.</span>
                      </div>
                    )}

                    {/* Inputs de carga de Insumos (Solo en BORRADOR) */}
                    {estatus === 'BORRADOR' && !modoVisualizacion && (
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                        <div className="md:col-span-2 flex flex-col gap-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase">Seleccionar Insumo del Stock</label>
                          <select
                            value={tempEntrada.id_item_inventario}
                            onChange={e => setTempEntrada(prev => ({ ...prev, id_item_inventario: e.target.value }))}
                            className="text-xs font-bold text-slate-700 bg-white p-3 rounded-xl border border-gray-150 outline-none focus:border-brand-500 shadow-sm"
                          >
                            <option value="">-- SELECCIONE UN LOTE CON STOCK --</option>
                            {inventario.map(item => (
                              <option key={item.id} value={item.id}>
                                {getNombreItemInventario(item)} [Stock: {item.cantidad_actual} {item.producto?.rubro?.unidad?.abreviatura || 'U'}]
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase">Empaque / Presentación</label>
                          <select
                            value={tempEntrada.id_presentacion_logistica}
                            onChange={e => setTempEntrada(prev => ({ ...prev, id_presentacion_logistica: e.target.value }))}
                            disabled={!tempEntrada.id_item_inventario}
                            className="text-xs font-bold text-slate-700 bg-white p-3 rounded-xl border border-gray-150 outline-none focus:border-brand-500 disabled:opacity-50 shadow-sm"
                          >
                            <option value="">-- SELECCIONE --</option>
                            {presentacionesDisponibles.map(p => (
                              <option key={p.id} value={p.id}>
                                {p.presentacion?.nombre || 'Unidad Base'} (x{p.factor})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex flex-col gap-1 relative">
                          <label className="text-[9px] font-black text-slate-400 uppercase">Cantidad</label>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="Ej: 1"
                            value={tempEntrada.cantidad_presentacion}
                            disabled={!tempEntrada.id_presentacion_logistica}
                            onChange={e => setTempEntrada(prev => ({ ...prev, cantidad_presentacion: e.target.value }))}
                            className="text-xs font-bold text-slate-700 bg-white p-3 rounded-xl border border-gray-150 outline-none focus:border-brand-500 disabled:opacity-50 shadow-sm"
                          />
                          {cantidadBaseCalculada > 0 && (
                            <span className="text-[8px] font-black text-orange-600 uppercase tracking-tighter absolute -bottom-4 left-1.5 animate-in fade-in">
                              = {cantidadBaseCalculada} {selectedItemInventario?.producto?.rubro?.unidad?.abreviatura || 'KG'}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={addEntrada}
                          className="flex items-center justify-center gap-1.5 px-4 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-black uppercase active:scale-95 transition-all w-full shadow-lg shadow-orange-500/20"
                        >
                          <Plus size={14} /> Mandar a Mesa
                        </button>
                      </div>
                    )}
                  </div>


                  {/* ========================================================
                      FASE B: FORMULARIO DE FRACCIONAMIENTO PARCIAL (EN PROCESO)
                     ======================================================== */}
                  {estatus === 'EN_PROCESO' && !modoVisualizacion && (
                    <div className="bg-white px-3 py-1 rounded-md border border-amber-100 shadow-sm space-y-1 animate-in slide-in-from-bottom-2 duration-300">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-600 border-b border-amber-50 pb-2 flex items-center gap-2">
                        <Play size={13} /> 2. Registrar Declaración de Fraccionamiento Parcial
                      </h4>

                      <div className="grid grid-cols-1 md:grid-cols-12 gap-1 items-center bg-slate-50/50 p-4 rounded-md border border-slate-100">
                        {/* Selector Insumo en Mesa */}
                        <div className="md:col-span-6 flex flex-col gap-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase">1. Insumo Origen (En Mesa)</label>
                          <select
                            value={tempDeclarar.id_entrada_transformacion}
                            onChange={e => setTempDeclarar(prev => ({ ...prev, id_entrada_transformacion: e.target.value }))}
                            className="text-xs font-bold text-slate-700 bg-white p-3 rounded-xl border border-gray-150 outline-none focus:border-brand-500 shadow-sm"
                          >
                            <option value="">-- SELECCIONE INSUMO EN MESA --</option>
                            {entradas.filter(e => Number(e.cantidad_pendiente) > 0).map(e => (
                              <option key={e.id} value={e.id}>
                                {e.producto_nombre} [Pendiente: {e.cantidad_pendiente} {e.unidad_medida}]
                              </option>
                            ))}
                          </select>
                        </div>
                          
                        <div className="md:col-span-4 flex flex-col gap-1">
                          {/* Selector Producto Salida */}
                          <div className="flex flex-col gap-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase">2. Producto Resultante (Salida)</label>
                            <select
                              value={tempDeclarar.id_producto_salida}
                              disabled={!tempDeclarar.id_entrada_transformacion}
                              onChange={e => setTempDeclarar(prev => ({ ...prev, id_producto_salida: e.target.value }))}
                              className="text-xs font-bold text-slate-700 bg-white p-3 rounded-xl border border-gray-150 outline-none focus:border-brand-500 disabled:opacity-50 shadow-sm"
                            >
                              <option value="">-- SELECCIONE PRODUCTO --</option>
                              {productosResultantesFiltrados.map(prod => (
                                <option key={prod.id} value={prod.id}>
                                  {getNombreProducto(prod)} [{prod.rubro?.almacen_unidades_medida?.abreviatura || 'U'}]
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Empaque y cantidad obtenida */}
                          <div className="flex flex-col gap-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase">3. Empaque</label>
                            <select
                              value={tempDeclarar.id_presentacion_logistica}
                              disabled={!tempDeclarar.id_producto_salida}
                              onChange={e => setTempDeclarar(prev => ({ ...prev, id_presentacion_logistica: e.target.value }))}
                              className="text-xs font-bold text-slate-700 bg-white p-3 rounded-xl border border-gray-150 outline-none focus:border-brand-500 disabled:opacity-50 shadow-sm"
                            >
                              <option value="">-- SELECCIONE --</option>
                              {presentacionesSalidaDisponibles.map(p => (
                                <option key={p.id} value={p.id}>
                                  {p.presentacion?.nombre || 'Base'} (x{p.factor})
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="md:col-span-2 flex flex-col gap-1">
                          <div className="flex flex-col gap-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase">4. Cant. Obtenida</label>
                            <input
                              type="number"
                              step="0.01"
                              placeholder="Ej: 8"
                              disabled={!tempDeclarar.id_presentacion_logistica}
                              value={tempDeclarar.cantidad_obtenida}
                              onChange={e => setTempDeclarar(prev => ({ ...prev, cantidad_obtenida: e.target.value }))}
                              className={`text-xs font-bold text-slate-700 bg-white p-3 rounded-xl border outline-none focus:border-brand-500 disabled:opacity-50 shadow-sm w-full transition-all ${deMesaExcedido ? 'border-red-500 focus:border-red-500 focus:ring-4 focus:ring-red-500/5' : 'border-gray-150'}`}
                            />
                          </div>

                          {/* Consumo real (descontar de mesa) */}
                          <div className="flex flex-col gap-1 relative">
                            <label className="text-[9px] font-black text-slate-400 uppercase">5. Consumo Real del Insumo</label>
                            <input
                              type="number"
                              step="0.01"
                              placeholder="Consumo"
                              disabled={!tempDeclarar.cantidad_obtenida}
                              value={tempDeclarar.cantidad_insumo_descontar}
                              onChange={e => setTempDeclarar(prev => ({ ...prev, cantidad_insumo_descontar: e.target.value }))}
                              className="hidden text-xs font-bold text-slate-700 bg-white p-3 rounded-xl border border-gray-150 outline-none focus:border-brand-500 disabled:opacity-50 shadow-sm w-full"
                            />
                            <span className={`text-xs font-bold bg-white p-3 rounded-xl border outline-none disabled:opacity-50 shadow-sm w-full transition-all ${deMesaExcedido ? 'border-red-500 text-red-600' : 'border-gray-150 text-slate-700'}`}>
                              {tempDeclarar.cantidad_insumo_descontar ? `${formatNumber(tempDeclarar.cantidad_insumo_descontar, 2)} ${selectedInsumoMesa?.unidad_medida || 'U'}` : '--'}
                            </span>
                            {deMesaExcedido ? (
                              <span className="text-[8px] font-black text-red-500 uppercase tracking-tighter absolute -bottom-4 left-1.5 animate-in fade-in">
                                ¡Excede saldo ({selectedInsumoMesa?.cantidad_pendiente} {selectedInsumoMesa?.unidad_medida})!
                              </span>
                            ) : costoUnitarioDeclaradoProyectado > 0 ? (
                              <span className="text-[8px] font-black text-emerald-600 uppercase tracking-tighter absolute -bottom-4 left-1.5">
                                Costo Bolsa: $ {formatNumber(costoUnitarioDeclaradoProyectado, 2)}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center bg-slate-50/50 p-4 rounded-2xl border border-slate-100 mt-2">
                        {/* Ubicación destino */}
                        <div className="flex flex-col gap-1 md:col-span-2">
                          <label className="text-[9px] font-black text-slate-400 uppercase">6. Ubicación Física Final de las Bolsas (Racks)</label>
                          <select
                            value={tempDeclarar.id_ubicacion_destino}
                            disabled={!tempDeclarar.cantidad_obtenida}
                            onChange={e => setTempDeclarar(prev => ({ ...prev, id_ubicacion_destino: e.target.value }))}
                            className="text-xs font-bold text-slate-700 bg-white p-3 rounded-xl border border-gray-150 outline-none focus:border-brand-500 disabled:opacity-50 shadow-sm"
                          >
                            <option value="">-- SELECCIONE UBICACIÓN DE DESTINO EN RACKS --</option>
                            {ubicaciones.map(u => (
                              <option key={u.id} value={u.id}>
                                {u.codigo} [{u.tipoalmacen?.nombre}]
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Botón de envío parcial */}
                        <button
                          type="button"
                          disabled={saving || !tempDeclarar.id_ubicacion_destino || deMesaExcedido}
                          onClick={handleDeclararSalidaParcial}
                          className="flex items-center justify-center gap-1.5 px-4 py-3 bg-brand-900 hover:bg-brand-950 text-white rounded-xl text-xs font-black uppercase active:scale-95 transition-all w-full shadow-lg shadow-brand-900/10 disabled:opacity-50 mt-4 md:mt-0"
                        >
                          <Plus size={14} /> Registrar Salida Parcial
                        </button>
                      </div>
                    </div>
                  )}


                  {/* ========================================================
                      FASE C: PRODUCTOS OBTENIDOS (HISTORIAL/SALIDAS)
                     ======================================================== */}
                  {(salidas.length > 0 || estatus !== 'BORRADOR') && (
                    <div className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm space-y-4">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-gray-100 pb-2 flex items-center gap-2">
                        <Package size={13} className="text-purple-500" /> {estatus === 'BORRADOR' ? '2. Productos Obtenidos' : '3. Historial de Salidas y Mermas Obtenidas'}
                      </h4>

                      {/* Tabla de Salidas */}
                      {salidas.length > 0 ? (
                        <div className="border border-gray-100 rounded-2xl overflow-hidden">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-slate-50 text-[9px] font-black uppercase text-slate-400 border-b">
                                <th className="px-4 py-3">Producto Obtenido</th>
                                <th className="px-4 py-3">Tracking ID</th>
                                <th className="px-4 py-3">Ubicación Destino</th>
                                <th className="px-4 py-3 text-right">Cantidad Empacada</th>
                                <th className="px-4 py-3 text-right">Costo Unitario</th>
                                <th className="px-4 py-3 text-right">Subtotal Valor</th>
                                <th className="px-4 py-3 text-center">Acciones</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {salidas.map((s, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="px-4 py-3 font-bold text-slate-700 uppercase">
                                    <span className="flex flex-col items-start gap-1">
                                      <span>{s.producto_nombre}</span>
                                      <span>{s.lote_generado}</span>
                                      <span>
                                        {s.es_scrap ? (
                                          <span className="px-2 py-0.5 bg-red-50 text-red-600 rounded-full text-[9px] font-black">MERMA/SCRAP</span>
                                        ) : (
                                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full text-[9px] font-black">PRODUCTO BUENO</span>
                                        )}
                                      </span>
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 font-mono text-[10px] font-black text-brand-900">
                                    {s.tracking_id ? (
                                      <span className="bg-slate-100 px-1.5 py-0.5 rounded border">{s.tracking_id}</span>
                                    ) : (
                                      <span className="text-slate-400 italic">--</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-slate-650 font-bold uppercase tracking-tight">
                                    <div className="flex items-center gap-1.5">
                                      <MapPin size={12} className="text-slate-400" />
                                      {s.ubicacion_codigo || 'N/A'}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    {s.es_scrap ? (
                                      <span className="text-xs font-black text-slate-850 tabular-nums">
                                        {s.cantidad_obtenida} {s.unidad_medida}
                                      </span>
                                    ) : (
                                      <div className="flex flex-col items-end gap-0.5">
                                        {s.cantidad_presentacion && s.presentacion_logistica ? (
                                          <div className="flex flex-col items-end">
                                            <div className="flex gap-1.5 items-center justify-end">
                                              <span className="font-black tabular-nums text-right text-slate-800 text-xs">
                                                {s.cantidad_presentacion}
                                              </span>
                                              <span className="text-[9px] font-black uppercase text-slate-400 w-16 text-left">
                                                {s.presentacion_logistica?.presentacion?.nombre || 'ENV'}
                                              </span>
                                            </div>
                                            <span className="text-[10px] font-normal text-slate-400 block opacity-70">
                                              = {formatNumber(s.cantidad_obtenida, 2)} {s.unidad_medida}
                                            </span>
                                          </div>
                                        ) : (
                                          (() => {
                                            const pInfo = productos.find(p => p.id == s.id_producto);
                                            const logistica = pInfo?.logistica || [];
                                            const equivalencias = getEquivalenciasLogisticas(s.cantidad_obtenida, logistica, s.unidad_medida);
                                            return equivalencias.map((equiv, idx) => (
                                              <div key={idx} className="flex gap-1.5 items-center justify-end">
                                                <span className={`font-black tabular-nums text-right ${equiv.isBase ? 'text-slate-400 text-[10px] opacity-70' : 'text-slate-800 text-xs'}`}>
                                                  {equiv.cantidad}
                                                </span>
                                                <span className="text-[9px] font-black uppercase text-slate-400 w-16 text-left">
                                                  {equiv.unidad}
                                                </span>
                                              </div>
                                            ));
                                          })()
                                        )}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    {s.es_scrap ? (
                                      <span className="text-xs font-black text-emerald-600 tabular-nums">
                                        $ 0.00
                                      </span>
                                    ) : (
                                      <div className="flex flex-col items-end gap-0.5">
                                        {(() => {
                                          const pInfo = productos.find(p => p.id == s.id_producto);
                                          const logistica = pInfo?.logistica || [];
                                          const equivalencias = getEquivalenciasCostos(s.costo_unitario, s.cantidad_obtenida, logistica, s.unidad_medida);
                                          return equivalencias.map((equiv, idx) => (
                                            <div key={idx} className="flex gap-1.5 items-center justify-end">
                                              <span className={`font-black tabular-nums text-right ${equiv.isBase ? 'text-slate-400 text-[10px] opacity-70' : 'text-emerald-600 text-xs'}`}>
                                                $ {equiv.costo}
                                              </span>
                                              <span className="text-[9px] font-black uppercase text-slate-400 w-16 text-left">
                                                / {equiv.unidad}
                                              </span>
                                            </div>
                                          ));
                                        })()}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-right font-black text-emerald-700">
                                    $ {formatNumber(s.cantidad_obtenida * s.costo_unitario, 2)}
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <div className="flex items-center justify-center gap-1.5">
                                      {s.tracking_id && !s.es_scrap ? (
                                        <button
                                          type="button"
                                          onClick={() => handlePrintEtiqueta(s)}
                                          className="text-slate-400 hover:text-brand-900 p-1.5 hover:bg-brand-50 rounded-xl transition-all"
                                          title="Imprimir etiqueta de tracking"
                                        >
                                          <Printer size={14} />
                                        </button>
                                      ) : (
                                        <span className="text-slate-300 italic text-[10px]">--</span>
                                      )}
                                      {estatus === 'EN_PROCESO' && !modoVisualizacion && (
                                        <button
                                          type="button"
                                          onClick={() => handleRevertirSalida(s.id)}
                                          className="text-red-400 hover:text-red-650 p-1.5 hover:bg-red-50 rounded-xl transition-all"
                                          title="Revertir y eliminar reenvasado"
                                        >
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
                        <div className="flex items-center gap-2 text-slate-400 bg-slate-50 p-4 rounded-2xl text-xs font-bold border border-gray-100 opacity-70">
                          <AlertCircle size={14} />
                          <span>No se ha declarado ningún fraccionamiento parcial todavía en esta orden.</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* SECCIÓN D: COMENTARIOS Y AUDITORÍA */}
                  <div className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2 flex flex-col gap-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase">Observaciones y Notas de la Orden</label>
                      <textarea
                        value={observaciones}
                        onChange={e => setObservaciones(e.target.value)}
                        disabled={modoVisualizacion || estatus !== 'BORRADOR'}
                        placeholder="Escriba detalles adicionales sobre este proceso..."
                        className="text-xs font-bold text-slate-700 bg-slate-50/50 p-3 rounded-2xl border border-gray-200 outline-none focus:border-brand-500 h-16 w-full resize-none disabled:bg-slate-100 disabled:text-slate-400"
                      />
                    </div>

                    {/* VALORACIÓN GENERAL */}
                    <div className="bg-slate-50 border border-gray-150 rounded-[1.5rem] p-4 flex flex-col justify-between shadow-sm">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Balance del Proceso</span>
                      <div className="flex flex-col gap-1 mt-2">
                        <span className="text-xs font-bold text-slate-500">
                          Costo Insumos: ${formatNumber(entradas.reduce((sum, e) => sum + (Number(e.cantidad_consumida) * Number(e.costo_unitario)), 0), 2)}
                        </span>
                        <span className="text-xs font-bold text-slate-500">
                          Valor Obtenido: ${formatNumber(salidas.reduce((sum, s) => sum + (Number(s.cantidad_obtenida) * Number(s.costo_unitario)), 0), 2)}
                        </span>
                        <span className="text-xs font-bold text-red-500">
                          Mermas Declaradas: {formatNumber(salidas.filter(s => s.es_scrap).reduce((sum, s) => sum + Number(s.cantidad_obtenida), 0), 2)} unidades/kg
                        </span>
                      </div>
                    </div>
                  </div>

                </div>

                {/* BOTONES DE ACCIÓN FOOTER */}
                <div className="px-6 py-4 bg-white border-t border-gray-100 flex items-center justify-end gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-6 py-3 bg-white text-slate-500 border border-slate-200 rounded-xl text-xs font-black uppercase hover:bg-slate-50 active:scale-95 transition-all shadow-sm"
                  >
                    Cerrar
                  </button>

                  {/* Acciones en estatus BORRADOR */}
                  {estatus === 'BORRADOR' && !modoVisualizacion && (
                    <>
                      <button
                        type="submit"
                        disabled={saving}
                        className="px-6 py-3 bg-white text-brand-900 border border-brand-200 rounded-xl text-xs font-black uppercase hover:bg-brand-50 active:scale-95 transition-all disabled:opacity-50 shadow-sm"
                      >
                        {saving ? 'Guardando...' : 'Guardar Borrador'}
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => {
                          toast('¿Desea iniciar el proceso de reenvasado?', {
                            description: 'El producto se descontará de los racks y pasará a la mesa de trabajo.',
                            duration: 8000,
                            action: {
                              label: 'Iniciar',
                              onClick: () => handleIniciarReenvasado(values)
                            }
                          });
                        }}
                        className="px-6 py-3 bg-brand-900 hover:bg-brand-950 text-white rounded-xl text-xs font-black uppercase shadow-xl shadow-brand-900/10 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 border border-brand-850"
                      >
                        {saving ? 'Iniciando...' : 'Iniciar Reenvasado (Mesa)'}
                      </button>
                    </>
                  )}

                  {/* Acciones en estatus EN_PROCESO */}
                  {estatus === 'EN_PROCESO' && !modoVisualizacion && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={handleFinalizarOrden}
                      className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase shadow-xl shadow-emerald-600/10 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                    >
                      {saving ? 'Cerrando...' : 'Finalizar y Cerrar Orden'}
                    </button>
                  )}
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
