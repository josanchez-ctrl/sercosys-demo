import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { X, Package, Layers, Hash, Plus, Trash2, AlertTriangle, Info, QrCode, Landmark, Truck, Scale, Percent } from 'lucide-react';
import { getRubros } from '../../../services/rubroService';
import { getMarcas } from '../../../services/marcaService';
import { getPresentaciones } from '../../../services/presentacionService';
import { saveProductoCompleto, getDerivadosPorOrigen, saveDerivadosProducto, getProductos, getDerivadosPorDestino, saveDerivadosDestino } from '../../../services/productoService';
import { getTiposDepreciacion } from '../../../services/tipoDepreciacionService';

const validationSchema = Yup.object().shape({
    id_rubro: Yup.string().required('El rubro es obligatorio'),
    id_marca: Yup.string().nullable(),
    variedad: Yup.string().max(100, 'Máximo 100 caracteres'),
    stock_minimo: Yup.number().min(0, 'No puede ser negativo'),
    estatus: Yup.boolean(),
    id_tipo_depreciacion: Yup.string().nullable(),
    valor_calculo_depreciacion: Yup.number().nullable().min(0, 'No puede ser negativo'),
    es_insumo_transformacion: Yup.boolean(),
    es_resultado_transformacion: Yup.boolean(),
    es_reprocesable: Yup.boolean(),
    costo_proporcional_peso: Yup.boolean(),
    es_subproducto: Yup.boolean(),
    logistica: Yup.array().min(1, 'Debe configurar al menos la presentación base del producto')
});

export default function ProductosModal({ initialData = null, empresaActiva, perfil, almacenSel, onClose, onUpdate }) {
    const isEdit = !!initialData?.id;
    const isDistribucion = almacenSel?.nombre?.toUpperCase().includes('DISTRIBUCION') || almacenSel?.nombre?.toUpperCase().includes('DISTRIBUCIÓN');
    const [loadingMaestros, setLoadingMaestros] = useState(true);

    const [rubros, setRubros] = useState([]);
    const [marcas, setMarcas] = useState([]);
    const [presentaciones, setPresentaciones] = useState([]);
    const [tiposDepreciacion, setTiposDepreciacion] = useState([]);
    const [todosProductos, setTodosProductos] = useState([]);

    const [derivadosSeleccionados, setDerivadosSeleccionados] = useState([]);
    const [searchCorte, setSearchCorte] = useState('');
    const [showDropdownCortes, setShowDropdownCortes] = useState(false);

    const [origenesSeleccionados, setOrigenesSeleccionados] = useState([]);
    const [searchOrigen, setSearchOrigen] = useState('');
    const [showDropdownOrigenes, setShowDropdownOrigenes] = useState(false);

    const [reprocesosSeleccionados, setReprocesosSeleccionados] = useState([]);
    const [searchReproceso, setSearchReproceso] = useState('');
    const [showDropdownReprocesos, setShowDropdownReprocesos] = useState(false);

    const [initialDerivados, setInitialDerivados] = useState([]);
    const [initialOrigenes, setInitialOrigenes] = useState([]);
    const [initialReprocesos, setInitialReprocesos] = useState([]);

    const productosCortes = useMemo(() => {
        return todosProductos.filter(p => 
            p.es_resultado_transformacion === true && 
            p.id !== initialData?.id
        );
    }, [todosProductos, initialData?.id]);

    const productosOrigenes = useMemo(() => {
        return todosProductos.filter(p => 
            (p.es_insumo_transformacion === true || p.es_reprocesable === true) && 
            p.id !== initialData?.id
        );
    }, [todosProductos, initialData?.id]);

    useEffect(() => {
        if (empresaActiva?.id) {
            fetchMaestros();
        }
    }, [empresaActiva?.id]);

    const fetchMaestros = async () => {
        setLoadingMaestros(true);
        try {
            const [rubRes, marRes, preRes, depRes, prodsRes] = await Promise.all([
                getRubros(empresaActiva.id),
                getMarcas(empresaActiva.id),
                getPresentaciones(empresaActiva.id),
                getTiposDepreciacion(),
                getProductos(empresaActiva.id)
            ]);
            const rubrosFiltrados = rubRes.filter(r => r.almacen_categorias?.id_almacen === almacenSel?.id);
            setRubros(rubrosFiltrados || []);
            setMarcas(marRes || []);
            setPresentaciones(preRes || []);
            setTiposDepreciacion(depRes || []);
            setTodosProductos(prodsRes || []);

            if (isEdit && initialData?.id) {
                try {
                    const [devs, origs] = await Promise.all([
                        getDerivadosPorOrigen(initialData.id),
                        getDerivadosPorDestino(initialData.id)
                    ]);
                    
                    const desposteList = [];
                    const reprocesoList = [];
                    const isOnlyReproceso = initialData?.es_reprocesable && !initialData?.es_insumo_transformacion;
                    const isOnlyDesposte = !initialData?.es_reprocesable && initialData?.es_insumo_transformacion;

                    (devs || []).forEach(d => {
                        const destProduct = (prodsRes || []).find(p => p.id === d.id_producto_destino);
                        const rubroNombre = destProduct?.rubro?.nombre?.toUpperCase() || '';
                        
                        if (isOnlyReproceso) {
                            reprocesoList.push(d);
                        } else if (isOnlyDesposte) {
                            desposteList.push(d);
                        } else {
                            if (rubroNombre.includes('MOLIDO') || rubroNombre.includes('MOLIDA') || rubroNombre.includes('REPROCESO') || rubroNombre.includes('MOLIENDA')) {
                                reprocesoList.push(d);
                            } else {
                                desposteList.push(d);
                            }
                        }
                    });
                    
                    setDerivadosSeleccionados(desposteList);
                    setInitialDerivados(JSON.parse(JSON.stringify(desposteList)));
                    setReprocesosSeleccionados(reprocesoList);
                    setInitialReprocesos(JSON.parse(JSON.stringify(reprocesoList)));
                    setOrigenesSeleccionados(origs || []);
                    setInitialOrigenes(JSON.parse(JSON.stringify(origs || [])));
                } catch (err) {
                    console.warn('Error al cargar derivados/orígenes del producto:', err);
                }
            }
        } catch (error) {
            console.error('Error al cargar maestros:', error);
        } finally {
            setLoadingMaestros(false);
        }
    };

    const formik = useFormik({
        initialValues: {
            id_rubro: initialData?.id_rubro || '',
            id_marca: initialData?.id_marca || '',
            variedad: initialData?.variedad || '',
            // Si hay una referencia de stock, mostramos el valor en esa unidad, sino en base
            stock_minimo: initialData?.id_logistica_stock_minimo
                ? (initialData.stock_minimo / (initialData.logistica?.find(l => l.id === initialData.id_logistica_stock_minimo)?.factor || 1))
                : (initialData?.stock_minimo || 0),
            maneja_lote: initialData?.maneja_lote || false,
            estatus: initialData?.estatus ?? true,
            es_recipiente_transporte: initialData?.es_recipiente_transporte ?? false,
            peso_tara_estandar: initialData?.peso_tara_estandar ?? 0,
            es_insumo_transformacion: initialData?.es_insumo_transformacion ?? false,
            es_resultado_transformacion: initialData?.es_resultado_transformacion ?? false,
            es_reprocesable: initialData?.es_reprocesable ?? false,
            peso_variable: initialData?.peso_variable ?? false,
            costo_proporcional_peso: initialData?.costo_proporcional_peso ?? false,
            es_subproducto: initialData?.es_subproducto ?? false,
            id_tipo_depreciacion: initialData?.id_tipo_depreciacion || '',
            valor_calculo_depreciacion: initialData?.valor_calculo_depreciacion || '',
            logistica: initialData?.logistica?.map((l, idx, arr) => {
                let relIdx = l.id_referencia
                    ? arr.findIndex(item => item.id === l.id_referencia)
                    : -1;

                if (!l.es_base && relIdx === -1) {
                    const potentialParents = arr
                        .map((p, pIdx) => ({ factor: p.factor, idx: pIdx, id: p.id }))
                        .filter(p => {
                            const isSame = p.id && l.id ? p.id === l.id : p.idx === idx;
                            return !isSame && p.factor > 0 && p.factor < l.factor;
                        })
                        .filter(p => {
                            const ratio = l.factor / p.factor;
                            return Math.abs(ratio - Math.round(ratio)) < 0.0001;
                        })
                        .sort((a, b) => b.factor - a.factor);

                    relIdx = potentialParents.length > 0 ? potentialParents[0].idx : 0;
                }

                return {
                    ...l,
                    es_stock_minimo: l.id === initialData.id_logistica_stock_minimo,
                    relacion_index: l.id_referencia
                        ? arr.findIndex(item => item.id === l.id_referencia)
                        : (l.es_base ? -1 : relIdx),
                    cant_base: l.es_base ? l.factor : (l.id_referencia ? (l.cantidad_referencia || 1) : (l.factor / (arr[relIdx]?.factor || 1))),
                    orden: l.orden || 0
                };
            }) || []
        },
        validationSchema,
        enableReinitialize: true,
        onSubmit: async (values, { setSubmitting, setStatus }) => {
            try {
                const payload = {
                    id_empresa: empresaActiva.id,
                    id_rubro: parseInt(values.id_rubro),
                    id_marca: values.id_marca ? parseInt(values.id_marca) : null,
                    variedad: (values.variedad || '').trim().toUpperCase(),
                    stock_minimo: parseFloat(values.stock_minimo),
                    maneja_lote: values.maneja_lote,
                    estatus: values.estatus,
                    es_recipiente_transporte: values.es_recipiente_transporte,
                    peso_tara_estandar: parseFloat(values.peso_tara_estandar) || 0,
                    es_insumo_transformacion: values.es_insumo_transformacion,
                    es_resultado_transformacion: values.es_resultado_transformacion,
                    es_reprocesable: values.es_reprocesable,
                    peso_variable: values.peso_variable,
                    costo_proporcional_peso: values.es_reprocesable ? true : values.costo_proporcional_peso,
                    es_subproducto: values.es_subproducto,
                    id_tipo_depreciacion: values.id_tipo_depreciacion ? parseInt(values.id_tipo_depreciacion) : null,
                    valor_calculo_depreciacion: values.valor_calculo_depreciacion ? parseFloat(values.valor_calculo_depreciacion) : null
                };

                const savedId = await saveProductoCompleto(initialData?.id, payload, values.logistica, perfil.id);
                
                const combinedDerivados = [];
                if (values.es_insumo_transformacion) {
                    combinedDerivados.push(...derivadosSeleccionados);
                }
                if (values.es_reprocesable) {
                    combinedDerivados.push(...reprocesosSeleccionados);
                }
                await saveDerivadosProducto(savedId, combinedDerivados, perfil.id);

                if (values.es_resultado_transformacion) {
                    await saveDerivadosDestino(savedId, origenesSeleccionados, perfil.id);
                } else {
                    await saveDerivadosDestino(savedId, [], perfil.id);
                }

                onUpdate();
                onClose();
            } catch (error) {
                console.error('Error al guardar producto:', error);
                setStatus(error.message || 'Error al procesar la solicitud');
            } finally {
                setSubmitting(false);
            }
        }
    });

    const selectedRubro = rubros.find(r => r.id == formik.values.id_rubro);
    const selectedCategoria = selectedRubro?.almacen_categorias;

    const cortesSugeridos = useMemo(() => {
        const query = searchCorte.toLowerCase().trim();
        const categoriaIdActual = selectedRubro?.id_categoria;

        const noAgregados = productosCortes.filter(p => !derivadosSeleccionados.some(d => d.id_producto_destino === p.id));

        const filtradosPorCategoria = categoriaIdActual 
            ? noAgregados.filter(p => Number(p.rubro?.id_categoria) === Number(categoriaIdActual))
            : noAgregados;

        if (!query) {
            return filtradosPorCategoria;
        }
        return filtradosPorCategoria.filter(p => {
            const rubroNom = p.rubro?.nombre?.toLowerCase() || '';
            const marcaNom = p.marca?.nombre?.toLowerCase() || '';
            const varNom = p.variedad?.toLowerCase() || '';
            return rubroNom.includes(query) || marcaNom.includes(query) || varNom.includes(query);
        });
    }, [searchCorte, productosCortes, derivadosSeleccionados, selectedRubro]);

    const origenesSugeridos = useMemo(() => {
        const query = searchOrigen.toLowerCase().trim();
        const categoriaIdActual = selectedRubro?.id_categoria;

        const noAgregados = productosOrigenes.filter(p => !origenesSeleccionados.some(d => d.id_producto_origen === p.id));

        const filtradosPorCategoria = categoriaIdActual 
            ? noAgregados.filter(p => Number(p.rubro?.id_categoria) === Number(categoriaIdActual))
            : noAgregados;

        if (!query) {
            return filtradosPorCategoria;
        }
        return filtradosPorCategoria.filter(p => {
            const rubroNom = p.rubro?.nombre?.toLowerCase() || '';
            const marcaNom = p.marca?.nombre?.toLowerCase() || '';
            const varNom = p.variedad?.toLowerCase() || '';
            return rubroNom.includes(query) || marcaNom.includes(query) || varNom.includes(query);
        });
    }, [searchOrigen, productosOrigenes, origenesSeleccionados, selectedRubro]);

    const reprocesosSugeridos = useMemo(() => {
        const query = searchReproceso.toLowerCase().trim();
        const categoriaIdActual = selectedRubro?.id_categoria;

        const noAgregados = productosCortes.filter(p => !reprocesosSeleccionados.some(d => d.id_producto_destino === p.id));

        const filtradosPorCategoria = categoriaIdActual 
            ? noAgregados.filter(p => Number(p.rubro?.id_categoria) === Number(categoriaIdActual))
            : noAgregados;

        if (!query) {
            return filtradosPorCategoria;
        }
        return filtradosPorCategoria.filter(p => {
            const rubroNom = p.rubro?.nombre?.toLowerCase() || '';
            const marcaNom = p.marca?.nombre?.toLowerCase() || '';
            const varNom = p.variedad?.toLowerCase() || '';
            return rubroNom.includes(query) || marcaNom.includes(query) || varNom.includes(query);
        });
    }, [searchReproceso, productosCortes, reprocesosSeleccionados, selectedRubro]);

    const totalPorcentajeDerivados = useMemo(() => {
        return derivadosSeleccionados.reduce((sum, d) => sum + (parseFloat(d.porcentaje_costo) || 0), 0);
    }, [derivadosSeleccionados]);

    const totalCorteDerivados = useMemo(() => {
        return derivadosSeleccionados.reduce((sum, d) => sum + (parseFloat(d.porcentaje_corte) || 0), 0);
    }, [derivadosSeleccionados]);

    const totalPorcentajeReprocesos = useMemo(() => {
        return reprocesosSeleccionados.reduce((sum, d) => sum + (parseFloat(d.porcentaje_costo) || 0), 0);
    }, [reprocesosSeleccionados]);

    const totalCorteReprocesos = useMemo(() => {
        return reprocesosSeleccionados.reduce((sum, d) => sum + (parseFloat(d.porcentaje_corte) || 0), 0);
    }, [reprocesosSeleccionados]);

    const totalPorcentajeOrigenes = useMemo(() => {
        return origenesSeleccionados.reduce((sum, d) => sum + (parseFloat(d.porcentaje_costo) || 0), 0);
    }, [origenesSeleccionados]);

    const totalCorteOrigenes = useMemo(() => {
        return origenesSeleccionados.reduce((sum, d) => sum + (parseFloat(d.porcentaje_corte) || 0), 0);
    }, [origenesSeleccionados]);

    const hasDerivadosChanged = useMemo(() => {
        if (initialDerivados.length !== derivadosSeleccionados.length) return true;
        for (const d of derivadosSeleccionados) {
            const init = initialDerivados.find(x => x.id_producto_destino === d.id_producto_destino);
            if (!init) return true;
            if (Number(d.porcentaje_costo) !== Number(init.porcentaje_costo) ||
                Number(d.porcentaje_corte) !== Number(init.porcentaje_corte)) {
                return true;
            }
        }
        return false;
    }, [initialDerivados, derivadosSeleccionados]);

    const hasReprocesosChanged = useMemo(() => {
        if (initialReprocesos.length !== reprocesosSeleccionados.length) return true;
        for (const r of reprocesosSeleccionados) {
            const init = initialReprocesos.find(x => x.id_producto_destino === r.id_producto_destino);
            if (!init) return true;
            if (Number(r.porcentaje_costo) !== Number(init.porcentaje_costo) ||
                Number(r.porcentaje_corte) !== Number(init.porcentaje_corte)) {
                return true;
            }
        }
        return false;
    }, [initialReprocesos, reprocesosSeleccionados]);

    const hasOrigenesChanged = useMemo(() => {
        if (initialOrigenes.length !== origenesSeleccionados.length) return true;
        for (const o of origenesSeleccionados) {
            const init = initialOrigenes.find(x => x.id_producto_origen === o.id_producto_origen);
            if (!init) return true;
            if (Number(o.porcentaje_costo) !== Number(init.porcentaje_costo) ||
                Number(o.porcentaje_corte) !== Number(init.porcentaje_corte)) {
                return true;
            }
        }
        return false;
    }, [initialOrigenes, origenesSeleccionados]);

    const isFormDirty = formik.dirty || hasDerivadosChanged || hasReprocesosChanged || hasOrigenesChanged;
    const isActivoFijo = almacenSel?.nombre?.toUpperCase().includes('ACTIVO');
    const isCategoriaUtensilios = selectedCategoria?.nombre?.toUpperCase() === 'UTENSILIOS';
    const isCategoriaDesechables = selectedCategoria?.nombre?.toUpperCase() === 'DESECHABLES';
    const selectedTipoDepreciacion = tiposDepreciacion.find(t => t.id == formik.values.id_tipo_depreciacion);

    // Automatización de Unidad Base al elegir Rubro
    useEffect(() => {
        // Solo si es un producto nuevo y el rubro ha sido seleccionado
        if (!isEdit && formik.values.id_rubro && selectedRubro) {
            const unidadAbrev = selectedRubro.almacen_unidades_medida?.abreviatura?.toUpperCase();

            // Si la logística está vacía o solo tiene filas inválidas
            const isLogisticaEmpty = formik.values.logistica.length === 0 ||
                (formik.values.logistica.length === 1 && !formik.values.logistica[0].id_presentacion);

            if (isLogisticaEmpty && unidadAbrev) {
                // Buscar la presentación base genérica "UNIDAD BASE"
                const basePres = presentaciones.find(p => p.nombre.toUpperCase() === 'UNIDAD BASE');

                if (basePres) {
                    formik.setFieldValue('logistica', [
                        {
                            id_presentacion: basePres.id.toString(),
                            codigo_barras: '',
                            factor: 1,
                            es_base: true,
                            cant_base: 1,
                            es_stock_minimo: true,
                            relacion_index: -1,
                            orden: 1
                        }
                    ]);
                }
            }
        }
    }, [formik.values.id_rubro, selectedRubro, isEdit, presentaciones]);

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 animate-in fade-in duration-300" onClick={onClose}>
            <div className="bg-white w-full h-full max-w-[90vw] max-h-[90vh] flex flex-col overflow-hidden rounded-md shadow-2xl animate-in zoom-in-95 duration-300 border border-white/20" onClick={(e) => e.stopPropagation()}>

                {/* Header */}
                <div className="px-8 py-5 border-b border-gray-100 flex items-center justify-between bg-white relative">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-500 to-brand-900" />
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-[1.2rem] flex items-center justify-center border shadow-inner ${isEdit ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-brand-50 text-brand-600 border-brand-100'}`}>
                            <Package size={22} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-800 tracking-tight leading-tight">
                                {isEdit ? 'Identidad de Producto' : 'Nueva Identidad de Producto'}
                            </h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 italic">
                                Definición técnica y logística multipresentación
                            </p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600">
                        <X size={22} />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={formik.handleSubmit} className="flex-1 p-8 space-y-6 bg-gray-50/30 overflow-y-auto max-h-[75vh] custom-scrollbar">
                    {formik.status && (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-md flex items-center gap-3">
                            <AlertTriangle size={18} className="text-red-500 flex-shrink-0" />
                            <p className="text-xs font-bold text-red-700 leading-snug">{formik.status}</p>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                        {/* Columna Izquierda: Identidad Descriptiva */}
                        <div className="space-y-4">
                            <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-4">
                                <h4 className="text-[10px] font-black text-brand-900 uppercase tracking-widest flex items-center gap-2">
                                    <Layers size={14} /> Identidad del Producto
                                </h4>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Rubro</label>
                                    <select {...formik.getFieldProps('id_rubro')} className="w-full px-4 py-3 rounded-md border border-gray-100 bg-gray-50/20 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-brand-accent/5 focus:border-brand-accent transition-all">
                                        <option value="">-- SELECCIONAR --</option>
                                        {rubros.map(r => <option key={r.id} value={r.id}>{r.nombre} ({r.almacen_categorias?.nombre})</option>)}
                                    </select>
                                </div>

                                <div className="space-y-1">
                                    <label className={`text-[10px] font-black uppercase tracking-widest ml-1 ${selectedRubro?.requiere_marca === false ? 'text-slate-300' : 'text-slate-400'}`}>
                                        Marca {selectedRubro?.requiere_marca === false && '(No Aplica)'}
                                    </label>
                                    <select
                                        {...formik.getFieldProps('id_marca')}
                                        disabled={selectedRubro?.requiere_marca === false}
                                        className={`w-full px-4 py-3 rounded-md border border-gray-100 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-brand-accent/5 focus:border-brand-accent transition-all
                                        ${selectedRubro?.requiere_marca === false ? 'bg-gray-100/50 cursor-not-allowed opacity-50' : 'bg-gray-50/20'}`}
                                    >
                                        <option value="">-- {selectedRubro?.requiere_marca === false ? 'SIN MARCA' : 'SELECCIONAR'} --</option>
                                        {marcas.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                                    </select>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Especificación (Variedad)</label>
                                    <input
                                        type="text"
                                        {...formik.getFieldProps('variedad')}
                                        placeholder="Ej: Tradicional, Superior, Premium..."
                                        className="w-full px-5 py-3 rounded-md border border-gray-100 bg-gray-50/20 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-brand-accent/5 focus:border-brand-accent transition-all placeholder:text-slate-300 placeholder:italic"
                                    />
                                    <p className="text-[9px] text-slate-400 font-bold px-1 italic">Diferenciador secundario de la marca (opcional).</p>
                                </div>
                            </div>
                        </div>

                        {/* Columna Derecha: Configuración Operativa */}
                        <div className="space-y-4">
                            <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-4">
                                <h4 className="text-[10px] font-black text-brand-900 uppercase tracking-widest flex items-center gap-2">
                                    <Hash size={14} /> Control Operativo
                                </h4>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                        Stock Mínimo {formik.values.logistica.find(l => l.es_stock_minimo)?.id_presentacion
                                            ? `(en ${presentaciones.find(p => p.id == formik.values.logistica.find(l => l.es_stock_minimo).id_presentacion)?.nombre})`
                                            : `(en ${selectedRubro?.almacen_unidades_medida?.abreviatura || 'Unidades'})`}
                                    </label>
                                    <input
                                        type="number"
                                        {...formik.getFieldProps('stock_minimo')}
                                        className="w-full px-5 py-3 rounded-md border border-gray-100 bg-gray-50/20 text-sm font-black text-slate-700 outline-none focus:ring-4 focus:ring-brand-accent/5 focus:border-brand-accent transition-all"
                                    />
                                    <p className="text-[9px] text-slate-400 font-bold px-1 italic">Alerta de reposición basada en existencias físicas.</p>
                                    
                                    <div className="space-y-3 pt-2">
                                        <label className="flex items-center justify-between p-3.5 rounded-xl bg-brand-50/30 border border-brand-100 cursor-pointer hover:bg-brand-50 transition-all group/toggle">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black text-brand-900 uppercase tracking-widest leading-none">Trazabilidad</span>
                                                <span className="text-[9px] font-bold text-brand-600/60 italic mt-1">¿Maneja Lote y Vencimiento?</span>
                                            </div>
                                            <input
                                                type="checkbox"
                                                {...formik.getFieldProps('maneja_lote')}
                                                checked={formik.values.maneja_lote}
                                                className="w-5 h-5 rounded-lg text-brand-900 focus:ring-brand-accent cursor-pointer transition-transform group-active/toggle:scale-90"
                                            />
                                        </label>

                                        {/* Flags de Transformación y Reenvasado */}
                                        {/* Check 1: Despresable (Insumo de Desposte) */}
                                        <label className="flex items-center justify-between p-3.5 rounded-xl bg-orange-50/30 border border-orange-100 cursor-pointer hover:bg-orange-50 transition-all group/toggle">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black text-orange-900 uppercase tracking-widest leading-none">
                                                    {isDistribucion ? 'Insumo Reenvasable' : 'Insumo de Desposte (Despresable)'}
                                                </span>
                                                <span className="text-[9px] font-bold text-orange-600/60 italic mt-1">
                                                    {isDistribucion 
                                                        ? '¿Este producto se divide en empaques o presentaciones diferentes?' 
                                                        : '¿Este producto se divide en cortes con costos diferentes?'}
                                                </span>
                                            </div>
                                            <input
                                                type="checkbox"
                                                {...formik.getFieldProps('es_insumo_transformacion')}
                                                checked={formik.values.es_insumo_transformacion}
                                                className="w-5 h-5 rounded-lg text-orange-600 focus:ring-orange-500 cursor-pointer transition-transform group-active/toggle:scale-90"
                                            />
                                        </label>

                                        {formik.values.es_insumo_transformacion && (
                                            <div className="px-4 py-3 rounded-2xl bg-orange-50/15 border border-orange-100/50 space-y-4 animate-in fade-in duration-300">
                                                
                                                {/* Nuevo Check de Prorrateo de Costo */}
                                                <label className="flex items-center justify-between p-3 rounded-xl bg-white border border-orange-100 cursor-pointer hover:bg-orange-50/40 transition-all group/toggle">
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-black text-orange-955 uppercase tracking-widest leading-none">
                                                            {isDistribucion ? 'Prorratear Costo por Peso (Reempaques)' : 'Prorratear Costo por Peso (Cortes)'}
                                                        </span>
                                                        <span className="text-[8px] font-bold text-orange-600/60 italic mt-1">
                                                            {isDistribucion 
                                                                ? '¿Hereda el costo unitario del insumo? (Pérdidas a costo $0.00)' 
                                                                : '¿Hereda el costo unitario del insumo? (Desperdicios a costo $0.00)'}
                                                        </span>
                                                    </div>
                                                    <input
                                                        type="checkbox"
                                                        {...formik.getFieldProps('costo_proporcional_peso')}
                                                        checked={formik.values.costo_proporcional_peso}
                                                        className="w-5 h-5 rounded-lg text-orange-650 focus:ring-orange-500 cursor-pointer transition-transform group-active/toggle:scale-90"
                                                    />
                                                </label>

                                                <div className="flex flex-col">
                                                    <span className="text-[9px] font-black text-orange-955 uppercase tracking-widest leading-none">
                                                        {isDistribucion ? 'Presentaciones de Reenvasado' : 'Cortes y Derivados Permitidos'}
                                                    </span>
                                                    <span className="text-[8px] font-bold text-orange-600/60 italic mt-1">
                                                        {isDistribucion 
                                                            ? 'Busque y agregue las presentaciones resultantes del reenvasado de este insumo.' 
                                                            : 'Busque y agregue los productos resultantes de la transformación de este insumo.'}
                                                    </span>
                                                </div>

                                                {/* Buscador Predictivo */}
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        placeholder={isDistribucion ? 'Buscar producto para reenvasar...' : 'Buscar producto por rubro, marca o variedad...'}
                                                        value={searchCorte}
                                                        onChange={e => setSearchCorte(e.target.value)}
                                                        onFocus={() => setShowDropdownCortes(true)}
                                                        onBlur={() => setTimeout(() => setShowDropdownCortes(false), 200)}
                                                        className="w-full px-3 py-2.5 rounded-xl border border-gray-150 bg-white text-[10px] font-bold text-slate-750 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/10 transition-all placeholder:text-slate-350 placeholder:italic"
                                                    />
                                                    
                                                    {showDropdownCortes && (
                                                        <div className="absolute z-[20] top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-40 overflow-y-auto custom-scrollbar">
                                                            {cortesSugeridos.length > 0 ? (
                                                                cortesSugeridos.map(prod => {
                                                                    const prodLabel = [prod.rubro?.nombre, prod.marca?.nombre, prod.variedad].filter(Boolean).join(' · ');
                                                                    return (
                                                                        <div
                                                                            key={prod.id}
                                                                            onClick={() => {
                                                                                setDerivadosSeleccionados(prev => [...prev, { id_producto_destino: prod.id, porcentaje_costo: isDistribucion ? 100.00 : 0.00, porcentaje_corte: isDistribucion ? 100.00 : 0.00 }]);
                                                                                setSearchCorte('');
                                                                                setShowDropdownCortes(false);
                                                                            }}
                                                                            className="px-3.5 py-2.5 hover:bg-orange-50 hover:text-orange-950 text-[9px] font-black text-slate-650 cursor-pointer flex justify-between items-center transition-colors uppercase border-b border-gray-50 last:border-b-0"
                                                                        >
                                                                            <span>{prodLabel}</span>
                                                                            <span className="text-[8px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full font-extrabold uppercase">Seleccionar</span>
                                                                        </div>
                                                                    );
                                                                })
                                                            ) : (
                                                                <div className="px-3.5 py-2.5 text-[9px] font-bold text-slate-450 italic text-center">Sin sugerencias coincidentes o vacías</div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Lista de Seleccionados */}
                                                <div className="space-y-1">
                                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider ml-1">Productos Mapeados ({derivadosSeleccionados.length})</span>
                                                    {derivadosSeleccionados.length > 0 ? (
                                                        <div className="space-y-1.5 bg-white p-2.5 rounded-xl border border-gray-100 shadow-inner">
                                                            <div className="space-y-1.5 overflow-y-auto custom-scrollbar pr-1">
                                                                {derivadosSeleccionados.map(deriv => {
                                                                    const id = deriv.id_producto_destino;
                                                                    const prod = productosCortes.find(p => p.id === id);
                                                                    if (!prod) return null;
                                                                    const prodLabel = [prod.rubro?.nombre, prod.marca?.nombre, prod.variedad].filter(Boolean).join(' · ');
                                                                    return (
                                                                        <div key={id} className="flex items-center justify-between p-2 rounded-lg bg-orange-50/30 border border-orange-100/20 text-[9px] font-extrabold text-slate-700 uppercase animate-in slide-in-from-top-1 duration-200 gap-2">
                                                                            <span className="truncate flex-1">{prodLabel}</span>
                                                                            {!isDistribucion && (
                                                                                <>
                                                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                                                        <span className="text-[8px] text-slate-400 font-black">% CORTE:</span>
                                                                                        <input 
                                                                                            type="number" 
                                                                                            step="0.01" 
                                                                                            min="0"
                                                                                            max="100"
                                                                                            value={deriv.porcentaje_corte || 0.00} 
                                                                                            onChange={(e) => {
                                                                                                const val = parseFloat(e.target.value) || 0;
                                                                                                setDerivadosSeleccionados(prev => prev.map(x => x.id_producto_destino === id ? { ...x, porcentaje_corte: val } : x));
                                                                                            }}
                                                                                            className="w-14 px-1 py-0.5 bg-white border border-gray-200 rounded text-center font-black text-slate-800 text-[10px] outline-none focus:border-orange-450 focus:ring-1 focus:ring-orange-400/20"
                                                                                        />
                                                                                    </div>
                                                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                                                        <span className="text-[8px] text-slate-400 font-black">% COSTO:</span>
                                                                                        <input 
                                                                                            type="number" 
                                                                                            step="0.01" 
                                                                                            min="0"
                                                                                            max="100"
                                                                                            value={deriv.porcentaje_costo} 
                                                                                            onChange={(e) => {
                                                                                                const val = parseFloat(e.target.value) || 0;
                                                                                                setDerivadosSeleccionados(prev => prev.map(x => x.id_producto_destino === id ? { ...x, porcentaje_costo: val } : x));
                                                                                            }}
                                                                                            className="w-14 px-1 py-0.5 bg-white border border-gray-200 rounded text-center font-black text-slate-800 text-[10px] outline-none focus:border-orange-450 focus:ring-1 focus:ring-orange-400/20"
                                                                                        />
                                                                                    </div>
                                                                                </>
                                                                            )}
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => setDerivadosSeleccionados(prev => prev.filter(x => x.id_producto_destino !== id))}
                                                                                className="p-1 text-red-400 hover:text-red-650 hover:bg-red-50 rounded-lg active:scale-90 transition-all shrink-0"
                                                                            >
                                                                                <Trash2 size={12} />
                                                                            </button>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                            {!isDistribucion && (
                                                                <div className="flex flex-col gap-1 px-2 pt-1.5 border-t border-gray-100 text-[9px] font-black uppercase">
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-slate-400">Total Costo Distribuido:</span>
                                                                        <span className={Math.abs(totalPorcentajeDerivados - 100) < 0.001 ? 'text-emerald-600' : 'text-amber-600'}>
                                                                            {totalPorcentajeDerivados.toFixed(2)}% {Math.abs(totalPorcentajeDerivados - 100) > 0.001 && '(Recomendado: 100%)'}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-slate-400">Total Corte Distribuido:</span>
                                                                        <span className={Math.abs(totalCorteDerivados - 100) < 0.001 ? 'text-emerald-600' : 'text-amber-600'}>
                                                                            {totalCorteDerivados.toFixed(2)}% {Math.abs(totalCorteDerivados - 100) > 0.001 && '(Recomendado: 100%)'}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="text-[8px] font-bold text-slate-450 italic bg-white p-3.5 rounded-xl border border-gray-100 text-center">
                                                            No se han asociado productos derivados. Utilice el buscador para agregar.
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Check 2: Resultado de Transformación */}
                                        <label className="flex items-center justify-between p-3.5 rounded-xl bg-purple-50/30 border border-purple-100 cursor-pointer hover:bg-purple-50 transition-all group/toggle">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black text-purple-900 uppercase tracking-widest leading-none">
                                                    {isDistribucion ? 'Resultado de Reenvasado' : 'Resultado de Transformación'}
                                                </span>
                                                <span className="text-[9px] font-bold text-purple-600/60 italic mt-1">
                                                    {isDistribucion ? '¿Es un producto obtenido del reenvasado de otro?' : '¿Es un producto obtenido del proceso?'}
                                                </span>
                                            </div>
                                            <input
                                                type="checkbox"
                                                {...formik.getFieldProps('es_resultado_transformacion')}
                                                checked={formik.values.es_resultado_transformacion}
                                                className="w-5 h-5 rounded-lg text-purple-600 focus:ring-purple-500 cursor-pointer transition-transform group-active/toggle:scale-90"
                                            />
                                        </label>

                                        {formik.values.es_resultado_transformacion && (
                                            <div className="px-4 py-3 rounded-2xl bg-purple-50/15 border border-purple-100/50 space-y-4 animate-in fade-in duration-300">
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] font-black text-purple-955 uppercase tracking-widest leading-none">
                                                        {isDistribucion ? 'Orígenes de Reenvasado' : 'Orígenes de Transformación'}
                                                    </span>
                                                    <span className="text-[8px] font-bold text-purple-600/60 italic mt-1">
                                                        {isDistribucion 
                                                            ? 'Busque y agregue los insumos a granel de los cuales proviene este producto.' 
                                                            : 'Busque y agregue los insumos origen de los cuales proviene este producto.'}
                                                    </span>
                                                </div>

                                                {/* Buscador Predictivo */}
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        placeholder="Buscar producto origen..."
                                                        value={searchOrigen}
                                                        onChange={e => setSearchOrigen(e.target.value)}
                                                        onFocus={() => setShowDropdownOrigenes(true)}
                                                        onBlur={() => setTimeout(() => setShowDropdownOrigenes(false), 200)}
                                                        className="w-full px-3 py-2.5 rounded-xl border border-gray-150 bg-white text-[10px] font-bold text-slate-750 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/10 transition-all placeholder:text-slate-350 placeholder:italic"
                                                    />
                                                    
                                                    {showDropdownOrigenes && (
                                                        <div className="absolute z-[20] top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-40 overflow-y-auto custom-scrollbar">
                                                            {origenesSugeridos.length > 0 ? (
                                                                origenesSugeridos.map(prod => {
                                                                    const prodLabel = [prod.rubro?.nombre, prod.marca?.nombre, prod.variedad].filter(Boolean).join(' · ');
                                                                    return (
                                                                        <div
                                                                            key={prod.id}
                                                                            onClick={() => {
                                                                                setOrigenesSeleccionados(prev => [...prev, { id_producto_origen: prod.id, porcentaje_costo: isDistribucion ? 100.00 : 0.00, porcentaje_corte: isDistribucion ? 100.00 : 0.00 }]);
                                                                                setSearchOrigen('');
                                                                                setShowDropdownOrigenes(false);
                                                                            }}
                                                                            className="px-3.5 py-2.5 hover:bg-purple-50 hover:text-purple-950 text-[9px] font-black text-slate-650 cursor-pointer flex justify-between items-center transition-colors uppercase border-b border-gray-50 last:border-b-0"
                                                                        >
                                                                            <span>{prodLabel}</span>
                                                                            <span className="text-[8px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-extrabold uppercase">Seleccionar</span>
                                                                        </div>
                                                                    );
                                                                })
                                                            ) : (
                                                                <div className="px-3.5 py-2.5 text-[9px] font-bold text-slate-450 italic text-center">Sin sugerencias coincidentes o vacías</div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Lista de Seleccionados */}
                                                <div className="space-y-1">
                                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider ml-1">Orígenes Mapeados ({origenesSeleccionados.length})</span>
                                                    {origenesSeleccionados.length > 0 ? (
                                                        <div className="space-y-1.5 bg-white p-2.5 rounded-xl border border-gray-100 shadow-inner">
                                                            <div className="space-y-1.5 overflow-y-auto custom-scrollbar pr-1">
                                                                {origenesSeleccionados.map(orig => {
                                                                    const id = orig.id_producto_origen;
                                                                    const prod = productosOrigenes.find(p => p.id === id);
                                                                    if (!prod) return null;
                                                                    const prodLabel = [prod.rubro?.nombre, prod.marca?.nombre, prod.variedad].filter(Boolean).join(' · ');
                                                                    return (
                                                                        <div key={id} className="flex items-center justify-between p-2 rounded-lg bg-purple-50/30 border border-purple-100/20 text-[9px] font-extrabold text-slate-700 uppercase animate-in slide-in-from-top-1 duration-200 gap-2">
                                                                            <span className="truncate flex-1">{prodLabel}</span>
                                                                            {!isDistribucion && (
                                                                                <>
                                                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                                                        <span className="text-[8px] text-slate-400 font-black">% CORTE:</span>
                                                                                        <input 
                                                                                            type="number" 
                                                                                            step="0.01" 
                                                                                            min="0"
                                                                                            max="100"
                                                                                            value={orig.porcentaje_corte || 0.00} 
                                                                                            onChange={(e) => {
                                                                                                const val = parseFloat(e.target.value) || 0;
                                                                                                setOrigenesSeleccionados(prev => prev.map(x => x.id_producto_origen === id ? { ...x, porcentaje_corte: val } : x));
                                                                                            }}
                                                                                            className="w-14 px-1 py-0.5 bg-white border border-gray-200 rounded text-center font-black text-slate-800 text-[10px] outline-none focus:border-purple-450 focus:ring-1 focus:ring-purple-400/20"
                                                                                        />
                                                                                    </div>
                                                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                                                        <span className="text-[8px] text-slate-400 font-black">% COSTO:</span>
                                                                                        <input 
                                                                                            type="number" 
                                                                                            step="0.01" 
                                                                                            min="0"
                                                                                            max="100"
                                                                                            value={orig.porcentaje_costo} 
                                                                                            onChange={(e) => {
                                                                                                const val = parseFloat(e.target.value) || 0;
                                                                                                setOrigenesSeleccionados(prev => prev.map(x => x.id_producto_origen === id ? { ...x, porcentaje_costo: val } : x));
                                                                                            }}
                                                                                            className="w-14 px-1 py-0.5 bg-white border border-gray-200 rounded text-center font-black text-slate-800 text-[10px] outline-none focus:border-purple-450 focus:ring-1 focus:ring-purple-400/20"
                                                                                        />
                                                                                    </div>
                                                                                </>
                                                                            )}
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => setOrigenesSeleccionados(prev => prev.filter(x => x.id_producto_origen !== id))}
                                                                                className="p-1 text-red-400 hover:text-red-650 hover:bg-red-50 rounded-lg active:scale-90 transition-all shrink-0"
                                                                            >
                                                                                <Trash2 size={12} />
                                                                            </button>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                            {!isDistribucion && (
                                                                <div className="flex flex-col gap-1 px-2 pt-1.5 border-t border-gray-100 text-[9px] font-black uppercase">
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-slate-400">Total Costo Distribuido:</span>
                                                                        <span className={Math.abs(totalPorcentajeOrigenes - 100) < 0.001 ? 'text-emerald-600' : 'text-amber-600'}>
                                                                            {totalPorcentajeOrigenes.toFixed(2)}% {Math.abs(totalPorcentajeOrigenes - 100) > 0.001 && '(Recomendado: 100%)'}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-slate-400">Total Corte Distribuido:</span>
                                                                        <span className={Math.abs(totalCorteOrigenes - 100) < 0.001 ? 'text-emerald-600' : 'text-amber-600'}>
                                                                            {totalCorteOrigenes.toFixed(2)}% {Math.abs(totalCorteOrigenes - 100) > 0.001 && '(Recomendado: 100%)'}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="text-[8px] font-bold text-slate-450 italic bg-white p-3.5 rounded-xl border border-gray-100 text-center">
                                                            No se han asociado productos origen. Utilice el buscador para agregar.
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Check 3: Reprocesable (Insumo de Reproceso) */}
                                        {!isDistribucion && (
                                            <>
                                                <label className="flex items-center justify-between p-3.5 rounded-xl bg-indigo-50/30 border border-indigo-100 cursor-pointer hover:bg-indigo-50 transition-all group/toggle">
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-black text-indigo-900 uppercase tracking-widest leading-none">Insumo de Reproceso</span>
                                                        <span className="text-[9px] font-bold text-indigo-600/60 italic mt-1">¿Este producto puede ser reprocesado por molienda?</span>
                                                    </div>
                                                    <input
                                                        type="checkbox"
                                                        {...formik.getFieldProps('es_reprocesable')}
                                                        checked={formik.values.es_reprocesable}
                                                        className="w-5 h-5 rounded-lg text-indigo-650 focus:ring-indigo-500 cursor-pointer transition-transform group-active/toggle:scale-90"
                                                    />
                                                </label>

                                                {formik.values.es_reprocesable && (
                                                    <div className="px-4 py-3 rounded-2xl bg-indigo-50/15 border border-indigo-100/50 space-y-4 animate-in fade-in duration-300">
                                                        
                                                        <div className="flex flex-col">
                                                            <span className="text-[9px] font-black text-indigo-955 uppercase tracking-widest leading-none">Subproductos de Reproceso</span>
                                                            <span className="text-[8px] font-bold text-indigo-600/60 italic mt-1">Busque y agregue los subproductos resultantes de la molienda de este producto.</span>
                                                        </div>

                                                        {/* Buscador Predictivo */}
                                                        <div className="relative">
                                                            <input
                                                                type="text"
                                                                placeholder="Buscar subproducto de salida..."
                                                                value={searchReproceso}
                                                                onChange={e => setSearchReproceso(e.target.value)}
                                                                onFocus={() => setShowDropdownReprocesos(true)}
                                                                onBlur={() => setTimeout(() => setShowDropdownReprocesos(false), 200)}
                                                                className="w-full px-3 py-2.5 rounded-xl border border-gray-150 bg-white text-[10px] font-bold text-slate-750 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/10 transition-all placeholder:text-slate-350 placeholder:italic"
                                                            />
                                                            
                                                            {showDropdownReprocesos && (
                                                                <div className="absolute z-[20] top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-40 overflow-y-auto custom-scrollbar">
                                                                    {reprocesosSugeridos.length > 0 ? (
                                                                        reprocesosSugeridos.map(prod => {
                                                                            const prodLabel = [prod.rubro?.nombre, prod.marca?.nombre, prod.variedad].filter(Boolean).join(' · ');
                                                                            return (
                                                                                <div
                                                                                    key={prod.id}
                                                                                    onClick={() => {
                                                                                        setReprocesosSeleccionados(prev => [...prev, { id_producto_destino: prod.id, porcentaje_costo: 100.00, porcentaje_corte: 100.00 }]);
                                                                                        setSearchReproceso('');
                                                                                        setShowDropdownReprocesos(false);
                                                                                    }}
                                                                                    className="px-3.5 py-2.5 hover:bg-indigo-50 hover:text-indigo-950 text-[9px] font-black text-slate-655 cursor-pointer flex justify-between items-center transition-colors uppercase border-b border-gray-50 last:border-b-0"
                                                                                >
                                                                                    <span>{prodLabel}</span>
                                                                                    <span className="text-[8px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-extrabold uppercase">Seleccionar</span>
                                                                                </div>
                                                                            );
                                                                        })
                                                                    ) : (
                                                                        <div className="px-3.5 py-2.5 text-[9px] font-bold text-slate-450 italic text-center">Sin sugerencias coincidentes o vacías</div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Lista de Seleccionados */}
                                                        <div className="space-y-1">
                                                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider ml-1">Subproductos Mapeados ({reprocesosSeleccionados.length})</span>
                                                            {reprocesosSeleccionados.length > 0 ? (
                                                                <div className="space-y-1.5 bg-white p-2.5 rounded-xl border border-gray-100 shadow-inner">
                                                                    <div className="space-y-1.5 overflow-y-auto custom-scrollbar pr-1">
                                                                        {reprocesosSeleccionados.map(rep => {
                                                                            const id = rep.id_producto_destino;
                                                                            const prod = productosCortes.find(p => p.id === id);
                                                                            if (!prod) return null;
                                                                            const prodLabel = [prod.rubro?.nombre, prod.marca?.nombre, prod.variedad].filter(Boolean).join(' · ');
                                                                            return (
                                                                                <div key={id} className="flex items-center justify-between p-2 rounded-lg bg-indigo-50/30 border border-indigo-100/20 text-[9px] font-extrabold text-slate-700 uppercase animate-in slide-in-from-top-1 duration-200 gap-2">
                                                                                    <span className="truncate flex-1">{prodLabel}</span>
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => {
                                                                                            const isUtil = rep.porcentaje_costo > 0;
                                                                                            const newCosto = isUtil ? 0.00 : 100.00;
                                                                                            const newCorte = isUtil ? 0.00 : 100.00;
                                                                                            setReprocesosSeleccionados(prev => prev.map(x => x.id_producto_destino === id ? { ...x, porcentaje_costo: newCosto, porcentaje_corte: newCorte } : x));
                                                                                        }}
                                                                                        className={`px-3 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all duration-300 border shrink-0 active:scale-95 ${
                                                                                            rep.porcentaje_costo > 0
                                                                                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm shadow-emerald-900/10 hover:bg-emerald-100/50'
                                                                                            : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100/50'
                                                                                        }`}
                                                                                    >
                                                                                        {rep.porcentaje_costo > 0 ? 'Corte Útil' : 'Desperdicio (Costo $0.00)'}
                                                                                    </button>
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => setReprocesosSeleccionados(prev => prev.filter(x => x.id_producto_destino !== id))}
                                                                                        className="p-1 text-red-400 hover:text-red-650 hover:bg-red-50 rounded-lg active:scale-90 transition-all shrink-0"
                                                                                    >
                                                                                        <Trash2 size={12} />
                                                                                    </button>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="text-[8px] font-bold text-slate-450 italic bg-white p-3.5 rounded-xl border border-gray-150 text-center">
                                                                    No se han asociado subproductos. Utilice el buscador para agregar.
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        )}

                                        <label className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50/50 border border-slate-100 cursor-pointer hover:bg-slate-100/50 transition-all group/status">
                                            <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Estado del Producto</span>
                                            <input type="checkbox" {...formik.getFieldProps('estatus')} checked={formik.values.estatus} className="w-5 h-5 rounded-lg text-brand-900 focus:ring-brand-accent cursor-pointer" />
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 bg-brand-50/50 border border-brand-100 rounded-3xl flex gap-3">
                                <Info size={20} className="text-brand-600 flex-shrink-0" />
                                <p className="text-[10px] font-bold text-brand-900/70 leading-relaxed italic">
                                    Configure el stock mínimo para recibir alertas automáticas cuando las existencias estén por debajo del límite definido.
                                </p>
                            </div>

                            {/* Sección de Depreciación (Solo visible si el almacén es de activos) */}
                            {isActivoFijo && (
                                <div className="bg-brand-50/30 p-6 rounded-3xl border border-brand-200 shadow-sm space-y-4">
                                    <h4 className="text-[10px] font-black text-brand-900 uppercase tracking-widest flex items-center gap-2">
                                        <Landmark size={14} /> Configuración Financiera (Depreciación)
                                    </h4>
                                    
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo de Depreciación</label>
                                        <select {...formik.getFieldProps('id_tipo_depreciacion')} className="w-full px-4 py-3 rounded-md border border-gray-100 bg-white text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-brand-accent/5 focus:border-brand-accent transition-all">
                                            <option value="">-- N/A (Gasto Directo) --</option>
                                            {tiposDepreciacion.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                                        </select>
                                    </div>

                                    {formik.values.id_tipo_depreciacion && selectedTipoDepreciacion && selectedTipoDepreciacion.codigo !== 'GASTO_DIRECTO' && (
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                                Valor del Cálculo ({selectedTipoDepreciacion.unidad_medida})
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    step="any"
                                                    {...formik.getFieldProps('valor_calculo_depreciacion')}
                                                    placeholder="Ej: 40"
                                                    className="w-full px-5 py-3 rounded-md border border-gray-100 bg-white text-sm font-black text-slate-700 outline-none focus:ring-4 focus:ring-brand-accent/5 focus:border-brand-accent transition-all"
                                                />
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300 uppercase tracking-widest">
                                                    {selectedTipoDepreciacion.unidad_medida}
                                                </div>
                                            </div>
                                            <p className="text-[9px] text-slate-400 font-bold px-1 italic mt-1">
                                                {selectedTipoDepreciacion.descripcion}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Sección de Config. Despacho Cocina (Solo utensilios) */}
                            {(isCategoriaUtensilios || isCategoriaDesechables) && (
                                <div className="bg-orange-50/40 p-5 rounded-3xl border border-orange-200 shadow-sm space-y-4">
                                    <h4 className="text-[10px] font-black text-orange-800 uppercase tracking-widest flex items-center gap-2">
                                        <Truck size={14} /> Configuración de Despacho de Cocina
                                    </h4>
                                    <p className="text-[9px] font-bold text-orange-600/70 italic -mt-2">
                                        Solo aplica para utensilios de transporte de raciones (termos, cavas, recipientes Chefandish...).
                                    </p>

                                    <label className="flex items-center justify-between p-3.5 rounded-xl bg-white border border-orange-200 cursor-pointer hover:bg-orange-50 transition-all group/toggle">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black text-orange-900 uppercase tracking-widest leading-none">Recipiente de Transporte</span>
                                            <span className="text-[9px] font-bold text-orange-600/60 italic mt-1">¿Es apto para contener y transportar raciones de alimentos?</span>
                                        </div>
                                        <input
                                            type="checkbox"
                                            {...formik.getFieldProps('es_recipiente_transporte')}
                                            checked={formik.values.es_recipiente_transporte}
                                            className="w-5 h-5 rounded-lg text-orange-600 focus:ring-orange-400 cursor-pointer transition-transform group-active/toggle:scale-90"
                                        />
                                    </label>

                                    {formik.values.es_recipiente_transporte && (
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                                Tara Estándar (KG)
                                            </label>
                                            <input
                                                type="number"
                                                step="0.001"
                                                {...formik.getFieldProps('peso_tara_estandar')}
                                                placeholder="Ej: 2.500"
                                                className="w-full px-5 py-3 rounded-md border border-orange-200 bg-white text-sm font-black text-slate-700 outline-none focus:ring-4 focus:ring-orange-400/20 focus:border-orange-400 transition-all"
                                            />
                                            <p className="text-[9px] text-orange-600/70 font-bold px-1 italic">Peso vacío del recipiente. Se autocompletará en el formulario de despacho.</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* SECCIÓN LOGÍSTICA INDUSTRIAL */}
                    <div className="space-y-4">

                        {/* Toggle: Producto de Peso Variable */}
                        <label className="flex items-center justify-between p-3.5 rounded-xl bg-blue-50/60 border border-blue-200 cursor-pointer hover:bg-blue-50 transition-all group/toggle">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-blue-900 uppercase tracking-widest leading-none">Producto de Peso Variable</span>
                                <span className="text-[9px] font-bold text-blue-600/70 italic mt-1">
                                    Activa si cada empaque (bolsa, bandeja) tiene peso diferente en báscula.
                                    El picking pedirá capturar los KG reales y la cantidad de empaques por separado.
                                </span>
                            </div>
                            <input
                                type="checkbox"
                                {...formik.getFieldProps('peso_variable')}
                                checked={formik.values.peso_variable}
                                className="w-5 h-5 rounded-lg text-blue-600 focus:ring-blue-400 cursor-pointer transition-transform group-active/toggle:scale-90"
                            />
                        </label>

                        {/* Toggle: Subproducto / Desecho */}
                        <label className="flex items-center justify-between p-3.5 rounded-xl bg-amber-50/60 border border-amber-200 cursor-pointer hover:bg-amber-50 transition-all group/toggle">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-amber-900 uppercase tracking-widest leading-none">Subproducto / Desecho Cárnico</span>
                                <span className="text-[9px] font-bold text-amber-600/70 italic mt-1">
                                    Activa si este producto es considerado un subproducto (grasa, piel, hueso, patas, pescuezo) en el balance de masa de desposte.
                                </span>
                            </div>
                            <input
                                type="checkbox"
                                {...formik.getFieldProps('es_subproducto')}
                                checked={formik.values.es_subproducto}
                                className="w-5 h-5 rounded-lg text-amber-600 focus:ring-amber-400 cursor-pointer transition-transform group-active/toggle:scale-90"
                            />
                        </label>

                        <div className="flex items-center justify-between px-2">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-brand-900 rounded-lg text-white shadow-lg shadow-brand-900/20">
                                    <QrCode size={18} />
                                </div>
                                <div>
                                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest leading-none">Configuración Logística</h4>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Presentaciones y Factores de Conversión</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => formik.setFieldValue('logistica', [...formik.values.logistica, { id_presentacion: '', codigo_barras: '', factor: 0, es_base: false, cant_base: 1, relacion_index: 0, orden: formik.values.logistica.length + 1 }])}
                                className="flex items-center gap-2 px-4 py-2 bg-brand-50 text-brand-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-900 hover:text-white transition-all shadow-sm active:scale-95 group"
                            >
                                <Plus size={14} className="group-hover:rotate-90 transition-transform duration-300" />
                                <span>Añadir Presentación</span>
                            </button>
                        </div>

                        <div className="bg-white rounded-md border border-gray-100 shadow-sm overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50/50">
                                        <th className="px-1 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center w-[5%]">#</th>
                                        <th className="px-1 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center w-[5%]">Base</th>
                                        <th className="px-1 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Ref. Stock</th>
                                        <th className="px-1 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Presentación</th>
                                        <th className="px-1 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center w-[15%]">Relativo a...</th>
                                        <th className="px-1 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center w-[12%]">Contenido</th>
                                        <th className="px-1 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center w-[12%]">Total ({selectedRubro?.almacen_unidades_medida?.abreviatura || 'U'})</th>
                                        <th className="px-1 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest w-[15%]">Cód. Barras</th>
                                        <th className="px-1 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center w-12">Activo</th>
                                        <th className="px-1 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right w-12"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {formik.values.logistica
                                        .map((item, index) => ({ ...item, originalIndex: index }))
                                        .sort((a, b) => (a.orden || 0) - (b.orden || 0) || (a.factor || 0) - (b.factor || 0))
                                        .map((item) => {
                                            const index = item.originalIndex;
                                            return (
                                                <tr key={index} className={`hover:bg-slate-50/50 transition-colors ${item.es_base ? 'bg-brand-50/20' : ''}`}>
                                                    {/* 1. Orden */}
                                                    <td className="px-1 py-2">
                                                        <input
                                                            type="text"
                                                            value={item.orden ?? ''}
                                                            onChange={(e) => {
                                                                const val = e.target.value.replace(/\D/g, '');
                                                                const newList = [...formik.values.logistica];
                                                                newList[index].orden = val === '' ? '' : parseInt(val);
                                                                formik.setFieldValue('logistica', newList);
                                                            }}
                                                            className="w-full bg-transparent border-none text-[10px] font-black text-center text-slate-400 focus:ring-0"
                                                        />
                                                    </td>
                                                    {/* 2. Es Base */}
                                                    <td className="px-1 py-2 text-center">
                                                        <input
                                                            type="radio"
                                                            name="es_base_radio"
                                                            checked={item.es_base}
                                                            disabled={!!item.id}
                                                            onChange={() => {
                                                                const newList = formik.values.logistica.map((l, i) => ({
                                                                    ...l,
                                                                    es_base: i === index,
                                                                    // factor: i === index ? 1 : l.factor, // COMENTADO: No queremos resetear a 1
                                                                    relacion_index: i === index ? -1 : l.relacion_index
                                                                }));
                                                                formik.setFieldValue('logistica', newList);
                                                            }}
                                                            className="w-4 h-4 text-brand-900 focus:ring-brand-accent rounded cursor-pointer"
                                                        />
                                                    </td>
                                                    {/* 3. Ref Stock */}
                                                    <td className="px-1 py-2 text-center">
                                                        <input
                                                            type="radio"
                                                            name="es_stock_minimo_radio"
                                                            checked={item.es_stock_minimo}
                                                            onChange={() => {
                                                                const newList = formik.values.logistica.map((l, i) => ({
                                                                    ...l,
                                                                    es_stock_minimo: i === index
                                                                }));
                                                                formik.setFieldValue('logistica', newList);
                                                            }}
                                                            className="w-4 h-4 text-amber-500 focus:ring-amber-400 cursor-pointer"
                                                        />
                                                    </td>
                                                    {/* 4. Presentación */}
                                                    <td className="px-1 py-2">
                                                        <select
                                                            value={item.id_presentacion}
                                                            disabled={!!item.id}
                                                            onChange={(e) => {
                                                                const newList = [...formik.values.logistica];
                                                                newList[index].id_presentacion = e.target.value;
                                                                formik.setFieldValue('logistica', newList);
                                                            }}
                                                            className={`w-full p-2 bg-transparent border-none text-[10px] font-black uppercase focus:ring-0 ${!!item.id ? 'text-slate-400 cursor-not-allowed' : 'text-brand-900'}`}
                                                        >
                                                            <option value="">Seleccione...</option>
                                                            {presentaciones.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                                                        </select>
                                                    </td>
                                                    {/* 5. Relativo a */}
                                                    <td className="px-1 py-2">
                                                        {!item.es_base ? (
                                                            <select
                                                                value={item.relacion_index}
                                                                onChange={(e) => {
                                                                    const relIdx = parseInt(e.target.value);
                                                                    const newList = [...formik.values.logistica];
                                                                    newList[index].relacion_index = relIdx;

                                                                    // Al cambiar el padre, queremos PRESERVAR el factor total y ajustar la cant_base
                                                                    const parentFactor = relIdx === -1 ? 1 : (newList[relIdx]?.factor || 1);
                                                                    newList[index].cant_base = (newList[index].factor / parentFactor);

                                                                    formik.setFieldValue('logistica', newList);
                                                                }}
                                                                className={`w-full p-2 bg-transparent border-none text-[10px] font-black uppercase focus:ring-0 ${!item.estatus ? '' : 'text-brand-600'}`}
                                                            >
                                                                {/* <option value={-1}>LA BASE ({selectedRubro?.almacen_unidades_medida?.abreviatura || 'U'})</option> */}
                                                                {formik.values.logistica.map((l, i) => (
                                                                    i !== index && l.id_presentacion && (
                                                                        <option key={i} value={i}>
                                                                            {presentaciones.find(p => p.id == l.id_presentacion)?.nombre || 'OTRA'}
                                                                        </option>
                                                                    )
                                                                ))}
                                                            </select>
                                                        ) : (
                                                            <div className="text-center text-[10px] font-black text-slate-300 italic">--</div>
                                                        )}
                                                    </td>
                                                    {/* 6. Contenido */}
                                                    <td className="px-1 py-2">
                                                        <div className="flex flex-col items-center gap-1">
                                                            {!item.es_base ? (
                                                                <>
                                                                    <input
                                                                        type="number"
                                                                        step="1"
                                                                        value={item.cant_base}
                                                                        onChange={(e) => {
                                                                            const cant = parseFloat(e.target.value) || 0;
                                                                            const newList = [...formik.values.logistica];
                                                                            const relIdx = newList[index].relacion_index;
                                                                            newList[index].cant_base = cant;
                                                                            const recalculateChildren = (list) => {
                                                                                list.forEach((l, i) => {
                                                                                    if (l.relacion_index !== -1) {
                                                                                        const parent = list[l.relacion_index];
                                                                                        const factorValue = parent ? (l.cant_base * parent.factor) : l.cant_base;
                                                                                        list[i].factor = parseFloat(Number(factorValue).toFixed(3));
                                                                                    }
                                                                                });
                                                                            };
                                                                            recalculateChildren(newList);
                                                                            formik.setFieldValue('logistica', newList);
                                                                        }}
                                                                        className={`w-full p-2 text-center rounded-lg text-xs font-black outline-none transition-all ${!item.estatus ? 'bg-gray-100/50' : 'bg-brand-50 text-brand-700 focus:ring-2 focus:ring-brand-accent/20'}`}
                                                                    />
                                                                    <span className="text-[7px] font-black text-slate-400 uppercase italic whitespace-nowrap leading-none">
                                                                        1 {presentaciones.find(p => p.id == item.id_presentacion)?.nombre || 'PRES.'} = {Number(item.cant_base).toLocaleString()} {item.relacion_index === -1 ? (selectedRubro?.almacen_unidades_medida?.abreviatura || 'U') : (presentaciones.find(p => p.id == formik.values.logistica[item.relacion_index]?.id_presentacion)?.nombre || 'REF.')}
                                                                    </span>
                                                                </>
                                                            ) : (
                                                                <span className="text-[10px] font-black text-slate-300 italic">UNIDAD BASE</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    {/* 7. Total (Calculado) */}
                                                    <td className="px-1 py-2">
                                                        <div className="flex items-center justify-center">
                                                            {item.es_base ? (
                                                                <input
                                                                    type="number"
                                                                    step="any"
                                                                    value={item.factor}
                                                                    onChange={(e) => {
                                                                        const val = parseFloat(e.target.value) || 0;
                                                                        const newList = [...formik.values.logistica];
                                                                        newList[index].factor = val;

                                                                        // Recalcular hijos que dependen de esta base
                                                                        const recalculateChildren = (list) => {
                                                                            list.forEach((l, i) => {
                                                                                if (l.relacion_index !== -1) {
                                                                                    const parent = list[l.relacion_index];
                                                                                    if (parent) {
                                                                                        const factorValue = l.cant_base * parent.factor;
                                                                                        list[i].factor = parseFloat(Number(factorValue).toFixed(3));
                                                                                    }
                                                                                }
                                                                            });
                                                                        };
                                                                        recalculateChildren(newList);
                                                                        formik.setFieldValue('logistica', newList);
                                                                    }}
                                                                    className="w-full p-2 text-center rounded-lg text-[11px] font-black bg-brand-900 text-white border-none shadow-md focus:ring-2 focus:ring-brand-accent/50 outline-none"
                                                                />
                                                            ) : (
                                                                <div className={`w-full p-2 text-center rounded-lg text-[11px] font-black border border-dashed transition-all duration-300 bg-slate-50 text-slate-500 border-slate-200`}>
                                                                    {item.factor}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    {/* 8. Código de Barras */}
                                                    <td className="px-1 py-2">
                                                        <input
                                                            type="text"
                                                            value={item.codigo_barras}
                                                            onChange={(e) => {
                                                                const newList = [...formik.values.logistica];
                                                                newList[index].codigo_barras = e.target.value.replace(/\s/g, '').toUpperCase();
                                                                formik.setFieldValue('logistica', newList);
                                                            }}
                                                            placeholder={!!item.id ? '' : "Escanee..."}
                                                            className={`w-full p-2 bg-transparent border-none text-xs font-bold focus:ring-0 placeholder:italic placeholder:text-slate-300 ${!item.estatus ? '' : 'text-slate-700'}`}
                                                        />
                                                    </td>
                                                    {/* 9. Activo */}
                                                    <td className="px-1 py-2 text-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={item.estatus !== false}
                                                            onChange={(e) => {
                                                                const newList = [...formik.values.logistica];
                                                                newList[index].estatus = e.target.checked;
                                                                formik.setFieldValue('logistica', newList);
                                                            }}
                                                            className="w-4 h-4 text-brand-900 focus:ring-brand-accent rounded cursor-pointer"
                                                        />
                                                    </td>
                                                    {/* 10. Acciones */}
                                                    <td className="px-1 py-2 text-right">
                                                        {!item.id && !item.es_base && (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const newList = formik.values.logistica.filter((_, i) => i !== index);
                                                                    formik.setFieldValue('logistica', newList);
                                                                }}
                                                                className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </form>

                {/* Footer */}
                <div className="p-8 border-t border-gray-100 bg-white flex items-center justify-end gap-4 sticky bottom-0 z-20">
                    <button type="button" onClick={onClose} className="px-8 py-3 text-[11px] font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest transition-colors">
                        Cancelar
                    </button>
                    <button type="submit" onClick={formik.handleSubmit} disabled={formik.isSubmitting || !isFormDirty} className={`bg-brand-900 text-white px-12 py-3.5 rounded-md text-xs font-black hover:bg-brand-600 shadow-xl shadow-brand-accent/30 transition-all active:scale-95 flex items-center gap-3 uppercase tracking-widest ${(!isFormDirty || formik.isSubmitting) ? 'opacity-50 cursor-not-allowed shadow-none' : ''}`}>
                        {formik.isSubmitting && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                        {isEdit ? 'Guardar Cambios' : 'Registrar Producto'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
