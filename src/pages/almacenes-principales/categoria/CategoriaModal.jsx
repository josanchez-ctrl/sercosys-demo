import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Tag, AlertTriangle, Warehouse } from 'lucide-react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { createCategoria, updateCategoria } from '../../../services/categoriaService';
import { getAlmacenes } from '../../../services/almacenService';
import { getTipoMerma } from '../../../services/tipomermaService';
import { getMermasByCategoria, saveMermasCategoria } from '../../../services/categoriaMermaService';

const validationSchema = Yup.object({
    nombre: Yup.string().required('El nombre es obligatorio').min(2, 'Mínimo 2 caracteres'),
    id_almacen: Yup.string().required('Debe seleccionar un almacén'),

    estatus: Yup.boolean(),
});

export default function CategoriaModal({ initialData = null, preselectedAlmacenId = '', empresaActiva, perfil, onClose, onUpdate }) {
    const isEdit = !!initialData;
    const [almacenes, setAlmacenes] = useState([]);
    const [tipomerma, setTipoMerma] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (empresaActiva?.id) {
            fetchData();
        }
    }, [empresaActiva?.id]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [almacenes, tipomerma] = await Promise.all([
                getAlmacenes(empresaActiva.id),
                getTipoMerma(empresaActiva.id)
            ]);
            setAlmacenes(almacenes);
            setTipoMerma(tipomerma);

            if (isEdit) {
                const mermasActivas = await getMermasByCategoria(initialData.id);
                formik.setFieldValue('ids_mermas', mermasActivas || []);
            }

        } catch (error) {
            console.error("Error al cargar maestros:", error);
        } finally {
            setLoading(false);
        }
    };

    const formik = useFormik({
        initialValues: {
            nombre: initialData?.nombre?.toUpperCase() || '',
            id_almacen: initialData?.id_almacen || preselectedAlmacenId || '',
            //descripcion: initialData?.descripcion || '',
            estatus: initialData?.estatus !== false,
            ids_mermas: [],
        },
        enableReinitialize: true,
        validationSchema,
        onSubmit: async (values) => {
            const payload = {
                nombre: values.nombre.trim().toUpperCase(),
                id_almacen: values.id_almacen,
                //descripcion: values.descripcion.trim(),
                estatus: values.estatus,
                id_empresa: empresaActiva?.id,
            };

            try {
                let categoryId = initialData?.id;

                if (isEdit) {
                    await updateCategoria(initialData.id, payload, perfil?.id);
                } else {
                    const newCat = await createCategoria(payload, perfil?.id);
                    categoryId = newCat.id;
                }

                // Guardar asociaciones de mermas
                if (categoryId) {
                    await saveMermasCategoria(categoryId, values.ids_mermas, perfil?.id);
                }

                onUpdate();
                onClose();
            } catch (err) {
                formik.setStatus(err.message || 'Error al procesar la solicitud');
            }
        },
    });

    const almacenesFiltrados = almacenes.filter(almacen =>
        perfil?.F_ALL
            ? true
            : perfil?.ids_almacenes?.includes(almacen.id)
    );

    return createPortal(
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 animate-in fade-in duration-300"
            onClick={onClose}
        >
            <div
                className="bg-white w-full h-full max-w-[60vw] max-h-[90vh] flex flex-col overflow-hidden rounded-[2.5rem] shadow-2xl animate-in zoom-in-95 duration-300 border border-white/20"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-8 py-5 border-b border-gray-100 flex items-center justify-between bg-white relative">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-500 to-brand-900" />
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-[1.2rem] flex items-center justify-center border shadow-inner ${isEdit ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-brand-50 text-brand-600 border-brand-100'}`}>
                            <Tag size={22} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-800 tracking-tight leading-tight">
                                {isEdit ? 'Editar Categoría' : 'Nueva Categoría'}
                            </h3>
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 italic">
                                {isEdit ? initialData.nombre : 'Clasificación de productos'}
                            </p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600">
                        <X size={22} />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={formik.handleSubmit} className="flex-1 p-8 space-y-6 bg-gray-50/30 overflow-y-auto">
                    {formik.status && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
                            <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />
                            <p className="text-xs font-bold text-red-700">{formik.status}</p>
                        </div>
                    )}

                    <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-6">

                        {/* Nombre */}
                        <div className="space-y-2">
                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">
                                Nombre de la Categoría
                            </label>
                            <input
                                type="text"
                                {...formik.getFieldProps('nombre')}
                                className={`w-full px-5 py-3.5 rounded-md border transition-all text-sm font-bold text-slate-700 outline-none bg-gray-50/50
                                ${formik.touched.nombre && formik.errors.nombre
                                        ? 'border-red-300 ring-4 ring-red-100'
                                        : 'border-gray-100 focus:ring-4 focus:ring-brand-accent/10 focus:border-brand-accent focus:bg-white'}`}
                                placeholder="EJ: VÍVERES, CÁRNICOS, LIMPIEZA..."
                            />
                            {formik.touched.nombre && formik.errors.nombre && (
                                <p className="text-[10px] font-bold text-red-500 ml-1 uppercase tracking-wider">{formik.errors.nombre}</p>
                            )}
                        </div>

                        {/* Almacén (Solo visible/editable para F_ALL) */}
                        {perfil?.F_ALL ? (
                            <div className="space-y-2 animate-in fade-in duration-300">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                                    <Warehouse size={12} /> Almacén Destino
                                </label>
                                <select
                                    {...formik.getFieldProps('id_almacen')}
                                    className={`w-full px-5 py-3.5 rounded-md border transition-all text-sm font-bold text-slate-700 outline-none bg-gray-50/50
                                    ${formik.touched.id_almacen && formik.errors.id_almacen
                                            ? 'border-red-300 ring-4 ring-red-100'
                                            : 'border-gray-100 focus:ring-4 focus:ring-brand-accent/10 focus:border-brand-accent focus:bg-white'}`}
                                >
                                    <option value="">-- SELECCIONAR ALMACÉN --</option>
                                    {almacenesFiltrados.map((alm) => (
                                        <option key={alm.id} value={alm.id}>{alm.nombre} ({alm.letra})</option>
                                    ))}
                                </select>
                                {formik.touched.id_almacen && formik.errors.id_almacen && (
                                    <p className="text-[10px] font-bold text-red-500 ml-1 uppercase tracking-wider">{formik.errors.id_almacen}</p>
                                )}
                            </div>
                        ) : (
                            /* Vista informativa para usuarios sin F_ALL */
                            <div className="bg-slate-50 p-4 rounded-xl border border-dashed border-slate-200 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white rounded-lg border border-slate-100 text-slate-400">
                                        <Warehouse size={16} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Almacén Destino</span>
                                        <span className="text-sm font-black text-slate-700 uppercase tracking-tight mt-1">
                                            {almacenes.find(a => a.id == formik.values.id_almacen)?.nombre || 'SIN ASIGNAR'}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 px-3 py-1 bg-brand-50 text-brand-700 rounded-full border border-brand-100 shadow-sm">
                                    <Tag size={10} />
                                    <span className="text-[9px] font-black uppercase tracking-widest">Bloqueado</span>
                                </div>
                            </div>
                        )}

                        {/* Tipo de Merma */}
                        <div className="space-y-4">
                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">
                                Tipos de Merma Aplicables <span className="normal-case font-medium text-slate-300 ml-1 italic">(Selección múltiple)</span>
                            </label>

                            <div className="grid grid-cols-1 gap-2 overflow-y-auto pr-2 custom-scrollbar">
                                {tipomerma.length > 0 ? (
                                    tipomerma.map((tm) => {
                                        const isChecked = formik.values.ids_mermas.includes(tm.id);
                                        return (
                                            <label
                                                key={tm.id}
                                                className={`flex items-center justify-between p-3.5 rounded-md border transition-all cursor-pointer group
                                                    ${isChecked
                                                        ? 'bg-brand-50/50 border-brand-200 ring-2 ring-brand-100/50'
                                                        : 'bg-gray-50/50 border-gray-100 hover:border-brand-200 hover:bg-white'}`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black tracking-widest
                                                        ${isChecked ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20' : 'bg-gray-200 text-gray-500'}`}>
                                                        {tm.letra}
                                                    </div>
                                                    <span className={`text-xs font-bold uppercase tracking-tight
                                                        ${isChecked ? 'text-brand-900' : 'text-slate-500'}`}>
                                                        {tm.nombre}
                                                    </span>
                                                </div>

                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={(e) => {
                                                        const current = formik.values.ids_mermas;
                                                        if (e.target.checked) {
                                                            formik.setFieldValue('ids_mermas', [...current, tm.id]);
                                                        } else {
                                                            formik.setFieldValue('ids_mermas', current.filter(id => id !== tm.id));
                                                        }
                                                    }}
                                                    className="w-5 h-5 rounded-lg border-gray-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                                                />
                                            </label>
                                        );
                                    })
                                ) : (
                                    <div className="text-center py-4 opacity-40 italic text-[10px] font-bold uppercase tracking-widest">
                                        No hay tipos de merma configurados
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Estatus */}
                        {isEdit && (
                            <label className="flex items-center justify-between p-4 rounded-md bg-slate-50/50 border border-slate-100 cursor-pointer hover:bg-slate-100/50 transition-all group">
                                <div className="flex items-center gap-3">
                                    <div className={`w-2 h-2 rounded-full ${formik.values.estatus ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                                    <span className="text-xs font-black text-slate-600 uppercase tracking-widest">Estado de Categoría</span>
                                </div>
                                <input type="checkbox" {...formik.getFieldProps('estatus')} checked={formik.values.estatus} className="sr-only peer" />
                                <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-brand-600 after:content-[''] after:absolute after:top-[4px] after:right-[19px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:-translate-x-full relative flex-shrink-0 shadow-inner" />
                            </label>
                        )}
                    </div>
                </form>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 bg-white flex items-center justify-end gap-4 sticky bottom-0 z-20">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-3 text-[11px] font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        onClick={formik.handleSubmit}
                        disabled={formik.isSubmitting || !formik.dirty}
                        className={`bg-brand-900 text-white px-10 py-3.5 rounded-md text-xs font-black hover:bg-brand-600 shadow-xl shadow-brand-accent/30 transition-all active:scale-95 flex items-center gap-3 uppercase tracking-widest
                        ${(!formik.dirty || formik.isSubmitting) ? 'opacity-50 cursor-not-allowed shadow-none' : ''}`}
                    >
                        {formik.isSubmitting && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                        {isEdit ? 'Guardar Cambios' : 'Crear Categoría'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
