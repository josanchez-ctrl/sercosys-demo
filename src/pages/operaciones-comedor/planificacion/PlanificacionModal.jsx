import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, CalendarDays, ChefHat, Plus, Trash2, Search, Utensils, Box, Check, Info, Calculator, Layers, AlertCircle, Users } from 'lucide-react';
import { formatToISODate, formatToDDMMYYYYManual, getDayNameLong, getMonthNameShort, getWeekNumber } from '../../../util/workDate';
import PlanificacionConsolidadaModal from './PlanificacionConsolidadaModal';

import { getServiciosConfig, getRecetasDisponibles, getRubrosOperativos, getEstructuraSlots, getTipologias, upsertPlanificacionCompleta } from '../../../services/planificacionService';
import { Now } from '../../../services/nowService';

export default function PlanificacionModal({
  plan = null,
  weekDays,
  comedorId,
  serviciosDisponibles,
  empresaActiva,
  perfil,
  isReadOnly = false,
  planificacionesExistentes = [],
  onClose,
  onUpdate
}) {
  const [activeTab, setActiveTab] = useState('menu');
  const [loading, setLoading] = useState(false);
  const [internalServicioId, setInternalServicioId] = useState(plan?.id_servicio_config || '');
  const [detalleMenu, setDetalleMenu] = useState([]);
  const [insumosOperativos, setInsumosOperativos] = useState([]);
  const [slots, setSlots] = useState([]);
  const [recetas, setRecetas] = useState([]);
  const [rubrosOperativos, setRubrosOperativos] = useState([]);
  const [tipologias, setTipologias] = useState([]);

  const currentServicio = serviciosDisponibles.find(s => Number(s.id) === Number(internalServicioId));
  const [searchResults, setSearchResults] = useState([]);
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);
  const [internalPlanId, setInternalPlanId] = useState(plan?.id || null);
  const [showConsolidado, setShowConsolidado] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (!internalServicioId) return;
      setLoading(true);
      try {
        const serv = serviciosDisponibles.find(s => Number(s.id) === Number(internalServicioId));
        const idEst = serv?.id_estructura_menu ? Number(serv.id_estructura_menu) : null;

        const [recetasData, rubrosData, slotsData, tipsData] = await Promise.all([
          getRecetasDisponibles(empresaActiva.id),
          getRubrosOperativos(empresaActiva.id),
          idEst ? getEstructuraSlots(idEst) : Promise.resolve([]),
          getTipologias()
        ]);

        setRecetas(recetasData || []);
        setRubrosOperativos(rubrosData || []);
        setSlots(slotsData || []);
        setTipologias(tipsData || []);

        // 1. Generar la cuadrícula completa (7 días x N slots) siempre
        const fullGrid = [];
        weekDays.forEach(day => {
          const dateStr = formatToISODate(day);
          slotsData.forEach(slot => {
            // Buscar si ya existe un dato guardado para este día y este slot
            const saved = plan?.detalle?.find(d =>
              d.fecha === dateStr &&
              Number(d.id_estructura_slot) === Number(slot.id)
            );

            fullGrid.push({
              fecha: dateStr,
              id_estructura_slot: slot.id,
              id_receta: saved?.id_receta || '',
              comensales: saved?.comensales || 0,
              ajustes_ingredientes: saved?.ajustes_ingredientes || {},
              slot_nombre: slot.nombre,
              tempId: Math.random().toString(36).substr(2, 9),
              id: saved?.id // Mantener el ID original si existe para futuros upserts
            });
          });
        });

        setDetalleMenu(fullGrid);

        // 2. Cargar insumos operativos
        if (plan?.insumos_operativos) {
          setInsumosOperativos(plan.insumos_operativos.map(i => ({
            ...i,
            tempId: Math.random().toString(36).substr(2, 9)
          })));
        }
      } catch (error) {
        console.error("Error al cargar datos del modal:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [plan, internalServicioId, serviciosDisponibles]);

  const handleInitialSave = async (serviceId) => {
    setLoading(true);
    try {
      const { upsertPlanificacionCompleta } = await import('../../../services/planificacionService');
      const now = await Now();

      const payload = {
        id_empresa: empresaActiva.id,
        id_comedor: comedorId,
        id_servicio_config: serviceId,
        semana_inicio: formatToISODate(weekDays[0]),
        semana_fin: formatToISODate(weekDays[6]),
        estatus: 'BORRADOR',
        id_usuario_update: perfil.id,
        timestamp_update: now,
        detalle: [],
        insumos_operativos: []
      };

      const newId = await upsertPlanificacionCompleta(payload);
      setInternalPlanId(newId);
      setInternalServicioId(serviceId);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error("Error al crear planificación inicial:", error);
      alert("No se pudo iniciar la planificación. Intente de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (targetStatus = null) => {
    if (!internalServicioId) return;

    // Validar si la semana ya está en curso (Bloqueo de edición para borradores pasados/actuales)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(weekDays[0]);
    startOfWeek.setHours(0, 0, 0, 0);

    const isRunningOrPast = today >= startOfWeek;

    setLoading(true);
    try {
      const { upsertPlanificacionCompleta } = await import('../../../services/planificacionService');
      const now = await Now();

      const finalStatus = targetStatus || plan?.estatus || 'BORRADOR';

      const payload = {
        id: internalPlanId,
        id_empresa: empresaActiva.id,
        id_comedor: comedorId,
        id_servicio_config: internalServicioId,
        semana_inicio: formatToISODate(weekDays[0]),
        semana_fin: formatToISODate(weekDays[6]),
        observaciones: '',
        estatus: finalStatus,
        id_usuario_create: plan?.id_usuario_create || perfil.id,
        id_usuario_update: perfil.id,
        timestamp_create: plan?.timestamp_create || now,
        timestamp_update: now,
        detalle: detalleMenu,
        insumos_operativos: insumosOperativos
      };

      await upsertPlanificacionCompleta(payload);
      onUpdate();
      onClose();
    } catch (error) {
      console.error("Error al guardar planificación:", error);
      alert("Error al guardar la planificación. Verifique los datos.");
    } finally {
      setLoading(false);
    }
  };

  // Lógica de bloqueo visual mejorada
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(weekDays[0]);
  startOfWeek.setHours(0, 0, 0, 0);

  // Solo bloqueamos si la semana YA EMPEZÓ O PASÓ y el plan está en BORRADOR/RECHAZADO (o es nuevo)
  const estatusPlan = plan?.estatus?.toUpperCase();
  const isStatusDraft = !estatusPlan || estatusPlan === 'BORRADOR' || estatusPlan === 'RECHAZADO';
  const isPendingOrApproved = estatusPlan === 'PENDIENTE' || estatusPlan === 'APROBADO';
  const isLockedByDate = today >= startOfWeek && isStatusDraft;

  // Se puede editar si: No es lectura únicamente Y NO está pendiente/aprobado Y (No está bloqueado por fecha O es una semana futura)
  const canEdit = !isReadOnly && !isPendingOrApproved && (!isLockedByDate || today < startOfWeek);

  return createPortal(
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 sm:p-6 overflow-hidden">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose} />

      <div className="relative bg-white w-full max-w-[98vw] h-full max-h-[98vh] rounded-[3rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-500">
        {/* Cabecera Principal Compacta */}
        <div className="px-6 py-4 bg-white border-b border-slate-100 flex items-center justify-between z-20 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-brand-900 rounded-md flex items-center justify-center text-white shadow-lg rotate-3 shrink-0">
              <CalendarDays size={20} />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-black text-slate-800 tracking-tight leading-none">
                  {plan ? 'Gestionar' : 'Nueva'} Planificación
                </h3>
                {internalServicioId && (
                  <>
                    <span className="text-slate-300">|</span>
                    <span className="text-brand-900 font-black text-sm uppercase tracking-tighter">
                      {currentServicio?.tipo_servicio?.nombre}
                    </span>
                    <span className="text-[9px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                      {currentServicio?.estructura?.nombre}
                    </span>
                    <span className={`text-[9px] font-black px-3 py-0.5 rounded-full border uppercase tracking-widest ${plan?.estatus?.toUpperCase() === 'PENDIENTE' ? 'bg-amber-50 text-amber-600 border-amber-200' : plan?.estatus?.toUpperCase() === 'APROBADO' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                      {plan?.estatus || 'NUEVO'}
                    </span>
                  </>
                )}
              </div>
              <p className="text-slate-400 text-[10px] italic mt-0.5">
                {formatToDDMMYYYYManual(weekDays[0])} al {formatToDDMMYYYYManual(weekDays[6])}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-slate-50 p-1 rounded-xl flex items-center gap-1 border border-slate-100">
              <button
                disabled={!internalServicioId}
                onClick={() => setActiveTab('menu')}
                className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'menu' ? 'bg-white text-brand-900 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600 disabled:opacity-30'}`}
              >
                <Utensils size={12} /> Menú
              </button>
              <button
                disabled={!internalServicioId}
                onClick={() => setActiveTab('operacion')}
                className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'operacion' ? 'bg-white text-brand-900 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600 disabled:opacity-30'}`}
              >
                <Box size={12} /> Insumos Adicionales
              </button>
              {/* <button
                disabled={!internalServicioId}
                onClick={() => setShowConsolidado(true)}
                className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${showConsolidado ? 'bg-white text-brand-900 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600 disabled:opacity-30'}`}
              >
                <Calculator size={12} /> Total
              </button> */}
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col bg-slate-50/20">
          {!internalServicioId ? (
            <div className="flex-1 flex flex-col lg:flex-row items-center justify-center p-6 lg:p-20 gap-10 lg:gap-20 animate-in fade-in zoom-in duration-700 overflow-y-auto">

              <div className="flex flex-col items-center lg:items-start text-center lg:text-left max-w-md">
                <div className="w-24 h-24 bg-brand-900 rounded-[2.5rem] flex items-center justify-center text-white mb-10 rotate-6 shadow-2xl shadow-brand-900/30 animate-bounce-subtle">
                  <Utensils size={44} />
                </div>
                <h3 className="text-4xl font-black text-slate-800 tracking-tighter leading-[0.9] mb-6">
                  Planifica el <span className="text-brand-900">Siguiente</span> Servicio
                </h3>
                <p className="text-slate-400 text-lg font-medium italic leading-relaxed border-l-4 border-brand-100 pl-6">
                  Selecciona uno de los bloques de servicio configurados para este comedor. Cada bloque carga su propia estructura de menú.
                </p>
              </div>

              <div className="flex flex-col gap-4 w-full max-w-md relative">
                <div className="absolute -top-6 -right-6 w-32 h-32 bg-brand-50 rounded-full blur-3xl opacity-50" />

                {serviciosDisponibles.length === 0 ? (
                  <div className="p-12 bg-white rounded-[3rem] border border-slate-100 shadow-xl shadow-slate-200/50 text-center relative z-10">
                    <AlertCircle className="mx-auto text-amber-500 mb-4" size={48} strokeWidth={1.5} />
                    <p className="text-sm font-black text-slate-700 uppercase tracking-widest mb-2">Sin Configuración</p>
                    <p className="text-xs text-slate-400 italic">No hay servicios operativos registrados.</p>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[500px] overflow-y-auto pr-4 custom-scrollbar relative z-10">
                    {serviciosDisponibles
                      .filter(s => !planificacionesExistentes.some(p => String(p.id_servicio_config) === String(s.id)))
                      .map((serv, idx) => (
                        <button
                          key={serv.id}
                          onClick={() => handleInitialSave(serv.id)}
                          className="w-full bg-white p-7 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-2xl hover:border-brand-500/30 hover:-translate-y-1 transition-all group flex items-center gap-6 text-left"
                        >
                          <div className="w-14 h-14 bg-slate-50 rounded-md flex items-center justify-center text-slate-300 group-hover:bg-brand-900 group-hover:text-white group-hover:rotate-12 transition-all duration-500 shrink-0 shadow-inner">
                            <Check size={24} strokeWidth={3} />
                          </div>
                          <div className="flex-1">
                            <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-1 group-hover:text-brand-900 transition-colors">Disponible</p>
                            <p className="text-xl font-black text-slate-800 tracking-tighter leading-none">{serv.tipo_servicio?.nombre}</p>
                            <p className="text-[10px] font-bold text-slate-400 mt-2 italic">{serv.estructura?.nombre}</p>
                          </div>
                        </button>
                      ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              {activeTab === 'menu' && (
                <div className="flex-1 overflow-hidden flex flex-col">
                  <div className="flex-1 flex overflow-hidden">
                    <div className="w-32 bg-slate-50 border-r border-slate-100 flex flex-col overflow-y-auto custom-scrollbar">
                      {weekDays.map((day, idx) => {
                        const isActive = selectedDayIdx === idx;
                        const dateStr = formatToISODate(day);
                        const dayDetalle = detalleMenu.filter(d => d.fecha === dateStr);
                        const filledCount = dayDetalle.filter(d => d.id_receta && d.id_receta !== '').length;
                        const totalSlots = slots.length;
                        const isCompleted = filledCount === totalSlots && totalSlots > 0;

                        return (
                          <button
                            key={idx}
                            onClick={() => setSelectedDayIdx(idx)}
                            className={`px-4 py-3 text-left transition-all relative border-b border-slate-100/30 ${isActive ? 'bg-white shadow-[inset_-3px_0_0_0_#0f172a]' : 'hover:bg-slate-100/30'}`}
                          >
                            <p className={`text-[8px] font-black uppercase tracking-widest ${isActive ? 'text-brand-900' : 'text-slate-400'}`}>
                              {getDayNameLong(day).slice(0, 3)}
                            </p>
                            <p className={`text-[12px] font-black tracking-tighter leading-none ${isActive ? 'text-slate-900' : 'text-slate-600'}`}>
                              {day.getDate()}/{day.getMonth() + 1}/{day.getFullYear()}
                            </p>

                            <div className={`mt-1.5 text-[9px] font-black px-1.5 py-0.5 rounded-md inline-block ${isCompleted ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                              {filledCount}/{totalSlots}
                            </div>

                            {isCompleted && (
                              <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-sm" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex-1 bg-white overflow-y-auto p-6 custom-scrollbar">
                      {loading ? (
                        <div className="h-full flex flex-col items-center justify-center">
                          <div className="w-8 h-8 border-2 border-brand-100 border-t-brand-900 rounded-full animate-spin mb-4" />
                        </div>
                      ) : slots.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center p-10 text-slate-300">
                          <Layers size={48} className="mb-4 opacity-20" />
                          <p className="font-black uppercase tracking-tight text-sm text-slate-400">Sin Niveles</p>
                        </div>
                      ) : (() => {
                        const dateStr = formatToISODate(weekDays[selectedDayIdx]);
                        const dayEntries = detalleMenu.filter(d => d.fecha === dateStr);
                        const baseSlotIds = slots.filter(s =>
                          s.tipologias?.some(t => tipologias.find(tp => Number(tp.id) === Number(t.id_tipologia))?.es_base)
                        ).map(s => Number(s.id));
                        const totalBasePax = dayEntries
                          .filter(d => baseSlotIds.includes(Number(d.id_estructura_slot)))
                          .reduce((acc, d) => acc + (Number(d.comensales) || 0), 0);

                        return (
                          <div className="max-w-4xl mx-auto space-y-4 animate-in fade-in slide-in-from-right-2 duration-300">
                            <div className="bg-brand-50/50 border border-brand-100 p-4 rounded-3xl flex items-center justify-between mb-6">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-brand-900 rounded-xl flex items-center justify-center text-white shadow-lg">
                                  <Users size={16} />
                                </div>
                                <div>
                                  <p className="text-[10px] font-black text-brand-900 uppercase tracking-widest leading-none mb-1">Cupo Base del Día</p>
                                  <p className="text-[9px] font-bold text-slate-400 italic">Total de comensales en platos base</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-2xl font-black text-brand-900 leading-none">{totalBasePax}</p>
                                <p className="text-[8px] font-black uppercase text-brand-900/40">Pax Ref.</p>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 gap-2">
                              {slots.map(slot => {
                                const isBase = baseSlotIds.includes(Number(slot.id));
                                const existing = dayEntries.find(d => Number(d.id_estructura_slot) === Number(slot.id));
                                const slotTipologias = slot.tipologias?.map(t => Number(t.id_tipologia)) || [];
                                const sameTypeEntries = dayEntries.filter(d => {
                                  const dSlot = slots.find(s => Number(s.id) === Number(d.id_estructura_slot));
                                  return dSlot?.tipologias?.some(t => slotTipologias.includes(Number(t.id_tipologia))) && Number(d.id_estructura_slot) !== Number(slot.id);
                                });
                                const currentOtherSum = sameTypeEntries.reduce((acc, d) => acc + (Number(d.comensales) || 0), 0);
                                const currentTotalPax = currentOtherSum + (Number(existing?.comensales) || 0);
                                const groupPercentage = totalBasePax > 0 ? Math.round((currentTotalPax / totalBasePax) * 100) : 0;
                                const maxAllowed = isBase ? 999999 : Math.max(0, totalBasePax - currentOtherSum);

                                return (
                                  <div key={slot.id} className="flex flex-col sm:flex-row sm:items-center gap-4 group">
                                    <div className="sm:w-44 shrink-0">
                                      <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-2 rounded border block text-center sm:text-left truncate ${isBase ? 'bg-brand-900 text-white border-brand-900 shadow-md shadow-brand-900/10' : 'bg-brand-50 text-brand-900 border-brand-100'}`}>
                                        {slot.nombre}
                                      </span>
                                    </div>
                                    <div className="flex-1">
                                      <SlotCell
                                        entry={existing}
                                        recetas={recetas}
                                        tipologiasPermitidas={slotTipologias}
                                        isReadOnly={!canEdit}
                                        maxPax={maxAllowed}
                                        totalBasePax={totalBasePax}
                                        groupPercentage={groupPercentage}
                                        isBase={isBase}
                                        onChange={(updates) => {
                                          if (updates.id_receta === '') {
                                            updates.comensales = 0;
                                          } else if (updates.id_receta) {
                                            const currentPax = Number(existing?.comensales) || 0;
                                            if (currentPax === 0) {
                                              updates.comensales = isBase ? 1 : totalBasePax;
                                            }
                                          }
                                          if (!existing) {
                                            const newEntry = {
                                              fecha: formatToISODate(weekDays[selectedDayIdx]),
                                              id_estructura_slot: slot.id,
                                              id_receta: '',
                                              comensales: 0,
                                              ajustes_ingredientes: {},
                                              tempId: Math.random().toString(36).substr(2, 9)
                                            };
                                            setDetalleMenu([...detalleMenu, { ...newEntry, ...updates }]);
                                          } else {
                                            setDetalleMenu(detalleMenu.map(d => (Number(d.id_estructura_slot) === Number(slot.id) && d.fecha === dateStr) ? { ...d, ...updates } : d));
                                          }
                                        }}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'operacion' && (
                <div className="flex-1 overflow-auto p-10 flex flex-col gap-8 animate-in slide-in-from-right-4 duration-500">
                  <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                      <div>
                        <h4 className="text-xl font-black text-slate-800">Insumos de Operación Directos</h4>
                        <p className="text-xs text-slate-400 italic">Limpieza, papelería y otros suministros no alimenticios</p>
                      </div>
                      <button
                        disabled={!canEdit}
                        onClick={() => setInsumosOperativos([...insumosOperativos, { id_rubro: '', cantidad: 0, observacion: '', tempId: Math.random().toString(36).substr(2, 9) }])}
                        className="flex items-center gap-2 px-6 py-2.5 bg-brand-900 text-white rounded-md text-[10px] font-black uppercase hover:bg-brand-800 transition-all disabled:opacity-50"
                      >
                        <Plus size={16} /> Agregar Insumo
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-gray-50/50">
                            <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest rounded-l-2xl">Rubro Operativo</th>
                            <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Unidad</th>
                            <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Cantidad Semanal</th>
                            <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Observación / Detalle</th>
                            <th className="px-6 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest rounded-r-2xl w-20">Acción</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {insumosOperativos.map((item, idx) => {

                            const rubro = rubrosOperativos.find(r => String(r.id) === String(item.id_rubro));
                            //console.log(rubro)
                            return (
                              <tr key={item.tempId || idx} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4">
                                  <select
                                    disabled={!canEdit}
                                    value={item.id_rubro}
                                    onChange={(e) => {
                                      const updated = insumosOperativos.map((ins, i) => i === idx ? { ...ins, id_rubro: e.target.value } : ins);
                                      setInsumosOperativos(updated);
                                    }}
                                    className="w-full bg-white border border-slate-100 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 outline-none focus:border-brand-500"
                                  >
                                    <option value="">-- SELECCIONE RUBRO --</option>
                                    {rubrosOperativos.map(r => (
                                      <option key={r.id} value={r.id}>{r.nombre}</option>
                                    ))}
                                  </select>
                                </td>
                                <td className="px-6 py-4 text-sm font-medium text-slate-500">{rubro?.unidad?.abreviatura || '-'}</td>
                                <td className="px-6 py-4">
                                  <input
                                    disabled={!canEdit}
                                    type="number"
                                    value={item.cantidad}
                                    onChange={(e) => {
                                      const updated = insumosOperativos.map((ins, i) => i === idx ? { ...ins, cantidad: parseFloat(e.target.value) || 0 } : ins);
                                      setInsumosOperativos(updated);
                                    }}
                                    className="w-32 bg-white border border-slate-100 rounded-xl px-4 py-2 text-sm font-black text-brand-900 outline-none focus:border-brand-500"
                                  />
                                </td>
                                <td className="px-6 py-4">
                                  <input
                                    disabled={!canEdit}
                                    type="text"
                                    placeholder="Ej: 24oz, Mediano, etc."
                                    value={item.observacion || ''}
                                    onChange={(e) => {
                                      const updated = insumosOperativos.map((ins, i) => i === idx ? { ...ins, observacion: e.target.value } : ins);
                                      setInsumosOperativos(updated);
                                    }}
                                    className="w-full bg-white border border-slate-100 rounded-xl px-4 py-2 text-sm font-bold text-slate-600 outline-none focus:border-brand-500 placeholder:text-slate-300 placeholder:italic placeholder:font-normal"
                                  />
                                </td>
                                <td className="px-6 py-4 text-center">
                                  {canEdit && (
                                    <button
                                      onClick={() => setInsumosOperativos(insumosOperativos.filter((_, i) => i !== idx))}
                                      className="p-2 text-red-300 hover:text-red-500 transition-colors"
                                    >
                                      <Trash2 size={18} />
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
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Compacto */}
        <div className="px-6 py-4 bg-white border-t border-slate-100 flex items-center justify-between z-20 shrink-0">
          <div className="flex items-center gap-3 text-slate-400 italic text-[10px]">
            <Info size={14} />
            <p>Complete el menú para generar el consolidado automáticamente.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 rounded-xl text-[10px] font-black uppercase text-slate-400 hover:bg-slate-50 transition-all"
            >
              Cerrar
            </button>

            {canEdit && (
              <>
                <button
                  onClick={() => handleSave('BORRADOR')}
                  disabled={loading || !internalServicioId}
                  className="flex items-center gap-2 px-6 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase hover:bg-slate-50 transition-all disabled:opacity-50 active:scale-95"
                >
                  {loading ? <div className="w-3 h-3 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin" /> : <Save size={14} />}
                  Guardar Borrador
                </button>

                <button
                  onClick={() => handleSave('PENDIENTE')}
                  disabled={loading || !internalServicioId}
                  className="flex items-center gap-2 px-8 py-2 bg-brand-900 text-white rounded-xl text-[10px] font-black uppercase hover:bg-brand-800 transition-all shadow-lg shadow-brand-900/20 disabled:opacity-50 active:scale-95"
                >
                  {loading ? <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <Check size={14} />}
                  Finalizar Plan
                </button>
              </>
            )}

            {isLockedByDate && !isReadOnly && (
              <div className="bg-red-50 border border-red-100 px-4 py-2 rounded-xl flex items-center gap-2">
                <AlertCircle size={14} className="text-red-500" />
                <span className="text-[9px] font-black text-red-500 uppercase">La semana ya está en curso. Bloqueado para envío.</span>
              </div>
            )}
          </div>
        </div>

      </div>
      {showConsolidado && (
        <PlanificacionConsolidadaModal
          planId={internalPlanId}
          planDetalle={detalleMenu}
          insumosOperativos={insumosOperativos}
          weekDays={weekDays}
          onClose={() => setShowConsolidado(false)}
        />
      )}
    </div>,
    document.body
  );
}

// Componente auxiliar para cada celda de la planificación
function SlotCell({ entry, recetas, tipologiasPermitidas = [], isReadOnly, maxPax, totalBasePax, groupPercentage, isBase, onChange }) {
  if (!entry) return null;

  // Filtrar recetas según tipologías permitidas del slot
  const recetasFiltradas = tipologiasPermitidas.length > 0
    ? recetas.filter(r => tipologiasPermitidas.some(idT => Number(idT) === Number(r.id_tipologia)))
    : recetas;

  // Solo validar límite si NO es una base
  const isOverLimit = !isBase && Number(entry.comensales) > Number(maxPax);

  // Calcular porcentaje con respecto a la base
  const paxNumber = Number(entry.comensales) || 0;
  const totalBaseNumber = Number(totalBasePax) || 0;
  const percentage = totalBaseNumber > 0 ? Math.round((paxNumber / totalBaseNumber) * 100) : 0;

  return (
    <div className={`px-4 py-1 rounded-md border-2 transition-all min-h-[80px] flex flex-col justify-center ${entry.id_receta ? 'bg-white border-brand-100 shadow-sm' : 'bg-slate-50 border-dashed border-slate-200 opacity-60 hover:opacity-100 hover:bg-white hover:border-brand-100'} ${isOverLimit ? 'border-red-500 bg-red-50/30' : ''}`}>
      <div className="flex flex-col sm:flex-row items-center gap-4">

        <div className="relative flex-1 group/sel w-full">
          <ChefHat size={12} className={`absolute left-3 top-1/2 -translate-y-1/2 transition-colors ${isOverLimit ? 'text-red-500' : 'text-slate-400 group-hover/sel:text-brand-900'}`} />
          <select
            disabled={isReadOnly}
            value={entry.id_receta || ''}
            onChange={(e) => onChange({ id_receta: e.target.value })}
            className={`w-full pl-8 pr-4 py-1.5 border rounded-lg text-[10px] font-bold appearance-none focus:ring-2 outline-none transition-all ${isOverLimit ? 'bg-white border-red-200 text-red-900 focus:ring-red-500/20 focus:border-red-500' : 'bg-slate-50 border-slate-100 text-slate-700 focus:ring-brand-500/20 focus:border-brand-500'}`}
          >
            <option value="">Seleccione Receta...</option>
            {recetasFiltradas.map(r => (
              <option key={r.id} value={r.id}>{r.nombre}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-32">
          <div className="flex-1 relative">
            <Users size={10} className={`absolute left-3 top-1/2 -translate-y-1/2 ${isOverLimit ? 'text-red-500' : 'text-slate-400'}`} />
            <input
              type="number"
              disabled={isReadOnly || !entry.id_receta}
              value={entry.comensales || ''}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 0;
                onChange({ comensales: val });
              }}
              placeholder="Pax"
              className={`w-full pl-7 pr-2 py-1.5 border rounded-lg text-[10px] font-black focus:ring-2 outline-none transition-all ${!entry.id_receta ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : isOverLimit ? 'bg-white border-red-200 text-red-900 focus:ring-red-500/20 focus:border-red-500 animate-shake' : 'bg-slate-50 border-slate-100 text-brand-900 focus:ring-brand-500/20 focus:border-brand-500'}`}
            />
            {!isBase && totalBaseNumber > 0 && (
              <span className={`absolute -top-6 right-0 text-[8px] font-black uppercase tracking-widest bg-white px-1 ${isOverLimit ? 'text-red-500' : 'text-brand-900'}`}>
                {percentage}%
              </span>
            )}
            {isBase && (
              <span className="absolute -top-6 right-0 text-[8px] font-black text-brand-900 uppercase tracking-widest bg-white px-1">BASE</span>
            )}
          </div>
          {!isReadOnly && entry.id_receta && (
            <button
              onClick={() => onChange({ id_receta: '', comensales: 0 })}
              className="p-1.5 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all shrink-0"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
      {isOverLimit && (
        <p className="text-[8px] font-black text-red-500 uppercase mt-2 animate-in fade-in slide-in-from-top-1">
          Excede el cupo base ({groupPercentage}%.)
        </p>
      )}
    </div>
  );
}
