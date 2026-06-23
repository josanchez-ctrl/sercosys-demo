import React, { useState, useEffect, useMemo, useRef, Fragment } from 'react';
import { toast } from 'sonner';
import { createPortal } from 'react-dom';
import { X, ArrowRightFromLine, Package, QrCode, FileText, AlertTriangle, Save, Send, CheckCircle2, XCircle, Search, Trash2, Calendar, Hash, Truck, Warehouse, DollarSign, ShieldCheck, Printer, Tag, Keyboard } from 'lucide-react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { formato8Digitos, formatearFecha, formato5Digitos } from '../../../util/workDate';
import { getProveedores } from '../../../services/proveedorService';
import { getProductos, resolverCodigoBarras } from '../../../services/productoService';
import { saveCotejo, getCotejoById, updateCotejoStatus, procesarCotejo, anularCotejo, getInventarioByCotejo } from '../../../services/cotejoService';
import { getValidaciones } from '../../../services/validacionesService';
import EtiquetasTrackingRecepcionModal from '../../../components/modals/EtiquetasTrackingRecepcionModal';
import { getDecimalPlaces } from '../../../util/workDecimales';

const validationSchema = Yup.object({
  id_proveedor: Yup.string().required('El proveedor es obligatorio'),
  tipo_doc_recepcion: Yup.string().required('El tipo de documento de recepción es obligatorio'),
  nro_doc_recepcion: Yup.string().required('El nro de documento de recepción es obligatorio'),
  fecha_doc_recepcion: Yup.date().required('La fecha de recepción es obligatoria'),
  detalles: Yup.array().of(
    Yup.object().shape({
      cantidad: Yup.number().required('Requerido').moreThan(0, 'Mayor a 0'),
      cantidad_factura: Yup.number().nullable().moreThan(0, 'Mayor a 0'),
      lote: Yup.string().nullable().test('lot-req', 'Falta Lote', function (val) {
        const { producto_info } = this.parent;
        if (producto_info?.maneja_lote && !val) return false;
        return true;
      }),
      fecha_vencimiento: Yup.date()
        .transform((value, originalValue) => originalValue === "" ? null : value)
        .nullable()
        .test('date-req', 'Falta Fecha', function (val) {
          const { producto_info } = this.parent;
          if (producto_info?.maneja_lote && !val) return false;
          return true;
        }),
      costo_unitario: Yup.number()
        .transform((value, originalValue) => originalValue === "" ? 0 : value)
        .nullable()
        .test('costo-req', 'Falta Costo', function (val) {
          const { isProcesar } = this.options.context || {};
          // El costo SOLO es obligatorio cuando se va a PROCESAR el documento.
          if (!isProcesar) return true;
          return val > 0;
        })
    })
  ).min(1, 'Debe agregar al menos un producto')
});

export default function CotejoModal({ initialData = null, empresaActiva, almacenSel, perfil, onClose, onUpdate }) {
  const isEdit = !!initialData;
  const [loading, setLoading] = useState(false);
  const [loadingMaestros, setLoadingMaestros] = useState(true);

  const [proveedores, setProveedores] = useState([]);
  const [productos, setProductos] = useState([]);
  const [validaciones, setValidaciones] = useState([]);
  const [showAnularModal, setShowAnularModal] = useState(false);
  const [showEtiquetas, setShowEtiquetas] = useState(false);
  const [dataEtiquetas, setDataEtiquetas] = useState([]);
  const [motivoAnulacion, setMotivoAnulacion] = useState('');
  const searchInputRef = useRef(null);
  const [lectorMode, setLectorMode] = useState(() => {
    return localStorage.getItem('cotejo_lector_mode') === 'true';
  });

  const toggleLectorMode = () => {
    setLectorMode(prev => {
      const next = !prev;
      localStorage.setItem('cotejo_lector_mode', String(next));
      return next;
    });
  };

  const [productSearch, setProductSearch] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [errorModal, setErrorModal] = useState({ show: false, message: '' });
  const [showConfirmProcesar, setShowConfirmProcesar] = useState(false);

  const handleSaveAction = async (status) => {
    formik.setFieldValue('estatus', status);
    formik.handleSubmit();
  };

  const executeSave = async (values) => {
    setLoading(true);
    try {
      const { detalles, ...rest } = values;
      const header = {
        ...rest,
        id_empresa: empresaActiva.id,
        id_almacen: almacenSel?.id
      };

      const details = (detalles || []).map(d => ({
        ...d,
        id_almacen: d.id_almacen || almacenSel?.id,
        lote: d.lote ? d.lote.trim().toUpperCase() : null,
        costo_unitario: d.costo_unitario || 0
      }));

      await saveCotejo(header, details, perfil.id);
      onUpdate();
      onClose();
    } catch (error) {
      console.error('Error al guardar:', error);
      setErrorModal({ show: true, message: error.message });
    } finally {
      setLoading(false);
    }
  };

  const formik = useFormik({
    initialValues: initialData || {
      id: null,
      id_proveedor: '',
      tipo_doc_recepcion: 'NOTA_ENTREGA',
      nro_doc_recepcion: '',
      fecha_doc_recepcion: '',
      observaciones: '',
      estatus: 'BORRADOR',
      id_moneda: 1,
      tasa_cambio: 1,
      detalles: []
    },
    validationSchema,
    validateOnChange: false,
    validateOnBlur: true,
    onSubmit: executeSave
  });

  const isFrigorifico = useMemo(() => {
    const aid = Number(almacenSel?.id || initialData?.id_almacen || formik.values.id_almacen);
    return aid === 2;
  }, [almacenSel?.id, initialData?.id_almacen, formik.values.id_almacen]);

  const isMayorista = useMemo(() => {
    const aid = Number(almacenSel?.id || initialData?.id_almacen || formik.values.id_almacen);
    return aid === 3;
  }, [almacenSel?.id, initialData?.id_almacen, formik.values.id_almacen]);

  const isCatchWeightWarehouse = useMemo(() => {
    return isFrigorifico || isMayorista;
  }, [isFrigorifico, isMayorista]);

  const fetchMaestros = async () => {
    setLoadingMaestros(true);
    try {
      const [proRes, prdRes, valRes] = await Promise.all([
        getProveedores(empresaActiva.id),
        getProductos(empresaActiva.id, almacenSel?.id),
        getValidaciones(),
      ]);

      setProveedores(proRes || []);
      setProductos(prdRes || []);
      setValidaciones(valRes || []);
    } catch (error) {
      console.error('Error al cargar maestros:', error);
    } finally {
      setLoadingMaestros(false);
    }
  };

  const fetchCotejoFull = async () => {
    setLoading(true);
    try {
      const full = await getCotejoById(initialData.id);
      formik.setValues({
        ...full,
        detalles: (full?.detalles || []).map(d => {
          const factorVal = Number(d.factor);
          const cantVal = Number(d.cantidad);
          return {
            ...d,
            id_almacen: full.id_almacen,
            id_presentacion_logistica: d.id_presentacion_logistica,
            factor: factorVal,
            peso_neto_real: Number((cantVal * factorVal).toFixed(4)),
            id_validacion_color: d.id_validacion_color || 1,
            id_validacion_olor: d.id_validacion_olor || 1,
            id_validacion_textura: d.id_validacion_textura || 1,
            producto_info: {
              ...d.almacen_productos,
              presentacion: d.logistica?.presentacion || d.almacen_productos?.presentacion
            }
          };
        })
      });
    } catch (error) {
      console.error('Error al cargar cotejo completo:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrintLabels = async () => {
    setLoading(true);
    try {
      const res = await getInventarioByCotejo(formik.values.id);
      const inventario = res.data || [];

      if (!inventario || inventario.length === 0) {
        toast.error("No se encontraron etiquetas para imprimir. Asegúrese de que el cotejo esté procesado.");
        return;
      }

      setDataEtiquetas(inventario);
      setShowEtiquetas(true);
    } catch (error) {
      console.error('Error al cargar etiquetas:', error);
      toast.error('Error al cargar los datos de impresión');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (empresaActiva?.id) {
      fetchMaestros();
    }
    if (isEdit && initialData.id) {
      fetchCotejoFull();
    }
    setTimeout(() => searchInputRef.current?.focus(), 500);
  }, [empresaActiva?.id, initialData, almacenSel?.id]);

  const filteredProducts = useMemo(() => {
    if (!productSearch) return [];
    const search = productSearch.toLowerCase().trim();
    const searchTerms = search.split(' ').filter(t => t.length > 0);
    const results = [];

    productos
      .filter(p => !almacenSel?.id || p.rubro?.categoria?.id_almacen === almacenSel?.id)
      .forEach(p => {
        const matchingCodes = p.logistica?.filter(l =>
          l.codigo_barras?.toLowerCase().includes(search)
        );

        if (matchingCodes?.length > 0) {
          matchingCodes.forEach(l => {
            results.push({
              ...p,
              specificFactor: l.factor,
              specificPresentation: l.presentacion,
              id_presentacion_logistica: l.id,
              matchedBarcode: l.codigo_barras,
              cantidad_referencia: l.cantidad_referencia,
              referencia: l.referencia,
              uid: `code-${l.id}`
            });
          });
        }

        const rubroName = p.rubro?.nombre?.toLowerCase() || '';
        const marcaName = p.marca?.nombre?.toLowerCase() || '';
        const variedad = p.variedad?.toLowerCase() || '';
        const presentacion = p.presentacion?.nombre?.toLowerCase() || '';

        const matchesBasic = searchTerms.every(term =>
          rubroName.includes(term) ||
          marcaName.includes(term) ||
          variedad.includes(term) ||
          presentacion.includes(term)
        );

        if (matchesBasic) {
          p.logistica?.forEach(l => {
            const uid = `prod-log-${l.id}`;
            // Evitar duplicados si ya se agregó por código exacto
            if (!results.some(r => r.uid === `code-${l.id}`)) {
              results.push({
                ...p,
                specificFactor: l.factor,
                specificPresentation: l.presentacion,
                id_presentacion_logistica: l.id,
                matchedBarcode: l.codigo_barras,
                cantidad_referencia: l.cantidad_referencia,
                referencia: l.referencia,
                uid: uid
              });
            }
          });
        }
      });

    return results.slice(0, 20);
  }, [productSearch, productos]);

  const addProduct = (p) => {
    setProductSearch('');
    setShowResults(false);

    const targetPresLog = p.id_presentacion_logistica || null;
    const existingDetails = formik.values.detalles.filter(d => 
      d.id_producto === p.id && 
      d.id_presentacion_logistica === targetPresLog
    );

    if (existingDetails.length > 0) {
      if (!p.maneja_lote) {
        const index = formik.values.detalles.findIndex(d => 
          d.id_producto === p.id && 
          d.id_presentacion_logistica === targetPresLog
        );
        if (index >= 0) {
          const factor = Number(formik.values.detalles[index].factor) || 1;
          if (isMayorista) {
            const currentPeso = Number(formik.values.detalles[index].peso_neto_real) || 0;
            const newPeso = Number((currentPeso + factor).toFixed(4));
            formik.setFieldValue(`detalles.${index}.peso_neto_real`, newPeso);
            formik.setFieldValue(`detalles.${index}.cantidad_factura`, newPeso);
          } else {
            const currentQty = Number(formik.values.detalles[index].cantidad) || 0;
            const newQty = currentQty + 1;
            formik.setFieldValue(`detalles.${index}.cantidad`, newQty);
            formik.setFieldValue(`detalles.${index}.peso_neto_real`, Number((newQty * factor).toFixed(4)));
            if (!isCatchWeightWarehouse) {
              formik.setFieldValue(`detalles.${index}.cantidad_factura`, newQty);
            } else {
              const currentFact = Number(formik.values.detalles[index].cantidad_factura) || 0;
              formik.setFieldValue(`detalles.${index}.cantidad_factura`, Number((currentFact + factor).toFixed(4)));
            }
          }
        }
        setTimeout(() => searchInputRef.current?.focus(), 100);
        return;
      } else {
        const emptyLotIndex = formik.values.detalles.findIndex(d => 
          d.id_producto === p.id && 
          d.id_presentacion_logistica === targetPresLog &&
          (!d.lote || d.lote.trim() === '')
        );

        if (emptyLotIndex >= 0) {
          const factor = Number(formik.values.detalles[emptyLotIndex].factor) || 1;
          if (isMayorista) {
            const currentPeso = Number(formik.values.detalles[emptyLotIndex].peso_neto_real) || 0;
            const newPeso = Number((currentPeso + factor).toFixed(4));
            formik.setFieldValue(`detalles.${emptyLotIndex}.peso_neto_real`, newPeso);
            formik.setFieldValue(`detalles.${emptyLotIndex}.cantidad_factura`, newPeso);
          } else {
            const currentQty = Number(formik.values.detalles[emptyLotIndex].cantidad) || 0;
            const newQty = currentQty + 1;
            formik.setFieldValue(`detalles.${emptyLotIndex}.cantidad`, newQty);
            formik.setFieldValue(`detalles.${emptyLotIndex}.peso_neto_real`, Number((newQty * factor).toFixed(4)));
            if (!isCatchWeightWarehouse) {
              formik.setFieldValue(`detalles.${emptyLotIndex}.cantidad_factura`, newQty);
            } else {
              const currentFact = Number(formik.values.detalles[emptyLotIndex].cantidad_factura) || 0;
              formik.setFieldValue(`detalles.${emptyLotIndex}.cantidad_factura`, Number((currentFact + factor).toFixed(4)));
            }
          }
          setTimeout(() => searchInputRef.current?.focus(), 100);
          return;
        }
      }
    }

    const theoreticalFactor = Number(p.specificFactor || p.factor || 1);
    const newItem = {
      id_producto: p.id,
      id_almacen: p.rubro?.categoria?.id_almacen,
      cantidad: 1,
      cantidad_factura: isCatchWeightWarehouse ? theoreticalFactor : 1,
      lote: '',
      fecha_vencimiento: '',
      id_validacion_color: 1,
      id_validacion_olor: 1,
      id_validacion_textura: 1,
      id_presentacion_logistica: p.id_presentacion_logistica || null,
      id_presentacion: p.specificPresentation?.id || p.presentacion?.id || null,
      factor: theoreticalFactor,
      peso_neto_real: theoreticalFactor,
      matchedBarcode: p.matchedBarcode,
      producto_info: {
        ...p,
        presentacion: p.specificPresentation || p.presentacion
      },
      logistica: p.logistica?.find(l => l.id === p.id_presentacion_logistica),
      costo_unitario: p.ultimo_costo || p.costo_ponderado || 0
    };

    formik.setFieldValue('detalles', [newItem, ...formik.values.detalles]);
    setProductSearch('');
    setShowResults(false);
    setTimeout(() => searchInputRef.current?.focus(), 100);
  };

  const removeProduct = (index) => {
    const newDetails = [...formik.values.detalles];
    newDetails.splice(index, 1);
    formik.setFieldValue('detalles', newDetails);
  };

  const executeProcesar = async () => {
    setShowConfirmProcesar(false);
    setLoading(true);
    try {
      await saveCotejo(formik.values, formik.values.detalles, perfil.id);
      await procesarCotejo(formik.values.id, perfil.id);
      onUpdate();
      onClose();
    } catch (error) {
      console.error('Error al procesar:', error);
      alert(error.message || 'Error al procesar el cotejo');
    } finally {
      setLoading(false);
    }
  };

  const isBorrador = formik.values.estatus === 'BORRADOR';
  const isPendiente = formik.values.estatus === 'PENDIENTE';
  const isProcesado = formik.values.estatus === 'PROCESADO';
  const isAnulado = formik.values.estatus === 'ANULADO';
  const isFinalizado = isProcesado || isAnulado;

  const canEditQuantities = isBorrador;
  const canAddProducts = isBorrador;

  const manejarClick = () => {
    // No-op: Evitamos desenfocar el campo al hacer clic o foco.
    // El teclado virtual se gestiona de forma nativa mediante la prop inputMode.
  };



  return createPortal(
    <Fragment>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 animate-in fade-in duration-300" onClick={onClose}>
        <div className="bg-white w-full h-full max-w-[95vw] max-h-[95vh] flex flex-col overflow-hidden rounded-md shadow-2xl animate-in zoom-in-95 duration-300 border border-white/20" onClick={(e) => e.stopPropagation()}>

          <div className="px-8 py-5 border-b border-gray-100 flex items-center justify-between bg-white relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-500 to-brand-900" />
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-[1.2rem] bg-brand-50 text-brand-600 flex items-center justify-center border border-brand-100 shadow-inner">
                <ArrowRightFromLine size={22} />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-800 tracking-tight leading-tight">
                  {isEdit ? `Cotejo #${formato8Digitos(formik.values.id)}` : 'Nuevo Registro de Cotejo'}
                </h3>
                <div className="flex items-center gap-3 mt-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">
                    Cotejo de Mercancía
                  </p>
                  {isEdit && (
                    <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter border ${isBorrador ? 'bg-slate-50 text-slate-500 border-slate-200' :
                      isPendiente ? 'bg-amber-50 text-amber-600 border-amber-200' :
                        isProcesado ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                          'bg-red-50 text-red-600 border-red-200'
                      }`}>
                      {formik.values.estatus}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600">
              <X size={22} />
            </button>
          </div>

          <div className="flex-1 overflow-hidden flex flex-col bg-gray-50/30">
            <div className="flex-1 overflow-y-auto px-8 py-1 space-y-2 custom-scrollbar">

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="lg:col-span-1 bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex flex-col justify-center">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2 mb-2">
                    <Truck size={12} /> Proveedor
                  </label>
                  <select
                    {...formik.getFieldProps('id_proveedor')}
                    disabled={!isBorrador}
                    className={`w-full px-4 py-3 rounded-md border border-gray-100 bg-gray-50/20 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-brand-accent/5 focus:border-brand-accent transition-all disabled:opacity-50
                      ${(formik.errors.id_proveedor && formik.touched.id_proveedor)
                        ? 'border-red-500 text-red-700 focus:ring-red-200 bg-red-50/30'
                        : 'border-gray-100 text-slate-700 focus:ring-brand-accent/20 focus:border-brand-accent'}`}
                  >
                    <option value="">-- SELECCIONAR --</option>
                    {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>

                <div className="lg:col-span-1 bg-white p-6 rounded-[2rem] border border-brand-100 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-3 opacity-5">
                    <ArrowRightFromLine size={40} />
                  </div>
                  <label className="text-[10px] font-black text-brand-600 uppercase tracking-widest ml-1 flex items-center gap-2 mb-4">
                    <ArrowRightFromLine size={12} /> Información del Documento
                  </label>
                  <div className="flex items-center justify-between gap-2">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter ml-1">Tipo Doc.</label>
                      <select
                        {...formik.getFieldProps('tipo_doc_recepcion')}
                        disabled={!isBorrador}
                        className={`w-full px-3 py-2 rounded-xl border border-gray-100 bg-gray-50/20 text-xs font-black text-slate-700 outline-none focus:ring-2 focus:ring-brand-accent/20 transition-all
                          ${(formik.errors.tipo_doc_recepcion && formik.touched.tipo_doc_recepcion)
                            ? 'border-red-500 text-red-700 focus:ring-red-200 bg-red-50/30'
                            : 'border-gray-100 text-slate-700 focus:ring-brand-accent/20 focus:border-brand-accent'}`}
                      >
                        <option value="">...</option>
                        <option value="NOTA_ENTREGA">NOTA ENTREGA</option>
                        <option value="FACTURA">FACTURA</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter ml-1">Nro Documento</label>
                      <input
                        type="text"
                        {...formik.getFieldProps('nro_doc_recepcion')}
                        disabled={!isBorrador}
                        className={`w-full px-3 py-2 rounded-xl border border-gray-100 bg-gray-50/20 text-xs font-black text-slate-700 outline-none focus:ring-2 focus:ring-brand-accent/20 transition-all
                          ${(formik.errors.nro_doc_recepcion && formik.touched.nro_doc_recepcion)
                            ? 'border-red-500 text-red-700 focus:ring-red-200 bg-red-50/30'
                            : 'border-gray-100 text-slate-700 focus:ring-brand-accent/20 focus:border-brand-accent'}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter ml-1">Fecha</label>
                      <input
                        type="date"
                        {...formik.getFieldProps('fecha_doc_recepcion')}
                        disabled={!isBorrador}
                        className={`w-full px-3 py-2 rounded-xl border border-gray-100 bg-gray-50/20 text-xs font-black text-slate-700 outline-none focus:ring-2 focus:ring-brand-accent/20 transition-all
                          ${(formik.errors.fecha_doc_recepcion && formik.touched.fecha_doc_recepcion)
                            ? 'border-red-500 text-red-700 focus:ring-red-200 bg-red-50/30'
                            : 'border-gray-100 text-slate-700 focus:ring-brand-accent/20 focus:border-brand-accent'}`}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {canAddProducts && (
                <div className="relative group/search max-w-2xl mx-auto">
                  <div className={`flex items-center bg-white border border-gray-100 rounded-[1.5rem] shadow-xl overflow-hidden focus-within:ring-4 focus-within:ring-brand-accent/10 focus-within:border-brand-accent transition-all ${showResults ? 'rounded-b-none border-b-transparent shadow-none' : ''}`}>
                    <div className="pl-6 text-brand-900">
                      <FileText size={20} />
                    </div>
                    <input
                      ref={searchInputRef}
                      type="text"
                      inputMode={lectorMode ? 'none' : 'text'}
                      value={productSearch}
                      onFocus={() => {setShowResults(true); manejarClick();}}
                      onKeyDown={async (e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const code = productSearch.trim();
                          if (!code) return;

                          try {
                            const res = await resolverCodigoBarras(empresaActiva.id, code);
                            if (res) {
                              addProduct({
                                id: res.id_producto,
                                id_presentacion_logistica: res.id_presentacion_logistica,
                                factor: res.factor,
                                rubro: {
                                  nombre: res.rubro,
                                  id_unidad_medida: res.id_unidad_medida,
                                  almacen_unidades_medida: { abreviatura: res.unidad },
                                  categoria: { id_almacen: almacenSel?.id, almacenes: { nombre: almacenSel?.nombre } }
                                },
                                marca: { nombre: res.marca },
                                variedad: res.variedad,
                                presentacion: { id: res.id_presentacion, nombre: res.nombre_presentacion },
                                maneja_lote: res.maneja_lote,
                                peso_variable: res.peso_variable
                              });
                              return;
                            }
                          } catch (err) {
                            console.error('Error al resolver código:', err);
                          }

                          if (filteredProducts.length > 0) {
                            addProduct(filteredProducts[0]);
                          } else {
                            setErrorModal({
                              show: true,
                              message: `El código o búsqueda "${code}" no coincide con ningún producto.`
                            });
                            setProductSearch('');
                          }
                        }
                      }}
                      onChange={(e) => { setProductSearch(e.target.value); setShowResults(true); }}
                      onClick={manejarClick}
                      placeholder="Escriba nombre, marca o código..."
                      className="flex-1 px-4 py-5 text-sm font-bold text-slate-800 outline-none placeholder:text-slate-300 bg-transparent"
                    />
                    <div className="pr-4 flex items-center">
                      <button
                        type="button"
                        onClick={toggleLectorMode}
                        className={`p-2.5 rounded-xl border transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 ${
                          lectorMode
                            ? 'bg-brand-900 border-brand-900 text-white shadow-lg shadow-brand-900/20'
                            : 'bg-white border-gray-100 text-slate-400 hover:border-brand-200 hover:bg-slate-50'
                        }`}
                        title={lectorMode ? "Lector de barras activo (teclado virtual oculto)" : "Teclado virtual activo (clic para activar lector de barras)"}
                      >
                        {lectorMode ? <QrCode size={16} /> : <Keyboard size={16} />}
                        <span className="text-[9px] font-black uppercase tracking-widest hidden sm:inline">
                          {lectorMode ? "Lector" : "Teclado"}
                        </span>
                      </button>
                    </div>
                  </div>

                  {showResults && filteredProducts.length > 0 && (
                    <div className="absolute top-full left-0 w-full bg-white border border-gray-100 rounded-b-[1.5rem] shadow-2xl z-50 overflow-hidden animate-in slide-in-from-top-2">
                      {filteredProducts.map(p => {
                        const displayFactor = p.specificFactor || p.factor || 1;
                        const displayPres = p.specificPresentation?.nombre || p.presentacion?.nombre || 'UNIDAD';

                        const decimals = getDecimalPlaces(displayFactor);
                        const formatted = Number(displayFactor).toFixed(decimals);

                        return (
                          <button
                            key={p.uid}
                            type="button"
                            onClick={() => {
                              addProduct({
                                ...p,
                                specificFactor: p.specificFactor,
                                specificPresentation: p.specificPresentation,
                                id_presentacion_logistica: p.id_presentacion_logistica
                              });
                            }}
                            className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors border-b border-gray-50 last:border-0"
                          >
                            <div className="flex flex-col items-start text-left gap-1">
                              <span className="text-[11px] font-black text-slate-800 uppercase tracking-tight leading-tight">
                                {p.rubro?.nombre} {p.marca?.nombre} {p.variedad && `| ${p.variedad}`}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="flex items-center gap-1.5 text-[9px] font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-md border border-brand-100">
                                  <QrCode size={10} />
                                  <span className="font-black tracking-tight">{p.matchedBarcode}</span>
                                </span>
                                <span className="text-[9px] font-black text-brand-500 uppercase tracking-widest">
                                  {displayPres}
                                  <span className="ml-1 opacity-70 uppercase">
                                    {Number(p.cantidad_referencia) > 1 ? `${p.cantidad_referencia} ${p.referencia?.presentacion?.nombre || ''} | ` : ''} {formatted}{p.rubro?.almacen_unidades_medida?.abreviatura}
                                  </span>
                                </span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div className="bg-white rounded-md border border-gray-100 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50/80">
                      <th className="px-2 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-gray-100">Producto</th>
                      <th className={`px-2 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-gray-100 ${isCatchWeightWarehouse ? 'w-64' : 'w-32'}`}>
                        {isFrigorifico ? 'Cant. & Peso Real' : isMayorista ? 'Peso Real' : 'Unidad'}
                      </th>
                      {isCatchWeightWarehouse && (
                        <th className="px-2 py-5 text-[10px] font-black uppercase tracking-widest border-b border-gray-100 w-48 bg-blue-50/40 text-blue-800">
                          Peso Factura
                        </th>
                      )}
                      <th className="px-2 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-gray-100 w-40 text-center">Organoléptico</th>
                      <th className="px-2 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-gray-100 w-44">Lote / Vence</th>
                      {!isFinalizado && <th className="px-2 py-5 text-right w-16" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-300">
                    {(formik.values.detalles?.length || 0) === 0 ? (
                      <tr>
                        <td colSpan={isCatchWeightWarehouse ? 7 : 6} className="px-8 py-20 text-center">
                          <div className="flex flex-col items-center opacity-20">
                            <Package size={48} className="mb-4 text-brand-900" />
                            <p className="text-sm font-bold uppercase tracking-widest">Lista de productos vacía</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      formik.values.detalles.map((d, idx) => {
                        const p = d.producto_info;
                        const requiresLot = p?.maneja_lote;


                        // Check for duplicate lot in other rows
                        const isDuplicateLot = d.lote && formik.values.detalles.some((other, oIdx) =>
                          oIdx !== idx &&
                          other.id_producto === d.id_producto &&
                          other.lote?.trim().toUpperCase() === d.lote?.trim().toUpperCase()
                        );

                        const isLotMissing = requiresLot && !d.lote;
                        const isDateMissing = requiresLot && !d.fecha_vencimiento;

                        return (
                          <tr key={idx} className="group/row hover:bg-slate-50/30 transition-all">
                            <td className="px-2 py-1">
                              <div className="flex flex-col">
                                <span className="flex flex-col text-[11px] font-black text-slate-800 uppercase tracking-tight">
                                  {p?.rubro?.nombre}
                                  <span className="ml-4 text-[10px] font-bold text-slate-600 uppercase tracking-tight">{p?.marca ? p?.marca.nombre : ''} {p?.variedad && ` ${p.variedad}`}</span>
                                </span>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="flex items-center gap-2 text-[9px] font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-md border border-brand-100">
                                    <QrCode size={10} />
                                    <span className="font-black tracking-tight">{d.matchedBarcode || d.logistica?.codigo_barras}</span>
                                    <span className="opacity-40">|</span>
                                    <span className="uppercase tracking-widest">
                                      {d.logistica?.presentacion?.nombre || d.producto_info?.presentacion?.nombre || 'UNIDAD'}
                                      <span className="ml-1 text-brand-500 tracking-tighter">
                                        {Number(d.logistica?.cantidad_referencia) > 1 ? `${d.logistica.cantidad_referencia} ${d.logistica.referencia?.presentacion?.nombre || ''} | ` : ''} {Number(d.factor || 1).toFixed(getDecimalPlaces(d.factor || 1))} {p?.rubro?.almacen_unidades_medida?.abreviatura}
                                      </span>
                                    </span>
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="px-2 py-1">
                              {isCatchWeightWarehouse ? (
                                <div className="flex gap-2">
                                  {isFrigorifico && (
                                    <div className="flex-1 min-w-[70px]">
                                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-tight block mb-1">Pzas/Bultos</span>
                                      <input
                                        type="number"
                                        min={1}
                                        step={1}
                                        disabled={!canEditQuantities}
                                        value={d.cantidad}
                                        onChange={(e) => {
                                          let val = e.target.value;
                                          const fraccionamiento = d.producto_info?.rubro?.tipo_fraccionamiento;
                                          if (fraccionamiento === 'NUNCA' || fraccionamiento === 'SOLO_EJECUCION') {
                                            if (val !== '') {
                                              val = Math.floor(Number(val)).toString();
                                            }
                                          }
                                          const numCant = Number(val) || 0;
                                          const theoreticalFactor = Number(d.logistica?.factor || d.producto_info?.factor || 1);
                                          const newPesoReal = Number((numCant * theoreticalFactor).toFixed(4));
                                          
                                          formik.setFieldValue(`detalles.${idx}.cantidad`, val);
                                          formik.setFieldValue(`detalles.${idx}.peso_neto_real`, newPesoReal);
                                          formik.setFieldValue(`detalles.${idx}.factor`, theoreticalFactor);
                                        }}
                                        className="w-full px-2 py-1.5 bg-gray-50 border border-gray-100 rounded-xl text-xs font-black text-slate-700 outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all disabled:opacity-30"
                                      />
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-[90px]">
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-tight block mb-1">
                                      Peso {p?.rubro?.almacen_unidades_medida?.abreviatura || 'KG'} Real
                                    </span>
                                    <input
                                      type="number"
                                      min={0.01}
                                      step={0.001}
                                      disabled={!canEditQuantities}
                                      value={d.peso_neto_real || ''}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        const numPeso = Number(val) || 0;
                                        if (isMayorista) {
                                          formik.setFieldValue(`detalles.${idx}.cantidad`, 1);
                                          formik.setFieldValue(`detalles.${idx}.peso_neto_real`, val);
                                          formik.setFieldValue(`detalles.${idx}.factor`, numPeso);
                                        } else {
                                          const numCant = Number(d.cantidad) || 0;
                                          let newFactor = Number(d.logistica?.factor || d.producto_info?.factor || 1);
                                          if (numCant > 0) {
                                            newFactor = numPeso / numCant;
                                          }
                                          formik.setFieldValue(`detalles.${idx}.peso_neto_real`, val);
                                          formik.setFieldValue(`detalles.${idx}.factor`, newFactor);
                                        }
                                      }}
                                      className="w-full px-2 py-1.5 bg-white border border-brand-200 rounded-xl text-xs font-black text-brand-900 outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all disabled:opacity-30"
                                    />
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <input
                                    type="number"
                                    min={1}
                                    step={1}
                                    disabled={!canEditQuantities}
                                    value={d.cantidad}
                                    onChange={(e) => {
                                      let val = e.target.value;
                                      const fraccionamiento = d.producto_info?.rubro?.tipo_fraccionamiento;
                                      if (fraccionamiento === 'NUNCA' || fraccionamiento === 'SOLO_EJECUCION') {
                                        if (val !== '') {
                                          val = Math.floor(Number(val)).toString();
                                        }
                                      }
                                      formik.setFieldValue(`detalles.${idx}.cantidad`, val);
                                      if (!isCatchWeightWarehouse) {
                                        formik.setFieldValue(`detalles.${idx}.cantidad_factura`, val);
                                      }
                                    }}
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm font-black text-slate-700 outline-none focus:ring-4 focus:ring-brand-accent/5 focus:border-brand-accent transition-all disabled:opacity-30"
                                  />
                                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mt-1">
                                    = {Number(d.cantidad * (d.factor || 1)).toFixed(getDecimalPlaces(d.cantidad * (d.factor || 1)))} {p?.rubro?.almacen_unidades_medida?.abreviatura}
                                  </span>
                                </>
                              )}
                            </td>
                            {isCatchWeightWarehouse && (
                              <td className="px-2 py-1 bg-blue-50/10">
                                <div className="flex flex-col w-full">
                                  <input
                                    type="number"
                                    min={0.01}
                                    step={0.001}
                                    disabled={!canEditQuantities}
                                    value={d.cantidad_factura || ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      formik.setFieldValue(`detalles.${idx}.cantidad_factura`, val);
                                    }}
                                    className="w-full px-2 py-1.5 bg-white border border-blue-200 rounded-xl text-xs font-black text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all disabled:opacity-30 text-right"
                                    placeholder="Peso Fact."
                                  />
                                  {(() => {
                                    const pesoFact = Number(d.cantidad_factura) || 0;
                                    const pesoRec = Number(d.peso_neto_real) || 0;
                                    if (pesoFact > pesoRec && pesoFact > 0) {
                                      const diff = pesoFact - pesoRec;
                                      const pct = (diff / pesoFact) * 100;
                                      return (
                                        <span className="text-[9px] font-bold text-red-500 block mt-1 text-center bg-red-50 rounded px-1 py-0.5 border border-red-100">
                                          Merma: -{diff.toFixed(2)} KG ({pct.toFixed(1)}%)
                                        </span>
                                      );
                                    }
                                    return null;
                                  })()}
                                </div>
                              </td>
                            )}
                            <td className="px-2 py-1">
                              <div className="w-full flex flex-col gap-1.5 items-center">
                                {['color', 'olor', 'textura'].map((field) => {
                                  const currentId = d[`id_validacion_${field}`] || 1;
                                  const v = validaciones.find(val => val.id === currentId) || { nombre: 'N/A', letra: 'N', id: 5 };

                                  // Colores según el estado
                                  const colorClass =
                                    v.id === 1 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : // Excelente
                                      v.id === 2 ? 'bg-blue-50 text-blue-700 border-blue-100' :      // Bueno
                                        v.id === 3 ? 'bg-amber-50 text-amber-700 border-amber-100' :    // Regular
                                          v.id === 4 ? 'bg-red-50 text-red-700 border-red-100' :        // Deficiente
                                            'bg-slate-50 text-slate-500 border-slate-100';               // N/A

                                  return (
                                    <div key={field} className="w-full flex items-center gap-2 group/val">
                                      <span className="text-[9px] font-black text-slate-800 uppercase w-4 text-right">{field[0]}</span>
                                      <button
                                        type="button"
                                        disabled={isPendiente || isFinalizado}
                                        onClick={() => {
                                          // Lógica de ciclo: 1->2->3->4->5->1
                                          const nextId = (currentId % 5) + 1;
                                          formik.setFieldValue(`detalles.${idx}.id_validacion_${field}`, nextId);
                                        }}
                                        className={`flex-1 flex items-center justify-center gap-2 py-1 px-2 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 ${colorClass} ${!isFinalizado && 'hover:shadow-sm cursor-pointer'}`}
                                      >
                                        <span className="w-4 h-4 flex items-center justify-center rounded-full bg-white/50">{v.letra}</span>
                                        <span className="flex-1 text-left">{v.nombre}</span>
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </td>
                            <td className="px-2 py-1">
                              {requiresLot ? (
                                <div className="space-y-1">
                                  <input
                                    {...formik.getFieldProps(`detalles.${idx}.lote`)}
                                    type="text"
                                    disabled={!canEditQuantities}
                                    placeholder="Lote"
                                    className={`w-full px-2 py-1.5 bg-gray-50 border rounded-lg text-[10px] font-bold outline-none focus:ring-2 transition-all
                                      ${((isDuplicateLot || formik.errors.detalles?.[idx]?.lote) && formik.touched.detalles?.[idx]?.lote)
                                        ? 'border-red-500 text-red-700 focus:ring-red-200 bg-red-50/30'
                                        : 'border-gray-100 text-slate-700 focus:ring-brand-accent/20 focus:border-brand-accent'}`}
                                  />
                                  {isDuplicateLot && formik.touched.detalles?.[idx]?.lote && (
                                    <p className="text-[8px] text-red-500 font-black uppercase tracking-tighter animate-pulse">Lote Duplicado</p>
                                  )}
                                  <input
                                    {...formik.getFieldProps(`detalles.${idx}.fecha_vencimiento`)}
                                    type="date"
                                    disabled={!canEditQuantities}
                                    className={`w-full px-2 py-1.5 bg-gray-50 border rounded-lg text-[10px] font-bold text-slate-700 outline-none focus:ring-2 transition-all
                                      ${(formik.errors.detalles?.[idx]?.fecha_vencimiento && formik.touched.detalles?.[idx]?.fecha_vencimiento)
                                        ? 'border-red-500 text-red-700 focus:ring-red-200 bg-red-50/30'
                                        : 'border-gray-100'}`}
                                  />
                                </div>
                              ) : (
                                <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest italic">
                                  No aplica
                                </span>
                              )}
                            </td>
                            {!isFinalizado && (
                              <td className="px-2 py-1 text-right">
                                {isBorrador && (
                                  <button
                                    type="button"
                                    onClick={() => removeProduct(idx)}
                                    className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Observaciones / Nota Adicional</label>
                <textarea
                  {...formik.getFieldProps('observaciones')}
                  disabled={isFinalizado}
                  rows={2}
                  className="w-full px-4 py-3 rounded-md border border-gray-100 bg-gray-50/20 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-brand-accent/5 focus:border-brand-accent transition-all resize-none"
                />
              </div>

              {isAnulado && formik.values.observacion_anula && (
                <div className="p-6 bg-red-50 border border-red-200 rounded-[2rem] space-y-2">
                  <label className="text-[10px] font-black text-red-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                    <AlertTriangle size={12} /> Motivo de Anulación
                  </label>
                  <p className="text-sm font-bold text-red-700 italic">"{formik.values.observacion_anula}"</p>
                </div>
              )}
            </div>
          </div>

          <div className="p-8 border-t border-gray-100 bg-white flex items-center justify-between gap-4 sticky bottom-0 z-20">
            <div className="flex items-center gap-4">
              <button type="button" onClick={onClose} className="px-8 py-3 text-[11px] font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest transition-colors">
                Cerrar
              </button>
            </div>

            <div className="flex items-center gap-3">
              {isProcesado && (
                <button
                  type="button"
                  onClick={() => handlePrintLabels()}
                  className="flex bg-brand-900 text-white px-10 py-3.5 rounded-md text-xs font-black hover:bg-brand-800 shadow-xl shadow-brand-900/20 transition-all active:scale-95 items-center gap-3 uppercase tracking-widest"
                >
                  <Tag size={18} /> Imprimir Etiquetas
                </button>
              )}
              {isBorrador && (
                <>
                  <button
                    type="button"
                    disabled={loading || !formik.dirty}
                    onClick={() => handleSaveAction('BORRADOR')}
                    className="flex bg-slate-100 text-slate-600 px-8 py-3.5 rounded-md text-xs font-black hover:bg-slate-200 transition-all active:scale-95 items-center gap-3 uppercase tracking-widest disabled:opacity-50"
                  >
                    <Save size={18} /> Guardar Borrador
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleSaveAction('PENDIENTE')}
                    className="flex bg-brand-900 text-white px-10 py-3.5 rounded-md text-xs font-black hover:bg-brand-600 shadow-xl shadow-brand-900/20 transition-all active:scale-95 items-center gap-3 uppercase tracking-widest"
                  >
                    <Send size={18} /> Finalizar Cotejo
                  </button>
                </>
              )}
            </div>
          </div>

          {loading && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] flex items-center justify-center z-[100]">
              <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-brand-900/20 border-t-brand-900 rounded-full animate-spin" />
                <p className="text-[10px] font-black text-brand-900 uppercase tracking-widest animate-pulse">Procesando solicitud...</p>
              </div>
            </div>
          )}

        </div>
      </div>

      {errorModal.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setErrorModal({ show: false, message: '' })} />
          <div className="relative bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-300">
            <div className="p-10 text-center">
              <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-red-100">
                <AlertTriangle size={40} />
              </div>
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-2">
                Producto no encontrado
              </h3>
              <p className="text-sm font-medium text-slate-500 leading-relaxed italic px-4">
                {errorModal.message}
              </p>
            </div>
            <div className="p-6 bg-gray-50/50 flex justify-center border-t border-gray-100">
              <button
                type="button"
                onClick={() => {
                  setErrorModal({ show: false, message: '' });
                  setTimeout(() => searchInputRef.current?.focus(), 100);
                }}
                className="px-10 py-4 bg-brand-900 text-white text-xs font-black uppercase tracking-widest rounded-md hover:bg-brand-800 transition-all shadow-xl shadow-brand-900/20 active:scale-95"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {showAnularModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAnularModal(false)} />
          <div className="relative bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-300">
            <div className="p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 bg-red-50 text-red-600 rounded-md flex items-center justify-center shadow-inner">
                  <AlertTriangle size={28} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight leading-tight">Anulación de Registro</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase italic tracking-widest">Esta acción es irreversible</p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-md p-4 mb-6">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">
                  Motivo de la Anulación (Obligatorio)
                </label>
                <textarea
                  autoFocus
                  value={motivoAnulacion}
                  onChange={(e) => setMotivoAnulacion(e.target.value)}
                  placeholder="Ej: Error en cantidades recibidas, factura incorrecta, etc..."
                  className="w-full h-32 px-4 py-3 rounded-xl border border-gray-100 bg-white text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-red-500/10 focus:border-red-500 transition-all resize-none"
                />
                <p className={`text-[9px] font-bold mt-2 text-right ${motivoAnulacion.length < 10 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {motivoAnulacion.length < 10 ? `Faltan ${10 - motivoAnulacion.length} caracteres` : 'Motivo válido'}
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowAnularModal(false)}
                  className="flex-1 py-4 bg-slate-100 text-slate-500 text-xs font-black uppercase tracking-widest rounded-md hover:bg-slate-200 transition-all active:scale-95"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={motivoAnulacion.length < 10 || loading}
                  onClick={handleAnular}
                  className="flex-2 px-8 py-4 bg-red-600 text-white text-xs font-black uppercase tracking-widest rounded-md hover:bg-red-700 transition-all shadow-xl shadow-red-900/20 active:scale-95 disabled:opacity-50 disabled:grayscale"
                >
                  Confirmar Anulación
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showConfirmProcesar && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={() => !loading && setShowConfirmProcesar(false)} />
          <div className="relative bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300 border border-white/20">
            <div className="p-8 text-center space-y-6">
              <div className="mx-auto w-24 h-24 bg-brand-50 rounded-full flex items-center justify-center animate-bounce shadow-inner">
                <ShieldCheck size={48} className="text-brand-600" />
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl font-black text-slate-800 tracking-tight leading-tight">¿Procesar Inventario?</h3>
                <p className="text-sm font-medium text-slate-500 italic leading-relaxed px-2">
                  Esta acción actualizará existencias y costos ponderados. <br />
                  <span className="text-brand-600 font-bold not-italic underline decoration-brand-200 underline-offset-4">Es un proceso irreversible.</span>
                </p>
              </div>

              <div className="flex flex-col gap-3 pt-4">
                <button
                  onClick={executeProcesar}
                  disabled={loading}
                  className="w-full py-4 bg-brand-600 hover:bg-brand-700 text-white rounded-md font-black text-xs uppercase tracking-widest shadow-xl shadow-brand-600/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'SÍ, PROCESAR AHORA'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <EtiquetasTrackingRecepcionModal
        isOpen={showEtiquetas}
        onClose={() => setShowEtiquetas(false)}
        inventario={dataEtiquetas}
      />
    </Fragment>,
    document.body
  );
}
