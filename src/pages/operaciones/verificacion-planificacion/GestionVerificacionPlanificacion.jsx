import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../../lib/supabase';
import { useModulePermissions } from '../../../hooks/useModulePermissions';
import { CalendarDays, ChefHat, ChevronLeft, ChevronRight, Filter, ClipboardList, Calculator, Eye, Check, XCircle, AlertCircle, Loader2, X } from 'lucide-react';
import { startOfWeekManual, addDaysManual, addWeeksManual, isSameDayManual, getDayNameShort, getMonthNameShort, formatToISODate, getWeekNumber, formatearFecha, formato8Digitos } from '../../../util/workDate';
import { Now } from '../../../services/nowService';

import PlanificacionConsolidadaModal from '../../operaciones-comedor/planificacion/PlanificacionConsolidadaModal';
import ViewDetalleMenu from '../../operaciones-comedor/planificacion/ViewDetalleMenu';
import { getPlanificacionesSemanales, approvePlanificacion, updatePlanificacionStatus, getComedores } from '../../../services/planificacionService';
import AprobarPlanificacionModal from './AprobarPlanificacionModal';
import RechazarPlanificacionModal from './RechazarPlanificacionModal';

export default function GestionVerificacionPlanificacion() {
  const { perfil, empresaActiva, renderGuard } = useModulePermissions();
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [serverNow, setServerNow] = useState(new Date());

  const [sucursalSelected, setSucursalSelected] = useState('');
  const [comedorSelected, setComedorSelected] = useState('');
  const [comedores, setComedores] = useState([]);
  const [planificaciones, setPlanificaciones] = useState([]);

  // Suscripción Realtime
  useEffect(() => {
    if (!empresaActiva?.id || !comedorSelected) return;

    const channel = supabase
      .channel('verificacion_planificacion_realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'planificacion_semanal',
        filter: `id_empresa=eq.${empresaActiva.id}`
      }, () => {
        fetchPlanificaciones();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [empresaActiva?.id, comedorSelected, currentDate]);

  // Modales
  const [showConsolidadoModal, setShowConsolidadoModal] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [selectedPlanDetalle, setSelectedPlanDetalle] = useState([]);
  const [selectedInsumosOperativos, setSelectedInsumosOperativos] = useState([]);

  const [showViewMenu, setShowViewMenu] = useState(false);
  const [selectedPlanMenu, setSelectedPlanMenu] = useState(null);

  const isSuperAdmin = perfil?.F_ALL === true;

  // Filtrar sucursales y comedores por permisos (Igual que en planificación)
  const sucursalesDisponibles = useMemo(() => {
    return Array.from(new Set(comedores.map(c => c.id_sucursal)))
      .map(id => {
        const com = comedores.find(c => c.id_sucursal === id);
        return { id, nombre: com?.sucursal?.nombre };
      })
      .filter(s => isSuperAdmin || !perfil.ids_sucursales || perfil.ids_sucursales.includes(s.id));
  }, [comedores, perfil, isSuperAdmin]);

  const comedoresFiltrados = useMemo(() => {
    return comedores.filter(c =>
      c.id_sucursal == sucursalSelected &&
      (isSuperAdmin || !perfil.ids_comedores || perfil.ids_comedores.includes(c.id))
    );
  }, [comedores, sucursalSelected, perfil, isSuperAdmin]);

  const startDate = startOfWeekManual(currentDate);
  const weekDays = [...Array(7)].map((_, i) => addDaysManual(startDate, i));

  useEffect(() => {
    const initDate = async () => {
      const nowStr = await Now();
      const now = new Date(nowStr);
      setServerNow(now);
      setCurrentDate(now);
    };
    initDate();
  }, []);

  useEffect(() => {
    if (empresaActiva?.id) fetchComedores();
  }, [empresaActiva?.id]);

  useEffect(() => {
    if (empresaActiva?.id && comedorSelected && currentDate) {
      fetchPlanificaciones();
    } else {
      setPlanificaciones([]);
    }
  }, [empresaActiva?.id, comedorSelected, currentDate]);

  const fetchComedores = async () => {
    try {
      const data = await getComedores(empresaActiva.id);
      setComedores(data || []);

      // Auto-seleccionar sucursal si solo hay una disponible tras filtrar
      const sucs = Array.from(new Set((data || []).map(c => c.id_sucursal)))
        .filter(id => isSuperAdmin || !perfil.ids_sucursales || perfil.ids_sucursales.includes(id));
      if (sucs.length === 1) setSucursalSelected(sucs[0]);
    } catch (error) {
      console.error("Error al cargar comedores:", error);
    }
  };

  const fetchPlanificaciones = async () => {
    setLoading(true);
    try {
      const start = formatToISODate(weekDays[0]);
      const end = formatToISODate(weekDays[6]);
      const data = await getPlanificacionesSemanales(empresaActiva.id, comedorSelected, start, end);
      // Solo los pendientes para el Gerente Operativo
      setPlanificaciones((data || []).filter(p => p.estatus === 'PENDIENTE'));
    } catch (error) {
      console.error("Error al cargar planificaciones:", error);
    } finally {
      setLoading(false);
    }
  };

  const [showAprobarModal, setShowAprobarModal] = useState(false);
  const [planToApprove, setPlanToApprove] = useState(null);

  const handleAprobar = async (plan) => {
    setActionLoading(plan.id);
    try {
      await approvePlanificacion(plan.id, perfil.id);
      await fetchPlanificaciones();
      setShowAprobarModal(false);
      setPlanToApprove(null);
    } catch (error) {
      console.error("Error al aprobar:", error);
      alert("Error al procesar la aprobación.");
    } finally {
      setActionLoading(null);
    }
  };

  const [showRechazarModal, setShowRechazarModal] = useState(false);
  const [planToReject, setPlanToReject] = useState(null);

  const handleRechazar = async (planId) => {
    setActionLoading(planId);
    try {
      await updatePlanificacionStatus(planId, 'RECHAZADO', perfil.id);
      await fetchPlanificaciones();
      setShowRechazarModal(false);
      setPlanToReject(null);
    } catch (error) {
      console.error("Error al rechazar:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const guard = renderGuard();
  if (guard) return guard;

  return (
    <div className="p-4 sm:p-8 space-y-8 animate-in fade-in duration-500 bg-slate-50 min-h-screen">
      {/* ... (resto del JSX igual hasta los modales) */}
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-brand-900 rounded-md text-white shadow-xl rotate-3">
            <ClipboardList size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight uppercase leading-none">Verificación de Planificación</h1>
            <p className="text-sm text-slate-400 italic font-medium mt-1">Revisión y aprobación de menús semanales por gerencia</p>
          </div>
        </div>
      </div>

      {/* Selectores de Contexto (Unificados con Planificación) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Nivel 1: Sucursal */}
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col gap-4">
          <div className="flex items-center gap-2 text-slate-400">
            <Filter size={16} />
            <span className="text-[10px] font-black uppercase tracking-widest">Sucursal</span>
          </div>
          <select
            value={sucursalSelected}
            onChange={(e) => {
              setSucursalSelected(e.target.value);
              setComedorSelected('');
            }}
            className="w-full px-4 py-3 rounded-md border border-slate-100 bg-slate-50/50 text-sm font-bold text-slate-700 outline-none focus:border-brand-900 transition-all"
          >
            <option value="">-- SELECCIONE SUCURSAL --</option>
            {sucursalesDisponibles.map(s => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </select>
        </div>

        {/* Nivel 2: Comedor */}
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col gap-4">
          <div className="flex items-center gap-2 text-slate-400">
            <ChefHat size={16} />
            <span className="text-[10px] font-black uppercase tracking-widest">Comedor</span>
          </div>
          <select
            value={comedorSelected}
            disabled={!sucursalSelected}
            onChange={(e) => setComedorSelected(e.target.value)}
            className="w-full px-4 py-3 rounded-md border border-slate-100 bg-slate-50/50 text-sm font-bold text-slate-700 outline-none focus:border-brand-900 transition-all disabled:opacity-50"
          >
            <option value="">-- SELECCIONE COMEDOR --</option>
            {comedoresFiltrados.map(c => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </div>

        {/* Calendario Semanal */}
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col gap-4">
          <div className="flex w-full flex-col items-start justify-between">
            <div className="flex items-center gap-2 text-slate-400">
              <CalendarDays size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">Semana de Revisión</span>
            </div>
            <div className="w-full flex items-center justify-center gap-1 mt-1">
              <button onClick={() => setCurrentDate(addWeeksManual(currentDate, -1))} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400"><ChevronLeft size={20} /></button>
              <div className="flex flex-col items-center bg-slate-100 px-6 py-1.5 rounded-full">
                <span className="text-[10px] font-black text-brand-900 uppercase leading-none">Sem#{getWeekNumber(weekDays[0])}</span>
                <span className="text-[8px] lg:text-[11px] font-bold text-slate-700 mt-0.5">
                  {weekDays[0].getDate()} {getMonthNameShort(weekDays[0])} - {weekDays[6].getDate()} {getMonthNameShort(weekDays[6])} {weekDays[6].getFullYear()}
                </span>
              </div>
              <button onClick={() => setCurrentDate(addWeeksManual(currentDate, 1))} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400"><ChevronRight size={20} /></button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map((day, idx) => (
              <div key={idx} className={`text-center p-2 rounded-xl border ${isSameDayManual(day, serverNow) ? 'bg-brand-50 border-brand-200' : 'bg-slate-50 border-slate-100'}`}>
                <p className="text-[6px] lg:text-[10px] font-black text-slate-400 uppercase">{getDayNameShort(day)}</p>
                <p className={`text-[8px] lg:text-[11px] font-black ${isSameDayManual(day, serverNow) ? 'text-brand-900' : 'text-slate-700'}`}>{day.getDate()}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Lista de Planificaciones */}
      {!comedorSelected ? (
        <div className="bg-white rounded-[2.5rem] p-20 flex flex-col items-center justify-center border border-dashed border-slate-200 animate-in fade-in zoom-in duration-700">
          <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 mb-6">
            <ChefHat size={48} />
          </div>
          <h3 className="text-xl font-black text-slate-400 uppercase tracking-tighter">Esperando Selección</h3>
          <p className="text-slate-400 text-sm italic mt-2 text-center max-w-xs">Seleccione una sucursal y comedor para verificar las planificaciones pendientes.</p>
        </div>
      ) : loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[2.5rem] border border-slate-100">
          <div className="w-12 h-12 border-4 border-brand-100 border-t-brand-900 rounded-full animate-spin mb-4" />
          <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Cargando planificaciones...</p>
        </div>
      ) : planificaciones.length > 0 ? (
        <div className="grid grid-cols-2 gap-6 animate-in slide-in-from-bottom-4 duration-500">
          {planificaciones.map((plan) => (
            <div key={plan.id} className={`bg-white rounded-[2.5rem] p-8 shadow-sm border transition-all ${plan.estatus === 'APROBADO' ? 'border-emerald-100 opacity-80' : 'border-slate-100 hover:shadow-xl hover:border-brand-100'}`}>
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-md ${plan.estatus === 'APROBADO' ? 'bg-emerald-50 text-emerald-600' : 'bg-brand-50 text-brand-900'}`}>
                    <CalendarDays size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter leading-none">
                      {plan.servicio_config?.tipo_servicio?.nombre}
                    </h3>
                    <p className="text-xs text-slate-400 font-bold mt-1 uppercase tracking-widest">
                      {plan.servicio_config?.estructura?.nombre}
                    </p>
                  </div>
                </div>
                <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${plan.estatus === 'PENDIENTE' ? 'bg-amber-50 text-amber-600 border-amber-200 animate-pulse' :
                  plan.estatus === 'APROBADO' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                    plan.estatus === 'RECHAZADO' ? 'bg-red-50 text-red-600 border-red-200' :
                      'bg-slate-50 text-slate-500 border-slate-200'
                  }`}>
                  {plan.estatus}
                  {plan.estatus === 'APROBADO' && plan.requisicion?.[0]?.id && (
                    <span className="ml-1 opacity-70">/ REQ {formato8Digitos(plan.requisicion[0].id)}</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-slate-50 p-4 rounded-md border border-slate-100">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Días Menú</p>
                  <p className="text-sm font-black text-slate-700">{plan.detalle?.length || 0} Registros</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-md border border-slate-100">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Insumos Adic.</p>
                  <p className="text-sm font-black text-slate-700">{plan.insumos_operativos?.length || 0} Items</p>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-50 flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-col min-w-[120px]">
                  <span className="text-[9px] font-black text-slate-400 uppercase leading-none mb-1">Enviado por:</span>
                  <span className="text-xs font-bold text-slate-600 truncate max-w-[150px]">
                    {plan.usuario_update?.nombres} {plan.usuario_update?.apellidos}
                  </span>
                </div>

                <div className="flex items-center gap-2 ml-auto">
                  {/* Visores */}
                  <div className="flex items-center gap-1.5 mr-2 pr-2 border-r border-slate-100">
                    <button
                      onClick={() => { setSelectedPlanMenu(plan); setShowViewMenu(true); }}
                      className="p-3 rounded-xl bg-slate-50 text-slate-400 hover:bg-brand-900 hover:text-white transition-all shadow-sm active:scale-95 border border-slate-100"
                      title="Ver Menú"
                    >
                      <Eye size={18} />
                    </button>
                    <button
                      onClick={() => {
                        setSelectedPlanId(plan.id);
                        setSelectedPlanDetalle(plan.detalle || []);
                        setSelectedInsumosOperativos(plan.insumos_operativos || []);
                        setShowConsolidadoModal(true);
                      }}
                      className="p-3 rounded-xl bg-brand-50 text-brand-900 hover:bg-brand-900 hover:text-white transition-all shadow-sm active:scale-95 border border-brand-100"
                      title="Ver Consolidado"
                    >
                      <Calculator size={18} />
                    </button>
                  </div>

                  {/* Acciones de Gerencia */}
                  {plan.estatus === 'PENDIENTE' && (
                    <div className="flex items-center gap-2">
                      <button
                        disabled={actionLoading === plan.id}
                        onClick={() => {
                          setPlanToReject(plan);
                          setShowRechazarModal(true);
                        }}
                        className="p-3 rounded-xl bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm border border-red-100 active:scale-95"
                        title="Rechazar y devolver a Borrador"
                      >
                        {actionLoading === plan.id ? <Loader2 size={18} className="animate-spin" /> : <XCircle size={18} />}
                      </button>
                      <button
                        disabled={actionLoading === plan.id}
                        onClick={() => {
                          setPlanToApprove(plan);
                          setShowAprobarModal(true);
                        }}
                        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                      >
                        {actionLoading === plan.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={16} />}
                        <span className="text-[10px] font-black uppercase tracking-widest">Aprobar</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-[2.5rem] p-20 flex flex-col items-center justify-center border border-slate-100 shadow-sm">
          <AlertCircle size={48} className="text-slate-200 mb-4" />
          <p className="text-slate-400 font-bold italic text-sm">No hay planificaciones pendientes de verificación.</p>
        </div>
      )}

      {/* Modales Compartidos */}
      {showConsolidadoModal && (
        <PlanificacionConsolidadaModal
          planId={selectedPlanId}
          planDetalle={selectedPlanDetalle}
          insumosOperativos={selectedInsumosOperativos}
          weekDays={weekDays}
          onClose={() => setShowConsolidadoModal(false)}
        />
      )}

      {showViewMenu && selectedPlanMenu && (
        <ViewDetalleMenu
          plan={selectedPlanMenu}
          onClose={() => {
            setShowViewMenu(false);
            setSelectedPlanMenu(null);
          }}
        />
      )}

      {showRechazarModal && planToReject && (
        <RechazarPlanificacionModal
          plan={planToReject}
          comedores={comedores}
          onClose={() => {
            setShowRechazarModal(false);
            setPlanToReject(null);
          }}
          onConfirm={() => handleRechazar(planToReject.id)}
          loading={actionLoading === planToReject.id}
        />
      )}

      {showAprobarModal && planToApprove && (
        <AprobarPlanificacionModal
          plan={planToApprove}
          comedores={comedores}
          onClose={() => {
            setShowAprobarModal(false);
            setPlanToApprove(null);
          }}
          onConfirm={() => handleAprobar(planToApprove)}
          loading={actionLoading === planToApprove.id}
        />
      )}
    </div>
  );
}
