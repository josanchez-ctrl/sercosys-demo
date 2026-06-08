import React, { useState, useEffect, useMemo, useRef, Fragment } from 'react';
import { toast } from 'sonner';
import { createPortal } from 'react-dom';
import { X, ArrowRightFromLine, Package, QrCode, FileText, AlertTriangle, Save, Send, CheckCircle2, XCircle, Search, Trash2, Calendar, Hash, Truck, Warehouse, DollarSign, ShieldCheck } from 'lucide-react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { formato8Digitos, formatearFecha, formato5Digitos } from '../../../util/workDate';
import { getProveedores } from '../../../services/proveedorService';
import { getProductos, resolverCodigoBarras } from '../../../services/productoService';
import { saveCotejo, getCotejoById, updateCotejoStatus, procesarCotejo, anularCotejo, getInventarioByCotejo } from '../../../services/cotejoService';
import { getMonedas } from '../../../services/monedasService';
import { getTasa } from '../../../services/tasaDiaService';
import { getValidaciones } from '../../../services/validacionesService';
import EtiquetasTrackingRecepcionModal from '../../../components/modals/EtiquetasTrackingRecepcionModal';
import { getDecimalPlaces } from '../../../util/workDecimales';

const validationSchema = Yup.object({
    id_proveedor: Yup.string().required('El proveedor es obligatorio'),
    id_moneda: Yup.string().required('La moneda es obligatoria'),
    tipo_doc_recepcion: Yup.string().required('El tipo de documento de recepción es obligatorio'),
    nro_doc_recepcion: Yup.string().required('El nro de documento de recepción es obligatorio'),
    fecha_doc_recepcion: Yup.date().required('La fecha de recepción es obligatoria'),
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

export default function RecepcionModal({ initialData = null, empresaActiva, almacenSel, perfil, onClose, onUpdate }) {
    const isEdit = !!initialData;
    const [loading, setLoading] = useState(false);
    const [loadingMaestros, setLoadingMaestros] = useState(true);

    const [proveedores, setProveedores] = useState([]);
    const [productos, setProductos] = useState([]);
    const [monedas, setMonedas] = useState([]);
    const [tasaGlobal, setTasaGlobal] = useState(null);
    const [validaciones, setValidaciones] = useState([]);
    const [showAnularModal, setShowAnularModal] = useState(false);
    const [showEtiquetas, setShowEtiquetas] = useState(false);
    const [dataEtiquetas, setDataEtiquetas] = useState([]);
    const [motivoAnulacion, setMotivoAnulacion] = useState('');
    const searchInputRef = useRef(null);

    const [productSearch, setProductSearch] = useState('');
    const [showResults, setShowResults] = useState(false);
    const [errorModal, setErrorModal] = useState({ show: false, message: '' });
    const [showConfirmProcesar, setShowConfirmProcesar] = useState(false);
    const [procesadoOk, setProcesadoOk] = useState(false);
    const [inventarioGenerado, setInventarioGenerado] = useState([]);

    const executeSave = async (values) => {
        setLoading(true);
        try {
            const { detalles, ...rest } = values;
            const header = {
                ...rest,
                id_empresa: empresaActiva.id,
                id_almacen: almacenSel?.id
            };

             const details = (detalles || []).map(d => {
                const esPesoVariable = productos.find(p => p.id === d.id_producto)?.peso_variable === true || d.producto_info?.peso_variable === true;

                // El costo base es el costo por unidad física.
                // Si es peso variable, el costo ingresado ya es por Kilo (unidad base).
                let costoBaseOriginal = esPesoVariable
                    ? (d.costo_unitario || 0)
                    : (d.costo_unitario || 0) / (d.factor || 1);

                // Conversión de moneda a Dólar (Base del sistema)
                let costoBase = costoBaseOriginal;
                if (values.id_moneda === 2) costoBase = costoBase / (values.tasa_cambio || 1);
                if (values.id_moneda === 3) costoBase = (costoBase * (tasaGlobal?.tasa_euro || 1)) / (tasaGlobal?.tasa_dolar || 1);

                // Si es peso variable, el costo por presentación (por bulto) en la DB es costo por KG * factor
                let costoPorPresentacion = esPesoVariable
                    ? (d.costo_unitario || 0) * (d.factor || 1)
                    : (d.costo_unitario || 0);

                return {
                    id_producto: d.id_producto,
                    id_almacen: d.id_almacen || almacenSel?.id,
                    id_presentacion_logistica: d.id_presentacion_logistica || null,
                    factor: d.factor || 1,
                    cantidad: d.cantidad,
                    costo_unitario: costoPorPresentacion,
                    costo_unitario_base: costoBase || 0,
                    lote: d.lote || null,
                    fecha_vencimiento: d.fecha_vencimiento || null,
                    id_validacion_color: d.id_validacion_color,
                    id_validacion_olor: d.id_validacion_olor,
                    id_validacion_textura: d.id_validacion_textura
                };
            });

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
            id_moneda: 1,
            tasa_cambio: 1,
            tipo_doc_recepcion: 'NOTA_ENTREGA',
            nro_doc_recepcion: '',
            fecha_doc_recepcion: '',
            observaciones: '',
            estatus: 'BORRADOR',
            detalles: []
        },
        validationSchema,
        validateOnChange: false,
        validateOnBlur: true,
        onSubmit: executeSave
    });

    const fetchMaestros = async () => {
        setLoadingMaestros(true);
        try {
            const [proRes, prdRes, monRes, tasaRes, valRes] = await Promise.all([
                getProveedores(empresaActiva.id),
                getProductos(empresaActiva.id, almacenSel?.id),
                getMonedas(),
                getTasa(),
                getValidaciones(),
            ]);

            setProveedores(proRes || []);
            setProductos(prdRes || []);
            setMonedas(monRes || []);
            setValidaciones(valRes || []);

            if (tasaRes) {
                setTasaGlobal(tasaRes);
                if (!isEdit) {
                    formik.setFieldValue('tasa_cambio', tasaRes.tasa_dolar);
                }
            }
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
                    const esPesoVariable = d.almacen_productos?.peso_variable === true;
                    return {
                        ...d,
                        costo_unitario: esPesoVariable
                            ? (Number(d.costo_unitario) / Number(d.factor || 1))
                            : Number(d.costo_unitario),
                        id_validacion_color: d.id_validacion_color || 1,
                        id_validacion_olor: d.id_validacion_olor || 1,
                        id_validacion_textura: d.id_validacion_textura || 1,
                        producto_info: d.almacen_productos
                    };
                })
            });
        } catch (error) {
            console.error('Error al cargar cotejo completo:', error);
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
        // Foco inicial
        setTimeout(() => searchInputRef.current?.focus(), 500);
    }, [empresaActiva?.id, initialData, almacenSel?.id]);


    const filteredProducts = useMemo(() => {
        if (!productSearch) return [];
        const search = productSearch.toLowerCase().trim();
        const searchTerms = search.split(' ').filter(t => t.length > 0);
        const results = [];

        productos
            .forEach(p => {
                // 1. Intentar por códigos de barras en logística
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

                // 2. Búsqueda por texto (Rubro, Marca, Variedad)
                const rubroName = p.rubro?.nombre?.toLowerCase() || '';
                const marcaName = p.marca?.nombre?.toLowerCase() || '';
                const variedad = p.variedad?.toLowerCase() || '';

                const matchesBasic = searchTerms.every(term =>
                    rubroName.includes(term) ||
                    marcaName.includes(term) ||
                    variedad.includes(term)
                );

                if (matchesBasic) {
                    p.logistica?.forEach(l => {
                        const uid = `prod-log-${l.id}`;
                        // Evitar duplicados si ya se agregó por código
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

        return results.slice(0, 25);
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
                    const currentQty = Number(formik.values.detalles[index].cantidad) || 0;
                    formik.setFieldValue(`detalles.${index}.cantidad`, currentQty + 1);
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
                    const currentQty = Number(formik.values.detalles[emptyLotIndex].cantidad) || 0;
                    formik.setFieldValue(`detalles.${emptyLotIndex}.cantidad`, currentQty + 1);
                    setTimeout(() => searchInputRef.current?.focus(), 100);
                    return;
                }
            }
        }

        const newItem = {
            id_producto: p.id,
            id_almacen: p.rubro?.categoria?.id_almacen || almacenSel?.id,
            cantidad: 1,
            costo_unitario: 0,
            costo_unitario_base: 0,
            lote: '',
            fecha_vencimiento: '',
            id_validacion_color: 1,
            id_validacion_olor: 1,
            id_validacion_textura: 1,
            id_presentacion_logistica: p.id_presentacion_logistica || null,
            factor: p.specificFactor || p.factor || 1,
            producto_info: p,
            logistica: {
                id: p.id_presentacion_logistica,
                codigo_barras: p.matchedBarcode,
                presentacion: p.specificPresentation,
                cantidad_referencia: p.cantidad_referencia,
                referencia: p.referencia
            }
        };

        formik.setFieldValue('detalles', [...formik.values.detalles, newItem]);
        setTimeout(() => searchInputRef.current?.focus(), 100);
    };

    const removeProduct = (index) => {
        const newDetails = [...formik.values.detalles];
        newDetails.splice(index, 1);
        formik.setFieldValue('detalles', newDetails);
    };

    const handleSaveAction = async (targetEst) => {
        const finalValues = { ...formik.values, estatus: targetEst };

        try {
            // 1. Validamos directamente con Yup pasando el estatus y la bandera isProcesar
            await validationSchema.validate(finalValues, {
                abortEarly: false,
                context: { estatus: targetEst, isProcesar: false }
            });
        } catch (err) {
            console.warn('Errores de validación:', err.inner);

            const errorPaths = err.inner.map(e => e.path);
            const isHeaderError = errorPaths.some(p => !p.startsWith('detalles'));

            // Marcar tocados
            const touchedFields = Object.keys(finalValues)
                .filter(k => k !== 'detalles')
                .reduce((acc, k) => ({ ...acc, [k]: true }), {
                    detalles: (finalValues.detalles || []).map(() => ({
                        cantidad: true, costo_unitario: true, lote: true, fecha_vencimiento: true
                    }))
                });

            formik.setTouched(touchedFields);

            let msg = isHeaderError
                ? 'Faltan datos obligatorios en la cabecera (Proveedor, Documento, etc.).'
                : `Hay campos pendientes en los productos para el estado ${targetEst === 'PENDIENTE' ? 'FINALIZADO' : 'BORRADOR'}. Verifique los campos marcados en rojo.`;

            setErrorModal({ show: true, message: msg });
            return;
        }

        // 2. Si es válido, guardamos
        await executeSave(finalValues);
    };

    const handleProcesar = async () => {
        const finalValues = { ...formik.values, estatus: 'PENDIENTE' };
        try {
            await validationSchema.validate(finalValues, {
                abortEarly: false,
                context: { estatus: 'PENDIENTE', isProcesar: true }
            });
        } catch (err) {
            console.warn('Errores al procesar:', err.inner);
            const touchedFields = Object.keys(finalValues)
                .filter(key => key !== 'detalles')
                .reduce((acc, key) => ({ ...acc, [key]: true }), {
                    detalles: (finalValues.detalles || []).map(() => ({
                        cantidad: true, costo_unitario: true, lote: true, fecha_vencimiento: true
                    }))
                });
            formik.setTouched(touchedFields);
            setErrorModal({
                show: true,
                message: 'No se puede procesar: Faltan datos obligatorios o hay errores en los campos marcados en rojo.'
            });
            return;
        }
        //console.log('Procesando cotejo', formik.values.id);
        setShowConfirmProcesar(true);
    };

    const executeProcesar = async () => {
        setShowConfirmProcesar(false);
        setLoading(true);
        try {
             const mappedDetails = (formik.values.detalles || []).map(d => {
                const esPesoVariable = productos.find(p => p.id === d.id_producto)?.peso_variable === true || d.producto_info?.peso_variable === true;
                const costoPorPresentacion = esPesoVariable
                    ? (d.costo_unitario || 0) * (d.factor || 1)
                    : (d.costo_unitario || 0);

                return {
                    id_producto: d.id_producto,
                    id_almacen: d.id_almacen || almacenSel?.id,
                    id_presentacion_logistica: d.id_presentacion_logistica || null,
                    factor: d.factor || 1,
                    cantidad: d.cantidad,
                    costo_unitario: costoPorPresentacion,
                    lote: d.lote || null,
                    fecha_vencimiento: d.fecha_vencimiento || null,
                    id_validacion_color: d.id_validacion_color,
                    id_validacion_olor: d.id_validacion_olor,
                    id_validacion_textura: d.id_validacion_textura
                };
            });

            // Forzamos un guardado previo para asegurar que los costos base estén sincronizados en la DB
            await saveCotejo(formik.values, mappedDetails, perfil.id);

            // Ahora sí procesamos
            await procesarCotejo(formik.values.id, perfil.id);

            // Obtener los datos del inventario generado para las etiquetas
            // Esto es asíncrono pero no bloquea el cierre si el usuario decide cerrar
            try {
                const { data: invData } = await getInventarioByCotejo(formik.values.id);
                setInventarioGenerado(invData || []);
            } catch (err) {
                console.error("Error obteniendo tracking ids:", err);
            }

            setProcesadoOk(true);
            onUpdate();
            // onClose(); // No cerramos para permitir imprimir
        } catch (error) {
            console.error('Error al procesar:', error);
            alert(error.message || 'Error al procesar el cotejo');
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

    const handleAnular = async () => {
        if (!motivoAnulacion || motivoAnulacion.length < 10) return;
        setLoading(true);
        try {
            await anularCotejo(formik.values.id, perfil.id, motivoAnulacion);
            onUpdate();
            onClose();
        } catch (error) {
            console.error('Error al anular:', error);
            alert(error.message || 'Error al anular el cotejo');
        } finally {
            setLoading(false);
            setShowAnularModal(false);
        }
    };

    const isBorrador = formik.values.estatus === 'BORRADOR';
    const isPendiente = formik.values.estatus === 'PENDIENTE';
    const isProcesado = formik.values.estatus === 'PROCESADO';
    const isAnulado = formik.values.estatus === 'ANULADO';
    const isFinalizado = isProcesado || isAnulado;

    // Permisos dinámicos en Recepción
    const canEditQuantities = isBorrador;
    const canEditPrices = isPendiente;
    const canAddProducts = isBorrador; // Se permiten agregar en borrador vía escáner o buscador

    return createPortal(
        <Fragment>
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 animate-in fade-in duration-300" onClick={onClose}>
                <div className="bg-white w-full h-full max-w-[95vw] max-h-[95vh] flex flex-col overflow-hidden rounded-md shadow-2xl animate-in zoom-in-95 duration-300 border border-white/20" onClick={(e) => e.stopPropagation()}>

                    {/* Header */}
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
                                        Recepción de Mercancía
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

                    {/* Body */}
                    <div className="flex-1 overflow-hidden flex flex-col bg-gray-50/30">
                        <div className="flex-1 overflow-y-auto px-8 py-1 space-y-2 custom-scrollbar">

                            {/* Banner de Tasas Globales */}
                            {(isPendiente || isFinalizado) && tasaGlobal && (
                                <div className="lg:col-span-12 bg-amber-50/50 border border-amber-100 rounded-md p-4 flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-500">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-amber-100 rounded-lg text-amber-700">
                                            <DollarSign size={16} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-amber-800 uppercase tracking-widest">Tasas de Referencia Centralizadas</p>
                                            <p className="text-[9px] font-bold text-amber-600 italic flex items-center gap-2">Última actualización: <span className="font-black text-black text-sm">{formatearFecha(tasaGlobal.fecha)}</span></p>
                                        </div>
                                    </div>
                                    <div className="flex gap-8">
                                        <div className="flex flex-col items-end">
                                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Dólar Oficial (Bs/$)</span>
                                            <span className="text-sm font-black text-amber-900">{Number(tasaGlobal.tasa_dolar).toFixed(2)} Bs</span>
                                        </div>
                                        <div className="flex flex-col items-end pr-4">
                                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Euro Oficial (Bs/€)</span>
                                            <span className="text-sm font-black text-amber-900">{Number(tasaGlobal.tasa_euro).toFixed(2)} Bs</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Cabecera del Formulario */}
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                                {/* Proveedor */}
                                <div className="lg:col-span-5 bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex flex-col justify-center">
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

                                {/* Datos del Documento */}
                                <div className="lg:col-span-7 bg-white p-6 rounded-[2rem] border border-brand-100 shadow-sm relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-3 opacity-5">
                                        <ArrowRightFromLine size={40} />
                                    </div>
                                    <label className="text-[10px] font-black text-brand-600 uppercase tracking-widest ml-1 flex items-center gap-2 mb-4">
                                        <ArrowRightFromLine size={12} /> Información del Documento
                                    </label>
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter ml-1">Moneda</label>
                                            <select
                                                {...formik.getFieldProps('id_moneda')}
                                                disabled={!isBorrador && !isPendiente}
                                                onChange={(e) => {
                                                    const val = parseInt(e.target.value);
                                                    formik.setFieldValue('id_moneda', val);
                                                    // Si selecciona Dólar, tasa es 1
                                                    if (val === 1) formik.setFieldValue('tasa_cambio', 1);
                                                    // Si selecciona Bs, usar tasa_dolar
                                                    if (val === 2) formik.setFieldValue('tasa_cambio', tasaGlobal?.tasa_dolar || 1);
                                                    // Si selecciona Euro, usar tasa_euro (para mostrar en cabecera)
                                                    if (val === 3) formik.setFieldValue('tasa_cambio', tasaGlobal?.tasa_euro || 1);
                                                }}
                                                className={`w-full px-3 py-2 rounded-xl border border-gray-100 bg-gray-50/20 text-xs font-black text-slate-700 outline-none focus:ring-2 focus:ring-brand-accent/20 transition-all
                          ${(formik.errors.id_moneda && formik.touched.id_moneda)
                                                        ? 'border-red-500 text-red-700 focus:ring-red-200 bg-red-50/30'
                                                        : 'border-gray-100 text-slate-700 focus:ring-brand-accent/20 focus:border-brand-accent'}`}

                                            >
                                                {monedas.map(m => <option key={m.id} value={m.id} title={m.nombre}>{m.simbolo}</option>)}
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter ml-1">Tipo Doc.</label>
                                            <select
                                                {...formik.getFieldProps('tipo_doc_recepcion')}
                                                disabled={!isBorrador && !isPendiente}
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
                                                disabled={!isBorrador && !isPendiente}
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
                                                disabled={!isBorrador && !isPendiente}
                                                className={`w-full px-3 py-2 rounded-xl border border-gray-100 bg-gray-50/20 text-xs font-black text-slate-700 outline-none focus:ring-2 focus:ring-brand-accent/20 transition-all
                          ${(formik.errors.fecha_doc_recepcion && formik.touched.fecha_doc_recepcion)
                                                        ? 'border-red-500 text-red-700 focus:ring-red-200 bg-red-50/30'
                                                        : 'border-gray-100 text-slate-700 focus:ring-brand-accent/20 focus:border-brand-accent'}`}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Buscador de Productos (Solo en Borrador) */}
                            {canAddProducts && (
                                <div className="relative group/search max-w-2xl mx-auto">
                                    <div className={`flex items-center bg-white border border-gray-100 rounded-[1.5rem] shadow-xl overflow-hidden focus-within:ring-4 focus-within:ring-brand-accent/10 focus-within:border-brand-accent transition-all ${showResults ? 'rounded-b-none border-b-transparent shadow-none' : ''}`}>
                                        <div className="pl-6 text-brand-900">
                                            <Search size={20} />
                                        </div>
                                        <input
                                            ref={searchInputRef}
                                            type="text"
                                            value={productSearch}
                                            onFocus={() => setShowResults(true)}
                                            onKeyDown={async (e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    const code = productSearch.trim();
                                                    if (!code) return;

                                                    // 1. Intentar resolver por Código de Barras (Prioridad)
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
                                                                presentacion: { nombre: res.nombre_presentacion },
                                                                maneja_lote: res.maneja_lote,
                                                                peso_variable: res.peso_variable
                                                            });
                                                            return;
                                                        }
                                                    } catch (err) {
                                                        console.error('Error al resolver código:', err);
                                                    }

                                                    // 2. Si no es código, usar primer resultado de búsqueda tradicional
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
                                            placeholder="Escriba nombre, marca o ID del producto..."
                                            className="flex-1 px-4 py-5 text-sm font-bold text-slate-800 outline-none placeholder:text-slate-300"
                                        />
                                        <div className="pr-4">
                                            <div
                                                className="p-3 text-slate-300 rounded-md transition-colors"
                                                title="Sistema compatible con lectores láser y QR"
                                            >
                                                <QrCode size={20} />
                                            </div>
                                        </div>
                                    </div>

                                    {showResults && filteredProducts.length > 0 && (
                                        <div className="absolute top-full left-0 w-full bg-white border border-gray-100 rounded-b-[1.5rem] shadow-2xl z-50 overflow-hidden animate-in slide-in-from-top-2">
                                            {filteredProducts.map(p => (
                                                <button
                                                    key={p.uid}
                                                    type="button"
                                                    onClick={() => addProduct(p)}
                                                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors border-b border-gray-50 last:border-0"
                                                >
                                                    <div className="flex flex-col items-start text-left">
                                                        <span className="text-[11px] font-black text-slate-800 uppercase tracking-tight">
                                                            {p.rubro?.nombre} - {p.marca?.nombre}
                                                        </span>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[9px] font-bold text-brand-600 italic uppercase tracking-widest">
                                                                {p.specificPresentation?.nombre || 'UNIDAD'} {p.variedad && `| ${p.variedad}`}
                                                            </span>
                                                            {p.matchedBarcode && (
                                                                <span className="text-[8px] font-black text-slate-400 uppercase bg-gray-50 px-2 py-0.5 rounded-md">
                                                                    Cód: {p.matchedBarcode}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-[9px] font-black text-brand-900 bg-brand-50 px-3 py-1 rounded-full border border-brand-100">
                                                            FACTOR: x{Number(p.specificFactor).toFixed(getDecimalPlaces(p.specificFactor))} {p.rubro?.almacen_unidades_medida?.abreviatura}
                                                        </span>
                                                        {Number(p.cantidad_referencia) > 1 && (
                                                            <span className="text-[7px] font-black text-slate-400 uppercase mt-1">
                                                                CONTENIDO: {p.cantidad_referencia} {p.referencia?.presentacion?.nombre || 'UND'}
                                                            </span>
                                                        )}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {showResults && productSearch && filteredProducts.length === 0 && (
                                        <div className="absolute top-full left-0 w-full bg-white border border-gray-100 rounded-b-[1.5rem] p-8 text-center z-50">
                                            <p className="text-xs font-bold text-slate-400 uppercase italic">No se encontraron productos coincidentes</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Listado de Detalles */}
                            <div className="bg-white rounded-md border border-gray-100 shadow-sm overflow-hidden">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50/80">
                                            <th className="px-2 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-gray-100">Producto</th>
                                            <th className="px-2 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-gray-100 w-32">Unidad</th>
                                            <th className="px-2 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-gray-100 w-40 text-center">Organoléptico</th>
                                            <th className="px-2 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-gray-100 w-44">Lote / Vence</th>
                                            {(isPendiente || isFinalizado) && <th className="px-2 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-gray-100 w-40">Costo Unit.</th>}
                                            {(isPendiente || isFinalizado) && <th className="px-2 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-gray-100 w-40 text-right">Subtotal</th>}
                                            {/* {!isFinalizado && <th className="px-2 py-5 text-right w-16" />} */}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-300">
                                        {(formik.values.detalles?.length || 0) === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="px-8 py-20 text-center">
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
                                                                                {Number(d.logistica?.cantidad_referencia) > 1 ? `${d.logistica.cantidad_referencia} ${d.logistica.referencia?.presentacion?.nombre || 'PAQ'} | ` : ''} {Number(d.factor || 1).toFixed(getDecimalPlaces(d.factor || 1))} {p?.rubro?.almacen_unidades_medida?.abreviatura}
                                                                            </span>
                                                                        </span>
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-2 py-1">
                                                            <input
                                                                type="number"
                                                                disabled={!canEditQuantities}
                                                                value={d.cantidad}
                                                                onChange={(e) => formik.setFieldValue(`detalles.${idx}.cantidad`, e.target.value)}
                                                                className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm font-black text-slate-700 outline-none focus:ring-4 focus:ring-brand-accent/5 focus:border-brand-accent transition-all disabled:opacity-30"
                                                            />
                                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mt-1">
                                                                = {Number(d.cantidad * (d.factor || 1)).toFixed(getDecimalPlaces(d.cantidad * (d.factor || 1)))} {p?.rubro?.almacen_unidades_medida?.abreviatura}
                                                            </span>
                                                        </td>
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
                                                                                disabled={(isPendiente || isFinalizado)}
                                                                                onClick={() => {
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
                                                        {(isPendiente || isFinalizado) && (
                                                            <>
                                                                <td className="px-2 py-1">
                                                                    <div className="relative group">
                                                                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[10px]">
                                                                            {monedas.find(m => m.id === formik.values.id_moneda)?.simbolo || '$'}
                                                                        </span>
                                                                        <input
                                                                            type="number"
                                                                            step="0.01"
                                                                            min="0.01"
                                                                            disabled={!canEditPrices}
                                                                            value={d.costo_unitario}
                                                                            onChange={(e) => formik.setFieldValue(`detalles.${idx}.costo_unitario`, e.target.value)}
                                                                            onBlur={formik.handleBlur}
                                                                            name={`detalles.${idx}.costo_unitario`}
                                                                            className={`w-full pl-8 pr-3 py-2 border rounded-xl text-sm font-black text-slate-700 outline-none focus:ring-4 focus:ring-brand-accent/5 focus:border-brand-accent transition-all
                                                                                ${canEditPrices ? (formik.errors.detalles?.[idx]?.costo_unitario ? 'bg-red-50 border-red-500 shadow-sm' : 'bg-white border-brand-200') : 'bg-transparent border-transparent cursor-not-allowed'}`}
                                                                        />
                                                                        {(formik.values.id_moneda !== 1) && (
                                                                            <div className="mt-1 flex items-center gap-1 justify-end pr-1">
                                                                                <span className="text-[8px] font-bold text-slate-400 uppercase italic">Eq. en $</span>
                                                                                <span className="text-[9px] font-black text-brand-600">
                                                                                    {(
                                                                                        formik.values.id_moneda === 1 ? d.costo_unitario :
                                                                                            formik.values.id_moneda === 2 ? (d.costo_unitario / (formik.values.tasa_cambio || 1)) :
                                                                                                (d.costo_unitario * (tasaGlobal?.tasa_euro || 1)) / (tasaGlobal?.tasa_dolar || 1)
                                                                                    ).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                                                                                </span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td className="px-2 py-1 text-right font-black text-slate-700 text-sm">
                                                                    {monedas.find(m => m.id === formik.values.id_moneda)?.simbolo || '$'}
                                                                    {(
                                                                        Number(d.cantidad_factura) > 0
                                                                            ? Number(d.cantidad_factura) * Number(d.costo_unitario || 0)
                                                                            : (productos.find(p => p.id === d.id_producto)?.peso_variable === true || d.producto_info?.peso_variable === true)
                                                                                ? (Number(d.cantidad) * Number(d.factor || 1)) * Number(d.costo_unitario || 0)
                                                                                : Number(d.cantidad) * Number(d.costo_unitario || 0)
                                                                    ).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                                                                </td>
                                                            </>
                                                        )}
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
                                    {(formik.values.detalles?.length || 0) > 0 && (
                                        <tfoot>
                                            {typeof formik.errors.detalles === 'string' && (
                                                <tr>
                                                    <td colSpan={6} className="px-2 py-2 bg-red-50 border-y border-red-100">
                                                        <div className="flex items-center gap-2 text-red-600">
                                                            <AlertTriangle size={14} />
                                                            <span className="text-[10px] font-black uppercase tracking-widest">{formik.errors.detalles}</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                            <tr className="bg-slate-50/50">
                                                {(isPendiente || isFinalizado) && (
                                                    <td colSpan={7} className="px-2 py-4 text-right">
                                                        {(formik.values.detalles?.length || 0) > 0 && (
                                                            <div className="flex flex-col justify-center items-end gap-1">
                                                                {(() => {
                                                                    const monedaSel = monedas.find(m => m.id.toString() === formik.values.id_moneda?.toString());
                                                                    const simbolo = monedaSel?.simbolo || '$';
                                                                    const totalOriginal = (formik.values.detalles || []).reduce((acc, d) => {
                                                                        const esPesoVariable = productos.find(p => p.id === d.id_producto)?.peso_variable === true || d.producto_info?.peso_variable === true;
                                                                        const subtotalFila = Number(d.cantidad_factura) > 0
                                                                            ? Number(d.cantidad_factura) * Number(d.costo_unitario || 0)
                                                                            : esPesoVariable
                                                                                ? (Number(d.cantidad) * Number(d.factor || 1)) * Number(d.costo_unitario || 0)
                                                                                : Number(d.cantidad) * Number(d.costo_unitario || 0);
                                                                        return acc + subtotalFila;
                                                                    }, 0);
                                                                    const esMonedaBase = monedaSel?.es_base;

                                                                    // Lógica de conversión unificada
                                                                    let totalDolares = totalOriginal;
                                                                    if (!esMonedaBase) {
                                                                        if (formik.values.id_moneda === 2) { // BOLIVARES
                                                                            totalDolares = totalOriginal / (formik.values.tasa_cambio || 1);
                                                                        } else if (formik.values.id_moneda === 3) { // EURO
                                                                            const factorEuro = (tasaGlobal?.tasa_euro || 1) / (tasaGlobal?.tasa_dolar || 1);
                                                                            totalDolares = totalOriginal * factorEuro;
                                                                        }
                                                                    }

                                                                    return (
                                                                        <>
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Documento</span>
                                                                                <span className="text-xl font-black text-brand-900">
                                                                                    {simbolo} {totalOriginal.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                                                                                </span>
                                                                            </div>
                                                                            {!esMonedaBase && (
                                                                                <div className="flex items-center gap-2 px-3 py-1 bg-brand-50 rounded-lg border border-brand-100/50">
                                                                                    <span className="text-[9px] font-bold text-brand-400 uppercase tracking-tight">Equivalente</span>
                                                                                    <span className="text-xs font-black text-brand-600">
                                                                                        $ {totalDolares.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                                                                                    </span>
                                                                                </div>
                                                                            )}
                                                                        </>
                                                                    );
                                                                })()}
                                                            </div>
                                                        )}
                                                    </td>
                                                )}
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            </div>

                            {/* Observaciones */}
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

                        {/* Overlay de Éxito / Impresión */}
                        {procesadoOk && (
                            <div className="absolute inset-0 bg-white/95 backdrop-blur-md z-[110] flex items-center justify-center p-8 animate-in fade-in zoom-in duration-500">
                                <div className="max-w-md w-full text-center space-y-8">
                                    <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/10 animate-bounce">
                                        <CheckCircle2 size={48} />
                                    </div>
                                    <div className="space-y-2">
                                        <h2 className="text-3xl font-black text-slate-800 tracking-tight">¡Cotejo Procesado!</h2>
                                        <p className="text-slate-500 font-medium italic">
                                            La mercancía ha sido ingresada a <span className="text-brand-600 font-bold">PLAYA DE RECEPCIÓN</span> y se han generado las tareas de ubicación.
                                        </p>
                                    </div>

                                    <div className="bg-gray-50 rounded-[2rem] p-6 border border-gray-100 shadow-inner">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Acciones de Trazabilidad</p>
                                        <div className="grid grid-cols-1 gap-3">
                                            <button
                                                onClick={handlePrintLabels}
                                                className="w-full py-5 bg-brand-900 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl shadow-brand-900/20 hover:bg-brand-800 transition-all flex items-center justify-center gap-3"
                                            >
                                                <QrCode size={20} /> Imprimir Etiquetas Sercosys
                                            </button>
                                            <button
                                                onClick={onClose}
                                                className="w-full py-4 bg-white text-slate-500 border border-gray-100 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-gray-50 transition-all"
                                            >
                                                Finalizar y Salir
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer Dinámico */}
                    <div className="p-8 border-t border-gray-100 bg-white flex items-center justify-between gap-4 sticky bottom-0 z-20">
                        <div className="flex items-center gap-4">
                            <button type="button" onClick={onClose} className="px-8 py-3 text-[11px] font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest transition-colors">
                                Cerrar
                            </button>
                        </div>

                        <div className="flex items-center gap-3">
                            {isPendiente && (
                                <>
                                    <button
                                        type="button"
                                        disabled={loading}
                                        onClick={() => setShowAnularModal(true)}
                                        className="flex bg-red-50 text-red-600 px-8 py-3.5 rounded-md text-xs font-black hover:bg-red-100 transition-all active:scale-95 items-center gap-3 uppercase tracking-widest mr-auto"
                                    >
                                        <XCircle size={18} /> Anular
                                    </button>
                                    <button
                                        type="button"
                                        disabled={loading}
                                        onClick={() => handleSaveAction('PENDIENTE')}
                                        className="flex bg-slate-100 text-slate-600 px-8 py-3.5 rounded-md text-xs font-black hover:bg-slate-200 transition-all active:scale-95 items-center gap-3 uppercase tracking-widest"
                                    >
                                        <Save size={18} /> Guardar Precios
                                    </button>
                                    <button
                                        type="button"
                                        disabled={loading}
                                        onClick={handleProcesar}
                                        className="flex bg-emerald-600 text-white px-10 py-3.5 rounded-md text-xs font-black hover:bg-emerald-700 shadow-xl shadow-emerald-900/20 transition-all active:scale-95 items-center gap-3 uppercase tracking-widest"
                                    >
                                        <CheckCircle2 size={18} /> Procesar Inventario
                                    </button>
                                </>
                            )}
                            {isProcesado && (
                                <button
                                    type="button"
                                    onClick={() => handlePrintLabels()}
                                    className="flex bg-brand-900 text-white px-10 py-3.5 rounded-md text-xs font-black hover:bg-brand-800 shadow-xl shadow-brand-900/20 transition-all active:scale-95 items-center gap-3 uppercase tracking-widest"
                                >
                                    <QrCode size={18} /> Imprimir Etiquetas
                                </button>
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

            {/* Modal de Error de Búsqueda */}
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

            {/* Modal de Motivo de Anulación */}
            {showAnularModal && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAnularModal(false)} />
                    <div className="relative bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 border border-red-100">
                        <div className="flex flex-col items-center text-center gap-4">
                            <div className="p-4 bg-red-50 text-red-600 rounded-full animate-bounce">
                                <AlertTriangle size={40} />
                            </div>
                            <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Anular Cotejo</h3>
                            <p className="text-slate-500 italic">¿Está seguro de anular esta recepción? Esta acción no se puede deshacer.</p>

                            <div className="bg-gray-50 rounded-md p-4 w-full">
                                <textarea
                                    autoFocus
                                    value={motivoAnulacion}
                                    onChange={(e) => setMotivoAnulacion(e.target.value)}
                                    placeholder="Motivo (mínimo 10 caracteres)..."
                                    className="w-full h-24 px-4 py-3 rounded-xl border border-gray-100 bg-white text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-red-500/10 focus:border-red-500 transition-all resize-none"
                                />
                            </div>

                            <div className="flex gap-3 w-full mt-4">
                                <button
                                    onClick={() => setShowAnularModal(false)}
                                    className="flex-1 px-6 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-all active:scale-95"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleAnular}
                                    disabled={motivoAnulacion.length < 10 || loading}
                                    className="flex-2 px-8 py-3 bg-red-600 text-white rounded-xl font-black shadow-xl shadow-red-900/20 hover:bg-red-700 transition-all active:scale-95 disabled:opacity-50"
                                >
                                    Confirmar Anulación
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Confirmación de Procesamiento */}
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
                                <button
                                    onClick={() => setShowConfirmProcesar(false)}
                                    disabled={loading}
                                    className="w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-md font-black text-xs uppercase tracking-widest active:scale-95 transition-all"
                                >
                                    CANCELAR
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Etiquetas */}
            <EtiquetasTrackingRecepcionModal
                isOpen={showEtiquetas}
                onClose={() => setShowEtiquetas(false)}
                inventario={dataEtiquetas}
            />
        </Fragment>,
        document.body
    );
};
