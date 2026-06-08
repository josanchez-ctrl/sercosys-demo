import { useState, useEffect } from 'react';
import { PackageSearch, Plus, Search, Calendar, FileText, PackageCheck, Warehouse, MoreHorizontal, CheckCircle2, XCircle, Clock, FileEdit, Truck, ClipboardList, Scan } from 'lucide-react';
import { useModulePermissions } from '../../../hooks/useModulePermissions';
import { getAlmacenes } from '../../../services/almacenService';
import { getPickings } from '../../../services/pickingService';
import PickingModal from './PickingModal';
import PickingManualModal from './PickingManualModal';
import PickingViewModal from './PickingViewModal';
import PickingTrackingModal from './PickingTrackingModal';
import { supabase } from '../../../lib/supabase';
import { Now } from '../../../services/nowService';
import { formatearFecha, formato8Digitos, formatDateSystemToDDMMYYYY_HHMMSS, getDatesFromWeek, getWeekStringFromDate } from '../../../util/workDate';
import ViewUser from '../../../components/user-table/ViewUser';

const statusConfig = {
  BORRADOR: {
    label: 'Borrador',
    color: 'bg-slate-50 text-slate-500 border-slate-200',
    icon: <FileEdit size={12} />
  },
  PENDIENTE: {
    label: 'Pendiente',
    color: 'bg-amber-50 text-amber-600 border-amber-200',
    icon: <Clock size={12} />
  },
  RECOLECTADO: {
    label: 'Recolectado',
    color: 'bg-indigo-50 text-indigo-600 border-indigo-200 shadow-sm shadow-indigo-900/10',
    icon: <Scan size={12} />
  },
  PROCESADO: {
    label: 'Procesado',
    color: 'bg-emerald-50 text-emerald-600 border-emerald-200 shadow-sm shadow-emerald-900/10',
    icon: <CheckCircle2 size={12} />
  },
  ANULADO: {
    label: 'Anulado',
    color: 'bg-red-50 text-red-600 border-red-200',
    icon: <XCircle size={12} />
  },
};

export default function GestionPicking() {
  const { perfil, empresaActiva, renderGuard } = useModulePermissions();

  const [loading, setLoading] = useState(true);
  const [pickings, setPickings] = useState([]);
  const [almacenes, setAlmacenes] = useState([]);
  const [almacenSel, setAlmacenSel] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeStatusFilter, setActiveStatusFilter] = useState(null);

  // Estados para el rango de semanas
  const [weekStart, setWeekStart] = useState('');
  const [weekEnd, setWeekEnd] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  useEffect(() => {
    if (!empresaActiva?.id) return;

    const fetchAlmacen = async () => {
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
        console.error('Error al cargar almacenes:', error);
      }
    };

    fetchAlmacen();
  }, [empresaActiva?.id]);

  useEffect(() => {
    if (empresaActiva?.id && almacenSel && weekStart && weekEnd) {
      fetchData();

      // Suscripción Realtime
      const channel = supabase
        .channel('picking_changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'almacen_picking', filter: `id_empresa=eq.${empresaActiva.id}` },
          () => {
            fetchData();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } else {
      setPickings([]);
    }
  }, [empresaActiva?.id, almacenSel, weekStart, weekEnd]);

  const fetchData = async () => {
    if (!empresaActiva?.id || !almacenSel) return;
    setLoading(true);
    try {
      const dateStart = weekStart ? getDatesFromWeek(weekStart).start : null;
      const dateEnd = weekEnd ? getDatesFromWeek(weekEnd).end : null;

      const res = await getPickings(empresaActiva.id, dateStart, dateEnd, almacenSel.id);
      setPickings(res || []);
    } catch (error) {
      console.error('Error al cargar pickings:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredData = pickings.filter(p => {
    const search = searchTerm.toLowerCase();
    const matchesStatus = activeStatusFilter ? p.estatus === activeStatusFilter : true;

    const destinoStr = `${p.sucursales?.nombre || ''} ${p.comedores?.nombre || ''}`.toLowerCase();
    const reqStr = JSON.stringify(p.id_requisicion || '').toLowerCase();

    return matchesStatus && (
      p.id.toString().includes(search) ||
      destinoStr.includes(search) ||
      reqStr.includes(search) ||
      p.observaciones?.toLowerCase().includes(search)
    );
  });

  const almacenesFiltrados = almacenes.filter(almacen =>
    perfil?.F_ALL === true
      ? true
      : (perfil?.ids_almacenes?.includes(almacen.id))
  );

  const guard = renderGuard();
  if (guard) return guard;

  return (
    <div className="p-4 sm:p-8 space-y-2 animate-in fade-in duration-500 bg-slate-50">

      {/* Header Premium */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-[1.5rem] bg-brand-900 flex items-center justify-center text-white shadow-2xl shadow-brand-900/20 relative group overflow-hidden">
            <PackageSearch size={28} className="relative z-10" />
            <div className="absolute inset-0 bg-gradient-to-br from-brand-600 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight uppercase leading-none">
              Gestión de Picking
            </h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-3 flex items-center gap-2">
              <ClipboardList size={12} className="text-brand-500" />
              Despacho y Consolidación de Mercancía
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 relative">
          <div className='grid grid-cols-4 md:grid-cols-2 lg:grid-cols-4 gap-2'>
            {almacenesFiltrados.filter(almacen => almacen.id !== 5).map(almacen => (
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
          <div className="flex flex-col gap-2">
            <button
              disabled={!almacenSel}
              onClick={() => { setSelectedItem(null); setShowModal(true); }}
              className={`flex bg-brand-900 text-white px-6 py-3 rounded-md text-sm font-bold hover:bg-brand-600 transition-all shadow-lg shadow-brand-accent/20 items-center justify-center gap-2 active:scale-95 whitespace-nowrap ${!almacenSel && 'opacity-50 cursor-not-allowed'}`}
            >
              <Plus size={18} />
              <span>Nuevo Picking</span>
            </button>

            <button
              disabled={!almacenSel}
              onClick={() => { setSelectedItem(null); setShowManualModal(true); }}
              className={`flex bg-slate-800 text-white px-6 py-3 rounded-md text-sm font-bold hover:bg-slate-700 transition-all shadow-lg items-center justify-center gap-2 active:scale-95 whitespace-nowrap ${!almacenSel && 'opacity-50 cursor-not-allowed'}`}
            >
              <Plus size={18} />
              <span>Nuevo Picking Manual</span>
            </button>

          </div>
        </div>
      </div>

      {/* Barra de Acciones */}
      <div className="flex flex-col md:flex-row items-start md:items-center gap-4 relative z-10">
        {/* Filtro de Semanas */}
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

        <div className="flex-1 group/search relative w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within/search:text-brand-500 transition-colors" size={18} />
          <input
            type="text"
            placeholder="Buscar por ID, destino o requisición..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-12 pr-6 py-3 bg-white border border-gray-100 rounded-md text-sm font-semibold text-slate-700 outline-none focus:ring-4 focus:ring-brand-accent/10 focus:border-brand-accent transition-all w-full shadow-sm"
          />
        </div>
      </div>

      {/* KPIs */}
      {(almacenSel && weekStart && weekEnd) && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {Object.entries(statusConfig).map(([key, config]) => {
            const count = pickings.filter(p => p.estatus === key).length;
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

      {/* Tabla de Resultados */}
      <div className="bg-white rounded-md shadow-xl shadow-slate-200/40 border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-gray-100 whitespace-nowrap">Picking / Fecha / Estado</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-gray-100 whitespace-nowrap">Destino</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-gray-100 whitespace-nowrap">Requisiciones</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-gray-100 whitespace-nowrap">Responsables</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-gray-100 text-right whitespace-nowrap">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-300">
              {loading ? (
                Array(3).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={5} className="px-8 py-10"><div className="h-4 bg-gray-100 rounded w-full"></div></td>
                  </tr>
                ))
              ) : filteredData.length > 0 ? (
                filteredData.map((picking) => {
                  const status = statusConfig[picking.estatus] || statusConfig.BORRADOR;
                  return (
                    <tr key={picking.id} className="hover:bg-slate-50/50 transition-all group/row">
                      <td className="px-8 py-6">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                              <PackageCheck size={10} className="text-slate-400" />
                              {formato8Digitos(picking.id)}
                            </span>
                            <span className="whitespace-nowrap text-[9px] font-bold text-slate-400 italic">
                              {formatDateSystemToDDMMYYYY_HHMMSS(`${picking.timestamp_update ? picking.timestamp_update : picking.timestamp_create}`)}
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
                          <span className="whitespace-nowrap text-[11px] font-black text-slate-700 uppercase tracking-tight flex items-center gap-2">
                            <Truck size={12} className="text-brand-500" />
                            {picking.sucursales?.nombre}
                          </span>
                          <span className="whitespace-nowrap text-[9px] font-bold text-slate-400 italic ml-5">
                            Comedor: {picking.comedores?.nombre}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex flex-wrap gap-1">
                          {Array.isArray(picking.id_requisicion) && picking.id_requisicion.length > 0 ? (
                            picking.id_requisicion.map(reqId => (
                              <span key={reqId} className="px-2 py-0.5 bg-slate-100 text-[10px] font-black text-slate-600 rounded-lg border border-slate-200">
                                #{formato8Digitos(reqId)}
                              </span>
                            ))
                          ) : (
                            <span className="px-2 py-0.5 bg-slate-100 text-[10px] font-black text-slate-400 rounded-lg border border-slate-200 italic uppercase">
                              Manual
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex flex-col gap-2">
                          <ViewUser textDisplay="Creado por" usuario={picking.usuario_create} timestamp={picking.timestamp_create} formatDate={formatDateSystemToDDMMYYYY_HHMMSS} />
                          {picking.usuario_update && (
                            <ViewUser textDisplay="Actualizado por" usuario={picking.usuario_update} timestamp={picking.timestamp_update} formatDate={formatDateSystemToDDMMYYYY_HHMMSS} />
                          )}
                          {picking.usuario_procesa && (
                            <ViewUser textDisplay="Procesado por" usuario={picking.usuario_procesa} timestamp={picking.timestamp_procesa} formatDate={formatDateSystemToDDMMYYYY_HHMMSS} />
                          )}
                          {picking.usuario_anula && (
                            <ViewUser textDisplay="Anulado por" usuario={picking.usuario_anula} timestamp={picking.timestamp_anula} formatDate={formatDateSystemToDDMMYYYY_HHMMSS} />
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {picking.estatus === 'PENDIENTE' && (
                            <button
                              onClick={() => {
                                setSelectedItem(picking);
                                setShowTrackingModal(true);
                              }}
                              title="Ejecutar Tracking (Escáner)"
                              className="p-2 bg-brand-50 text-brand-700 hover:bg-brand-900 hover:text-white rounded-xl transition-all active:scale-90"
                            >
                              <Scan size={18} />
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setSelectedItem(picking);
                              if (picking.estatus === 'BORRADOR') {
                                const esManual = !picking.id_requisicion || picking.id_requisicion.length === 0;
                                if (esManual) {
                                  setShowManualModal(true);
                                } else {
                                  setShowModal(true);
                                }
                              } else {
                                setShowViewModal(true);
                              }
                            }}
                            className="p-2 hover:bg-brand-50 text-slate-400 hover:text-brand-900 rounded-xl transition-all active:scale-90"
                          >
                            <MoreHorizontal size={20} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-8 py-6 text-center">
                    <div className="flex flex-col items-center opacity-40">
                      <Calendar size={48} className="mb-4 text-brand-900" />
                      <p className="text-sm font-bold uppercase tracking-widest">
                        {!weekStart || !weekEnd
                          ? 'Selecciona un rango de semanas para ver los pickings'
                          : 'No se encontraron registros en este rango'}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <PickingModal
          initialData={selectedItem}
          empresaActiva={empresaActiva}
          almacenSel={almacenSel}
          perfil={perfil}
          onClose={() => setShowModal(false)}
          onUpdate={fetchData}
        />
      )}

      {showManualModal && (
        <PickingManualModal
          initialData={selectedItem}
          empresaActiva={empresaActiva}
          almacenSel={almacenSel}
          perfil={perfil}
          onClose={() => { setShowManualModal(false); setSelectedItem(null); }}
          onUpdate={fetchData}
        />
      )}

      {showViewModal && (
        <PickingViewModal
          isOpen={showViewModal}
          onClose={() => setShowViewModal(false)}
          pickingId={selectedItem?.id}
        />
      )}

      {showTrackingModal && (
        <PickingTrackingModal
          pickingId={selectedItem?.id}
          onClose={() => setShowTrackingModal(false)}
          onUpdate={fetchData}
          perfil={perfil}
        />
      )}
    </div>
  );
}
