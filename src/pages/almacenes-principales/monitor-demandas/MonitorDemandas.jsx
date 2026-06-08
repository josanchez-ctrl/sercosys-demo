import React, { useState, useEffect, useMemo } from 'react';
import { Monitor, Search, Calendar, Eye, Loader2, PackageCheck, Warehouse, ClipboardList, Clock, Building2, PackageSearch, FileText, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { useModulePermissions } from '../../../hooks/useModulePermissions';
import { Now } from '../../../services/nowService';
import { getAlmacenes } from '../../../services/almacenService';
import { getRequisicionesByAlmacen, getStockByAlmacen } from '../../../services/monitorDemandasService';
import { formatearFecha, getDatesFromWeek, getWeekStringFromDate, formato8Digitos, formatDateSystemToDDMMYYYY_HHMMSS } from '../../../util/workDate';
import MonitorDemandasDetalleModal from './MonitorDemandasDetalleModal';
import MesaTrabajoDespachoModal from './MesaTrabajoDespachoModal';
import ViewUser from '../../../components/user-table/ViewUser';

// Configuración para Historial (Estado de la REQ)
const statusConfig = {
  PROCESADA: { label: 'Procesada', color: 'bg-emerald-50 text-emerald-600 border-emerald-200', icon: <CheckCircle2 size={12} /> },
};

// Configuración para Demandas Activas (Estado de Abastecimiento)
const fillStatusConfig = {
  COMPLETO: { label: 'Surtido Total', color: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: <CheckCircle2 size={12} /> },
  PARCIAL: { label: 'Surtido Parcial', color: 'bg-amber-50 text-amber-700 border-amber-100', icon: <AlertTriangle size={12} /> },
  SIN_STOCK: { label: 'Sin Existencia', color: 'bg-red-50 text-red-700 border-red-100', icon: <XCircle size={12} /> }
};

export default function MonitorDemandas() {
  const { perfil, empresaActiva, renderGuard } = useModulePermissions();

  const [almacenes, setAlmacenes] = useState([]);
  const [almacenSel, setAlmacenSel] = useState(null);
  const [requisiciones, setRequisiciones] = useState([]);
  const [stockMap, setStockMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('PENDIENTE');
  const [activeStatusFilter, setActiveStatusFilter] = useState(null);

  // Rango de semanas
  const [weekStart, setWeekStart] = useState('');
  const [weekEnd, setWeekEnd] = useState('');

  // Modales y Selección
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedReq, setSelectedReq] = useState(null);
  const [showMesaTrabajo, setShowMesaTrabajo] = useState(false);
  const [selectedReqIds, setSelectedReqIds] = useState([]);

  useEffect(() => {
    if (empresaActiva?.id) {
      loadInitialData();
    }
  }, [empresaActiva?.id]);

  const loadInitialData = async () => {
    try {
      const [almacenesData, now] = await Promise.all([
        getAlmacenes(empresaActiva.id),
        Now()
      ]);
      setAlmacenes(almacenesData);

      if (now) {
        const weekStr = getWeekStringFromDate(new Date(now));
        setWeekStart(weekStr);
        setWeekEnd(weekStr);
      }
    } catch (error) {
      console.error("Error cargando datos iniciales:", error);
    }
  };

  useEffect(() => {
    if (empresaActiva?.id && almacenSel && weekStart && weekEnd) {
      fetchDemandas();
    } else {
      setRequisiciones([]);
      setStockMap({});
      setSelectedReqIds([]);
    }
  }, [empresaActiva?.id, almacenSel, weekStart, weekEnd, activeTab]);

  const fetchDemandas = async () => {
    setLoading(true);
    try {
      const dateStart = getDatesFromWeek(weekStart).start;
      const dateEnd = getDatesFromWeek(weekEnd).end;

      // Llamamos al servicio con el estatus de la PESTAÑA (PENDIENTE o HISTORIAL)
      // El servicio ahora decide basándose en los ítems del almacén
      const [data, stock] = await Promise.all([
        getRequisicionesByAlmacen(empresaActiva.id, almacenSel.id, dateStart, dateEnd, activeTab),
        getStockByAlmacen(almacenSel.id)
      ]);

      setStockMap(stock);
      setSelectedReqIds([]);

      const enrichedData = data.map(req => {
        let hasStockForSome = false;
        let hasStockForAll = true;

        const itemsPendientes = req.detalle?.filter(d =>
          d.estatus_item === 'PENDIENTE'
        ) || [];

        let totalItems = itemsPendientes.length;
        let availableItems = 0;

        itemsPendientes.forEach(item => {
          const s = stock[item.id_rubro] || 0;
          const pend = Math.max(0, Number(item.cantidad_solicitada) - Number(item.cantidad_despachada || 0));
          if (s >= pend) {
            hasStockForSome = true;
            availableItems++;
          } else if (s > 0) {
            hasStockForSome = true;
            hasStockForAll = false;
          } else {
            hasStockForAll = false;
          }
        });

        let fillStatus = 'SIN_STOCK';
        if (activeTab === 'HISTORIAL') fillStatus = 'COMPLETO';
        else if (totalItems === 0) fillStatus = 'COMPLETO';
        else if (availableItems === totalItems) fillStatus = 'COMPLETO';
        else if (hasStockForSome) fillStatus = 'PARCIAL';

        return {
          ...req,
          fillStatus,
          percent: totalItems === 0 ? 100 : Math.round((availableItems / totalItems) * 100)
        };
      });

      setRequisiciones(enrichedData);
    } catch (error) {
      console.error("Error cargando demanda:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredReqs = requisiciones.filter(r => {
    const matchesSearch = r.sucursal?.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.comedor?.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      formato8Digitos(r.id).includes(searchTerm);

    // En historial no aplicamos filtros de KPIs de abastecimiento (todos están completos para el almacén)
    const filterKey = activeTab === 'PENDIENTE' ? 'fillStatus' : 'estatus';
    const matchesActiveFilter = activeStatusFilter ? r[filterKey] === activeStatusFilter : true;

    return matchesSearch && matchesActiveFilter;
  });

  const toggleReqSelection = (id) => {
    setSelectedReqIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const almacenesFiltrados = almacenes.filter(almacen =>
    perfil?.F_ALL === true
      ? true
      : (perfil?.ids_almacenes?.includes(almacen.id))
  );

  const guard = renderGuard();
  if (guard) return guard;

  // Determinar qué configuración de KPIs usar
  const kpiConfig = activeTab === 'PENDIENTE' ? fillStatusConfig : statusConfig;

  return (
    <div className="p-4 sm:p-8 space-y-2 animate-in fade-in duration-500 bg-slate-50">

      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-brand-900 rounded-md shadow-xl shadow-brand-900/20 text-white border border-brand-800">
            <Monitor size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tighter leading-none">Monitor de Demandas</h1>
            <p className="text-sm text-slate-400 italic font-medium mt-1 uppercase tracking-widest">Sincronización de Pedidos y Stock</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className='grid grid-cols-4 md:grid-cols-2 lg:grid-cols-4 gap-2'>
            {almacenesFiltrados.map(almacen => (
              <button
                key={almacen.id}
                onClick={() => setAlmacenSel(almacenSel?.id === almacen.id ? null : almacen)}
                className={`px-4 py-2 rounded-md border-2 transition-all duration-300 flex flex-col items-center gap-1 ${almacenSel?.id === almacen.id
                  ? 'bg-brand-900 border-brand-900 text-white shadow-xl shadow-brand-900/10 scale-105'
                  : 'bg-white border-gray-100 text-slate-400 hover:border-brand-200 hover:bg-slate-50'
                  }`}
              >
                <Warehouse size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest">{almacen.nombre}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* FILTROS Y BÚSQUEDA */}
      <div className="flex flex-col md:flex-row items-start md:items-center gap-4 relative z-10">
        <div className="flex w-auto items-center gap-4 bg-white p-2 px-4 rounded-md border border-gray-100 shadow-sm animate-in slide-in-from-right duration-700 shrink-0">
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
              <input type="week" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} className="text-[10px] font-black text-brand-900 bg-slate-50 px-2 py-1 rounded-lg border border-transparent hover:border-brand-200 transition-all outline-none" />
            </div>
            <div className="w-4 h-px bg-slate-200 mt-3" />
            <div className="flex flex-col gap-0.5">
              <label className="text-[8px] font-black text-slate-400 uppercase ml-1">Fin</label>
              <input type="week" value={weekEnd} onChange={(e) => setWeekEnd(e.target.value)} className="text-[10px] font-black text-brand-900 bg-slate-50 px-2 py-1 rounded-lg border border-transparent hover:border-brand-200 transition-all outline-none" />
            </div>
          </div>
        </div>

        <div className="flex-1 group/search relative w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within/search:text-brand-500 transition-colors" size={18} />
          <input type="text" placeholder="Ej: REQ 00000005, Comedor..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-12 pr-6 py-3 bg-white border border-gray-100 rounded-md text-sm font-semibold text-slate-700 outline-none focus:ring-4 focus:ring-brand-accent/10 focus:border-brand-accent transition-all w-full shadow-sm" />
        </div>
      </div>

      {/* TABS DE ESTADO */}
      <div className="flex items-center gap-1 bg-slate-200/50 p-1 rounded-md w-fit shadow-inner border border-slate-200">
        <button
          onClick={() => { setActiveTab('PENDIENTE'); setActiveStatusFilter(null); }}
          className={`px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 flex items-center gap-2 ${activeTab === 'PENDIENTE' ? 'bg-white text-brand-900 shadow-md scale-100' : 'text-slate-400 hover:text-slate-600 scale-95'}`}
        >
          <Clock size={14} /> Demandas Activas
        </button>
        <button
          onClick={() => { setActiveTab('HISTORIAL'); setActiveStatusFilter(null); }}
          className={`px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 flex items-center gap-2 ${activeTab === 'HISTORIAL' ? 'bg-white text-brand-900 shadow-md scale-100' : 'text-slate-400 hover:text-slate-600 scale-95'}`}
        >
          <ClipboardList size={14} /> Historial / Cerradas
        </button>
      </div>

      {/* KPIs (ESTRUCTURA PICKING + LÓGICA VISTA) */}
      {(almacenSel && weekStart && weekEnd) && (
        <div className={`grid gap-4 ${activeTab === 'PENDIENTE' ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-2 md:grid-cols-2'}`}>
          {Object.entries(kpiConfig).map(([key, config]) => {
            // Si estamos en Historial, la cuenta es de todas las requisiciones traídas
            const count = activeTab === 'PENDIENTE'
              ? requisiciones.filter(r => r.fillStatus === key).length
              : requisiciones.length;

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
      )}

      {/* TABLA DE RESULTADOS */}
      <div className="bg-white rounded-md shadow-xl shadow-slate-200/40 border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-5 gap-4">
            <div className="w-12 h-12 border-4 border-brand-900/10 border-t-brand-900 rounded-full animate-spin" />
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Consultando Servidores...</p>
          </div>
        ) : filteredReqs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-8 py-5 w-16 text-center">
                    <ClipboardList size={14} className="mx-auto text-slate-300" />
                  </th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Requisición / Fecha / Estado</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Origen / Comedor</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center whitespace-nowrap">Abastecimiento</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Auditoría</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center whitespace-nowrap">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300">
                {filteredReqs.map(req => {
                  const isSelected = selectedReqIds.includes(req.id);
                  let badgeConfig = activeTab === 'PENDIENTE' ? fillStatusConfig[req.fillStatus] : statusConfig[req.estatus];
                  if (req.percent === 100 && activeTab === "HISTORIAL") {
                    badgeConfig = statusConfig.PROCESADA;
                  }

                  return (
                    <tr key={req.id} className={`group transition-all hover:bg-slate-50/80 cursor-pointer ${isSelected ? 'bg-brand-50/30' : ''}`} onClick={() => toggleReqSelection(req.id)}>
                      <td className="px-8 py-6 text-center">
                        <div className={`w-6 h-6 rounded-lg border-2 transition-all flex items-center justify-center ${isSelected ? 'bg-brand-900 border-brand-900 shadow-lg shadow-brand-900/30' : 'bg-white border-slate-200'}`}>
                          {isSelected && <CheckCircle2 size={14} className="text-white" />}
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        {/* <div className="flex flex-col gap-1.5">
                          <span className="text-sm font-black text-slate-800 tracking-tight">#{formato8Digitos(req.id)}</span>
                          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest w-fit ${badgeConfig?.color || 'bg-slate-50 text-slate-500'}`}>
                            {badgeConfig?.icon} {badgeConfig?.label}
                          </div>
                        </div> */}
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                              <PackageCheck size={10} className="text-slate-400" />
                              {formato8Digitos(req.id)}
                            </span>
                            <span className="whitespace-nowrap text-[9px] font-bold text-slate-400 italic">
                              {formatDateSystemToDDMMYYYY_HHMMSS(`${req.timestamp_update ? req.timestamp_update : req.timestamp_create}`)}
                            </span>
                          </div>
                          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest ${badgeConfig?.color}`}>
                            {badgeConfig?.icon}
                            {badgeConfig?.label}
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400"><Building2 size={18} /></div>
                          <div className="flex flex-col">
                            <span className="text-xs font-black text-slate-800 uppercase tracking-tight leading-none">{req.sucursal?.nombre}</span>
                            <span className="text-[9px] font-bold text-brand-600 uppercase tracking-widest mt-1">{req.comedor?.nombre || 'ALMACÉN GENERAL'}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200 shadow-inner">
                            <div className={`h-full rounded-full transition-all duration-1000 ${req.percent === 100 ? 'bg-emerald-500' : 'bg-brand-900'}`} style={{ width: `${req.percent}%` }} />
                          </div>
                          <span className="text-[10px] font-black text-brand-900 uppercase tracking-widest">{req.percent}% Surtido</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex flex-col gap-2 scale-90 origin-left">
                          <ViewUser textDisplay="Creado" usuario={req.usuario_create} timestamp={req.timestamp_create} formatDate={formatDateSystemToDDMMYYYY_HHMMSS} />
                          {req.usuario_procesa && <ViewUser textDisplay="Procesado" usuario={req.usuario_procesa} timestamp={req.timestamp_procesa} formatDate={formatDateSystemToDDMMYYYY_HHMMSS} />}
                          {req.usuario_anula && <ViewUser textDisplay="Anulado" usuario={req.usuario_anula} timestamp={req.timestamp_anula} formatDate={formatDateSystemToDDMMYYYY_HHMMSS} />}
                        </div>
                      </td>
                      <td className="px-8 py-6 text-center">
                        <button onClick={(e) => { e.stopPropagation(); setSelectedReq(req); setShowDetailModal(true); }} className="p-3 bg-white border border-slate-100 text-slate-400 rounded-md hover:bg-brand-900 hover:text-white hover:border-brand-900 transition-all shadow-sm active:scale-95"><Eye size={18} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 gap-6 bg-white">
            <div className="w-24 h-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center text-slate-200"><PackageSearch size={48} /></div>
            <div className="text-center"><p className="text-lg font-black text-slate-800 uppercase tracking-tighter">Sin Demandas</p><p className="text-sm text-slate-400 font-medium italic">No hay registros para este almacén y rango de fechas</p></div>
          </div>
        )}
      </div>

      {/* BARRA DE ACCIONES MASIVAS */}
      {selectedReqIds.length > 0 && activeTab === 'PENDIENTE' && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 animate-in slide-in-from-bottom-8 duration-500">
          <div className="bg-brand-900 text-white px-8 py-5 rounded-xl shadow-2xl shadow-brand-900/40 flex items-center gap-8 border border-brand-800">
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-300">Selección Masiva</span>
              <span className="text-lg font-black leading-none">{selectedReqIds.length} Requisiciones</span>
            </div>
            <div className="h-10 w-px bg-brand-800" />
            <button onClick={() => setShowMesaTrabajo(true)} className="bg-white text-brand-900 px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-brand-50 transition-all active:scale-95 shadow-lg shadow-white/10">Generar Mesa de Trabajo</button>
          </div>
        </div>
      )}

      {/* MODALES */}
      {showDetailModal && (
        <MonitorDemandasDetalleModal id_requisicion={selectedReq.id} id_almacen={almacenSel.id} onClose={() => { setShowDetailModal(false); setSelectedReq(null); }} onUpdate={fetchDemandas} />
      )}

      {showMesaTrabajo && (
        <MesaTrabajoDespachoModal ids_requisiciones={selectedReqIds} id_almacen={almacenSel.id} onClose={() => { setShowMesaTrabajo(false); setSelectedReqIds([]); }} onUpdate={fetchDemandas} />
      )}
    </div>
  );
}
