import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, LayoutGrid, AlertTriangle, Tag, Warehouse, Ruler, ShieldAlert, History, Hand, Thermometer, Flame, Plus, Trash2, Copy, Layers, User, Utensils } from 'lucide-react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { createRubro, updateRubro, createRubrosBatch } from '../../../services/rubroService';
import { getCategorias } from '../../../services/categoriaService';
import { getUnidadesMedida } from '../../../services/unidadesmedidaService';
import { getMermasByCategoria } from '../../../services/categoriaMermaService';
import { getValoresMermaRubro, saveValoresMermaRubro, saveValoresMermaBatch } from '../../../services/rubroMermaService';

const validationSchema = Yup.object({
    nombre: Yup.string().when('isBulk', {
        is: false,
        then: () => Yup.string().required('El nombre es obligatorio').min(2, 'Mínimo 2 caracteres')
    }),
    id_categoria: Yup.string().required('Debe seleccionar una categoría'),
    id_unidad_medida: Yup.string().when('isBulk', {
        is: false,
        then: () => Yup.string().required('La unidad de medida es obligatoria')
    }),
    porcentaje_costo_indirecto: Yup.number().min(0, 'No puede ser negativo').nullable(),
    permite_merma_reposo: Yup.boolean().nullable()
});

export default function RubroModal({ initialData = null, id_categoria_preselected = null, empresaActiva, perfil, onClose, onUpdate }) {
    const isEdit = !!initialData;
    const [isBulk, setIsBulk] = useState(false);
    const [categorias, setCategorias] = useState([]);
    const [unidadesMedida, setUnidadesMedida] = useState([]);
    const [mermasConfig, setMermasConfig] = useState([]);
    const [loading, setLoading] = useState(true);

    const [bulkRows, setBulkRows] = useState([
        { id: Date.now(), nombre: '', id_unidad_medida: '', es_alergeno: false, solicitud_manual: false, requiere_marca: true, es_ingrediente: true, tipo_fraccionamiento: 'SOLO_EJECUCION', mermas: {} }
    ]);

    useEffect(() => {
        if (empresaActiva?.id) {
            fetchInitialData();
        }
    }, [empresaActiva?.id]);

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            const [catRes, uniRes] = await Promise.all([
                getCategorias(empresaActiva.id),
                getUnidadesMedida(empresaActiva.id)
            ]);
            setCategorias(catRes || []);
            setUnidadesMedida(uniRes || []);
        } catch (error) {
            console.error("Error al cargar maestros:", error);
        } finally {
            setLoading(false);
        }
    };

    const formik = useFormik({
        initialValues: {
            nombre: initialData?.nombre?.toUpperCase() || '',
            id_categoria: initialData?.id_categoria || id_categoria_preselected || '',
            id_unidad_medida: initialData?.id_unidad_medida || '',
            requiere_marca: initialData?.requiere_marca !== false,
            es_ingrediente: initialData?.es_ingrediente !== false,
            estatus: initialData?.estatus !== false,
            solicitud_manual: initialData?.solicitud_manual !== false,
            tipo_fraccionamiento: initialData?.tipo_fraccionamiento || 'SOLO_EJECUCION',
            es_alergeno: initialData?.es_alergeno || false,
            porcentaje_costo_indirecto: initialData?.porcentaje_costo_indirecto || 0,
            permite_merma_reposo: initialData?.permite_merma_reposo || false,
            mermas_valores: {},
            isBulk: false
        },
        enableReinitialize: true,
        validationSchema,
        onSubmit: async (values) => {
            try {
                if (isBulk) {
                    // VALIDACIÓN MASIVA SIMPLE
                    const validRows = bulkRows.filter(r => r.nombre.trim());
                    if (validRows.length === 0) throw new Error("Debe añadir al menos un rubro con nombre");
                    if (validRows.some(r => !r.id_unidad_medida)) throw new Error("Todos los rubros deben tener unidad de medida");

                    // Validar duplicados en el mismo lote
                    const nombresSet = new Set();
                    for (const r of validRows) {
                        const n = r.nombre.trim().toUpperCase();
                        if (nombresSet.has(n)) throw new Error(`El nombre "${n}" está duplicado en la lista.`);
                        nombresSet.add(n);
                    }

                    // 1. Preparar rubros masivos
                    const rubrosPayload = validRows.map(r => ({
                        nombre: r.nombre.trim().toUpperCase(),
                        id_categoria: values.id_categoria,
                        id_unidad_medida: r.id_unidad_medida,
                        es_alergeno: r.es_alergeno,
                        solicitud_manual: r.solicitud_manual,
                        requiere_marca: r.requiere_marca,
                        es_ingrediente: r.es_ingrediente,
                        tipo_fraccionamiento: r.tipo_fraccionamiento || 'SOLO_EJECUCION',
                        id_empresa: empresaActiva?.id,
                        estatus: true
                    }));

                    const createdRubros = await createRubrosBatch(rubrosPayload, perfil?.id);

                    // 2. Preparar mermas masivas
                    const mermasBatch = createdRubros.map((newRubro, idx) => {
                        const originalRow = validRows[idx];
                        return {
                            id_rubro: newRubro.id,
                            mermas: Object.entries(originalRow.mermas).map(([id_tipo, val]) => ({
                                id_tipo_merma: id_tipo,
                                valor: val
                            }))
                        };
                    });

                    await saveValoresMermaBatch(mermasBatch, perfil?.id);
                } else {
                    // MODO INDIVIDUAL
                    const payload = {
                        nombre: values.nombre.trim().toUpperCase(),
                        id_categoria: values.id_categoria,
                        id_unidad_medida: values.id_unidad_medida,
                        es_alergeno: values.es_alergeno,
                        solicitud_manual: values.solicitud_manual,
                        requiere_marca: values.requiere_marca,
                        es_ingrediente: values.es_ingrediente,
                        tipo_fraccionamiento: values.tipo_fraccionamiento,
                        estatus: values.estatus,
                        id_empresa: empresaActiva?.id,
                        porcentaje_costo_indirecto: parseFloat(values.porcentaje_costo_indirecto) || 0,
                        permite_merma_reposo: values.permite_merma_reposo,
                    };

                    let rubroId = initialData?.id;
                    if (isEdit) {
                        await updateRubro(initialData.id, payload, perfil?.id);
                    } else {
                        const newRubro = await createRubro(payload, perfil?.id);
                        rubroId = newRubro.id;
                    }

                    if (rubroId) {
                        const mermasPayload = Object.entries(values.mermas_valores).map(([id_tipo, val]) => ({
                            id_tipo_merma: id_tipo,
                            valor: val
                        }));
                        await saveValoresMermaRubro(rubroId, mermasPayload, perfil?.id);
                    }
                }

                onUpdate();
                onClose();
            } catch (err) {
                let msg = err.message || 'Error al procesar la solicitud';
                if (err.code === '23505') {
                    msg = 'Ya existe un rubro con ese nombre en esta categoría. Por favor, use un nombre diferente o cámbielo de categoría.';
                }
                formik.setStatus(msg);
            }
        },
    });

    useEffect(() => {
        if (formik.values.id_categoria) {
            loadMermasForCategory(formik.values.id_categoria);
        } else {
            setMermasConfig([]);
        }
    }, [formik.values.id_categoria]);

    const loadMermasForCategory = async (id_cat) => {
        try {
            const mermasIds = await getMermasByCategoria(id_cat);
            if (mermasIds && mermasIds.length > 0) {
                let valoresActuales = {};
                if (isEdit && initialData.id) {
                    const resValores = await getValoresMermaRubro(initialData.id);
                    resValores.forEach(rv => { valoresActuales[rv.id_tipo_merma] = rv.valor; });
                }

                const { data: detalles } = await await import('../../../lib/supabase').then(m =>
                    m.supabase.from('tipos_mermas').select('*').in('id', mermasIds)
                );
                setMermasConfig(detalles || []);

                if (!isBulk) {
                    const nuevosValores = { ...formik.values.mermas_valores };
                    mermasIds.forEach(id => {
                        if (nuevosValores[id] === undefined) nuevosValores[id] = valoresActuales[id] || 0;
                    });
                    formik.setFieldValue('mermas_valores', nuevosValores);
                } else {
                    // Actualizar mermas en todas las filas masivas si están vacías
                    setBulkRows(prev => prev.map(row => ({
                        ...row,
                        mermas: { ...Object.fromEntries(mermasIds.map(id => [id, 0])), ...row.mermas }
                    })));
                }
            } else {
                setMermasConfig([]);
                if (!isBulk) formik.setFieldValue('mermas_valores', {});
            }
        } catch (error) {
            console.error("Error al cargar configuración de mermas:", error);
        }
    };

    // Funciones para Bulk
    const addRow = () => {
        const lastRow = bulkRows[bulkRows.length - 1];
        setBulkRows([...bulkRows, {
            id: Date.now(),
            nombre: '',
            id_unidad_medida: /* lastRow?.id_unidad_medida ||  */'',
            es_alergeno: false,
            solicitud_manual: false,
            requiere_marca: false,
            es_ingrediente: true,
            tipo_fraccionamiento: 'SOLO_EJECUCION',
            mermas: { /* ...lastRow?.mermas */ }
        }]);
    };

    /* const duplicateRow = (index) => {
        const row = bulkRows[index];
        const newRow = { ...row, id: Date.now(), nombre: `${row.nombre} (COPIA)` };
        const newRows = [...bulkRows];
        newRows.splice(index + 1, 0, newRow);
        setBulkRows(newRows);
    }; */

    const deleteRow = (index) => {
        if (bulkRows.length > 1) {
            setBulkRows(bulkRows.filter((_, i) => i !== index));
        }
    };

    const updateRow = (index, field, value) => {
        const newRows = [...bulkRows];
        newRows[index][field] = value;
        setBulkRows(newRows);
    };

    const updateRowMerma = (rowIndex, mermaId, value) => {
        const newRows = [...bulkRows];
        newRows[rowIndex].mermas[mermaId] = value;
        setBulkRows(newRows);
    };

    const getMermaIcon = (nombre) => {
        const n = nombre?.toUpperCase() || '';
        if (n.includes('MANIPULACIÓN')) return <Hand size={14} className="text-amber-500" />;
        if (n.includes('DESCONGELACIÓN')) return <Thermometer size={14} className="text-blue-500" />;
        if (n.includes('COCCIÓN')) return <Flame size={14} className="text-orange-500" />;
        return <AlertTriangle size={14} />;
    };

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 animate-in fade-in duration-300" onClick={onClose}>
            <div className={`bg-white w-full h-full max-w-[90vw] max-h-[90vh] flex flex-col overflow-hidden rounded-[1.5rem] shadow-2xl animate-in zoom-in-95 duration-300 border border-white/20 ${isBulk ? 'max-w-[95vw] h-[90vh]' : 'max-w-2xl h-auto max-h-[90vh]'}`} onClick={(e) => e.stopPropagation()}>

                {/* Header */}
                <div className="px-8 py-5 border-b border-gray-100 flex items-center justify-between bg-white relative">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-500 to-brand-900" />
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-[1.2rem] flex items-center justify-center border shadow-inner ${isBulk ? 'bg-brand-900 text-white' : 'bg-brand-50 text-brand-600'}`}>
                            {isBulk ? <Layers size={22} /> : <LayoutGrid size={22} />}
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-800 tracking-tight leading-tight">
                                {isEdit ? 'Editar Rubro' : (isBulk ? 'Carga Masiva de Rubros' : 'Nuevo Rubro')}
                            </h3>
                            {!isEdit && (
                                <button
                                    type="button"
                                    onClick={() => { setIsBulk(!isBulk); formik.setFieldValue('isBulk', !isBulk); }}
                                    className={`text-[10px] font-black uppercase tracking-widest mt-1 px-3 py-1 rounded-full transition-all border ${isBulk ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-brand-600'}`}
                                >
                                    {isBulk ? 'Cambiar a Modo Individual' : 'Cambiar a Modo Masivo'}
                                </button>
                            )}
                        </div>
                    </div>
                    <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600">
                        <X size={22} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-hidden flex flex-col bg-gray-50/30">
                    <div className="px-8 py-1">
                        <div className="bg-white px-6 py-2 rounded-md border border-gray-200 shadow-sm flex items-center gap-6">
                            <div className="w-full max-w-xs space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Categoría Padre (Común)</label>
                                <select
                                    {...formik.getFieldProps('id_categoria')}
                                    className={`w-full px-4 py-3 rounded-md border transition-all text-sm font-bold text-slate-700 outline-none
                                    ${formik.touched.id_categoria && formik.errors.id_categoria ? 'border-red-300' : 'border-gray-100 focus:border-brand-accent focus:bg-white bg-gray-50/50'}`}
                                >
                                    <option value="">-- SELECCIONAR CATEGORÍA --</option>
                                    {categorias.map(cat => (
                                        <option key={cat.id} value={cat.id}>{cat.nombre} ({cat.almacenes?.nombre})</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex flex-col justify-end">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Estado de configuración</div>
                                <div className="flex items-center gap-2 mt-1">
                                    <div className={`w-2 h-2 rounded-full ${formik.values.id_categoria ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                                    <span className="text-xs font-black text-slate-700">{formik.values.id_categoria ? 'Categoría Lista' : 'Esperando Categoría'}</span>
                                </div>
                            </div>
                        </div>

                        {formik.status && (
                            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
                                <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />
                                <p className="text-xs font-bold text-red-700">{formik.status}</p>
                            </div>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto px-8 py-1 custom-scrollbar">
                        {!isBulk ? (
                            /* UI INDIVIDUAL */
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-bottom-4 duration-500">
                                <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-5">
                                    <h4 className="text-[10px] font-black text-brand-900 uppercase tracking-widest flex items-center gap-2 mb-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-brand-500" /> General
                                    </h4>
                                    <input type="text" {...formik.getFieldProps('nombre')} className="w-full px-4 py-3 rounded-md border border-gray-100 bg-gray-50/50 text-sm font-bold text-slate-700" placeholder="NOMBRE DEL RUBRO" />
                                    <select {...formik.getFieldProps('id_unidad_medida')} className="w-full px-4 py-3 rounded-md border border-gray-100 bg-gray-50/50 text-sm font-bold text-slate-700">
                                        <option value="">---</option>
                                        {unidadesMedida.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                                    </select>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Recargo / Costo Indirecto (%)</label>
                                        <div className="relative flex items-center">
                                            <input 
                                                type="number" 
                                                step="0.01" 
                                                min="0"
                                                {...formik.getFieldProps('porcentaje_costo_indirecto')} 
                                                className={`w-full pr-12 pl-4 py-3 rounded-md border text-sm font-bold text-slate-700 outline-none focus:border-brand-accent transition-all ${formik.touched.porcentaje_costo_indirecto && formik.errors.porcentaje_costo_indirecto ? 'border-red-300 bg-red-50/10' : 'border-gray-100 bg-gray-50/50'}`} 
                                                placeholder="0.00" 
                                            />
                                            <span className="absolute right-4 text-xs font-black text-slate-400">%</span>
                                        </div>
                                        {formik.touched.porcentaje_costo_indirecto && formik.errors.porcentaje_costo_indirecto ? (
                                            <p className="text-[10px] text-red-500 font-bold ml-1">{formik.errors.porcentaje_costo_indirecto}</p>
                                        ) : (
                                            <p className="text-[9px] text-slate-400 italic px-1">
                                                Porcentaje de recargo por costos indirectos (mermas adicionales, empaque, mano de obra) que se sumará al costo del insumo en el despote/reenvasado.
                                            </p>
                                        )}
                                    </div>
                                    {/* <label className="flex items-center justify-between p-3.5 rounded-md border border-slate-100 bg-slate-50/30">
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Solicitud Manual</span>
                                        <input type="checkbox" {...formik.getFieldProps('solicitud_manual')} checked={formik.values.solicitud_manual} className="w-5 h-5 rounded-lg text-indigo-600" />
                                    </label> */}
                                    <label className={`flex items-center justify-between p-4 rounded-3xl border transition-all ${formik.values.solicitud_manual ? 'bg-white border-slate-100' : 'bg-blue-50 border-blue-200'}`}>
                                        <div className="flex items-center gap-3">
                                            <Tag size={20} className={formik.values.solicitud_manual ? 'text-gray-300' : 'text-blue-500'} />
                                            <span className="text-[11px] font-black uppercase">Solicitud Manual</span>
                                        </div>
                                        <input type="checkbox" {...formik.getFieldProps('solicitud_manual')} checked={formik.values.solicitud_manual} className="w-6 h-6 text-blue-500" />
                                    </label>
                                    <label className={`flex items-center justify-between p-4 rounded-3xl border transition-all ${formik.values.requiere_marca ? 'bg-white border-slate-100' : 'bg-blue-50 border-blue-200'}`}>
                                        <div className="flex items-center gap-3">
                                            <Tag size={20} className={formik.values.requiere_marca ? 'text-gray-300' : 'text-blue-500'} />
                                            <span className="text-[11px] font-black uppercase">Requiere Marca</span>
                                        </div>
                                        <input type="checkbox" {...formik.getFieldProps('requiere_marca')} checked={formik.values.requiere_marca} className="w-6 h-6 text-blue-500" />
                                    </label>
                                    <label className={`flex items-center justify-between p-4 rounded-3xl border transition-all ${formik.values.es_alergeno ? 'bg-orange-50 border-orange-200' : 'bg-white'}`}>
                                        <div className="flex items-center gap-3">
                                            <ShieldAlert size={20} className={formik.values.es_alergeno ? 'text-orange-500' : 'text-gray-300'} />
                                            <span className="text-[11px] font-black uppercase">Contiene Alérgenos</span>
                                        </div>
                                        <input type="checkbox" {...formik.getFieldProps('es_alergeno')} checked={formik.values.es_alergeno} className="w-6 h-6 text-orange-500" />
                                    </label>
                                    <label className={`flex items-center justify-between p-4 rounded-3xl border transition-all ${formik.values.es_ingrediente ? 'bg-emerald-50 border-emerald-200' : 'bg-white'}`}>
                                        <div className="flex items-center gap-3">
                                            <Utensils size={20} className={formik.values.es_ingrediente ? 'text-emerald-500' : 'text-gray-300'} />
                                            <span className="text-[11px] font-black uppercase">Es Ingrediente de Cocina</span>
                                        </div>
                                        <input type="checkbox" {...formik.getFieldProps('es_ingrediente')} checked={formik.values.es_ingrediente} className="w-6 h-6 text-emerald-500" />
                                    </label>
                                    <label className={`flex items-center justify-between p-4 rounded-3xl border transition-all ${formik.values.permite_merma_reposo ? 'bg-blue-50 border-blue-200' : 'bg-white'}`}>
                                        <div className="flex items-center gap-3">
                                            <Thermometer size={20} className={formik.values.permite_merma_reposo ? 'text-blue-500' : 'text-gray-300'} />
                                            <span className="text-[11px] font-black uppercase">Permite Merma de Reposo (Deshielo)</span>
                                        </div>
                                        <input type="checkbox" {...formik.getFieldProps('permite_merma_reposo')} checked={formik.values.permite_merma_reposo} className="w-6 h-6 text-blue-500" />
                                    </label>

                                    <div className="space-y-2 pt-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Control de Fraccionamiento</label>
                                        <select
                                            {...formik.getFieldProps('tipo_fraccionamiento')}
                                            className="w-full px-4 py-3 rounded-md border border-gray-100 bg-gray-50/50 text-sm font-bold text-slate-700 outline-none focus:border-brand-accent transition-all"
                                        >
                                            <option value="NUNCA">NUNCA (Indivisible: Activos, Laptops)</option>
                                            <option value="SOLO_EJECUCION">SOLO EJECUCIÓN (Bulto en Despacho, Gramo en Cocina)</option>
                                            <option value="SIEMPRE">SIEMPRE (Pesar/Medir siempre: Verduras, Granel)</option>
                                        </select>
                                        <p className="text-[9px] text-slate-400 italic px-1">
                                            Determina si el almacén principal puede abrir el empaque original.
                                        </p>
                                    </div>
                                </div>
                                <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-5">
                                    <h4 className="text-[10px] font-black text-brand-900 uppercase tracking-widest flex items-center gap-2 mb-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-brand-500" /> Mermas (%)
                                    </h4>
                                    {mermasConfig.map(mc => (
                                        <div key={mc.id} className="flex items-center justify-between p-4 bg-gray-50/30 rounded-md border border-gray-100">
                                            <div className="flex items-center gap-3">
                                                {getMermaIcon(mc.nombre)}
                                                <span className="text-[10px] font-black uppercase">{mc.nombre}</span>
                                            </div>
                                            <input type="number" value={formik.values.mermas_valores[mc.id] || 0} onChange={e => formik.setFieldValue(`mermas_valores.${mc.id}`, e.target.value)} className="w-20 px-3 py-2 rounded-xl border border-gray-200 text-right text-xs font-black" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            /* UI MASIVA (MATRIX) */
                            <div className="bg-white rounded-md border border-gray-200 shadow-sm overflow-hidden animate-in fade-in duration-500 flex flex-col h-full">
                                <div className="flex items-center justify-between px-8 py-4 bg-gray-50/50 border-b border-gray-100">
                                    <span className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">Matriz de Entrada ({bulkRows.length} rubros)</span>
                                    <button type="button" onClick={addRow} className="flex items-center gap-2 px-4 py-2 bg-brand-900 text-white rounded-xl text-[10px] font-black uppercase hover:bg-brand-600 transition-all shadow-lg shadow-brand-accent/20">
                                        <Plus size={14} /> Fila Nueva
                                    </button>
                                </div>
                                <div className="flex-1 overflow-auto custom-scrollbar">
                                    <table className="w-full text-left border-collapse min-w-[1000px]">
                                        <thead className="sticky top-0 bg-white z-10">
                                            <tr className="bg-slate-50">
                                                <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-gray-100 w-12 text-center">#</th>
                                                <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-gray-100 min-w-[200px]">Nombre Rubro</th>
                                                <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-gray-100 min-w-[150px]">Unidad</th>
                                                <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-gray-100 text-center w-24">Alergeno</th>
                                                <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-gray-100 text-center w-24">Manual</th>
                                                <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-gray-100 text-center w-24">Marca</th>
                                                <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-gray-100 text-center w-24">Ingred.</th>
                                                <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-gray-100 min-w-[150px]">Fraccionamiento</th>
                                                {mermasConfig.map(mc => (
                                                    <th key={mc.id} className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-gray-100 text-center w-32">
                                                        <div className="flex flex-col items-center gap-1">
                                                            {getMermaIcon(mc.nombre)}
                                                            <span>% {mc.letra}</span>
                                                        </div>
                                                    </th>
                                                ))}
                                                <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-gray-100 text-right w-32">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 font-bold">
                                            {bulkRows.map((row, idx) => (
                                                <tr key={row.id} className="hover:bg-slate-50/50 transition-colors group">
                                                    <td className="px-6 py-1 text-[10px] text-slate-300 text-center">{idx + 1}</td>
                                                    <td className="px-4 py-1">
                                                        <input type="text" value={row.nombre} onChange={e => updateRow(idx, 'nombre', e.target.value)} className="w-full px-3 py-2 bg-gray-50/50 border border-gray-50 focus:bg-white focus:border-brand-accent rounded-xl text-xs font-bold outline-none uppercase transition-all" placeholder="Ej: CARNE..." />
                                                    </td>
                                                    <td className="px-4 py-1">
                                                        <select value={row.id_unidad_medida} onChange={e => updateRow(idx, 'id_unidad_medida', e.target.value)} className="w-full px-3 py-2 bg-gray-50/50 border border-gray-50 rounded-xl text-xs font-bold outline-none appearance-none cursor-pointer">
                                                            <option value="">--</option>
                                                            {unidadesMedida.map(u => <option key={u.id} value={u.id} title={u.nombre}>{u.abreviatura}</option>)}
                                                        </select>
                                                    </td>
                                                    <td className="px-4 py-1 text-center">
                                                        <input type="checkbox" checked={row.es_alergeno} onChange={e => updateRow(idx, 'es_alergeno', e.target.checked)} className="w-5 h-5 rounded-lg border-gray-200 text-orange-500 focus:ring-orange-500" />
                                                    </td>
                                                    <td className="px-4 py-1 text-center">
                                                        <input type="checkbox" checked={row.solicitud_manual} onChange={e => updateRow(idx, 'solicitud_manual', e.target.checked)} className="w-5 h-5 rounded-lg border-gray-200 text-indigo-600 focus:ring-indigo-500" />
                                                    </td>
                                                    <td className="px-4 py-1 text-center">
                                                        <input type="checkbox" checked={row.requiere_marca} onChange={e => updateRow(idx, 'requiere_marca', e.target.checked)} className="w-5 h-5 rounded-lg border-gray-200 text-blue-600 focus:ring-blue-500" />
                                                    </td>
                                                    <td className="px-4 py-1 text-center">
                                                        <input type="checkbox" checked={row.es_ingrediente} onChange={e => updateRow(idx, 'es_ingrediente', e.target.checked)} className="w-5 h-5 rounded-lg border-gray-200 text-emerald-600 focus:ring-emerald-500" />
                                                    </td>
                                                    <td className="px-4 py-1">
                                                        <select value={row.tipo_fraccionamiento} onChange={e => updateRow(idx, 'tipo_fraccionamiento', e.target.value)} className="w-full px-3 py-2 bg-gray-50/50 border border-gray-50 rounded-xl text-[10px] font-bold outline-none cursor-pointer">
                                                            <option value="NUNCA">NUNCA</option>
                                                            <option value="SOLO_EJECUCION">SOLO EJEC.</option>
                                                            <option value="SIEMPRE">SIEMPRE</option>
                                                        </select>
                                                    </td>
                                                    {mermasConfig.map(mc => (
                                                        <td key={mc.id} className="px-4 py-1 text-center">
                                                            <input type="number" min="0" max="100" value={row.mermas[mc.id] || 0} onChange={e => updateRowMerma(idx, mc.id, e.target.value)} className="w-20 px-3 py-2 bg-gray-50/50 border border-gray-50 rounded-xl text-center text-xs font-black text-brand-900 outline-none" />
                                                        </td>
                                                    ))}
                                                    <td className="px-6 py-1 text-right">
                                                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            {/* <button type="button" onClick={() => duplicateRow(idx)} className="p-2 text-slate-400 hover:text-brand-600 hover:bg-white rounded-lg transition-all" title="Duplicar">
                                                                <Copy size={14} />
                                                            </button> */}
                                                            <button type="button" onClick={() => deleteRow(idx)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-white rounded-lg transition-all" title="Eliminar">
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-8 py-4 border-t border-gray-100 bg-white flex items-center justify-between gap-4 sticky bottom-0 z-20">
                    <div className="flex items-center gap-4 text-slate-400">
                        {isBulk && <div className="text-[10px] font-bold uppercase tracking-widest">Atajo: Use el botón de duplicar para agilizar la carga</div>}
                    </div>
                    <div className="flex items-center gap-4">
                        <button type="button" onClick={onClose} className="px-8 py-3 text-[11px] font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest transition-colors">Cancelar</button>
                        <button type="submit" onClick={formik.handleSubmit} disabled={formik.isSubmitting || (!isBulk && !formik.dirty)} className={`bg-brand-900 text-white px-12 py-3.5 rounded-md text-xs font-black hover:bg-brand-600 shadow-xl shadow-brand-accent/30 transition-all active:scale-95 flex items-center gap-3 uppercase tracking-widest ${formik.isSubmitting ? 'opacity-50 cursor-not-allowed shadow-none' : ''}`}>
                            {formik.isSubmitting && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                            {isEdit ? 'Guardar Cambios' : (isBulk ? `Cargar ${bulkRows.filter(r => r.nombre.trim()).length} Rubros` : 'Crear Rubro')}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
