import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, PackageSearch, FileText, AlertTriangle, Save, Send, XCircle, ClipboardList, Info, MapPin } from 'lucide-react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { formato8Digitos, formatearFecha, getDiasRestantes } from '../../../util/workDate';
import { savePicking, getPickingById, anularPicking, getRequisicionesParaPicking, getInventarioParaPicking, findDraftPicking, getCommittedQuantities } from '../../../services/pickingService';
import { resolverCodigoBarras } from '../../../services/productoService';
import { QrCode, Search, Warehouse } from 'lucide-react';
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

function PickingModal({ initialData = null, empresaActiva, almacenSel, perfil, onClose, onUpdate }) {
  const isEdit = !!initialData;
  const [loading, setLoading] = useState(false);
  const [loadingMaestros, setLoadingMaestros] = useState(true);

  const [sucursales, setSucursales] = useState([]);
  const [comedores, setComedores] = useState([]);
  const [availableReqs, setAvailableReqs] = useState([]);
  const [selectedReqIds, setSelectedReqIds] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [consolidatedNeeds, setConsolidatedNeeds] = useState({});
  const [isAutoLoading, setIsAutoLoading] = useState(false);
  const [draftFound, setDraftFound] = useState(null);
  const [committedQuantities, setCommittedQuantities] = useState([]);
  const [presentacionesSeleccionadas, setPresentacionesSeleccionadas] = useState({}); // { id_lote: id_presentacion }

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

        // --- Lógica de Distribución de Demandas ---
        // 1. Obtener todos los ítems pendientes de las requisiciones seleccionadas
        const pendingItems = availableReqs
          .filter(r => selectedReqIds.includes(r.id))
          .flatMap(r => r.detalle)
          .filter(d => d.estatus_item !== 'ANULADO' && (Number(d.cantidad_solicitada) - Number(d.cantidad_despachada)) > 0.001)
          .map(d => ({
            ...d,
            pendiente: Number(d.cantidad_solicitada) - Number(d.cantidad_despachada)
          }));

        // 2. Crear los nuevos detalles "explotados" (vínculo 1 a 1 con la demanda)
        const explodedDetails = [];

        // Agrupamos los detalles por rubro para facilitar la distribución
        const pickedByRubro = {};
        detalles.forEach(d => {
          const rubroId = d.producto_info?.id_rubro;
          if (!pickedByRubro[rubroId]) pickedByRubro[rubroId] = [];
          pickedByRubro[rubroId].push({ ...d });
        });

        // Para cada rubro en las requisiciones, consumimos lo que se recogió (picking)
        Object.keys(pickedByRubro).forEach(rubroId => {
          // Filtramos los ítems de requisición para este rubro
          const reqItemsForRubro = pendingItems.filter(pi => pi.id_rubro === parseInt(rubroId));

          // Distribuimos el picking entre los ítems de requisición usando unidades ENTERAS (Math.ceil)
          reqItemsForRubro.forEach(reqItem => {
            let stillNeededKilos = reqItem.pendiente;

            for (const lotDetail of pickedByRubro[rubroId]) {
              if (stillNeededKilos <= 0) break;
              if (lotDetail.cantidad <= 0) continue;

              const factor = Number(lotDetail.factor || lotDetail.producto_info?.factor || 1);
              const tipoFrac = lotDetail.producto_info?.rubro?.tipo_fraccionamiento || 'SOLO_EJECUCION';

              // ¿Cuántas unidades (empaques) necesito?
              // Si es NUNCA o SOLO_EJECUCION, redondeamos al alza (Math.ceil)
              // Si es SIEMPRE, permitimos la fracción exacta.
              const neededUnits = (tipoFrac === 'SIEMPRE')
                ? (stillNeededKilos / factor)
                : Math.ceil(stillNeededKilos / factor);

              // Tomamos lo que necesitamos o lo que haya disponible en el lote
              const takenUnits = Math.min(neededUnits, lotDetail.cantidad);

              if (takenUnits > 0) {
                explodedDetails.push({
                  ...lotDetail,
                  cantidad: takenUnits,
                  id_requisicion_detalle: reqItem.id
                });

                lotDetail.cantidad -= takenUnits;
                stillNeededKilos -= (takenUnits * factor);
              }
            }
          });

          // Si sobra picking (excedente manual), lo agregamos sin id_requisicion_detalle
          pickedByRubro[rubroId].forEach(lotDetail => {
            if (lotDetail.cantidad > 0.0001) {
              explodedDetails.push({
                ...lotDetail,
                id_requisicion_detalle: null
              });
            }
          });
        });

        const cleanDetails = detalles.map(d => ({
          ...d,
          factor: d.factor || d.producto_info?.factor || 1,
          id_presentacion_logistica: d.id_presentacion_logistica || null,
          cantidad_presentacion: d.cantidad_presentacion ?? null
        }));

        await savePicking(rest, cleanDetails, perfil.id);
        onUpdate();
        onClose();
      } catch (error) {
        console.error('Error al guardar:', error);
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
      // Inicializar presentaciones desde los detalles cargados
      const initialPres = {};
      (full?.detalle || []).forEach(d => {
        if (d.id_presentacion_logistica) {
          const key = `${d.id_producto}_${d.lote || 'null'}`;
          initialPres[key] = d.id_presentacion_logistica;
        }
      });
      setPresentacionesSeleccionadas(initialPres);
      if (Array.isArray(full.id_requisicion)) {
        setSelectedReqIds(full.id_requisicion);
      }
      
      // Cargar inventario, requisiciones y cantidades comprometidas
      const [reqs, inv, committed] = await Promise.all([
        getRequisicionesParaPicking(empresaActiva.id, full.id_sucursal, full.id_comedor, almacenSel.id),
        getInventarioParaPicking(almacenSel.id),
        getCommittedQuantities(full.id_requisicion || [])
      ]);
      setAvailableReqs(reqs);
      setInventory(inv);
      setCommittedQuantities(committed);
    } catch (error) {
      console.error('Error al cargar picking:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDestinationChange = async (sucId, comId) => {
    if (!sucId || !comId) return;
    setIsAutoLoading(true);
    try {
      const draft = await findDraftPicking(empresaActiva.id, almacenSel.id, sucId, comId);
      if (draft) {
        setDraftFound(draft);
        setIsAutoLoading(false);
        return;
      }
      const [reqs, inv] = await Promise.all([
        getRequisicionesParaPicking(empresaActiva.id, sucId, comId, almacenSel.id),
        getInventarioParaPicking(almacenSel.id)
      ]);
      const allReqIds = reqs.map(r => r.id);
      const committed = await getCommittedQuantities(allReqIds);
      setAvailableReqs(reqs);
      setInventory(inv);
      setCommittedQuantities(committed);
      setSelectedReqIds(allReqIds);
      formik.setFieldValue('id_requisicion', allReqIds);
    } catch (error) {
      console.error('Error en búsqueda:', error);
    } finally {
      setIsAutoLoading(false);
    }
  };

  useEffect(() => {
    if (empresaActiva?.id) fetchMaestros();
    if (isEdit && initialData.id) {
      fetchPickingFull(initialData.id);
    }
  }, [empresaActiva?.id, initialData]);

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
    if (formik.values.id_sucursal && formik.values.id_comedor && !isEdit) {
      handleDestinationChange(formik.values.id_sucursal, formik.values.id_comedor);
    }
  }, [formik.values.id_sucursal, formik.values.id_comedor]);

  useEffect(() => {
    const tempNeeds = {};
    availableReqs
      .filter(r => selectedReqIds.includes(r.id))
      .forEach(r => {
        r.detalle.forEach(d => {
          if (d.estatus_item !== 'ANULADO' && (Number(d.cantidad_solicitada) - Number(d.cantidad_despachada)) > 0.001) {
            const rubroId = d.id_rubro;
            if (!tempNeeds[rubroId]) {
              tempNeeds[rubroId] = {
                nombre: d.rubro?.nombre,
                unidad: d.rubro?.unidad?.abreviatura,
                categoria: d.rubro?.categoria?.nombre,
                totalRequerido: 0
              };
            }
            tempNeeds[rubroId].totalRequerido += (Number(d.cantidad_solicitada) - Number(d.cantidad_despachada));
          }
        });
      });

    const finalNeeds = {};
    Object.keys(tempNeeds).forEach(rubroId => {
      const committedForRubro = committedQuantities
        .filter(cq => cq.producto?.id_rubro === Number(rubroId))
        .reduce((acc, curr) => acc + (Number(curr.cantidad) * Number(curr.producto?.factor || 1)), 0);

      const realNeed = Math.max(0, tempNeeds[rubroId].totalRequerido - committedForRubro);

      if (realNeed > 0) {
        finalNeeds[rubroId] = { ...tempNeeds[rubroId], totalRequerido: realNeed };
      }
    });
    setConsolidatedNeeds(finalNeeds);
  }, [selectedReqIds, availableReqs, committedQuantities]);
  const handleMatrixChange = (invItem, qty) => {
    const currentDetails = [...formik.values.detalles];
    const index = currentDetails.findIndex(d => d.id_producto === invItem.id_producto && d.lote === invItem.lote);

    const tipoFrac = invItem.producto?.rubro?.tipo_fraccionamiento || 'SOLO_EJECUCION';
    let val = parseFloat(qty) || 0;

    // Si no permite fraccionamiento en despacho, forzamos entero
    if (tipoFrac !== 'SIEMPRE') {
      val = Math.round(val);
    }

    if (val > invItem.cantidad_actual) val = invItem.cantidad_actual;

    const presId = presentacionesSeleccionadas[`${invItem.id_producto}_${invItem.lote || 'null'}`];
    const selectedPres = invItem.producto?.presentaciones?.find(p => p.id === presId) || invItem.producto?.presentaciones?.find(p => p.es_base);

    // Si ya existen múltiples líneas para este lote (split), las consolidamos en una sola para la edición manual simplificada
    const otherIndexes = currentDetails.map((d, i) => (d.id_producto === invItem.id_producto && d.lote === invItem.lote && i !== index) ? i : -1).filter(i => i !== -1);

    const existingDetail = index >= 0 ? currentDetails[index] : null;
    const currentCantPres = existingDetail ? existingDetail.cantidad_presentacion : null;

    // Decidir si removemos o guardamos
    const shouldRemove = val <= 0 && (!invItem.producto?.peso_variable || !currentCantPres || currentCantPres <= 0);

    if (shouldRemove) {
      if (index >= 0) currentDetails.splice(index, 1);
      if (otherIndexes.length > 0) {
        otherIndexes.sort((a, b) => b - a).forEach(idx => currentDetails.splice(idx, 1));
      }
    } else {
      const detail = {
        id_producto: invItem.id_producto,
        cantidad: val,
        lote: invItem.lote,
        fecha_vencimiento: invItem.fecha_vencimiento,
        producto_info: invItem.producto,
        factor: selectedPres?.factor || 1,
        id_presentacion_logistica: selectedPres?.id || null,
        cantidad_presentacion: existingDetail ? existingDetail.cantidad_presentacion : null,
        costo_unidad_base: invItem.costo_unidad_base
      };

      if (index >= 0) {
        currentDetails[index] = detail;
      } else {
        currentDetails.push(detail);
      }

      // Eliminar las otras líneas duplicadas para este lote
      if (otherIndexes.length > 0) {
        otherIndexes.sort((a, b) => b - a).forEach(idx => currentDetails.splice(idx, 1));
      }
    }
    formik.setFieldValue('detalles', currentDetails);
  };

  const handlePresentationChange = (invItem, presId) => {
    const key = `${invItem.id_producto}_${invItem.lote || 'null'}`;
    setPresentacionesSeleccionadas(prev => ({ ...prev, [key]: presId }));

    // Si ya hay una cantidad asignada, actualizar su factor inmediatamente
    const currentDetails = [...formik.values.detalles];
    const index = currentDetails.findIndex(d => d.id_producto === invItem.id_producto && d.lote === invItem.lote);

    if (index >= 0) {
      const selectedPres = invItem.producto?.presentaciones?.find(p => p.id === presId);
      if (selectedPres) {
        currentDetails[index] = {
          ...currentDetails[index],
          factor: selectedPres.factor,
          id_presentacion_logistica: selectedPres.id
        };
        formik.setFieldValue('detalles', currentDetails);
      }
    }
  };

  // Actualiza el contador de empaques físicos (solo para peso variable)
  const handlePresentacionCountChange = (invItem, cantPres) => {
    const currentDetails = [...formik.values.detalles];
    const index = currentDetails.findIndex(d =>
      d.id_producto === invItem.id_producto &&
      d.lote === invItem.lote
    );

    const existingDetail = index >= 0 ? currentDetails[index] : null;
    const currentCantBase = existingDetail ? parseFloat(existingDetail.cantidad) || 0 : 0;

    if (cantPres === '' || parseFloat(cantPres) <= 0) {
      // Si se limpia el contador de empaques, verificamos si también la cantidad base es 0
      if (currentCantBase <= 0) {
        if (index >= 0) {
          currentDetails.splice(index, 1);
          formik.setFieldValue('detalles', currentDetails);
        }
      } else {
        if (index >= 0) {
          currentDetails[index] = { ...currentDetails[index], cantidad_presentacion: null };
          formik.setFieldValue('detalles', currentDetails);
        }
      }
      return;
    }

    let val = parseFloat(cantPres) || 0;
    val = Math.max(0, Math.round(val));

    const stockMaxPres = invItem.cantidad_presentacion || 0;
    if (val > stockMaxPres) val = stockMaxPres;

    if (index >= 0) {
      currentDetails[index] = { ...currentDetails[index], cantidad_presentacion: val };
    } else {
      const presId = presentacionesSeleccionadas[`${invItem.id_producto}_${invItem.lote || 'null'}`];
      const selectedPres = invItem.producto?.presentaciones?.find(p => p.id === presId) || invItem.producto?.presentaciones?.find(p => p.es_base);
      currentDetails.push({
        id_producto: invItem.id_producto,
        cantidad: 0,
        lote: invItem.lote,
        fecha_vencimiento: invItem.fecha_vencimiento,
        producto_info: invItem.producto,
        factor: selectedPres?.factor || 1,
        id_presentacion_logistica: selectedPres?.id || null,
        cantidad_presentacion: val,
        costo_unidad_base: invItem.costo_unidad_base
      });
    }
    formik.setFieldValue('detalles', currentDetails);
  };

  const handleBarcodeScan = async (code) => {
    try {
      setLoading(true);
      const res = await resolverCodigoBarras(empresaActiva.id, code);
      if (res) {
        // Buscar el producto en el inventario cargado
        // Priorizar el lote más antiguo (FIFO) que coincida con el producto
        const invMatch = inventory.find(inv => inv.id_producto === res.id_producto);

        if (invMatch) {
          const currentQty = formik.values.detalles.find(d => d.id_producto === invMatch.id_producto && d.lote === invMatch.lote)?.cantidad || 0;
          handleMatrixChange(invMatch, currentQty + 1);
          // Opcional: Feedback visual de éxito
        } else {
          setErrorModal({ show: true, message: `El producto "${res.rubro}" no tiene stock disponible en este almacén.` });
        }
      } else {
        setErrorModal({ show: true, message: `Código "${code}" no reconocido.` });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setBarcodeSearch('');
    }
  };

  const [barcodeSearch, setBarcodeSearch] = useState('');
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
            <div className="w-12 h-12 rounded-md bg-brand-50 text-brand-600 flex items-center justify-center border border-brand-100 shadow-inner">
              <PackageSearch size={22} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-800 tracking-tight">
                {formik.values.id ? `Picking #${formato8Digitos(formik.values.id)}` : 'Nuevo Picking'}
              </h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic mt-1">Consolidación de Despacho</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400"><X size={22} /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-2 bg-gray-50/30">
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
              <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Sucursal</label>
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
              <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Comedor</label>
              <select className="w-full h-12 bg-gray-50 rounded-xl border border-slate-100 px-4 font-bold disabled:opacity-50" value={formik.values.id_comedor} disabled={isEdit} onChange={formik.handleChange} name="id_comedor">
                <option value="">Seleccionar...</option>
                {comedores.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
          </div>

          {/* Buscador / Escáner */}
          <div className="bg-white px-8 py-4 rounded-md border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-brand-50 rounded-xl text-brand-600">
              <QrCode size={20} />
            </div>
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Escanee un código de barras o escriba para buscar..."
                className="w-full h-12 bg-gray-50 rounded-xl px-12 font-bold outline-none focus:ring-4 focus:ring-brand-accent/5 focus:border-brand-accent transition-all"
                value={barcodeSearch}
                onChange={(e) => setBarcodeSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleBarcodeScan(barcodeSearch.trim());
                  }
                }}
              />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
            </div>
            <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">
              Modo Escáner Activo
            </div>
          </div>

          {/* Requisiciones */}
          {availableReqs.length > 0 && (
            <div className="bg-white px-6 py-1 rounded-md border border-slate-100 shadow-sm space-y-4 flex justify-start items-center">
              <div className="flex items-center gap-2 text-slate-400 border-b border-slate-50">
                <ClipboardList size={18} />
                <span className="text-[10px] font-black uppercase tracking-widest">Requisiciones Pendientes</span>
              </div>
              <div className="ml-5 flex flex-wrap gap-3">
                {availableReqs.map(req => (
                  <label key={req.id} className={`px-4 py-2 rounded-xl border cursor-pointer transition-all ${selectedReqIds.includes(req.id) ? 'bg-brand-50 border-brand-200 text-brand-700' : 'bg-gray-50 border-slate-100 text-slate-400'}`}>
                    <input type="checkbox" className="hidden" checked={selectedReqIds.includes(req.id)} onChange={() => {
                      const newIds = selectedReqIds.includes(req.id) ? selectedReqIds.filter(id => id !== req.id) : [...selectedReqIds, req.id];
                      setSelectedReqIds(newIds);
                      formik.setFieldValue('id_requisicion', newIds);
                    }} />
                    <span className="text-xs font-black uppercase">REQ: {formato8Digitos(req.id)}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Matriz */}
          <div className="space-y-4">
            <div className="flex items-center gap-6 px-8 py-2 bg-slate-100/50 rounded-xl">
              <div className="w-[20%] text-[10px] font-black uppercase text-slate-400">Rubro</div>
              <div className="w-[10%] text-[10px] font-black uppercase text-slate-400 text-center">Requerido</div>
              <div className="flex-1 text-[10px] font-black uppercase text-slate-400">Detalles de Inventario</div>
              <div className="w-[15%] text-[10px] font-black uppercase text-slate-400 text-right">Total Asignado</div>
            </div>

            {Object.entries(consolidatedNeeds).map(([rubroId, need]) => {
              const rubroInv = inventory.filter(inv => inv.producto?.id_rubro === parseInt(rubroId));
              const { piezas, totalUnidad } = getPickedTotalsForRubro(rubroId);
              return (
                <div key={rubroId} className="flex items-center gap-6 bg-white rounded-md border border-slate-300 px-6 py-1 shadow-sm">
                  <div className="w-[20%]">
                    <h4 className="text-base font-black text-slate-800 uppercase leading-tight">{need.nombre}</h4>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">{need.categoria} | {need.unidad}</span>
                  </div>
                  <div className="w-[10%] text-center border-r border-slate-50">
                    <span className="text-2xl font-black text-slate-700">{parseFloat(need.totalRequerido.toFixed(3))}</span>
                    <p className="text-[9px] font-black text-slate-300 uppercase">{need.unidad}</p>
                  </div>
                  <div className="flex-1 space-y-1">
                    {rubroInv.map(invItem => {
                      const matchingDetails = formik.values.detalles.filter(d => d.id_producto === invItem.id_producto && d.lote === invItem.lote);
                      const totalQty = matchingDetails.reduce((acc, curr) => acc + (Number(curr.cantidad) || 0), 0);
                      return (
                        <div key={`${invItem.id_producto}-${invItem.lote}`} className="flex items-center gap-4 py-1 border-b border-slate-300 last:border-0">
                          <div className="flex-1">
                            {(() => {
                              const key = `${invItem.id_producto}_${invItem.lote || 'null'}`;
                              const presSelId = presentacionesSeleccionadas[key];
                              const presSel = invItem.producto?.presentaciones?.find(p => p.id === presSelId) || invItem.producto?.presentaciones?.find(p => p.es_base);

                              return (
                                <div className="flex flex-col gap-1.5">
                                  <p className="text-[11px] font-black text-slate-600 uppercase leading-tight">
                                    {invItem.producto?.marca?.nombre} {invItem.producto?.variedad}
                                  </p>

                                  <div className="flex items-center gap-3 text-[9px] font-bold text-slate-400 italic">
                                    {invItem.lote !== null && <span>LOTE: {invItem.lote}</span>}
                                    {getExpirationBadge(invItem.fecha_vencimiento)}
                                    {invItem.ubicacion?.codigo && (
                                      <span className="flex items-center gap-1 bg-brand-50 text-brand-600 px-1.5 py-0.5 rounded border border-brand-100 font-black not-italic">
                                        <MapPin size={8} /> {invItem.ubicacion.codigo}
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex flex-col gap-2 px-4 py-1 mt-1">
                                    {(() => {
                                      const basePres = invItem.producto?.presentaciones?.find(bp => bp.es_base);
                                      const baseFactor = basePres?.factor || 1;
                                      const baseNombre = basePres?.presentacion?.nombre || 'UND';

                                      return invItem.producto?.presentaciones?.sort((a, b) => a.factor - b.factor).map(p => {
                                        const factorRelativo = p.factor / baseFactor;
                                        return (
                                          <button
                                            key={p.id}
                                            type="button"
                                            onClick={() => handlePresentationChange(invItem, p.id)}
                                            className={`w-full items-center justify-center px-3 py-1 rounded-lg text-[8px] font-black uppercase transition-all border-2 flex items-center gap-1 w-fit ${(presSel?.id === p.id)
                                              ? 'bg-brand-900 border-brand-900 text-white shadow-sm'
                                              : 'bg-white border-slate-100 text-slate-400 hover:border-brand-200'
                                              }`}
                                          >
                                            {p.presentacion?.nombre}
                                            <span className="opacity-60 text-[7px]">
                                              {p.es_base
                                                ? `${p.factor % 1 === 0 ? p.factor : parseFloat(p.factor.toFixed(3))} ${need.unidad}`
                                                : `${factorRelativo % 1 === 0 ? factorRelativo : parseFloat(factorRelativo.toFixed(1))} ${baseNombre}`
                                              }
                                            </span>
                                          </button>
                                        );
                                      });
                                    })()}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                          <div className="w-40 flex justify-end">
                            {(() => {
                              const key = `${invItem.id_producto}_${invItem.lote || 'null'}`;
                              const presSelId = presentacionesSeleccionadas[key];
                              const presSel = invItem.producto?.presentaciones?.find(p => p.id === presSelId) || invItem.producto?.presentaciones?.find(p => p.es_base);
                              const factor = presSel?.factor || 1;
                              const stockEnPres = invItem.producto?.peso_variable
                                ? (invItem.cantidad_presentacion || 0)
                                : Math.round((invItem.cantidad_actual / factor) * 100) / 100;

                              return (
                                <span className="flex items-center gap-2 text-[10px] font-black text-slate-400">
                                  STOCK:
                                  <div className="flex flex-col justify-center items-end">
                                    <span className={`text-[10px] font-black flex items-center gap-1 ${stockEnPres < 0.001 ? 'text-red-500' : 'text-brand-600'}`}>
                                      {stockEnPres % 1 === 0 ? stockEnPres : parseFloat(stockEnPres.toFixed(3))}
                                      <span className='text-[7px] uppercase'>{presSel?.presentacion?.nombre || 'UND'}</span>
                                    </span>
                                    <span className="text-[8px] font-bold text-slate-600 flex items-center gap-1 italic">
                                      {parseFloat((invItem.cantidad_actual * (invItem.producto?.presentaciones?.find(p => p.es_base)?.factor || 1)).toFixed(3))}
                                      <span>{need.unidad}</span>
                                    </span>
                                  </div>
                                </span>
                              );
                            })()}
                          </div>
                          <div className="w-[15%] flex flex-col items-center gap-1">
                            {invItem.producto?.peso_variable ? (
                              // Modo Peso Variable: KG de báscula + conteo de empaques
                              <div className="flex flex-col gap-1 w-full">
                                <input
                                  type="number"
                                  step="0.001"
                                  className="w-full h-10 bg-emerald-50 border border-emerald-200 rounded-xl text-center font-black text-emerald-900 focus:border-emerald-500 transition-all"
                                  value={totalQty || ''}
                                  onChange={e => handleMatrixChange(invItem, e.target.value)}
                                  placeholder="KG"
                                />
                                <span className="text-[7px] font-black text-emerald-600 uppercase tracking-tighter text-center">KG (BÁSCULA)</span>
                                <input
                                  type="number"
                                  step="1"
                                  min="0"
                                  className="w-full h-10 bg-blue-50 border border-blue-200 rounded-xl text-center font-black text-blue-900 focus:border-blue-400 transition-all"
                                  value={(
                                    formik.values.detalles.find(d => d.id_producto === invItem.id_producto && d.lote === invItem.lote)?.cantidad_presentacion || ''
                                  )}
                                  onChange={e => handlePresentacionCountChange(invItem, e.target.value)}
                                  placeholder="# Empaques"
                                />
                                <span className="text-[7px] font-black text-blue-600 uppercase tracking-tighter text-center"># EMPAQUES</span>
                              </div>
                            ) : (
                              // Modo Normal: una sola entrada
                              <>
                                <input
                                  type="number"
                                  step={invItem.producto?.rubro?.tipo_fraccionamiento === 'SIEMPRE' ? "0.01" : "1"}
                                  className={`w-full h-10 bg-gray-50 border rounded-xl text-center font-black transition-all ${invItem.producto?.rubro?.tipo_fraccionamiento === 'SIEMPRE'
                                    ? 'border-emerald-100 focus:border-emerald-500'
                                    : 'border-slate-100 focus:border-brand-500'
                                  }`}
                                  value={totalQty || ''}
                                  onChange={e => handleMatrixChange(invItem, e.target.value)}
                                  placeholder="0"
                                />
                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">
                                  {(() => {
                                    const key = `${invItem.id_producto}_${invItem.lote || 'null'}`;
                                    const presSelId = presentacionesSeleccionadas[key];
                                    const presSel = invItem.producto?.presentaciones?.find(p => p.id === presSelId) || invItem.producto?.presentaciones?.find(p => p.es_base);
                                    return `ASIGNAR ${presSel?.presentacion?.nombre || 'UND'}`;
                                  })()}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="w-[15%] text-right border-l border-slate-50 pl-4">
                    <span className="text-2xl font-black text-brand-900">{parseFloat(totalUnidad.toFixed(3))}</span>
                    <p className="text-[9px] font-black text-slate-300 uppercase">{need.unidad}</p>
                  </div>
                </div>
              );
            })}
          </div>

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

export default PickingModal;
