import { Scale, AlertCircle, Info } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { getDecimalPlaces, formatNumber } from '../../../util/workDecimales';
import { getEquivalenciasLogisticas } from '../../../util/auxiliares';

export default function AjusteInventarioModal({ lote, onClose, onConfirm, loading }) {

    // Regla de fraccionamiento: Si no es 'SIEMPRE', forzamos enteros
    const permiteDecimales = lote.producto?.rubro?.tipo_fraccionamiento === 'SIEMPRE';
    
    // Obtener el factor de la presentación actual del lote
    const factor = Number(lote.producto?.logistica?.find(l => l.id === lote.id_presentacion_logistica)?.factor || 1);
    const presNombre = lote.producto?.logistica?.find(l => l.id === lote.id_presentacion_logistica)?.presentacion?.nombre || lote.producto?.rubro?.unidad?.abreviatura;

    const validationSchema = Yup.object().shape({
        cantidad: Yup.number()
            .typeError('Debe ser un número')
            .required('La cantidad es requerida')
            .positive('La cantidad debe ser mayor a cero')
            .test('is-integer', 'Solo se permiten números enteros para este rubro', (val) => {
                if (permiteDecimales) return true;
                return Number.isInteger(Number(val));
            }),
        tipo: Yup.string().required(),
        observaciones: Yup.string()
            .required('La observación es obligatoria')
            .min(10, 'Mínimo 10 caracteres para una observación válida')
            .test('no-only-numbers', 'La observación no puede ser solo números', (val) => !/^\d+$/.test(val || ''))
            .test('coherent-text', 'Por favor, ingrese un motivo coherente y descriptivo', (val) => {
                if (!val) return false;
                const trimmed = val.trim();
                const hasLongWord = trimmed.split(/\s+/).some(word => word.length > 20);
                if (hasLongWord) return false;
                if (/(.)\1{4,}/.test(trimmed)) return false;
                if (!/[a-zA-ZáéíóúÁÉÍÓÚñÑ]/.test(trimmed)) return false;
                return true;
            })
    });

    const formik = useFormik({
        initialValues: {
            cantidad: '',
            tipo: 'AJUSTE_POS',
            observaciones: ''
        },
        validationSchema,
        onSubmit: (values) => {
            const numCant = Number(values.cantidad);
            const ajusteDelta = values.tipo === 'AJUSTE_NEG' ? -Math.abs(numCant * factor) : Math.abs(numCant * factor);
            const nuevaCantidad = Number(lote.cantidad_actual) + ajusteDelta;

            // Seguridad: No permitir stock final negativo
            if (nuevaCantidad < 0) {
                alert("El ajuste resultaría en un stock negativo, lo cual no es posible.");
                return;
            }

            onConfirm(nuevaCantidad, values.observaciones);
        }
    });

    if (!lote) return null;

    const hasErrors = !formik.isValid || !formik.dirty;

    return createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-md shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-100">

                {/* Header */}
                <div className="flex items-center justify-center px-8 py-5 bg-slate-50 border-b border-slate-100">
                    <div className="w-12 h-12 bg-amber-500 text-white rounded-2xl flex items-center justify-center mr-4 shadow-xl shadow-amber-500/20 rotate-3 shrink-0">
                        <Scale size={24} />
                    </div>
                    <div className="flex flex-col">
                        <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter leading-none">Ajuste de Almacén</h3>
                        <div className="flex items-center gap-2">
                            <p className="text-xs font-black text-slate-700 uppercase truncate max-w-[200px]">
                                {lote.producto?.rubro?.nombre}
                            </p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase italic tracking-widest mt-1">
                                Lote: <span className="text-brand-900">{lote.lote}</span>
                            </p>
                        </div>
                    </div>
                </div>

                {/* Info del Rubro y Stock Actual */}
                <div className="px-8">
                    <div className="bg-slate-50/50 border border-slate-100 rounded-2xl px-4 py-2 flex justify-between items-center">
                        <div className="space-y-1">
                            <div className="flex flex-col">
                                <p className="text-xs font-black text-slate-700 uppercase truncate max-w-[200px]">
                                    {lote.producto?.marca?.nombre}
                                </p>
                                <p className="text-xs font-black text-slate-700 uppercase truncate max-w-[200px]">
                                    {lote.producto?.variedad}
                                </p>
                            </div>
                        </div>
                        <div className="flex flex-col">
                            {getEquivalenciasLogisticas(
                                lote.cantidad_actual,
                                lote.producto?.logistica || [],
                                lote.producto?.rubro?.unidad?.abreviatura || 'UND'
                            ).map((equiv, idx) => (
                                <div key={idx} className="flex gap-2 items-center justify-end">
                                    <span className={`text-xs font-black tabular-nums text-right ${equiv.isBase ? 'text-slate-400 opacity-60' : 'text-slate-800'}`}>
                                        {equiv.cantidad}
                                    </span>
                                    <span className="text-[10px] font-black uppercase text-slate-400 w-24 text-left">
                                        {equiv.unidad}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {!permiteDecimales && (
                        <div className="mt-2 flex items-center gap-2 px-2">
                            <Info size={12} className="text-amber-500" />
                            <p className="text-[9px] font-bold text-amber-600 uppercase italic tracking-wider">
                                Este rubro solo permite ajustes en unidades enteras
                            </p>
                        </div>
                    )}
                </div>

                <form onSubmit={formik.handleSubmit} className="px-8 py-4 pt-4 space-y-1">
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
                        <div className="flex justify-between items-center px-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase whitespace-nowrap">Cantidad a Ajustar</label>
                            {formik.errors.cantidad && formik.touched.cantidad && (
                                <span className="ml-4 text-[9px] font-bold text-red-500 uppercase flex items-center gap-1">
                                    <AlertCircle size={10} /> {formik.errors.cantidad}
                                </span>
                            )}
                        </div>
                        <div className="relative">
                            <input
                                name="cantidad"
                                type="number"
                                step={permiteDecimales ? "any" : "1"}
                                min="0"
                                value={formik.values.cantidad}
                                onChange={formik.handleChange}
                                onBlur={formik.handleBlur}
                                className={`w-full px-5 py-3 bg-slate-50 border rounded-2xl text-xl font-black text-slate-800 outline-none transition-all text-center ${formik.errors.cantidad && formik.touched.cantidad ? 'border-red-200 focus:ring-4 focus:ring-red-500/5' : 'border-slate-100 focus:ring-4 focus:ring-brand-500/5'}`}
                                placeholder={permiteDecimales ? "0.00" : "0"}
                            />
                             <span className="absolute right-5 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300 uppercase">
                                {presNombre}
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
                            className={`w-full px-5 py-4 bg-slate-50 border rounded-2xl text-xs font-bold text-slate-600 outline-none transition-all resize-none h-24 ${formik.errors.observaciones && formik.touched.observaciones ? 'border-red-200 focus:ring-4 focus:ring-red-500/5' : 'border-slate-100 focus:ring-4 focus:ring-brand-500/5'}`}
                            placeholder="Describa el motivo del ajuste (mín. 10 caracteres)..."
                        />
                    </div>

                    {/* Footer */}
                    <div className="pt-2 flex gap-4">
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
                            {loading ? 'Procesando...' : 'Guardar Ajuste'}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
}
