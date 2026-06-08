import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, ClipboardList, Plus, Trash2, Layers, CheckSquare, Square, ChevronDown, ChevronUp } from 'lucide-react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { saveEstructuraCompleta } from '../../../services/estructuraMenuService';

const validationSchema = Yup.object({
  nombre: Yup.string().required('El nombre es obligatorio'),
  id_tipo_servicio: Yup.string().required('El servicio es obligatorio'),
  slots: Yup.array().of(
    Yup.object().shape({
      nombre: Yup.string().required('El nombre del slot es obligatorio'),
      orden: Yup.number().required('Requerido'),
      tipologiasIds: Yup.array().min(1, 'Seleccione al menos una tipología')
    })
  ).min(1, 'Debe agregar al menos un slot')
});

export default function EstructuraMenuModal({ initialData = null, tipologias = [], tiposServicios = [], unidades = [], empresaActiva, perfil, onClose, onUpdate }) {
  const isEdit = !!initialData;
  const [loading, setLoading] = useState(false);

  // Mapear datos iniciales si existen
  const initialSlots = initialData?.slots?.map(s => ({
    id: s.id,
    nombre: s.nombre,
    orden: s.orden,
    id_unidad_medida: s.id_unidad_medida || '',
    estatus: s.estatus ?? true,
    tipologiasIds: s.tipologias?.map(t => t.id_tipologia) || []
  })) || [{ nombre: 'PROTÉICO I', orden: 1, id_unidad_medida: '', estatus: true, tipologiasIds: [] }];

  const formik = useFormik({
    initialValues: {
      id: initialData?.id || null,
      id_empresa: empresaActiva.id,
      nombre: initialData?.nombre || '',
      id_tipo_servicio: initialData?.id_tipo_servicio || '',
      estatus: true,
      slots: initialSlots
    },
    validationSchema,
    onSubmit: async (values) => {
      setLoading(true);
      try {
        await saveEstructuraCompleta(values, values.slots, perfil.id);
        onUpdate();
        onClose();
      } catch (error) {
        alert(error.message);
      } finally {
        setLoading(false);
      }
    }
  });

  const addSlot = () => {
    const nextOrder = formik.values.slots.length + 1;
    formik.setFieldValue('slots', [...formik.values.slots, { nombre: '', orden: nextOrder, id_unidad_medida: '', estatus: true, tipologiasIds: [] }]);
  };

  const toggleSlotStatus = (idx) => {
    const currentStatus = formik.values.slots[idx].estatus;
    formik.setFieldValue(`slots.${idx}.estatus`, !currentStatus);
  };

  const toggleTipologia = (slotIdx, tipId) => {
    const currentIds = [...formik.values.slots[slotIdx].tipologiasIds];
    const index = currentIds.indexOf(tipId);
    if (index === -1) {
      currentIds.push(tipId);
    } else {
      currentIds.splice(index, 1);
    }
    formik.setFieldValue(`slots.${slotIdx}.tipologiasIds`, currentIds);
  };

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300" onClick={onClose}>
      <div className="bg-white w-full max-w-[96vw] h-full max-h-[90vh] rounded-md shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-white relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-brand-900" />
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-md bg-brand-50 text-brand-900 flex items-center justify-center border border-brand-100 shadow-inner">
              <ClipboardList size={22} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-800 tracking-tight leading-tight">
                {isEdit ? 'Editar Clasificación' : 'Nueva Clasificación'}
              </h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">
                Definición de Renglones por Servicio
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
            <X size={22} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-gray-50/30 custom-scrollbar">

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Nombre de la Estructura */}
            <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                <ClipboardList size={12} className="text-brand-900" /> Nombre de la Clasificación (Ej: Básico, Estándar, VIP)
              </label>
              <input
                type="text"
                {...formik.getFieldProps('nombre')}
                placeholder="Ej: BÁSICO"
                className={`w-full px-4 py-3 bg-slate-50 rounded-md border text-sm font-black text-slate-700 outline-none focus:ring-4 transition-all ${formik.touched.nombre && formik.errors.nombre ? 'border-red-500 focus:ring-red-100' : 'border-gray-100 focus:ring-brand-900/5 focus:border-brand-900'}`}
              />
            </div>
            
            {/* Servicio Asociado */}
            <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                <ClipboardList size={12} className="text-brand-900" /> Servicio al que se Asocia esta Clasificación
              </label>
              <select
                {...formik.getFieldProps('id_tipo_servicio')}
                className={`w-full px-4 py-3 bg-slate-50 rounded-md border text-sm font-black text-slate-700 outline-none focus:ring-4 transition-all ${formik.touched.id_tipo_servicio && formik.errors.id_tipo_servicio ? 'border-red-500 focus:ring-red-100' : 'border-gray-100 focus:ring-brand-900/5 focus:border-brand-900'}`}
              >
                <option value="">Seleccione un servicio...</option>
                {tiposServicios.map(ts => (
                  <option key={ts.id} value={ts.id}>{ts.nombre}</option>
                ))}
              </select>
            </div>

          </div>

          {/* Gestión de Slots */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Layers size={14} className="text-brand-900" /> Renglones del Menú (Slots)
              </h4>
              <button
                type="button"
                onClick={addSlot}
                className="flex items-center gap-2 text-brand-900 hover:text-brand-600 font-black text-[10px] uppercase tracking-widest transition-all"
              >
                <Plus size={14} /> Añadir Renglón
              </button>
            </div>

            <div className="space-y-4">
              {formik.values.slots.map((slot, idx) => (
                <div key={idx} className={`bg-white p-6 rounded-[2.5rem] border transition-all shadow-sm animate-in slide-in-from-top-2 ${!slot.estatus ? 'opacity-50 grayscale border-red-100 bg-red-50/10' : 'border-gray-100'}`}>
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">

                    {/* Info Básica del Slot */}
                    <div className="md:col-span-5 space-y-4">
                      <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Nombre del Renglón</label>
                        <input
                          type="text"
                          value={slot.nombre}
                          onChange={e => formik.setFieldValue(`slots.${idx}.nombre`, e.target.value)}
                          placeholder="Nombre del Renglón"
                          className="w-full px-4 py-2 bg-slate-50 rounded-xl border border-slate-100 text-[11px] font-black text-slate-700 uppercase outline-none focus:border-brand-900"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Orden</label>
                          <input
                            type="number"
                            value={slot.orden}
                            onChange={e => formik.setFieldValue(`slots.${idx}.orden`, e.target.value)}
                            className="w-20 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100 text-[11px] font-black text-slate-700 outline-none focus:border-brand-900"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleSlotStatus(idx)}
                          className={`flex items-center gap-2 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border transition-all ${slot.estatus ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'}`}
                        >
                          {slot.estatus ? 'Activo' : 'Inactivo'}
                        </button>
                      </div>
                    </div>

                    {/* Mapeo de Tipologías */}
                    <div className="md:col-span-7 bg-slate-50/50 p-4 rounded-[1.5rem] border border-slate-100">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Tipologías Permitidas para este Renglón</label>
                      <div className="grid grid-cols-2 gap-2">
                        {tipologias.map(tip => (
                          <button
                            key={tip.id}
                            type="button"
                            onClick={() => toggleTipologia(idx, tip.id)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all text-left ${slot.tipologiasIds.includes(tip.id) ? 'bg-brand-900 border-brand-900 text-white shadow-md' : 'bg-white border-slate-100 text-slate-500 hover:border-brand-200'}`}
                          >
                            {slot.tipologiasIds.includes(tip.id) ? <CheckSquare size={14} /> : <Square size={14} />}
                            <span className="text-[10px] font-bold uppercase truncate">{tip.nombre}</span>
                          </button>
                        ))}
                      </div>
                      {formik.errors.slots?.[idx]?.tipologiasIds && (
                        <p className="text-[9px] text-red-500 font-bold mt-2 uppercase tracking-tighter italic">{formik.errors.slots[idx].tipologiasIds}</p>
                      )}
                    </div>

                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-6 bg-white border-t border-gray-100 flex items-center justify-between">
          <button type="button" onClick={onClose} className="px-6 py-3 rounded-md text-sm font-bold text-slate-400 hover:bg-gray-100 transition-all">
            Cancelar
          </button>
          <button
            onClick={() => formik.handleSubmit()}
            disabled={loading}
            className="flex items-center gap-2 px-10 py-4 bg-brand-900 text-white rounded-[1.5rem] text-sm font-black uppercase tracking-widest hover:bg-brand-600 transition-all shadow-xl shadow-brand-900/20 active:scale-95 disabled:opacity-50"
          >
            <Save size={18} />
            {loading ? 'Guardando...' : 'Guardar Clasificación'}
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}
