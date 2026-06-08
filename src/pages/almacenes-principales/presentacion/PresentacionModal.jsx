import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Tag, AlertTriangle } from 'lucide-react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { createPresentacion, updatePresentacion } from '../../../services/presentacionService';

const validationSchema = Yup.object({
    nombre: Yup.string().required('El nombre es obligatorio').min(2, 'Mínimo 2 caracteres'),
    estatus: Yup.boolean(),
});

export default function PresentacionModal({ initialData = null, empresaActiva, perfil, onClose, onUpdate }) {
    const isEdit = !!initialData;
    const [cargando, setCargando] = useState(false);

    const formik = useFormik({
        initialValues: {
            nombre: initialData?.nombre?.toUpperCase() || '',
            estatus: initialData?.estatus !== false,
        },
        validationSchema,
        onSubmit: async (values) => {
            const payload = {
                nombre: values.nombre.trim().toUpperCase(),
                estatus: values.estatus,
                id_empresa: empresaActiva?.id,
            };

            try {
                if (isEdit) {
                    await updatePresentacion(initialData.id, payload, perfil?.id);
                } else {
                    await createPresentacion(payload, perfil?.id);
                }
                onUpdate();
                onClose();
            } catch (err) {
                formik.setStatus(err.message || 'Error al procesar la solicitud');
            }
        },
    });

    return createPortal(
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 animate-in fade-in duration-300"
            onClick={onClose}
        >
            <div
                className="bg-white w-full sm:max-w-md flex flex-col overflow-hidden rounded-[2.5rem] shadow-2xl animate-in zoom-in-95 duration-300 border border-white/20"
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
                                {isEdit ? 'Editar Presentación' : 'Nueva Presentación'}
                            </h3>
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 italic">
                                {isEdit ? initialData.nombre : 'Categoría de Envase'}
                            </p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600">
                        <X size={22} />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={formik.handleSubmit} className="flex-1 p-8 space-y-6 bg-gray-50/30 overflow-y-auto max-h-[70vh]">
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
                                Nombre de Presentación
                            </label>
                            <input
                                type="text"
                                {...formik.getFieldProps('nombre')}
                                className={`w-full px-5 py-3.5 rounded-md border transition-all text-sm font-bold text-slate-700 outline-none bg-gray-50/50
                                ${formik.touched.nombre && formik.errors.nombre
                                        ? 'border-red-300 ring-4 ring-red-100'
                                        : 'border-gray-100 focus:ring-4 focus:ring-brand-accent/10 focus:border-brand-accent focus:bg-white'}`}
                                placeholder="EJ: EMPAQUE, CAJA, BOLSA, RESMA..."
                            />
                        </div>

                        {/* Estatus */}
                        {isEdit && (
                            <label className="flex items-center justify-between p-4 rounded-md bg-slate-50/50 border border-slate-100 cursor-pointer hover:bg-slate-100/50 transition-all group">
                                <div className="flex items-center gap-3">
                                    <div className={`w-2 h-2 rounded-full ${formik.values.estatus ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                                    <span className="text-xs font-black text-slate-600 uppercase tracking-widest">Estado</span>
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
                        {isEdit ? 'Guardar Cambios' : 'Crear Presentación'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
