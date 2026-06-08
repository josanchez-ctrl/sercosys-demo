import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useModulePermissions } from '../../../hooks/useModulePermissions';
import { CalendarDays, ChefHat, Plus, Search, ChevronLeft, ChevronRight, Filter, ClipboardList, Info, Calculator, Eye } from 'lucide-react';
import { startOfWeekManual, addDaysManual, addWeeksManual, isSameDayManual, getDayNameShort, getMonthNameShort, formatToISODate, getWeekNumber, formato8Digitos } from '../../../util/workDate';
import { Now } from '../../../services/nowService';

import { getComedores, getPlanificacionesSemanales, getServiciosConfig } from '../../../services/planificacionService';
import PlanificacionModal from './PlanificacionModal';
import PlanificacionConsolidadaModal from './PlanificacionConsolidadaModal';
import ViewDetalleMenu from './ViewDetalleMenu';

export default function GestionPlanificacion() {
  const { perfil, empresaActiva, renderGuard } = useModulePermissions();

  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [serverNow, setServerNow] = useState(new Date());
  const [sucursalSelected, setSucursalSelected] = useState('');
  const [comedorSelected, setComedorSelected] = useState('');
  const [comedores, setComedores] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [planificaciones, setPlanificaciones] = useState([]);

  // Suscripción Realtime
  useEffect(() => {
    if (!empresaActiva?.id || !comedorSelected) return;

    const channel = supabase
      .channel('planificacion_gestion_realtime')
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

  // Estados para el Modal
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showConsolidadoModal, setShowConsolidadoModal] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [selectedPlanDetalle, setSelectedPlanDetalle] = useState([]);
  const [selectedInsumosOperativos, setSelectedInsumosOperativos] = useState([]);

  // Ver Detalle Menú
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [selectedPlanMenu, setSelectedPlanMenu] = useState(null);

  const isSuperAdmin = perfil?.F_ALL === true;

  // Filtrar sucursales y comedores por permisos
  const sucursalesDisponibles = Array.from(new Set(comedores.map(c => c.id_sucursal)))
    .map(id => {
      const com = comedores.find(c => c.id_sucursal === id);
      return { id, nombre: com?.sucursal?.nombre };
    })
    .filter(s => isSuperAdmin || !perfil.ids_sucursales || perfil.ids_sucursales.includes(s.id));

  const comedoresFiltrados = comedores.filter(c =>
    c.id_sucursal == sucursalSelected &&
    (isSuperAdmin || !perfil.ids_comedores || perfil.ids_comedores.includes(c.id))
  );

  // Generar los días de la semana actual (Lunes a Domingo)
  const startDate = startOfWeekManual(currentDate);
  const weekDays = [...Array(7)].map((_, i) => addDaysManual(startDate, i));

  // Lógica de validación de tiempo
  const startOfCurrentWeek = startOfWeekManual(serverNow);
  const isFutureWeek = startDate.getTime() > startOfCurrentWeek.getTime();
  const isCurrentWeek = startDate.getTime() === startOfCurrentWeek.getTime();

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
    if (empresaActiva?.id) {
      fetchComedores();
    }
  }, [empresaActiva?.id]);

  useEffect(() => {
    if (empresaActiva?.id && comedorSelected) {
      fetchServicios();
    } else {
      setServicios([]);
    }
  }, [comedorSelected]);

  useEffect(() => {
    if (empresaActiva?.id && comedorSelected && currentDate) {
      fetchPlanificaciones();
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

  const fetchServicios = async () => {
    try {
      const data = await getServiciosConfig(comedorSelected);
      setServicios(data || []);
    } catch (error) {
      console.error("Error al cargar servicios:", error);
    }
  };

  const fetchPlanificaciones = async () => {
    setLoading(true);
    try {
      const fecha_inicio = formatToISODate(weekDays[0]);
      const fecha_fin = formatToISODate(weekDays[6]);
      const data = await getPlanificacionesSemanales(empresaActiva.id, comedorSelected, fecha_inicio, fecha_fin);
      setPlanificaciones(data || []);
    } catch (error) {
      console.error("Error al cargar planificaciones:", error);
    } finally {
      setLoading(false);
    }
  };

  const guard = renderGuard();
  if (guard) return guard;

  return (
    <div className="p-4 sm:p-8 space-y-2 animate-in fade-in duration-500 bg-slate-50">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-md bg-brand-900 flex items-center justify-center text-white shadow-xl shadow-brand-900/20">
            <CalendarDays size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Planificación de Menú</h1>
            <p className="text-slate-500 text-sm italic">Gestión semanal de servicios e insumos operativos</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isFutureWeek && (
            <button
              onClick={() => { setSelectedItem(null); setShowModal(true); }}
              className="flex items-center gap-2 px-6 py-3 bg-brand-900 text-white rounded-md text-xs font-black uppercase hover:bg-brand-800 transition-all shadow-lg shadow-brand-900/20 active:scale-95"
            >
              <Plus size={18} /> Nueva Planificación
            </button>
          )}
          {(isCurrentWeek || !isFutureWeek) && (
            <div className="px-6 py-3 bg-amber-50 text-amber-600 rounded-md text-[10px] font-black uppercase border border-amber-100 flex items-center gap-2">
              <Info size={16} /> Semana en curso o histórica
            </div>
          )}
        </div>
      </div>

      {/* Selectores de Contexto (Nivel 1 y 2) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col gap-4">
          <div className="flex w-full flex-col items-start justify-between">
            <div className="flex items-center gap-2 text-slate-400">
              <CalendarDays size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">Semana de Planificación</span>
            </div>
            <div className="w-full flex items-center justify-center gap-2">
              <button onClick={() => setCurrentDate(addWeeksManual(currentDate, -1))} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400"><ChevronLeft size={20} /></button>
              <div className="flex flex-col items-center bg-slate-100 px-6 py-1.5 rounded-full">
                <span className="text-[10px] font-black text-brand-900 uppercase">Sem#{getWeekNumber(weekDays[0])}</span>
                <span className="text-[11px] font-bold text-slate-700">
                  {weekDays[0].getDate()} {getMonthNameShort(weekDays[0])} - {weekDays[6].getDate()} {getMonthNameShort(weekDays[6])} {weekDays[6].getFullYear()}
                </span>
              </div>
              <button onClick={() => setCurrentDate(addWeeksManual(currentDate, 1))} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400"><ChevronRight size={20} /></button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map((day, idx) => (
              <div key={idx} className={`text-center p-2 rounded-xl border ${isSameDayManual(day, serverNow) ? 'bg-brand-50 border-brand-200' : 'bg-slate-50 border-slate-100'}`}>
                <p className="text-[8px] font-black text-slate-400 uppercase">{getDayNameShort(day)}</p>
                <p className={`text-xs font-black ${isSameDayManual(day, serverNow) ? 'text-brand-900' : 'text-slate-700'}`}>{day.getDate()}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Estado Vacío / Listado */}
      {!comedorSelected ? (
        <div className="bg-white rounded-[2.5rem] p-20 flex flex-col items-center justify-center border border-dashed border-slate-200 animate-in fade-in zoom-in duration-700">
          <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 mb-6">
            <ChefHat size={48} />
          </div>
          <h3 className="text-xl font-black text-slate-400 uppercase tracking-tighter">Esperando Selección</h3>
          <p className="text-slate-400 text-sm italic mt-2 text-center max-w-xs">Seleccione un comedor para visualizar o crear una nueva planificación semanal</p>
        </div>
      ) : loading ? (
        <div className="bg-white rounded-[2.5rem] p-20 flex flex-col items-center justify-center border border-slate-100 shadow-sm animate-pulse">
          <div className="w-12 h-12 border-4 border-brand-900/20 border-t-brand-900 rounded-full animate-spin mb-4" />
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Cargando Planificaciones...</p>
        </div>
      ) : planificaciones.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-in slide-in-from-bottom-4 duration-500">
          {planificaciones.map(plan => (
            <div key={plan.id} className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden">
              <div className={`absolute top-0 right-0 w-24 h-24 rounded-full -mr-12 -mt-12 group-hover:scale-110 transition-transform ${plan.estatus === 'APROBADO' ? 'bg-emerald-50' :
                plan.estatus === 'PENDIENTE' ? 'bg-amber-50' :
                  plan.estatus === 'RECHAZADO' ? 'bg-red-50' : 'bg-slate-50'
                }`} />

              <div className="relative z-10 space-y-6">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-black text-brand-900 bg-brand-50 px-2 py-0.5 rounded border border-brand-100 uppercase tracking-widest">{plan.servicio_config?.tipo_servicio?.nombre}</span>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{plan.sucursal?.nombre}</span>
                    </div>
                    <h4 className="text-lg font-black text-slate-800">
                      {new Date(plan.semana_inicio).getDate() + 1} {getMonthNameShort(new Date(plan.semana_inicio))} - {new Date(plan.semana_fin).getDate() + 1} {getMonthNameShort(new Date(plan.semana_fin))}
                    </h4>
                  </div>
                  <span className={`px-4 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest shadow-sm ${plan.estatus === 'APROBADO' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                    plan.estatus === 'PENDIENTE' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                      plan.estatus === 'RECHAZADO' ? 'bg-red-50 text-red-600 border border-red-100' :
                        'bg-slate-50 text-slate-500 border border-slate-100'
                    }`}>
                    <span className='flex flex-col'>
                      <span>
                        {plan.estatus}
                      </span>
                      {plan.estatus === 'APROBADO' && plan.requisicion?.[0]?.id && (
                        <span className="ml-1 opacity-70">REQ {formato8Digitos(plan.requisicion[0].id)}</span>
                      )}
                    </span>
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-md border border-slate-100">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Días Menú</p>
                    <p className="text-sm font-black text-slate-700">{plan.detalle?.length || 0} Registros</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-md border border-slate-100">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Op. Extra</p>
                    <p className="text-sm font-black text-slate-700">{plan.insumos_operativos?.length || 0} items</p>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black text-slate-300 uppercase italic">Por: {plan.usuario_create?.nombres}</span>
                    <span className="text-[8px] font-medium text-slate-300 italic">{formatToISODate(new Date(plan.timestamp_create))}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSelectedPlanMenu(plan);
                        setShowViewMenu(true);
                      }}
                      className="p-2.5 rounded-xl bg-slate-50 text-slate-600 border border-slate-100 hover:bg-brand-900 hover:text-white transition-all active:scale-95 shadow-sm"
                      title="Ver Detalle del Menú"
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
                      className="p-2.5 rounded-xl bg-brand-50 text-brand-900 border border-brand-100 hover:bg-brand-900 hover:text-white transition-all active:scale-95 shadow-sm shadow-brand-900/10"
                      title="Ver Consolidado de Insumos"
                    >
                      <Calculator size={18} />
                    </button>
                    <button
                      onClick={() => { setSelectedItem(plan); setShowModal(true); }}
                      className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all active:scale-95 ${isFutureWeek ? 'bg-slate-50 text-slate-400 hover:text-brand-900 hover:bg-brand-50 border-slate-100' : 'bg-slate-100 text-slate-400 border-slate-200'
                        }`}
                    >
                      {isFutureWeek && plan.estatus !== 'APROBADO' && plan.estatus !== 'PENDIENTE' ? 'Editar' : 'Consultar'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-[2.5rem] p-20 flex flex-col items-center justify-center border border-slate-100 shadow-sm">
          <ClipboardList size={48} className="text-slate-200 mb-4" />
          <p className="text-slate-400 font-bold italic text-sm">No hay planificaciones registradas para esta semana.</p>
          <button
            disabled={!isFutureWeek}
            onClick={() => { setSelectedItem(null); setShowModal(true); }}
            className={`mt-6 flex items-center gap-2 px-8 py-3 rounded-md text-xs font-black uppercase transition-all border ${isFutureWeek ? 'bg-brand-50 text-brand-900 border-brand-100 hover:bg-brand-100' : 'bg-slate-50 text-slate-300 border-slate-100 opacity-50 cursor-not-allowed'
              }`}
          >
            <Plus size={18} /> Crear Planificación
          </button>
        </div>
      )}

      {showModal && (
        <PlanificacionModal
          plan={selectedItem}
          weekDays={weekDays}
          comedorId={comedorSelected}
          serviciosDisponibles={servicios}
          empresaActiva={empresaActiva}
          perfil={perfil}
          isReadOnly={!isFutureWeek}
          planificacionesExistentes={planificaciones}
          onClose={() => setShowModal(false)}
          onUpdate={() => fetchPlanificaciones()}
        />
      )}
      {showConsolidadoModal && (
        <PlanificacionConsolidadaModal
          planId={selectedPlanId}
          planDetalle={selectedPlanDetalle}
          insumosOperativos={selectedInsumosOperativos}
          onClose={() => setShowConsolidadoModal(false)}
          weekDays={weekDays}
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

    </div>
  );
}
