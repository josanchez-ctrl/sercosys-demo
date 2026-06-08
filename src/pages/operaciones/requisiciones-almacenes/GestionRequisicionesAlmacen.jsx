import React, { useState, useEffect } from 'react';
import { Package, Search, Filter, Calendar, Eye, Trash2, Loader2, AlertCircle, X, CheckCircle2, Building2, Warehouse, ClipboardList, MoreHorizontal, Clock, XCircle, CheckCircle, Truck } from 'lucide-react';
import { getRequisicionesAlmacen, anularRequisicion } from '../../../services/requisicionService';
import { Now } from '../../../services/nowService';
import { useModulePermissions } from '../../../hooks/useModulePermissions';
import { formatearFecha, formato8Digitos, getDatesFromWeek, formatDateSystemToDDMMYYYY_HHMMSS, getWeekStringFromDate } from '../../../util/workDate';
import { supabase } from '../../../lib/supabase';
import ViewUser from '../../../components/user-table/ViewUser';
import RequisionesAlmacenDetalleModal from './RequisionesAlmacenDetalleModal';
import AnularRequisicionesAlmacenModal from './AnularRequisicionesAlmacenModal';

const statusConfig = {
  PENDIENTE: {
    label: 'Pendiente',
    color: 'bg-amber-50 text-amber-600 border-amber-200',
    icon: <Clock size={12} />
  },
  /* APROBADO: {
    label: 'Aprobado',
    color: 'bg-emerald-50 text-emerald-600 border-emerald-200 shadow-sm shadow-emerald-900/10',
    icon: <CheckCircle size={12} />
  }, */
  PROCESADA: {
    label: 'Procesada',
    color: 'bg-blue-50 text-blue-600 border-blue-200',
    icon: <Truck size={12} />
  },
  ANULADA: {
    label: 'Anulada',
    color: 'bg-red-50 text-red-600 border-red-200',
    icon: <XCircle size={12} />
  },
};

export default function GestionRequisicionesAlmacen() {
  const { perfil, empresaActiva, renderGuard } = useModulePermissions();

  const [requisiciones, setRequisiciones] = useState([]);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  // Filtros
  const [sucursalSel, setSucursalSel] = useState(null);
  const [comedorSel, setComedorSel] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeStatusFilter, setActiveStatusFilter] = useState(null);

  // Rango de semanas (Estado inicial vacío para esperar al servidor)
  const [weekStart, setWeekStart] = useState('');
  const [weekEnd, setWeekEnd] = useState('');

  useEffect(() => {
    const syncTime = async () => {
      const now = await Now();
      if (now) {
        const weekStr = getWeekStringFromDate(new Date(now));
        setWeekStart(weekStr);
        setWeekEnd(weekStr);
      }
    };
    syncTime();
  }, []);

  // Modales
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showAnularModal, setShowAnularModal] = useState(false);
  const [selectedReq, setSelectedReq] = useState(null);

  // Auxiliares de permisos (Consistencia con Planificación)
  const isSuperAdmin = perfil?.F_ALL === true;

  // Selectores derivados de los DATOS cargados
  const sucursalesDisponibles = Array.from(new Set(requisiciones.map(r => r.id_sucursal)))
    .map(id => {
      const req = requisiciones.find(r => r.id_sucursal === id);
      return { id, nombre: req?.sucursal?.nombre || `Sucursal ${id}` };
    });

  const comedoresFiltrados = Array.from(new Set(
    requisiciones
      .filter(r => r.id_sucursal === sucursalSel?.id)
      .map(r => r.id_comedor)
  )).map(id => {
    const req = requisiciones.find(r => r.id_comedor === id);
    return { id, nombre: req?.comedor?.nombre || `Comedor ${id}` };
  });

  useEffect(() => {
    if (empresaActiva?.id) {
      loadInitialData();
    }
  }, [empresaActiva?.id]);

  useEffect(() => {
    // Cargamos automáticamente al cambiar la semana o la empresa
    if (empresaActiva?.id && weekStart && weekEnd) {
      fetchRequisiciones();

      // Suscripción Realtime
      const channel = supabase
        .channel('requisiciones_changes')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'almacen_requisiciones',
          filter: `id_empresa=eq.${empresaActiva.id}`
        }, () => {
          // Pequeño delay para asegurar que los detalles se inserten 
          // (evita carrera de datos en creaciones rápidas)
          setTimeout(() => {
            fetchRequisiciones();
          }, 500);
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [empresaActiva?.id, weekStart, weekEnd]); // Quitamos sucursalSel/comedorSel del trigger para evitar bucles, ya que ahora filtramos en cliente

  const loadInitialData = async () => {
    // Ahora solo cargamos metadatos básicos si es necesario, 
    // pero los selectores de sucursal/comedor vendrán de las requisiciones
  };

  const fetchRequisiciones = async () => {
    if (!empresaActiva?.id || !weekStart || !weekEnd) return;
    setLoading(true);
    try {
      const dateStart = getDatesFromWeek(weekStart).start;
      const dateEnd = getDatesFromWeek(weekEnd).end;

      const data = await getRequisicionesAlmacen(empresaActiva.id, dateStart, dateEnd, perfil);
      setRequisiciones(data || []);
    } catch (error) {
      console.error("Error al cargar requisiciones:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAnular = async () => {
    if (!selectedReq) return;
    setActionLoading(selectedReq.id);
    try {
      await anularRequisicion(selectedReq.id, perfil.id);
      setShowAnularModal(false);
      setSelectedReq(null);
      await fetchRequisiciones();
    } catch (error) {
      console.error("Error al anular:", error);
      alert("No se pudo anular la requisición.");
    } finally {
      setActionLoading(null);
    }
  };

  // Filtrado final en cliente (Sucursal, Comedor, Estatus, Búsqueda)
  const filteredReqs = requisiciones.filter(req => {
    const matchesSucursal = !sucursalSel || req.id_sucursal === sucursalSel.id;
    const matchesComedor = !comedorSel || req.id_comedor === comedorSel.id;
    const matchesStatus = !activeStatusFilter || req.estatus === activeStatusFilter;
    const search = searchTerm.toLowerCase();
    const matchesSearch = `REQ ${formato8Digitos(req.id)}`.toLowerCase().includes(search) ||
      req.comedor?.nombre?.toLowerCase().includes(search);

    return matchesSucursal && matchesComedor && matchesStatus && matchesSearch;
  });

  const guard = renderGuard();
  if (guard) return guard;

  return (
    <div className="p-4 sm:p-8 space-y-8 animate-in fade-in duration-500 bg-slate-50 min-h-screen">

      {/* Header Premium (Estilo Picking) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-[1.5rem] bg-brand-900 flex items-center justify-center text-white shadow-2xl shadow-brand-900/20 relative group overflow-hidden">
            <ClipboardList size={28} className="relative z-10" />
            <div className="absolute inset-0 bg-gradient-to-br from-brand-600 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight uppercase leading-none">
              Requisiciones Almacenes
            </h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-3 flex items-center gap-2">
              <Building2 size={12} className="text-brand-500" />
              Recepción de insumos en almacenes
            </p>
          </div>
        </div>

        {/* Rango de Semanas (Donde estaban los almacenes en Picking) */}
        <div className="flex w-auto items-center gap-4 bg-white p-2 px-4 rounded-md border border-gray-100 shadow-sm animate-in slide-in-from-right duration-700">
          <div className="flex items-center gap-2 pr-4 border-r border-gray-100">
            <Calendar size={18} className="text-brand-600" />
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase text-slate-800 leading-none">Rango</span>
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Semanas</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex flex-col gap-0.5">
              <label className="text-[8px] font-black text-slate-400 uppercase ml-1">Inicio</label>
              <input
                type="week"
                value={weekStart}
                onChange={(e) => setWeekStart(e.target.value)}
                className="text-[10px] font-black text-brand-900 uppercase tracking-widest bg-slate-50 px-2 py-1 rounded-lg border border-transparent hover:border-brand-200 transition-all outline-none"
              />
            </div>
            <div className="w-4 h-px bg-slate-200 mt-3" />
            <div className="flex flex-col gap-0.5">
              <label className="text-[8px] font-black text-slate-400 uppercase ml-1">Fin</label>
              <input
                type="week"
                value={weekEnd}
                onChange={(e) => setWeekEnd(e.target.value)}
                className="text-[10px] font-black text-brand-900 uppercase tracking-widest bg-slate-50 px-2 py-1 rounded-lg border border-transparent hover:border-brand-200 transition-all outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda (Estilo Picking) */}
      <div className="flex flex-col xl:flex-row items-center gap-4 animate-in slide-in-from-bottom duration-700">
        {/* Selector Sucursal */}
        <div className="flex w-full md:w-auto items-center gap-4 bg-white p-2 px-4 rounded-md border border-gray-100 shadow-sm transition-all hover:border-brand-200">
          <div className="flex items-center gap-2 pr-4 border-r border-gray-100">
            <Building2 size={18} className="text-brand-600" />
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase text-slate-800 leading-none">Sucursal</span>
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Filtro principal</span>
            </div>
          </div>
          <select
            className="bg-transparent border-none text-[11px] font-black uppercase tracking-widest text-slate-600 focus:ring-0 cursor-pointer min-w-[150px] outline-none"
            value={sucursalSel?.id || ''}
            onChange={(e) => {
              const suc = sucursalesDisponibles.find(s => s.id.toString() === e.target.value);
              setSucursalSel(suc || null);
              setComedorSel(null);
            }}
          >
            <option value="">Todas las Sucursales</option>
            {sucursalesDisponibles.map(suc => (
              <option key={suc.id} value={suc.id}>{suc.nombre}</option>
            ))}
          </select>
        </div>

        {/* Selector Comedor */}
        <div className={`flex w-full md:w-auto items-center gap-4 bg-white p-2 px-4 rounded-md border border-gray-100 shadow-sm transition-all hover:border-brand-200 ${!sucursalSel ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="flex items-center gap-2 pr-4 border-r border-gray-100">
            <Warehouse size={18} className="text-brand-600" />
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase text-slate-800 leading-none">Comedor</span>
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Selección específica</span>
            </div>
          </div>
          <select
            className="bg-transparent border-none text-[11px] font-black uppercase tracking-widest text-slate-600 focus:ring-0 cursor-pointer min-w-[150px] outline-none"
            value={comedorSel?.id || ''}
            onChange={(e) => {
              const com = comedoresFiltrados.find(c => c.id.toString() === e.target.value);
              setComedorSel(com || null);
            }}
            disabled={!sucursalSel}
          >
            <option value="">Todos los Comedores</option>
            {comedoresFiltrados.map(com => (
              <option key={com.id} value={com.id}>{com.nombre}</option>
            ))}
          </select>
        </div>

        {/* Buscador Integrado */}
        <div className="flex-1 group/search relative w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within/search:text-brand-500 transition-colors" size={18} />
          <input
            type="text"
            placeholder="Buscar por nro de requisición o comedor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-12 pr-6 py-3.5 bg-white border border-gray-100 rounded-md text-sm font-semibold text-slate-700 outline-none focus:ring-4 focus:ring-brand-accent/10 focus:border-brand-accent transition-all w-full shadow-sm"
          />
        </div>
      </div>

      {/* KPIs de Estatus (Estilo Picking - Full Width) */}
      <div className="grid grid-cols-3 md:grid-cols-3 gap-4 animate-in slide-in-from-right duration-700">
        {Object.entries(statusConfig).map(([key, config]) => {
          const count = requisiciones.filter(r => r.estatus === key).length;
          const isActive = activeStatusFilter === key;

          return (
            <button
              key={key}
              onClick={() => setActiveStatusFilter(isActive ? null : key)}
              className={`bg-white p-4 rounded-md border transition-all duration-300 flex items-center justify-between group cursor-pointer ${isActive
                ? 'border-brand-500 shadow-lg shadow-brand-500/10 ring-2 ring-brand-500/5 -translate-y-1'
                : 'border-gray-100 shadow-sm hover:shadow-md hover:border-brand-200'
                }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl transition-colors ${isActive ? config.color.split(' ')[0] + ' ' + config.color.split(' ')[1] : config.color.split(' ').slice(0, 2).join(' ')}`}>
                  {config.icon}
                </div>
                <span className={`text-[10px] font-black uppercase tracking-widest transition-colors ${isActive ? 'text-brand-900' : 'text-slate-400'}`}>
                  {config.label}
                </span>
              </div>
              <span className={`text-xl font-black tabular-nums transition-transform duration-300 ${isActive ? 'scale-110' : ''} ${config.color.split(' ').find(c => c.startsWith('text-'))}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tabla de Requisiciones (Estilo Picking) */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-gray-100 whitespace-nowrap">Requisición / Fecha / Estado</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-gray-100 whitespace-nowrap">Destino (Sucursal/Comedor)</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-gray-100 whitespace-nowrap">Origen / Planificación</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-gray-100 whitespace-nowrap">Responsables</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-gray-100 text-right whitespace-nowrap">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array(3).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={5} className="px-8 py-10"><div className="h-4 bg-gray-100 rounded w-full"></div></td>
                  </tr>
                ))
              ) : filteredReqs.length > 0 ? (
                filteredReqs.map((req) => {
                  const status = statusConfig[req.estatus] || statusConfig.PENDIENTE;
                  return (
                    <tr key={req.id} className="hover:bg-slate-50/50 transition-all group/row">
                      <td className="px-8 py-6">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                              <ClipboardList size={10} className="text-slate-400" />
                              REQ {formato8Digitos(req.id)}
                            </span>
                            <span className="whitespace-nowrap text-[9px] font-bold text-slate-400 italic">
                              {formatearFecha(req.fecha_solicitud)}
                            </span>
                          </div>
                          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest w-fit ${status.color}`}>
                            {status.icon}
                            {status.label}
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex flex-col gap-1">
                          <span className="whitespace-nowrap text-[11px] font-black text-slate-700 uppercase tracking-tight">
                            {req.sucursal?.nombre}
                          </span>
                          <span className="whitespace-nowrap text-[9px] font-bold text-slate-400">{req.comedor?.nombre}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex flex-col gap-1.5 items-start">
                          <span className="inline-flex items-center gap-2 text-[11px] font-black text-slate-800 uppercase tracking-tight">
                            <Filter size={10} className="text-brand-500" />
                            {req.tipo}
                          </span>
                          {req.planificacion && (
                            <span className="text-[9px] font-bold text-slate-400 italic">
                              Plan: {formatearFecha(req.planificacion.semana_inicio)} - {formatearFecha(req.planificacion.semana_fin)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex flex-col gap-2">
                          <ViewUser textDisplay="Creado por" usuario={req.usuario_create} timestamp={req.timestamp_create} formatDate={formatDateSystemToDDMMYYYY_HHMMSS} />
                          {req.usuario_update && (
                            <ViewUser textDisplay="Actualizado por" usuario={req.usuario_update} timestamp={req.timestamp_update} formatDate={formatDateSystemToDDMMYYYY_HHMMSS} />
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => { setSelectedReq(req); setShowDetailModal(true); }}
                            className="p-2.5 bg-slate-50 text-slate-400 hover:bg-brand-50 hover:text-brand-600 rounded-xl transition-all active:scale-90 shadow-sm border border-slate-100"
                            title="Ver Detalle"
                          >
                            <Eye size={18} />
                          </button>
                          {req.estatus === 'PENDIENTE' && (
                            <button
                              onClick={() => { setSelectedReq(req); setShowAnularModal(true); }}
                              className="p-2.5 bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-600 rounded-xl transition-all active:scale-90 shadow-sm border border-slate-100"
                              title="Anular Requisición"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-8 py-24 text-center">
                    <div className="flex flex-col items-center opacity-40">
                      <Calendar size={48} className="mb-4 text-brand-900" />
                      <p className="text-sm font-bold uppercase tracking-widest">
                        {!weekStart || !weekEnd
                          ? 'Define un rango de semanas'
                          : 'No se encontraron requisiciones para este periodo'}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: Detalles de Requisición */}
      {showDetailModal && selectedReq && (
        <RequisionesAlmacenDetalleModal
          req={selectedReq}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedReq(null);
          }}
          onAnular={(reqToAnular) => {
            setShowDetailModal(false);
            setSelectedReq(reqToAnular);
            setShowAnularModal(true);
          }}
        />
      )}

      {/* MODAL: Anular Requisición */}
      {showAnularModal && selectedReq && (
        <AnularRequisicionesAlmacenModal
          req={selectedReq}
          loading={actionLoading === selectedReq.id}
          onClose={() => {
            setShowAnularModal(false);
            setSelectedReq(null);
          }}
          onConfirm={handleAnular}
        />
      )}
    </div>
  );
}

