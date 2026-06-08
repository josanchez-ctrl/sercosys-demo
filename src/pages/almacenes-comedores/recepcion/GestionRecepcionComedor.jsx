import React, { useState, useEffect, useMemo } from 'react';
import { Search, Calendar, Truck, PackageCheck, CheckCircle, Building2, Warehouse, AlertTriangle, Eye, Filter } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { getDespachosPendientes } from '../../../services/recepcionComedorService';
import { getComedores } from '../../../services/planificacionService';
import { Now } from '../../../services/nowService';
import { useModulePermissions } from '../../../hooks/useModulePermissions';
import { formatearFecha, getDatesFromWeek, getWeekStringFromDate, formatDateSystemToDDMMYYYY_HHMMSS, formato8Digitos } from '../../../util/workDate';
import ViewUser from '../../../components/user-table/ViewUser';
import RecepcionComedorModal from './RecepcionComedorModal';

const statusConfig = {
  'EN TRÁNSITO': {
    label: 'En Tránsito',
    color: 'bg-amber-50 text-amber-600 border-amber-200',
    icon: <Truck size={12} />
  },
  'RECIBIDO_TOTAL': {
    label: 'Conforme',
    color: 'bg-emerald-50 text-emerald-600 border-emerald-200 shadow-sm shadow-emerald-900/10',
    icon: <CheckCircle size={12} />
  },
  'RECIBIDO_PARCIAL': {
    label: 'Con Diferencia',
    color: 'bg-orange-50 text-orange-600 border-orange-200',
    icon: <AlertTriangle size={12} />
  }
};

export default function GestionRecepcionComedor() {
  const { perfil, empresaActiva, renderGuard } = useModulePermissions();

  const [despachos, setDespachos] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [sucursalSel, setSucursalSel] = useState(null);
  const [comedorSel, setComedorSel] = useState(null);
  const [comedores, setComedores] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeStatusFilter, setActiveStatusFilter] = useState(null);

  // Rango de semanas
  const [weekStart, setWeekStart] = useState('');
  const [weekEnd, setWeekEnd] = useState('');

  // Modales
  const [showRecepcionModal, setShowRecepcionModal] = useState(false);
  const [selectedDespacho, setSelectedDespacho] = useState(null);

  const isSuperAdmin = perfil?.F_ALL === true;

  useEffect(() => {
    if (empresaActiva?.id) fetchComedores();
  }, [empresaActiva?.id]);

  const fetchComedores = async () => {
    try {
      const data = await getComedores(empresaActiva.id);
      setComedores(data || []);
      const sucs = Array.from(new Set((data || []).map(c => c.id_sucursal)))
        .filter(id => isSuperAdmin || !perfil.ids_sucursales || perfil.ids_sucursales.includes(id));
      if (sucs.length === 1) {
        const firstSuc = data.find(c => c.id_sucursal === sucs[0]);
        setSucursalSel({ id: sucs[0], nombre: firstSuc?.sucursal?.nombre });
      }
    } catch (error) {
      console.error("Error al cargar comedores:", error);
    }
  };

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

  useEffect(() => {
    if (empresaActiva?.id && sucursalSel && comedorSel && weekStart && weekEnd) {
      fetchDespachos();

      // SUSCRIPCIÓN REALTIME
      const channel = supabase
        .channel('cambios-recepcion')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'almacen_despacho' }, () => fetchDespachos())
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } else {
      setDespachos([]);
    }
  }, [empresaActiva?.id, sucursalSel?.id, comedorSel?.id, weekStart, weekEnd]);

  const fetchDespachos = async () => {
    if (!empresaActiva?.id || !sucursalSel?.id || !comedorSel?.id || !weekStart || !weekEnd) return;
    setLoading(true);
    try {
      const dateStart = getDatesFromWeek(weekStart).start;
      const dateEnd = getDatesFromWeek(weekEnd).end;

      const data = await getDespachosPendientes(empresaActiva.id, dateStart, dateEnd, perfil);
      setDespachos(data || []);
    } catch (error) {
      console.error("Error al cargar despachos:", error);
    } finally {
      setLoading(false);
    }
  };

  // Selectores de Contexto Independientes (Unificado con Despacho)
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
      c.id_sucursal == sucursalSel?.id &&
      (isSuperAdmin || !perfil.ids_comedores || perfil.ids_comedores.includes(c.id))
    );
  }, [comedores, sucursalSel?.id, perfil, isSuperAdmin]);

  useEffect(() => {
    if (sucursalSel && comedoresFiltrados.length === 1) {
      setComedorSel(comedoresFiltrados[0]);
    }
  }, [sucursalSel, comedoresFiltrados]);

  // Filtrado final en cliente
  const filteredDespachos = despachos.filter(desp => {
    const matchesSucursal = !sucursalSel || desp.id_sucursal === sucursalSel.id;
    const matchesComedor = !comedorSel || desp.id_comedor === comedorSel.id;
    const matchesStatus = !activeStatusFilter || desp.estatus === activeStatusFilter;
    const search = searchTerm.toLowerCase();
    const matchesSearch =
      desp.id.toString().includes(search) ||
      desp.almacen?.nombre?.toLowerCase().includes(search) ||
      desp.comedor?.nombre?.toLowerCase().includes(search);

    return matchesSucursal && matchesComedor && matchesStatus && matchesSearch;
  });

  const guard = renderGuard();
  if (guard) return guard;

  return (
    <div className="p-4 sm:p-8 space-y-2 animate-in fade-in duration-500 bg-slate-50">

      {/* Header Premium (Estilo Picking) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-[1.5rem] bg-brand-900 flex items-center justify-center text-white shadow-2xl shadow-brand-900/20 relative group overflow-hidden">
            <PackageCheck size={28} className="relative z-10" />
            <div className="absolute inset-0 bg-gradient-to-br from-brand-600 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight uppercase leading-none">
              Recepción en Comedor
            </h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-3 flex items-center gap-2">
              <Truck size={12} className="text-brand-500" />
              Ingreso de mercancía en tránsito
            </p>
          </div>
        </div>

        {/* Rango de Semanas */}
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

      {/* Barra de Filtros y Búsqueda */}
      <div className="flex flex-col md:flex-row items-start md:items-center gap-4 relative z-10">

        <div className="flex flex-col w-auto items-center gap-1 bg-white p-2 px-4 rounded-md border border-gray-100 shadow-sm shrink-0">
          <div className="flex items-center gap-2 pr-4 border-r border-gray-100">
            <Filter size={18} className="text-brand-600" />
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase text-slate-800 leading-none">Sucursal</span>
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Ubicación</span>
            </div>
          </div>
          <select
            value={sucursalSel?.id || ''}
            onChange={(e) => {
              const suc = sucursalesDisponibles.find(s => s.id.toString() === e.target.value);
              setSucursalSel(suc || null);
              setComedorSel(null);
            }}
            className="text-[10px] font-black text-brand-900 uppercase tracking-widest bg-slate-50 px-2 py-1 rounded-lg border border-transparent hover:border-brand-200 transition-all outline-none min-w-[150px]"
          >
            <option value="">-- SELECCIONE --</option>
            {sucursalesDisponibles.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </div>

        <div className="flex flex-col w-auto items-center gap-1 bg-white p-2 px-4 rounded-md border border-gray-100 shadow-sm shrink-0">
          <div className="flex items-center gap-2 pr-4 border-r border-gray-100">
            <Warehouse size={18} className="text-brand-600" />
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase text-slate-800 leading-none">Comedor</span>
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Destino</span>
            </div>
          </div>
          <select
            value={comedorSel?.id || ''}
            disabled={!sucursalSel}
            onChange={(e) => {
              const com = comedoresFiltrados.find(c => c.id.toString() === e.target.value);
              setComedorSel(com || null);
            }}
            className="text-[10px] font-black text-brand-900 uppercase tracking-widest bg-slate-50 px-2 py-1 rounded-lg border border-transparent hover:border-brand-200 transition-all outline-none min-w-[150px] disabled:opacity-50"
          >
            <option value="">-- SELECCIONE --</option>
            {comedoresFiltrados.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>

        {/* Input Buscar */}
        <div className="flex-1 group/search relative w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within/search:text-brand-500 transition-colors" size={18} />
          <input
            type="text"
            placeholder="Buscar por nro de despacho o almacén..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-12 pr-6 py-3.5 bg-white border border-gray-100 rounded-md text-sm font-semibold text-slate-700 outline-none focus:ring-4 focus:ring-brand-accent/10 focus:border-brand-accent transition-all w-full shadow-sm"
          />
        </div>

      </div>


      {/* KPIs de Estatus */}
      <div className="grid grid-cols-4 gap-4 animate-in slide-in-from-right duration-700">
        {Object.entries(statusConfig).map(([key, config]) => {
          const count = despachos.filter(d => d.estatus === key).length;
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

      {/* Tabla de Despachos */}
      <div className="bg-white rounded-md shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-gray-100 whitespace-nowrap">Despacho / Fecha / Estado</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-gray-100 whitespace-nowrap">Destino (Sucursal/Comedor)</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-gray-100 whitespace-nowrap">Origen / Almacén</th>
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
              ) : !comedorSel ? (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-4 opacity-40">
                      <Warehouse size={48} className="text-brand-900" />
                      <p className="text-[11px] font-black uppercase tracking-widest text-slate-800">Seleccione un comedor para ver despachos</p>
                    </div>
                  </td>
                </tr>
              ) : filteredDespachos.length > 0 ? (
                filteredDespachos.map((desp) => {
                  const status = statusConfig[desp.estatus] || statusConfig['EN TRÁNSITO'];
                  return (
                    <tr key={desp.id} className="hover:bg-slate-50/50 transition-all group/row">
                      <td className="px-8 py-6">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                              <PackageCheck size={10} className="text-slate-400" />
                              {formato8Digitos(desp.id)}
                            </span>
                            <span className="whitespace-nowrap text-[9px] font-bold text-slate-400 italic">
                              {formatDateSystemToDDMMYYYY_HHMMSS(`${desp.timestamp_update ? desp.timestamp_update : desp.timestamp_create}`)}
                            </span>
                          </div>
                          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest ${status.color}`}>
                            {status.icon}
                            {status.label}
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex flex-col gap-1">
                          <span className="whitespace-nowrap text-[11px] font-black text-slate-700 uppercase tracking-tight">
                            {desp.sucursal?.nombre}
                          </span>
                          <span className="whitespace-nowrap text-[9px] font-bold text-slate-400">{desp.comedor?.nombre}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex flex-col gap-1.5 items-start">
                          <span className="inline-flex items-center gap-2 text-[11px] font-black text-slate-800 uppercase tracking-tight">
                            <Warehouse size={10} className="text-brand-500" />
                            {desp.almacen?.nombre || 'Almacén Principal'}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex flex-col gap-2">
                          <ViewUser textDisplay="Despachado por" usuario={desp.usuario_procesa} timestamp={desp.timestamp_procesa} formatDate={formatDateSystemToDDMMYYYY_HHMMSS} />
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {desp.estatus === 'EN TRÁNSITO' ? (
                            <button
                              onClick={() => { setSelectedDespacho(desp); setShowRecepcionModal(true); }}
                              className="px-4 py-2 bg-brand-500 text-white rounded-xl hover:bg-brand-600 active:scale-95 transition-all text-[10px] font-black uppercase tracking-widest shadow-lg shadow-brand-500/30 flex items-center gap-2"
                            >
                              <PackageCheck size={14} />
                              <span>RECIBIR</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => { setSelectedDespacho(desp); setShowRecepcionModal(true); }}
                              className="p-2.5 bg-slate-50 text-slate-400 hover:bg-brand-50 hover:text-brand-600 rounded-xl transition-all active:scale-90 shadow-sm border border-slate-100"
                              title="Ver Detalle"
                            >
                              <Eye size={18} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-8 py-2 text-center">
                    <div className="flex flex-col items-center opacity-40">
                      <Truck size={48} className="mb-4 text-brand-900" />
                      <p className="text-sm font-bold uppercase tracking-widest">
                        No se encontraron despachos en tránsito para este periodo
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showRecepcionModal && selectedDespacho && (
        <RecepcionComedorModal
          despacho={selectedDespacho}
          onClose={() => { setShowRecepcionModal(false); setSelectedDespacho(null); }}
          onSuccess={() => {
            setShowRecepcionModal(false);
            setSelectedDespacho(null);
            fetchDespachos();
          }}
          perfil={perfil}
        />
      )}
    </div>
  );
}
