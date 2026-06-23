import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, ArrowRightFromLine, Utensils, MapPin, ClipboardList, CheckSquare, Square, Layers, ChevronDown, ChevronUp } from 'lucide-react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { saveComedorCompleto } from '../../../services/comedorService';

const validationSchema = Yup.object({
  nombre: Yup.string().required('El nombre es obligatorio'),
  id_sucursal: Yup.string().required('Debe seleccionar una sucursal'),
  servicios: Yup.array().of(
    Yup.object().shape({
      id_tipo_servicio: Yup.mixed().required(),
      id_estructura_menu: Yup.mixed().required('Seleccione una clasificación'),
      precio_menu: Yup.number().min(0, 'Mínimo 0').required('Requerido'),
      perfil_nutricional: Yup.object().shape({
        kcal_objetivo: Yup.number().positive('Debe ser > 0').required('Requerido'),
        carb_min_pct: Yup.number().min(0, 'Mínimo 0').max(100, 'Máximo 100').required('Requerido'),
        carb_max_pct: Yup.number().min(0, 'Mínimo 0').max(100, 'Máximo 100')
          .test('compare-carbs', 'El máximo debe ser mayor o igual al mínimo', function(value) {
            const { carb_min_pct } = this.parent;
            return value >= carb_min_pct;
          }).required('Requerido'),
        prot_min_pct: Yup.number().min(0, 'Mínimo 0').max(100, 'Máximo 100').required('Requerido'),
        prot_max_pct: Yup.number().min(0, 'Mínimo 0').max(100, 'Máximo 100')
          .test('compare-prots', 'El máximo debe ser mayor o igual al mínimo', function(value) {
            const { prot_min_pct } = this.parent;
            return value >= prot_min_pct;
          }).required('Requerido'),
        grasa_min_pct: Yup.number().min(0, 'Mínimo 0').max(100, 'Máximo 100').required('Requerido'),
        grasa_max_pct: Yup.number().min(0, 'Mínimo 0').max(100, 'Máximo 100')
          .test('compare-grasas', 'El máximo debe ser mayor o igual al mínimo', function(value) {
            const { grasa_min_pct } = this.parent;
            return value >= grasa_min_pct;
          }).required('Requerido')
      })
    })
  ).min(1, 'Debe activar al menos un servicio')
});

export default function ComedoresModal({
  initialData = null,
  sucursales = [],
  tiposServicios = [],
  estructuras = [],
  unidades = [],
  empresaActiva,
  perfil,
  onClose,
  onUpdate
}) {
  const isEdit = !!initialData;
  const [loading, setLoading] = useState(false);
  const [expandedService, setExpandedService] = useState(null); // Para ver los slots de un servicio

  // Mapear servicios configurados si existen
  const initialServicios = initialData?.servicios_config?.map(s => {
    const est = estructuras.find(e => e.id === s.id_estructura_menu);
    const srvPerfil = initialData?.perfiles_nutricionales?.find(p => p.id_tipo_servicio === s.id_tipo_servicio);
    return {
      id_tipo_servicio: s.id_tipo_servicio,
      id_estructura_menu: s.id_estructura_menu,
      precio_menu: s.precio_menu || 0,
      slots_config: est?.slots?.map(slot => {
        const saved = s.slots_config?.find(sc => sc.id_slot === slot.id);
        return {
          id_slot: slot.id,
          cantidad_objetivo: saved?.cantidad_objetivo || 0,
          id_unidad_medida: saved?.id_unidad_medida || slot.id_unidad_medida || null
        };
      }) || [],
      perfil_nutricional: {
        kcal_objetivo: srvPerfil?.kcal_objetivo || 800.00,
        carb_min_pct: srvPerfil?.carb_min_pct || 50.00,
        carb_max_pct: srvPerfil?.carb_max_pct || 60.00,
        prot_min_pct: srvPerfil?.prot_min_pct || 15.00,
        prot_max_pct: srvPerfil?.prot_max_pct || 20.00,
        grasa_min_pct: srvPerfil?.grasa_min_pct || 25.00,
        grasa_max_pct: srvPerfil?.grasa_max_pct || 30.00
      }
    };
  }) || [];

  const formik = useFormik({
    initialValues: {
      id: initialData?.id || null,
      id_empresa: empresaActiva.id,
      nombre: initialData?.nombre || '',
      id_sucursal: initialData?.id_sucursal || '',
      estatus: true,
      servicios: initialServicios
    },
    validationSchema,
    onSubmit: async (values) => {
      setLoading(true);
      try {
        await saveComedorCompleto(values, values.servicios, perfil.id);
        onUpdate();
        onClose();
      } catch (error) {
        alert(error.message);
      } finally {
        setLoading(false);
      }
    }
  });

  const toggleServicio = (tipoServicioId) => {
    const current = [...formik.values.servicios];
    const index = current.findIndex(s => s.id_tipo_servicio === tipoServicioId);

    if (index === -1) {
      // Activar con la primera estructura asociada al servicio por defecto, o la primera en general
      const defaultEst = estructuras.find(e => Number(e.id_tipo_servicio) === Number(tipoServicioId)) || estructuras[0];
      current.push({
        id_tipo_servicio: tipoServicioId,
        id_estructura_menu: defaultEst?.id || null,
        precio_menu: 0,
        slots_config: defaultEst?.slots?.map(slot => ({
          id_slot: slot.id,
          cantidad_objetivo: 0,
          id_unidad_medida: slot.id_unidad_medida || null
        })) || [],
        perfil_nutricional: {
          kcal_objetivo: 800.00,
          carb_min_pct: 50.00,
          carb_max_pct: 60.00,
          prot_min_pct: 15.00,
          prot_max_pct: 20.00,
          grasa_min_pct: 25.00,
          grasa_max_pct: 30.00
        }
      });
      setExpandedService(tipoServicioId);
    } else {
      current.splice(index, 1);
      if (expandedService === tipoServicioId) setExpandedService(null);
    }
    formik.setFieldValue('servicios', current);
  };

  const updatePerfilField = (tipoServicioId, field, value) => {
    const current = formik.values.servicios.map(s => {
      if (s.id_tipo_servicio === tipoServicioId) {
        const perf = s.perfil_nutricional || {
          kcal_objetivo: 800.00,
          carb_min_pct: 50.00,
          carb_max_pct: 60.00,
          prot_min_pct: 15.00,
          prot_max_pct: 20.00,
          grasa_min_pct: 25.00,
          grasa_max_pct: 30.00
        };
        return {
          ...s,
          perfil_nutricional: {
            ...perf,
            [field]: value
          }
        };
      }
      return s;
    });
    formik.setFieldValue('servicios', current);
  };

  const updateEstructura = (tipoServicioId, estructuraId) => {
    const selectedEst = estructuras.find(e => e.id.toString() === estructuraId.toString());
    const current = formik.values.servicios.map(s => {
      if (s.id_tipo_servicio === tipoServicioId) {
        return {
          ...s,
          id_estructura_menu: estructuraId,
          slots_config: selectedEst?.slots?.map(slot => ({
            id_slot: slot.id,
            cantidad_objetivo: 0,
            id_unidad_medida: slot.id_unidad_medida || null
          })) || []
        };
      }
      return s;
    });
    formik.setFieldValue('servicios', current);
  };

  const updateSlotGramaje = (tipoServicioId, slotId, field, value) => {
    const current = formik.values.servicios.map(s => {
      if (s.id_tipo_servicio === tipoServicioId) {
        return {
          ...s,
          slots_config: s.slots_config.map(slot => {
            if (slot.id_slot === slotId) {
              return {
                ...slot,
                [field]: value
              };
            }
            return slot;
          })
        };
      }
      return s;
    });
    formik.setFieldValue('servicios', current);
  };

  const updateServicePrecio = (tipoServicioId, precio) => {
    const current = formik.values.servicios.map(s => {
      if (s.id_tipo_servicio === tipoServicioId) {
        return {
          ...s,
          precio_menu: precio
        };
      }
      return s;
    });
    formik.setFieldValue('servicios', current);
  };



  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300" onClick={onClose}>
      <div className="bg-white w-full max-[96vw] h-full max-h-[95vh] rounded-md shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-white relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-brand-900" />
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-md bg-brand-50 text-brand-900 flex items-center justify-center border border-brand-100 shadow-inner">
              <ArrowRightFromLine size={22} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-800 tracking-tight leading-tight">
                {isEdit ? 'Editar Comedor' : 'Nuevo Comedor'}
              </h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">
                Vinculación de Servicios y Negociación de Gramajes
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
            <X size={22} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-gray-50/30 custom-scrollbar">

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Info Básica */}
            <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <MapPin size={12} className="text-brand-900" /> Sucursal
                </label>
                <select
                  {...formik.getFieldProps('id_sucursal')}
                  className={`w-full px-4 py-3 bg-slate-50 rounded-md border text-sm font-black text-slate-700 outline-none focus:ring-4 transition-all ${formik.touched.id_sucursal && formik.errors.id_sucursal ? 'border-red-500 focus:ring-red-100' : 'border-gray-100 focus:ring-brand-900/5 focus:border-brand-900'}`}
                >
                  <option value="">Seleccione Sucursal...</option>
                  {sucursales.map(s => (
                    <option key={s.id} value={s.id}>{s.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <Utensils size={12} className="text-brand-900" /> Nombre del Comedor
                </label>
                <input
                  type="text"
                  {...formik.getFieldProps('nombre')}
                  placeholder="Ej: COMEDOR PLANTA 1"
                  className={`w-full px-4 py-3 bg-slate-50 rounded-md border text-sm font-black text-slate-700 outline-none focus:ring-4 transition-all ${formik.touched.nombre && formik.errors.nombre ? 'border-red-500 focus:ring-red-100' : 'border-gray-100 focus:ring-brand-900/5 focus:border-brand-900'}`}
                />
              </div>
            </div>

            {/* Tip */}
            <div className="bg-brand-900 p-6 rounded-[2rem] text-white flex flex-col justify-center gap-4 shadow-xl shadow-brand-900/20">
              <ClipboardList size={32} className="opacity-50" />
              <div>
                <h4 className="font-black uppercase tracking-widest text-sm text-brand-400">Protocolo de Negociación</h4>
                <p className="text-xs text-brand-50 opacity-80 italic mt-2">
                  Configura los gramajes objetivo por renglón. Si dejas el valor en 0, el sistema usará el gramaje base de la receta asignada.
                </p>
              </div>
            </div>
          </div>

          {/* Mapeo de Servicios */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Servicios Disponibles</h4>
            <div className="grid grid-cols-1 gap-4">
              {tiposServicios.map(tipo => {
                const config = formik.values.servicios.find(s => s.id_tipo_servicio === tipo.id);
                const isActive = !!config;
                const isExpanded = expandedService === tipo.id;
                const selectedEst = estructuras.find(e => e.id.toString() === config?.id_estructura_menu?.toString());
                const srvIdx = formik.values.servicios.findIndex(s => s.id_tipo_servicio === tipo.id);
                const srvError = formik.errors.servicios?.[srvIdx];
                const perfError = srvError?.perfil_nutricional;

                return (
                  <div key={tipo.id} className={`p-6 rounded-[2rem] border transition-all flex flex-col gap-4 ${isActive ? 'bg-white border-brand-900 shadow-md ring-4 ring-brand-900/5' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => toggleServicio(tipo.id)}
                          className={`p-1.5 rounded-lg transition-all ${isActive ? 'bg-brand-900 text-white' : 'bg-white text-slate-300 border border-slate-200'}`}
                        >
                          {isActive ? <CheckSquare size={18} /> : <Square size={18} />}
                        </button>
                        <span className="text-sm font-black text-slate-800 uppercase tracking-tight">{tipo.nombre}</span>
                        
                        {isActive && (
                          <div className="flex items-center gap-2 ml-4 animate-in fade-in duration-300">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Precio:</span>
                            <div className="relative flex items-center">
                              <span className="absolute left-3 text-[11px] font-black text-brand-900">$</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                value={config.precio_menu || ''}
                                onChange={(e) => updateServicePrecio(tipo.id, e.target.value)}
                                className="pl-6 pr-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-black text-brand-900 w-24 outline-none focus:border-brand-900 focus:ring-2 focus:ring-brand-900/5 transition-all text-right"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {isActive && (
                        <button 
                          type="button" 
                          onClick={() => setExpandedService(isExpanded ? null : tipo.id)}
                          className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-full text-[9px] font-black text-slate-500 uppercase tracking-widest border border-slate-100 hover:bg-brand-50 hover:text-brand-900 transition-all"
                        >
                          <Layers size={12} /> {isExpanded ? 'Cerrar Ajustes' : 'Configurar Gramajes'}
                          {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                      )}
                    </div>

                    {isActive && (
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start mt-2">
                        {/* Selector de Estructura */}
                        <div className="md:col-span-4 space-y-2">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                            <ClipboardList size={10} className="text-brand-900" /> Clasificación (Esqueleto)
                          </label>
                          <select
                            value={config.id_estructura_menu || ''}
                            onChange={(e) => updateEstructura(tipo.id, e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 text-[11px] font-black text-slate-700 outline-none focus:border-brand-900 focus:ring-4 focus:ring-brand-900/5 transition-all"
                          >
                            <option value="">Seleccione...</option>
                            {estructuras
                              .filter(est => !est.id_tipo_servicio || Number(est.id_tipo_servicio) === Number(tipo.id))
                              .map(est => (
                                <option key={est.id} value={est.id}>{est.nombre}</option>
                              ))}
                          </select>
                        </div>

                        {/* Panel de Gramajes (si está expandido) */}
                        {isExpanded && (
                          <div className="md:col-span-8 animate-in slide-in-from-right-4 duration-500">
                            <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-6">
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                                {/* Columna Izquierda: Gramajes */}
                                <div className="space-y-4">
                                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                                    <h5 className="text-[10px] font-black text-brand-900 uppercase tracking-widest">Gramajes Negociados</h5>
                                    <span className="text-[8px] font-bold text-slate-400 uppercase italic">Solo para {tipo.nombre}</span>
                                  </div>
                                  
                                  <div className="grid grid-cols-1 gap-3">
                                    {selectedEst?.slots?.map(slot => {
                                      const slotCfg = config.slots_config?.find(sc => sc.id_slot === slot.id);
                                      return (
                                        <div key={slot.id} className="flex items-center justify-between bg-white p-3 rounded-2xl border border-slate-100 shadow-sm group hover:border-brand-200 transition-all">
                                          <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-brand-50 group-hover:text-brand-900 transition-all">
                                              <Layers size={14} />
                                            </div>
                                            <span className="text-[10px] font-black text-slate-700 uppercase tracking-tight">{slot.nombre}</span>
                                          </div>
                                          
                                          <div className="flex items-center gap-2">
                                            <div className="relative">
                                              <input
                                                type="number"
                                                placeholder="0"
                                                value={slotCfg?.cantidad_objetivo || 0}
                                                onChange={(e) => updateSlotGramaje(tipo.id, slot.id, 'cantidad_objetivo', e.target.value)}
                                                className="w-20 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-100 text-[11px] font-black text-brand-900 outline-none focus:border-brand-900 text-center pr-6"
                                              />
                                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-400">%</span>
                                            </div>
                                            <div className="px-3 py-1.5 bg-brand-50 text-brand-900 rounded-lg text-[8px] font-black uppercase tracking-widest border border-brand-100">
                                              Ajuste
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                    {(!selectedEst?.slots || selectedEst.slots.length === 0) && (
                                      <div className="py-4 text-center">
                                        <p className="text-[9px] font-bold text-slate-400 uppercase italic">Sin renglones definidos.</p>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Columna Derecha: Perfil Nutricional */}
                                <div className="space-y-4">
                                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                                    <h5 className="text-[10px] font-black text-brand-900 uppercase tracking-widest">Perfil Nutricional</h5>
                                    <span className="text-[8px] font-bold text-slate-400 uppercase italic">Límites y metas</span>
                                  </div>

                                  <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                                    <div>
                                      <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Meta Calórica Diaria</label>
                                      <div className="relative">
                                        <input
                                          type="number"
                                          value={config.perfil_nutricional?.kcal_objetivo ?? 800}
                                          onChange={(e) => updatePerfilField(tipo.id, 'kcal_objetivo', e.target.value)}
                                          className={`w-full pl-3 pr-10 py-2 bg-slate-50 rounded-lg border text-[11px] font-black text-brand-900 outline-none text-center transition-all ${
                                            perfError?.kcal_objetivo ? 'border-red-300 ring-2 ring-red-100' : 'border-slate-100 focus:border-brand-900'
                                          }`}
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[8px] font-black text-slate-400">KCAL</span>
                                      </div>
                                      {perfError?.kcal_objetivo && (
                                        <p className="text-[8px] text-red-500 font-bold uppercase italic mt-0.5">{perfError.kcal_objetivo}</p>
                                      )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                      <div>
                                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Carb Min %</label>
                                        <input
                                          type="number"
                                          value={config.perfil_nutricional?.carb_min_pct ?? 50}
                                          onChange={(e) => updatePerfilField(tipo.id, 'carb_min_pct', e.target.value)}
                                          className={`w-full px-3 py-1.5 bg-slate-50 rounded-lg border text-[11px] font-black text-brand-900 outline-none text-center transition-all ${
                                            perfError?.carb_min_pct ? 'border-red-300 ring-2 ring-red-100' : 'border-slate-100 focus:border-brand-900'
                                          }`}
                                        />
                                      </div>
                                      <div>
                                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Carb Max %</label>
                                        <input
                                          type="number"
                                          value={config.perfil_nutricional?.carb_max_pct ?? 60}
                                          onChange={(e) => updatePerfilField(tipo.id, 'carb_max_pct', e.target.value)}
                                          className={`w-full px-3 py-1.5 bg-slate-50 rounded-lg border text-[11px] font-black text-brand-900 outline-none text-center transition-all ${
                                            perfError?.carb_max_pct ? 'border-red-300 ring-2 ring-red-100' : 'border-slate-100 focus:border-brand-900'
                                          }`}
                                        />
                                      </div>
                                      {(perfError?.carb_min_pct || perfError?.carb_max_pct) && (
                                        <p className="col-span-2 text-[8px] text-red-500 font-bold uppercase italic">{perfError.carb_max_pct || perfError.carb_min_pct}</p>
                                      )}
                                      
                                      <div>
                                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Prot Min %</label>
                                        <input
                                          type="number"
                                          value={config.perfil_nutricional?.prot_min_pct ?? 15}
                                          onChange={(e) => updatePerfilField(tipo.id, 'prot_min_pct', e.target.value)}
                                          className={`w-full px-3 py-1.5 bg-slate-50 rounded-lg border text-[11px] font-black text-brand-900 outline-none text-center transition-all ${
                                            perfError?.prot_min_pct ? 'border-red-300 ring-2 ring-red-100' : 'border-slate-100 focus:border-brand-900'
                                          }`}
                                        />
                                      </div>
                                      <div>
                                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Prot Max %</label>
                                        <input
                                          type="number"
                                          value={config.perfil_nutricional?.prot_max_pct ?? 20}
                                          onChange={(e) => updatePerfilField(tipo.id, 'prot_max_pct', e.target.value)}
                                          className={`w-full px-3 py-1.5 bg-slate-50 rounded-lg border text-[11px] font-black text-brand-900 outline-none text-center transition-all ${
                                            perfError?.prot_max_pct ? 'border-red-300 ring-2 ring-red-100' : 'border-slate-100 focus:border-brand-900'
                                          }`}
                                        />
                                      </div>
                                      {(perfError?.prot_min_pct || perfError?.prot_max_pct) && (
                                        <p className="col-span-2 text-[8px] text-red-500 font-bold uppercase italic">{perfError.prot_max_pct || perfError.prot_min_pct}</p>
                                      )}

                                      <div>
                                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Grasa Min %</label>
                                        <input
                                          type="number"
                                          value={config.perfil_nutricional?.grasa_min_pct ?? 25}
                                          onChange={(e) => updatePerfilField(tipo.id, 'grasa_min_pct', e.target.value)}
                                          className={`w-full px-3 py-1.5 bg-slate-50 rounded-lg border text-[11px] font-black text-brand-900 outline-none text-center transition-all ${
                                            perfError?.grasa_min_pct ? 'border-red-300 ring-2 ring-red-100' : 'border-slate-100 focus:border-brand-900'
                                          }`}
                                        />
                                      </div>
                                      <div>
                                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Grasa Max %</label>
                                        <input
                                          type="number"
                                          value={config.perfil_nutricional?.grasa_max_pct ?? 30}
                                          onChange={(e) => updatePerfilField(tipo.id, 'grasa_max_pct', e.target.value)}
                                          className={`w-full px-3 py-1.5 bg-slate-50 rounded-lg border text-[11px] font-black text-brand-900 outline-none text-center transition-all ${
                                            perfError?.grasa_max_pct ? 'border-red-300 ring-2 ring-red-100' : 'border-slate-100 focus:border-brand-900'
                                          }`}
                                        />
                                      </div>
                                      {(perfError?.grasa_min_pct || perfError?.grasa_max_pct) && (
                                        <p className="col-span-2 text-[8px] text-red-500 font-bold uppercase italic">{perfError.grasa_max_pct || perfError.grasa_min_pct}</p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {formik.touched.servicios && formik.errors.servicios && (
              <p className="text-[10px] text-red-500 font-bold ml-4 uppercase italic">{formik.errors.servicios}</p>
            )}
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
            {loading ? 'Guardando...' : 'Guardar Comedor'}
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}
