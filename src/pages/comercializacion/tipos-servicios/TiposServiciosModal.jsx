import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Utensils, Type, Hash, ShieldCheck } from 'lucide-react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { saveTipoServicio } from '../../../services/tipoServicioService';

const validationSchema = Yup.object({
  nombre: Yup.string().required('El nombre es obligatorio'),
  abreviatura: Yup.string().required('La abreviatura es obligatoria').max(10, 'Máximo 10 caracteres'),
  orden: Yup.number().required('El orden es obligatorio').min(0, 'No puede ser negativo')
});

export default function TiposServiciosModal({ initialData = null, empresaActiva, perfil, onClose, onUpdate }) {
  const isEdit = !!initialData;
  const [loading, setLoading] = useState(false);

  const formik = useFormik({
    initialValues: initialData || {
      id: null,
      id_empresa: empresaActiva.id,
      nombre: '',
      abreviatura: '',
      orden: 0,
      estatus: true
    },
    validationSchema,
    onSubmit: async (values) => {
      setLoading(true);
      try {
        await saveTipoServicio(values, perfil.id);
        onUpdate();
        onClose();
      } catch (error) {
        alert(error.message);
      } finally {
        setLoading(false);
      }
    }
  });

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300" onClick={onClose}>
      <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-white relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-900 to-brand-600" />
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-md bg-brand-50 text-brand-900 flex items-center justify-center border border-brand-100 shadow-inner">
              <Utensils size={22} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-800 tracking-tight leading-tight">
                {isEdit ? 'Editar Servicio' : 'Nuevo Servicio'}
              </h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">
                Definición de jornada
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
            <X size={22} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={formik.handleSubmit} className="p-8 space-y-6">

          <div className="space-y-4">
            <div className="bg-gray-50/50 p-6 rounded-[2rem] border border-gray-100 space-y-4">

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <Type size={12} className="text-brand-900" /> Nombre del Servicio
                </label>
                <input
                  type="text"
                  {...formik.getFieldProps('nombre')}
                  placeholder="Ej: ALMUERZO"
                  className={`w-full px-4 py-3 bg-white rounded-md border text-sm font-bold text-slate-700 outline-none focus:ring-4 transition-all ${formik.touched.nombre && formik.errors.nombre ? 'border-red-500 focus:ring-red-100' : 'border-gray-100 focus:ring-brand-900/5 focus:border-brand-900'}`}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <Hash size={12} className="text-brand-900" /> Abreviatura
                  </label>
                  <input
                    type="text"
                    {...formik.getFieldProps('abreviatura')}
                    placeholder="ALM"
                    className={`w-full px-4 py-3 bg-white rounded-md border text-sm font-bold text-slate-700 outline-none focus:ring-4 transition-all ${formik.touched.abreviatura && formik.errors.abreviatura ? 'border-red-500 focus:ring-red-100' : 'border-gray-100 focus:ring-brand-900/5 focus:border-brand-900'}`}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <Hash size={12} className="text-brand-900" /> Orden
                  </label>
                  <input
                    type="number"
                    {...formik.getFieldProps('orden')}
                    className={`w-full px-4 py-3 bg-white rounded-md border text-sm font-bold text-slate-700 outline-none focus:ring-4 transition-all ${formik.touched.orden && formik.errors.orden ? 'border-red-500 focus:ring-red-100' : 'border-gray-100 focus:ring-brand-900/5 focus:border-brand-900'}`}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between bg-white p-4 rounded-md border border-gray-100">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Estatus del Servicio</span>
                  <span className="text-[9px] text-slate-400 italic">{formik.values.estatus ? 'Activo (Visible)' : 'Inactivo (Oculto)'}</span>
                </div>
                <button
                  type="button"
                  onClick={() => formik.setFieldValue('estatus', !formik.values.estatus)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formik.values.estatus ? 'bg-emerald-500' : 'bg-red-400'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formik.values.estatus ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-4 rounded-md text-sm font-bold text-slate-400 hover:bg-gray-100 transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-brand-900 text-white rounded-md text-sm font-black uppercase tracking-widest hover:bg-brand-600 transition-all shadow-xl shadow-brand-900/20 active:scale-95 disabled:opacity-50"
            >
              <Save size={18} />
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>

      </div>
    </div>,
    document.body
  );
}
