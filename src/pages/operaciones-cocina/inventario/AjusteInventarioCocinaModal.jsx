import { Scale, AlertCircle } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useFormik } from 'formik';
import * as Yup from 'yup';

const validationSchema = Yup.object().shape({
    cantidad: Yup.number()
        .typeError('Debe ser un número')
        .required('La cantidad es requerida')
        .positive('La cantidad debe ser mayor a cero'),
    tipo: Yup.string().required(),
    observaciones: Yup.string()
        .required('La observación es obligatoria')
        .min(10, 'Mínimo 10 caracteres para una observación válida')
        .test('no-only-numbers', 'La observación no puede ser solo números', (val) => !/^\d+$/.test(val || ''))
        .test('coherent-text', 'Por favor, ingrese un motivo coherente y descriptivo', (val) => {
            if (!val) return false;
            const trimmed = val.trim();
            // Evitar secuencias largas sin espacios (posible basura/gibberish)
            const hasLongWord = trimmed.split(/\s+/).some(word => word.length > 20);
            if (hasLongWord) return false;
            // Evitar caracteres repetidos excesivamente (ej: aaaaaa)
            if (/(.)\1{4,}/.test(trimmed)) return false;
            // Debe contener al menos algunas letras para ser un texto real
            if (!/[a-zA-ZáéíóúÁÉÍÓÚñÑ]/.test(trimmed)) return false;
            return true;
        })
});

export default function AjusteInventarioCocinaModal({ isOpen, onClose, item, onConfirm, loading }) {

    const formik = useFormik({
        initialValues: {
            cantidad: '',
            tipo: 'AJUSTE_POS',
            observaciones: ''
        },
        validationSchema,
        enableReinitialize: true,
        onSubmit: (values) => {
            onConfirm(values);
        }
    });

    if (!isOpen || !item) return null;

    const hasErrors = !formik.isValid || !formik.dirty;

    return createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-md shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300">

                {/* Header */}
                <div className="flex items-center justify-center px-8 py-5 bg-slate-50 border-b border-slate-100">
                    <div className="w-12 h-12 bg-brand-900 text-white rounded-2xl flex items-center justify-center mr-4 shadow-xl shadow-brand-900/20 rotate-3 shrink-0">
                        <Scale size={24} />
                    </div>
                    <div className="flex flex-col">
                        <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter leading-none">Ajuste de Inventario</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase italic tracking-widest mt-1">
                            Rubro: <span className="text-brand-900">
                                {item.id_producto && item.producto
                                    ? `${item.rubro?.nombre} - ${item.producto.marca?.nombre || ''} · ${item.producto.variedad || ''}`
                                    : item.rubro?.nombre}
                            </span>
                        </p>
                    </div>
                </div>

                <form onSubmit={formik.handleSubmit} className="p-8 space-y-2">
                    {/* Selector de Tipo */}
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => formik.setFieldValue('tipo', 'AJUSTE_POS')}
                            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-2 ${formik.values.tipo === 'AJUSTE_POS' ? 'bg-emerald-50 border-emerald-500 text-emerald-600 shadow-lg shadow-emerald-500/10' : 'bg-white border-slate-100 text-slate-300 hover:border-slate-200'}`}
                        >
                            Suma (+)
                        </button>
                        <button
                            type="button"
                            onClick={() => formik.setFieldValue('tipo', 'AJUSTE_NEG')}
                            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-2 ${formik.values.tipo === 'AJUSTE_NEG' ? 'bg-red-50 border-red-500 text-red-600 shadow-lg shadow-red-500/10' : 'bg-white border-slate-100 text-slate-300 hover:border-slate-200'}`}
                        >
                            Resta (-)
                        </button>
                    </div>

                    {/* Cantidad */}
                    <div className="space-y-1">
                        <div className="w-full flex justify-between items-center px-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase whitespace-nowrap">Cantidad a Ajustar</label>
                            {formik.errors.cantidad && formik.touched.cantidad && (
                                <span className="text-[9px] font-bold text-red-500 uppercase flex items-center gap-1">
                                    <AlertCircle size={10} /> {formik.errors.cantidad}
                                </span>
                            )}
                        </div>
                        <div className="relative">
                            <input
                                name="cantidad"
                                type="number"
                                step="any"
                                min="0"
                                value={formik.values.cantidad}
                                onChange={formik.handleChange}
                                onBlur={formik.handleBlur}
                                className={`w-full px-5 py-2 bg-slate-50 border rounded-2xl text-xl font-black text-slate-800 outline-none transition-all text-center ${formik.errors.cantidad && formik.touched.cantidad ? 'border-red-200 focus:ring-4 focus:ring-red-500/5' : 'border-slate-100 focus:ring-4 focus:ring-brand-500/5'}`}
                                placeholder="0.00"
                            />
                            <span className="absolute right-5 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300 uppercase">
                                {item.rubro?.unidad?.abreviatura}
                            </span>
                        </div>
                    </div>

                    {/* Observaciones */}
                    <div className="space-y-1">
                        <div className="flex justify-between items-center px-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase">Motivo del Ajuste</label>
                            {formik.errors.observaciones && formik.touched.observaciones && (
                                <span className="text-[9px] font-bold text-red-500 uppercase flex items-center gap-1">
                                    <AlertCircle size={10} /> {formik.errors.observaciones}
                                </span>
                            )}
                        </div>
                        <textarea
                            name="observaciones"
                            value={formik.values.observaciones}
                            onChange={formik.handleChange}
                            onBlur={formik.handleBlur}
                            className={`w-full px-5 py-4 bg-slate-50 border rounded-2xl text-xs font-bold text-slate-600 outline-none transition-all resize-none h-28 ${formik.errors.observaciones && formik.touched.observaciones ? 'border-red-200 focus:ring-4 focus:ring-red-500/5' : 'border-slate-100 focus:ring-4 focus:ring-brand-500/5'}`}
                            placeholder="Describa el motivo del ajuste (mín. 10 caracteres)..."
                        />
                    </div>

                    {/* Footer / Botones */}
                    <div className="pt-4 flex gap-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 rounded-2xl transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading || hasErrors}
                            className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl ${hasErrors || loading ? 'bg-slate-100 text-slate-300 shadow-none cursor-not-allowed' : 'bg-brand-900 text-white shadow-brand-900/20 hover:scale-[1.02] active:scale-95'}`}
                        >
                            {loading ? 'Procesando...' : 'Procesar Ajuste'}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
}
