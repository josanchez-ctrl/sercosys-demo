import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, PackageSearch, FileText, AlertTriangle, Save, Send, XCircle, ClipboardList, Info, MapPin, Search, PlusCircle, Trash2 } from 'lucide-react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { formato8Digitos, formatearFecha, getDiasRestantes } from '../../../util/workDate';
import { savePicking, getPickingById, anularPicking, getInventarioParaPicking, findDraftPicking } from '../../../services/pickingService';
import { QrCode } from 'lucide-react';
import { getSucursalesActivas } from '../../../services/sucursalService';
import { getComedoresActivos } from '../../../services/comedorService';

const validationSchema = Yup.object({
  id_sucursal: Yup.string().required('La sucursal es obligatoria'),
  id_comedor: Yup.string().required('El comedor es obligatorio'),
  detalles: Yup.array().of(
    Yup.object().shape({
      cantidad: Yup.number().required('Requerido').moreThan(0, 'Mayor a 0'),
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
        })
    })
  ).min(1, 'Debe agregar al menos un producto')
});

function PickingManualModal({ initialData = null, empresaActiva, almacenSel, perfil, onClose, onUpdate }) {
  const isEdit = !!initialData;
  const [loading, setLoading] = useState(false);
  const [loadingMaestros, setLoadingMaestros] = useState(true);

  const [sucursales, setSucursales] = useState([]);
  const [comedores, setComedores] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [draftFound, setDraftFound] = useState(null);
  const [productSearch, setProductSearch] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchContainerRef = useRef(null);
  const searchInputRef = useRef(null);

  const formik = useFormik({
    initialValues: initialData || {
      id: null,
      id_empresa: empresaActiva.id,
      id_almacen: almacenSel?.id,
      id_sucursal: '',
      id_comedor: '',
      id_requisicion: [],
      observaciones: '',
      estatus: 'BORRADOR',
      detalles: []
    },
    validationSchema,
    validateOnChange: false,
    validateOnBlur: true,
    onSubmit: async (values) => {
      setLoading(true);
      try {
        const { detalles, ...rest } = values;
        const cleanDetails = detalles.map(d => ({
          ...d,
          factor: d.factor || d.producto_info?.factor || 1,
          id_presentacion_logistica: d.id_presentacion_logistica || null,
          cantidad_presentacion: d.cantidad_presentacion ?? null,
          id_requisicion_detalle: null
        }));

        await savePicking(rest, cleanDetails, perfil.id);
        onUpdate();
        onClose();
      } catch (error) {
        console.error('Error al guardar picking manual:', error);
      } finally {
        setLoading(false);
      }
    }
  });

  const fetchMaestros = async () => {
    setLoadingMaestros(true);
    try {
      const sucs = await getSucursalesActivas(empresaActiva.id);
      setSucursales(sucs);
      setComedores([]);
    } catch (error) {
      console.error('Error al cargar maestros:', error);
    } finally {
      setLoadingMaestros(false);
    }
  };

  const fetchPickingFull = async (id) => {
    setLoading(true);
    try {
      const full = await getPickingById(id);
      formik.setValues({
        ...full,
        detalles: (full?.detalle || []).map(d => ({
          ...d,
          producto_info: d.producto
        }))
      });
    } catch (error) {
      console.error('Error al cargar picking manual:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadInventory = async () => {
    if (!almacenSel?.id) {
      console.warn('loadInventory: No se pudo cargar el inventario porque almacenSel.id no está definido', almacenSel);
      return;
    }
    try {
      const inv = await getInventarioParaPicking(almacenSel.id);
      setInventory(inv || []);
    } catch (error) {
      console.error('Error al cargar inventario para picking manual:', error);
    }
  };

  useEffect(() => {
    if (empresaActiva?.id) {
      fetchMaestros();
      loadInventory();
    }
    if (isEdit && initialData.id) {
      fetchPickingFull(initialData.id);
    }
  }, [empresaActiva?.id, initialData, almacenSel?.id]);

  // Cargar comedores al cambiar sucursal
  useEffect(() => {
    const loadComedores = async () => {
      if (formik.values.id_sucursal) {
        try {
          const coms = await getComedoresActivos(formik.values.id_sucursal);
          setComedores(coms);
        } catch (error) {
          console.error('Error al cargar comedores de sucursal:', error);
        }
      } else {
        setComedores([]);
      }
    };
    loadComedores();
  }, [formik.values.id_sucursal]);

  useEffect(() => {
    if (formik.values.id_sucursal && formik.values.id_comedor) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 300);
    }
  }, [formik.values.id_sucursal, formik.values.id_comedor]);

  // Cargar borrador si aplica al cambiar destino
  useEffect(() => {
    const checkDraft = async () => {
      if (formik.values.id_sucursal && formik.values.id_comedor && !isEdit && almacenSel?.id && empresaActiva?.id) {
        const draft = await findDraftPicking(empresaActiva.id, almacenSel.id, formik.values.id_sucursal, formik.values.id_comedor);
        if (draft) {
          setDraftFound(draft);
        }
      }
    };
    checkDraft();
  }, [formik.values.id_sucursal, formik.values.id_comedor, almacenSel?.id, empresaActiva?.id, isEdit]);

  // Cerrar lista flotante de búsqueda al hacer clic afuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Agrupar los detalles seleccionados por Rubro para el renderizado premium
  const rubrosAgregados = useMemo(() => {
    const map = {};
    (formik.values.detalles || []).forEach(d => {
      const rubroId = d.producto_info?.id_rubro;
      if (rubroId && !map[rubroId]) {
        map[rubroId] = {
          id: rubroId,
          nombre: d.producto_info?.rubro?.nombre || 'PRODUCTO',
          unidad: d.producto_info?.rubro?.unidad_medida?.abreviatura || d.producto_info?.rubro?.unidad?.abreviatura || 'UND',
          categoria: d.producto_info?.rubro?.categoria?.nombre || 'GENERAL'
        };
      }
    });
    return Object.values(map);
  }, [formik.values.detalles]);

  // Filtrar el catálogo de inventario según el término de búsqueda
  const filteredInventory = useMemo(() => {
    if (!productSearch.trim()) return [];
    const search = productSearch.toLowerCase().trim();
    const searchTerms = search.split(' ').filter(t => t.length > 0);
    const results = [];

    inventory.forEach(item => {
      const presentaciones = item.producto?.presentaciones || [];
      const presList = presentaciones.length > 0 ? presentaciones : [{
        id: null,
        factor: 1,
        es_base: true,
        codigo_barras: '',
        codigo_interno: '',
        presentacion: { nombre: 'UNIDAD' }
      }];

      presList.forEach(pres => {
        const rubroName = (item.producto?.rubro?.nombre || '').toLowerCase();
        const brandName = (item.producto?.marca?.nombre || '').toLowerCase();
        const variety = (item.producto?.variedad || '').toLowerCase();
        const lote = (item.lote || '').toLowerCase();
        const presName = (pres.presentacion?.nombre || '').toLowerCase();
        const barcode = (pres.codigo_barras || '').toLowerCase();
        const internalCode = (pres.codigo_interno || '').toLowerCase();
        const trackingId = (item.tracking_id || '').toLowerCase();

        const matches = searchTerms.every(term => 
          rubroName.includes(term) ||
          brandName.includes(term) ||
          variety.includes(term) ||
          lote.includes(term) ||
          presName.includes(term) ||
          barcode.includes(term) ||
          internalCode.includes(term) ||
          trackingId.includes(term)
        );

        if (matches) {
          results.push({
            ...item,
            specificPresentation: pres,
            uid: `${item.id_producto}_${item.lote || 'null'}_${pres.id || 'base'}`
          });
        }
      });
    });

    return results.slice(0, 10); // Límite de 10 resultados para rendimiento
  }, [productSearch, inventory]);

  const handleMatrixChange = (invItem, qty) => {
    const realInvItem = inventory.find(inv => inv.id_producto === invItem.id_producto && (inv.lote || '') === (invItem.lote || ''));
    if (!realInvItem) return;

    const currentDetails = [...formik.values.detalles];
    const index = currentDetails.findIndex(d => 
      d.id_producto === invItem.id_producto && 
      (d.lote || '') === (invItem.lote || '') && 
      d.id_presentacion_logistica === invItem.id_presentacion_logistica
    );

    if (index === -1) return;

    if (qty === '') {
      currentDetails[index] = {
        ...currentDetails[index],
        cantidad: ''
      };
      formik.setFieldValue('detalles', currentDetails);
      return;
    }

    const tipoFrac = realInvItem.producto?.rubro?.tipo_fraccionamiento || 'SOLO_EJECUCION';
    let val = parseFloat(qty) || 0;
    val = Math.max(0, val);

    if (tipoFrac !== 'SIEMPRE') {
      val = Math.round(val);
    }

    const stockBase = realInvItem.cantidad_actual;
    const totalBaseOtherRows = currentDetails.reduce((sum, d, i) => {
      if (d.id_producto === invItem.id_producto && (d.lote || '') === (invItem.lote || '') && i !== index) {
        return sum + ((parseFloat(d.cantidad) || 0) * (d.factor || 1));
      }
      return sum;
    }, 0);

    const stockBaseDisponible = Math.max(0, stockBase - totalBaseOtherRows);
    const factor = invItem.factor || 1;
    const maxQtyInPres = stockBaseDisponible / factor;

    if (val > maxQtyInPres) val = maxQtyInPres;

    currentDetails[index] = {
      ...currentDetails[index],
      cantidad: val
    };
    formik.setFieldValue('detalles', currentDetails);
  };

  const handlePresentationChange = (invItem, presId) => {
    const currentDetails = [...formik.values.detalles];
    const index = currentDetails.findIndex(d => 
      d.id_producto === invItem.id_producto && 
      (d.lote || '') === (invItem.lote || '') && 
      d.id_presentacion_logistica === invItem.id_presentacion_logistica
    );
    if (index === -1) return;

    const realInvItem = inventory.find(inv => inv.id_producto === invItem.id_producto && (inv.lote || '') === (invItem.lote || ''));
    if (!realInvItem) return;

    const productInfo = invItem.producto_info || invItem.producto;
    const pres = productInfo?.presentaciones?.find(p => p.id === presId);
    const newFactor = pres?.factor || 1;

    const targetIndex = currentDetails.findIndex((d, i) => 
      d.id_producto === invItem.id_producto && 
      (d.lote || '') === (invItem.lote || '') && 
      d.id_presentacion_logistica === (presId || null) && 
      i !== index
    );

    if (targetIndex >= 0) {
      const qtyBaseOrig = (parseFloat(currentDetails[index].cantidad) || 0) * (currentDetails[index].factor || 1);
      const qtyBaseDest = (parseFloat(currentDetails[targetIndex].cantidad) || 0) * (currentDetails[targetIndex].factor || 1);
      const totalBase = qtyBaseOrig + qtyBaseDest;

      const finalBase = Math.min(totalBase, realInvItem.cantidad_actual);
      const finalQtyInPres = finalBase / newFactor;

      currentDetails[targetIndex] = {
        ...currentDetails[targetIndex],
        cantidad: finalQtyInPres
      };

      currentDetails.splice(index, 1);
    } else {
      const currentQtyBase = (parseFloat(currentDetails[index].cantidad) || 0) * (currentDetails[index].factor || 1);
      const finalBase = Math.min(currentQtyBase, realInvItem.cantidad_actual);
      const finalQtyInPres = finalBase / newFactor;

      currentDetails[index] = {
        ...currentDetails[index],
        factor: newFactor,
        id_presentacion_logistica: presId || null,
        cantidad: finalQtyInPres
      };
    }

    formik.setFieldValue('detalles', currentDetails);
  };
  const handleAddProductManual = (resultItem) => {
    const currentDetails = [...formik.values.detalles];
    const index = currentDetails.findIndex(d => 
      d.id_producto === resultItem.id_producto && 
      (d.lote || '') === (resultItem.lote || '') && 
      d.id_presentacion_logistica === (resultItem.specificPresentation?.id || null)
    );

    const factor = resultItem.specificPresentation?.factor || 1;
    const stockBase = resultItem.cantidad_actual;

    const totalBaseOtherRows = currentDetails.reduce((sum, d, i) => {
      if (d.id_producto === resultItem.id_producto && (d.lote || '') === (resultItem.lote || '') && i !== index) {
        return sum + ((parseFloat(d.cantidad) || 0) * (d.factor || 1));
      }
      return sum;
    }, 0);

    const stockBaseDisponible = Math.max(0, stockBase - totalBaseOtherRows);

    if (stockBaseDisponible <= 0) {
      setErrorModal({
        show: true,
        message: `No queda stock disponible de este producto en el almacén.`
      });
      return;
    }

    let newQty = 1;
    if (index >= 0) {
      newQty = (parseFloat(currentDetails[index].cantidad) || 0) + 1;
    }

    const maxQtyInPres = stockBaseDisponible / factor;
    if (newQty > maxQtyInPres) {
      newQty = maxQtyInPres;
    }

    const detail = {
      id_producto: resultItem.id_producto,
      cantidad: newQty,
      lote: resultItem.lote,
      fecha_vencimiento: resultItem.fecha_vencimiento,
      producto_info: resultItem.producto,
      factor: factor,
      id_presentacion_logistica: resultItem.specificPresentation?.id || null,
      // Para productos de peso variable, se inicializa en null; el usuario lo completa en el formulario
      cantidad_presentacion: null,
      costo_unidad_base: resultItem.costo_unidad_base
    };

    if (index >= 0) {
      currentDetails[index] = detail;
    } else {
      currentDetails.push(detail);
    }

    formik.setFieldValue('detalles', currentDetails);
    setProductSearch('');
    setShowSearchResults(false);
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
  };

  const handleRemoveItem = (invItem) => {
    const currentDetails = formik.values.detalles.filter(d => 
      !(d.id_producto === invItem.id_producto && 
        (d.lote || '') === (invItem.lote || '') && 
        d.id_presentacion_logistica === invItem.id_presentacion_logistica)
    );
    formik.setFieldValue('detalles', currentDetails);
  };

  // Actualiza el contador de empaques físicos (solo para peso variable)
  const handlePresentacionCountChange = (invItem, cantPres) => {
    const currentDetails = [...formik.values.detalles];
    const index = currentDetails.findIndex(d =>
      d.id_producto === invItem.id_producto &&
      (d.lote || '') === (invItem.lote || '') &&
      d.id_presentacion_logistica === invItem.id_presentacion_logistica
    );
    if (index === -1) return;

    if (cantPres === '') {
      currentDetails[index] = { ...currentDetails[index], cantidad_presentacion: null };
      formik.setFieldValue('detalles', currentDetails);
      return;
    }

    let val = parseFloat(cantPres) || 0;
    val = Math.max(0, Math.round(val));

    const realInvItem = inventory.find(inv => inv.id_producto === invItem.id_producto && (inv.lote || '') === (invItem.lote || ''));
    if (realInvItem) {
      const stockMaxPres = realInvItem.cantidad_presentacion || 0;
      const totalPresOtherRows = currentDetails.reduce((sum, d, i) => {
        if (d.id_producto === invItem.id_producto && (d.lote || '') === (invItem.lote || '') && i !== index) {
          return sum + (parseFloat(d.cantidad_presentacion) || 0);
        }
        return sum;
      }, 0);
      const maxPresDisponible = Math.max(0, stockMaxPres - totalPresOtherRows);
      if (val > maxPresDisponible) val = maxPresDisponible;
    }

    currentDetails[index] = { ...currentDetails[index], cantidad_presentacion: val };
    formik.setFieldValue('detalles', currentDetails);
  };

  const [errorModal, setErrorModal] = useState({ show: false, message: '' });

  const getPickedTotalsForRubro = (rubroId) => {
    return formik.values.detalles
      .filter(d => d.producto_info?.id_rubro === parseInt(rubroId))
      .reduce((acc, curr) => {
        const qty = Number(curr.cantidad) || 0;
        const factor = Number(curr.factor || curr.producto_info?.factor || 1);
        return {
          piezas: acc.piezas + qty,
          totalUnidad: acc.totalUnidad + (qty * factor)
        };
      }, { piezas: 0, totalUnidad: 0 });
  };

  const getExpirationBadge = (fecha) => {
    if (!fecha) return null;
    const dias = getDiasRestantes(fecha);
    let color = 'bg-emerald-50 text-emerald-600 border border-emerald-100';
    let text = `Vence en ${dias} d`;
    if (dias <= 0) {
      color = 'bg-red-50 text-red-600 border border-red-100 animate-pulse';
      text = '¡VENCIDO!';
    } else if (dias <= 60) color = 'bg-amber-50 text-amber-600 border border-amber-100';
    else if (dias <= 30) color = 'bg-orange-50 text-orange-600 border border-orange-100';
    return <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter ${color}`}>{text}</span>;
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4" onClick={onClose}>
      <div className="bg-white w-full h-full max-w-[95vw] max-h-[95vh] flex flex-col overflow-hidden rounded-md shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-8 py-5 border-b border-gray-100 flex items-center justify-between bg-white relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-500 to-brand-900" />
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-md bg-slate-100 text-slate-700 flex items-center justify-center border border-slate-200 shadow-inner">
              <PackageSearch size={22} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-800 tracking-tight">
                {formik.values.id ? `Picking Manual #${formato8Digitos(formik.values.id)}` : 'Nuevo Picking Manual'}
              </h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic mt-1">Carga de Despacho Libre</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400"><X size={22} /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-4 bg-gray-50/30">
          {/* Destino */}
          <div className="grid grid-cols-2 gap-6 bg-white p-6 rounded-md border border-slate-100 shadow-sm relative">
            {draftFound && (
              <div className="absolute inset-0 z-50 bg-brand-900/95 backdrop-blur-sm rounded-md flex flex-col items-center justify-center p-6 text-center text-white">
                <AlertTriangle size={48} className="mb-4" />
                <h3 className="font-black text-xl uppercase mb-2 text-white">Borrador Detectado (#{formato8Digitos(draftFound.id)})</h3>
                <div className="flex gap-4 mt-4">
                  <button onClick={() => fetchPickingFull(draftFound.id).then(() => setDraftFound(null))} className="px-6 py-2 bg-white text-brand-900 rounded-xl font-black text-xs uppercase">Continuar</button>
                  <button onClick={() => anularPicking(draftFound.id, perfil.id).then(() => setDraftFound(null))} className="px-6 py-2 bg-red-600 text-white rounded-xl font-black text-xs uppercase">Anular</button>
                </div>
              </div>
            )}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Sucursal Destino</label>
              <select 
                className="w-full h-12 bg-gray-50 rounded-xl border border-slate-100 px-4 font-bold disabled:opacity-50" 
                value={formik.values.id_sucursal} 
                disabled={isEdit} 
                onChange={(e) => {
                  const val = e.target.value;
                  formik.setFieldValue('id_sucursal', val);
                  formik.setFieldValue('id_comedor', '');
                }} 
                name="id_sucursal"
              >
                <option value="">Seleccionar...</option>
                {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Comedor Destino</label>
              <select className="w-full h-12 bg-gray-50 rounded-xl border border-slate-100 px-4 font-bold disabled:opacity-50" value={formik.values.id_comedor} disabled={isEdit} onChange={formik.handleChange} name="id_comedor">
                <option value="">Seleccionar...</option>
                {comedores.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
          </div>

          {formik.values.id_sucursal && formik.values.id_comedor && (
            <div className="relative group/search max-w-2xl mx-auto" ref={searchContainerRef}>
              <div className={`flex items-center bg-white border border-gray-100 rounded-[1.5rem] shadow-xl overflow-hidden focus-within:ring-4 focus-within:ring-brand-accent/10 focus-within:border-brand-accent transition-all ${showSearchResults && filteredInventory.length > 0 ? 'rounded-b-none border-b-transparent shadow-none' : ''}`}>
                <div className="pl-6 text-brand-900 flex items-center">
                  <Search size={20} />
                </div>
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Buscar por rubro, marca, variedad o lote..."
                  className="flex-1 px-4 py-5 text-sm font-bold text-slate-800 outline-none placeholder:text-slate-300"
                  value={productSearch}
                  onChange={(e) => {
                    setProductSearch(e.target.value);
                    setShowSearchResults(true);
                  }}
                  onFocus={() => setShowSearchResults(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                    }
                  }}
                />
              </div>
              {/* Lista flotante de búsqueda */}
              {showSearchResults && filteredInventory.length > 0 && (
                <div className="absolute top-full left-0 w-full bg-white border border-gray-100 rounded-b-[1.5rem] shadow-2xl z-[99999] overflow-hidden animate-in slide-in-from-top-2 divide-y divide-slate-100">
                  {filteredInventory.map(item => (
                    <button
                      key={item.uid}
                      type="button"
                      onClick={() => handleAddProductManual(item)}
                      className="w-full text-left px-6 py-4 hover:bg-slate-50 transition-colors flex items-center justify-between"
                    >
                      <div className="flex flex-col items-start gap-1">
                        <p className="text-[11px] font-black text-slate-800 uppercase leading-none">
                          {item.producto?.rubro?.nombre} {item.producto?.marca?.nombre} {item.producto?.variedad}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="text-[9px] font-bold text-slate-400">
                            LOTE: {item.lote || 'N/A'} | Vence: {item.fecha_vencimiento ? formatearFecha(item.fecha_vencimiento) : 'N/A'}
                          </span>
                          <span className="text-[9px] font-black text-brand-500 uppercase tracking-widest">
                            {item.specificPresentation?.presentacion?.nombre || 'UNIDAD'}
                            <span className="ml-1 opacity-70 uppercase">
                              ({item.specificPresentation?.factor} {item.producto?.rubro?.unidad_medida?.abreviatura || item.producto?.rubro?.unidad?.abreviatura})
                            </span>
                          </span>
                          {item.specificPresentation?.codigo_barras && (
                            <span className="flex items-center gap-1 text-[8px] font-black text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded border border-brand-100">
                              <QrCode size={8} /> {item.specificPresentation.codigo_barras}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex items-center gap-3">
                        <div>
                          <span className="text-xs font-black text-brand-900">
                            {Math.round((item.cantidad_actual / (item.specificPresentation?.factor || 1)) * 100) / 100}
                          </span>
                          <span className="text-[8px] font-bold text-slate-400 ml-1 uppercase">
                            {item.specificPresentation?.presentacion?.nombre || 'UND'}
                          </span>
                        </div>
                        <PlusCircle size={16} className="text-brand-600" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {!formik.values.id_sucursal && (
            <div className="max-w-2xl mx-auto p-4 bg-amber-50 border border-amber-100 rounded-xl flex items-center gap-3 text-amber-800">
              <AlertTriangle size={18} />
              <p className="text-xs font-bold uppercase tracking-wider">Seleccione Sucursal y Comedor primero para buscar e incorporar productos.</p>
            </div>
          )}

          {/* Matriz / Renglones Cargados */}
          {rubrosAgregados.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center gap-6 px-8 py-2 bg-slate-100/50 rounded-xl">
                <div className="w-[20%] text-[10px] font-black uppercase text-slate-400">Rubro</div>
                <div className="flex-1 text-[10px] font-black uppercase text-slate-400">Detalles de Inventario</div>
                <div className="w-[15%] text-[10px] font-black uppercase text-slate-400 text-right">Total Asignado</div>
              </div>

              {rubrosAgregados.map((rubro) => {
                const rubroDetails = formik.values.detalles.filter(d => d.producto_info?.id_rubro === rubro.id);
                const { piezas, totalUnidad } = getPickedTotalsForRubro(rubro.id);
                return (
                  <div key={rubro.id} className="flex items-center gap-6 bg-white rounded-md border border-slate-300 px-6 py-1 shadow-sm">
                    <div className="w-[20%]">
                      <h4 className="text-base font-black text-slate-800 uppercase leading-tight">{rubro.nombre}</h4>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">{rubro.categoria} | {rubro.unidad}</span>
                    </div>

                    <div className="flex-1 space-y-2">
                      {rubroDetails.map(d => {
                        const invItem = inventory.find(inv => inv.id_producto === d.id_producto && (inv.lote || '') === (d.lote || ''));
                        const factor = d.factor || 1;
                        const stockMax = invItem ? invItem.cantidad_actual : 0;
                        let stockEnPres = 0;
                        if (d.producto_info?.peso_variable) {
                          const stockMaxPres = invItem ? (invItem.cantidad_presentacion || 0) : 0;
                          const totalPresOtherRows = formik.values.detalles.reduce((sum, otherD) => {
                            if (otherD.id_producto === d.id_producto && (otherD.lote || '') === (d.lote || '') && 
                                otherD.id_presentacion_logistica !== d.id_presentacion_logistica) {
                              return sum + (parseFloat(otherD.cantidad_presentacion) || 0);
                            }
                            return sum;
                          }, 0);
                          stockEnPres = Math.max(0, stockMaxPres - totalPresOtherRows);
                        } else {
                          const totalBaseOtherRows = formik.values.detalles.reduce((sum, otherD) => {
                            if (otherD.id_producto === d.id_producto && (otherD.lote || '') === (d.lote || '') && 
                                otherD.id_presentacion_logistica !== d.id_presentacion_logistica) {
                              return sum + ((parseFloat(otherD.cantidad) || 0) * (otherD.factor || 1));
                            }
                            return sum;
                          }, 0);
                          const stockDisponibleBase = Math.max(0, stockMax - totalBaseOtherRows);
                          stockEnPres = Math.round((stockDisponibleBase / factor) * 100) / 100;
                        }

                        const currentPres = d.producto_info?.presentaciones?.find(p => p.id === d.id_presentacion_logistica) || d.producto_info?.presentaciones?.find(p => p.es_base);
                        const presName = currentPres?.presentacion?.nombre || 'UND';

                        return (
                          <div key={`${d.id_producto}-${d.lote || 'null'}-${d.id_presentacion_logistica || 'base'}`} className="flex items-center gap-4 py-2 border-b border-slate-200 last:border-0">
                            <div className="flex-1">
                              <div className="flex flex-col gap-1">
                                <p className="text-[11px] font-black text-slate-600 uppercase leading-tight">
                                  {d.producto_info?.marca?.nombre} {d.producto_info?.variedad}
                                </p>
                                <div className="flex items-center gap-3 text-[9px] font-bold text-slate-400 italic">
                                  {d.lote !== null && <span>LOTE: {d.lote}</span>}
                                  {getExpirationBadge(d.fecha_vencimiento)}
                                  {invItem?.ubicacion?.codigo && (
                                    <span className="flex items-center gap-1 bg-brand-50 text-brand-600 px-1.5 py-0.5 rounded border border-brand-100 font-black not-italic">
                                      <MapPin size={8} /> {invItem.ubicacion.codigo}
                                    </span>
                                  )}
                                </div>
                                {/* Opciones de presentación */}
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {d.producto_info?.presentaciones?.sort((a, b) => a.factor - b.factor).map(p => {
                                    const isSelected = d.id_presentacion_logistica === p.id || (!d.id_presentacion_logistica && p.es_base);
                                    return (
                                      <button
                                        key={p.id}
                                        type="button"
                                        onClick={() => handlePresentationChange(d, p.id)}
                                        className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase border transition-all flex items-center gap-1 ${
                                          isSelected
                                            ? 'bg-brand-900 border-brand-900 text-white shadow-sm'
                                            : 'bg-white border-slate-100 text-slate-400 hover:border-brand-200'
                                        }`}
                                      >
                                        {p.presentacion?.nombre}
                                        <span className="opacity-60 text-[7px]">
                                          ({p.factor} {rubro.unidad})
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                            
                            {/* Stock Informativo */}
                            <div className="w-36 text-right">
                              <span className="text-[10px] font-black text-slate-400 block">STOCK MÁX:</span>
                              <span className="text-[11px] font-black text-brand-600">
                  {stockEnPres} <span className="text-[8px] uppercase">{presName}</span>
                              </span>
                              <span className="text-[9px] font-bold text-slate-400 block italic">
                                ({stockMax} {rubro.unidad})
                              </span>
                            </div>

                            {/* Cantidad a Asignar */}
                            <div className="w-36 flex flex-col items-center gap-1">
                              {d.producto_info?.peso_variable ? (
                                // Modo Peso Variable: KG de báscula + conteo de empaques
                                <div className="flex flex-col gap-1 w-full">
                                  <input
                                    type="number"
                                    step="0.001"
                                    className="w-full h-10 bg-emerald-50 border border-emerald-200 rounded-xl text-center font-black text-emerald-900 focus:border-emerald-500 transition-all"
                                    value={d.cantidad || ''}
                                    onChange={e => handleMatrixChange(d, e.target.value)}
                                    placeholder="KG"
                                  />
                                  <span className="text-[7px] font-black text-emerald-600 uppercase tracking-tighter text-center">KG (BÁSCULA)</span>
                                  <input
                                    type="number"
                                    step="1"
                                    min="0"
                                    className="w-full h-10 bg-blue-50 border border-blue-200 rounded-xl text-center font-black text-blue-900 focus:border-blue-400 transition-all"
                                    value={d.cantidad_presentacion || ''}
                                    onChange={e => handlePresentacionCountChange(d, e.target.value)}
                                    placeholder="# Empaques"
                                  />
                                  <span className="text-[7px] font-black text-blue-600 uppercase tracking-tighter text-center"># {presName}S</span>
                                </div>
                              ) : (
                                // Modo Normal: una sola entrada con factor
                                <>
                                  <input
                                    type="number"
                                    step={d.producto_info?.rubro?.tipo_fraccionamiento === 'SIEMPRE' ? "0.01" : "1"}
                                    className={`w-full h-10 bg-gray-50 border rounded-xl text-center font-black transition-all ${
                                      d.producto_info?.rubro?.tipo_fraccionamiento === 'SIEMPRE'
                                        ? 'border-emerald-100 focus:border-emerald-500'
                                        : 'border-slate-100 focus:border-brand-500'
                                    }`}
                                    value={d.cantidad || ''}
                                    onChange={e => handleMatrixChange(d, e.target.value)}
                                    placeholder="0"
                                  />
                                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">
                                    {`CANT ${presName}`}
                                  </span>
                                </>
                              )}
                            </div>

                            {/* Acción Eliminar */}
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(d)}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    <div className="w-[15%] text-right border-l border-slate-50 pl-4">
                      <span className="text-2xl font-black text-brand-900">{parseFloat(totalUnidad.toFixed(3))}</span>
                      <p className="text-[9px] font-black text-slate-300 uppercase">{rubro.unidad}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-400 ml-4">Observaciones</label>
            <textarea className="w-full p-6 bg-white rounded-md border border-slate-100 shadow-sm italic outline-none" rows="3" name="observaciones" value={formik.values.observaciones} onChange={formik.handleChange} placeholder="Notas del despacho..." />
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-5 bg-white border-t border-gray-100 flex items-center justify-between shadow-xl">
          <div className="flex gap-4">
            {isEdit && formik.values.estatus === 'BORRADOR' && (
              <button type="button" onClick={() => anularPicking(formik.values.id, perfil.id).then(() => { onUpdate(); onClose(); })} className="flex items-center gap-2 text-red-600 font-bold px-4 py-2 hover:bg-red-50 rounded-xl transition-all"><XCircle size={18} /> Anular</button>
            )}
          </div>
          <div className="flex gap-4">
            <button type="button" onClick={onClose} className="px-6 py-3 text-slate-400 font-bold uppercase tracking-widest text-xs">Cancelar</button>
            {formik.values.estatus === 'BORRADOR' && (
              <>
                <button onClick={() => formik.handleSubmit()} className="flex items-center gap-2 px-8 py-3 bg-white border-2 border-brand-900 text-brand-900 rounded-md font-black text-xs uppercase shadow-lg hover:bg-brand-50"><Save size={18} /> Guardar Borrador</button>
                <button onClick={() => { formik.setFieldValue('estatus', 'PENDIENTE'); formik.handleSubmit(); }} className="flex items-center gap-2 px-8 py-3 bg-brand-900 text-white rounded-md font-black text-xs uppercase shadow-xl hover:bg-brand-600"><Send size={18} /> Fijar</button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Error */}
      {errorModal.show && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-md">
          <div className="bg-white p-8 rounded-md shadow-2xl max-w-sm w-full text-center space-y-6">
            <div className="w-20 h-20 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto border-4 border-white shadow-xl">
              <AlertTriangle size={40} />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-black text-slate-800 uppercase italic">¡Error de Lectura!</h3>
              <p className="text-sm font-medium text-slate-500 leading-relaxed">{errorModal.message}</p>
            </div>
            <button
              onClick={() => setErrorModal({ show: false, message: '' })}
              className="w-full py-4 bg-brand-900 text-white rounded-2xl font-black text-xs uppercase shadow-lg shadow-brand-900/20 active:scale-95 transition-all"
            >
              Entendido
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>,
    document.body
  );
}

export default PickingManualModal;
