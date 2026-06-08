import React, { useState, useEffect, useMemo } from 'react';
import { Warehouse, Search, Plus, FileEdit, CheckCircle2, XCircle, Trash2, Eye, ClipboardList, RotateCcw, AlertTriangle, Play, Clock, Calendar, PackageCheck } from 'lucide-react';
import { useModulePermissions } from '../../../hooks/useModulePermissions';
import { getAlmacenes } from '../../../services/almacenService';
import { getOrdenesTransformacion, iniciarTransformacion, anularOrdenTransformacion } from '../../../services/transformacionService';
import { Now } from '../../../services/nowService';
import { formato8Digitos, formatDateSystemToDDMMYYYY_HHMMSS, getDatesFromWeek, getWeekStringFromDate } from '../../../util/workDate';
import ViewUser from '../../../components/user-table/ViewUser';
import { toast } from 'sonner';
import ReenvasadoModal from './ReenvasadoModal';

const statusConfig = {
  BORRADOR: { label: 'Borrador', color: 'bg-slate-50 text-slate-500 border-slate-200', icon: <FileEdit size={12} /> },
  EN_PROCESO: { label: 'En Proceso', color: 'bg-amber-50 text-amber-600 border-amber-200 shadow-sm shadow-amber-900/10', icon: <Clock size={12} /> },
  PROCESADO: { label: 'Procesado', color: 'bg-emerald-50 text-emerald-600 border-emerald-200 shadow-sm shadow-emerald-900/10', icon: <CheckCircle2 size={12} /> },
  ANULADO: { label: 'Anulado', color: 'bg-red-50 text-red-600 border-red-200', icon: <XCircle size={12} /> },
};

export default function GestionReenvasado() {
  const { perfil, empresaActiva, sucursalActiva, renderGuard } = useModulePermissions();

  const [almacenes, setAlmacenes] = useState([]);
  const [almacenSel, setAlmacenSel] = useState(null);
  const [ordenes, setOrdenes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeStatusFilter, setActiveStatusFilter] = useState(null);

  // Estados para el rango de semanas
  const [weekStart, setWeekStart] = useState('');
  const [weekEnd, setWeekEnd] = useState('');

  // Modales
  const [ordenParaEditar, setOrdenParaEditar] = useState(null);
  const [mostrarModalNuevo, setMostrarModalNuevo] = useState(false);
  const [ordenParaVer, setOrdenParaVer] = useState(null);
  const [procesandoId, setProcesandoId] = useState(null);

  useEffect(() => {
    if (empresaActiva?.id) {
      getAlmacenes(empresaActiva.id).then(async (data) => {
        setAlmacenes(data || []);
        const now = await Now();
        if (now) {
          const weekStr = getWeekStringFromDate(new Date(now));
          setWeekStart(weekStr);
          setWeekEnd(weekStr);
        }
      });
    }
  }, [empresaActiva?.id]);

  useEffect(() => {
    if (empresaActiva?.id && weekStart && weekEnd) {
      fetchOrdenes();
    }
  }, [empresaActiva?.id, almacenSel, weekStart, weekEnd]);

  const fetchOrdenes = async () => {
    if (!empresaActiva?.id) return;
    setLoading(true);
    try {
      const dateStart = weekStart ? getDatesFromWeek(weekStart).start : null;
      const dateEnd = weekEnd ? getDatesFromWeek(weekEnd).end : null;

      const data = await getOrdenesTransformacion(empresaActiva.id, 'REENVASADO', dateStart, dateEnd);
      // Si hay un almacén seleccionado, filtramos por él
      if (almacenSel) {
        setOrdenes(data.filter(o => o.id_almacen === almacenSel.id));
      } else {
        setOrdenes(data);
      }
    } catch (e) {
      toast.error('Error al cargar órdenes de reenvasado');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const almacenesFiltrados = almacenes.filter(almacen =>
    perfil?.F_ALL === true ? true : (perfil?.ids_almacenes?.includes(almacen.id))
  );

  const filteredOrdenes = useMemo(() => {
    return ordenes.filter(o => {
      // Filtro por estatus
      if (activeStatusFilter && o.estatus !== activeStatusFilter) return false;

      // Filtro por término de búsqueda (ID, usuario o notas)
      const searchLower = searchTerm.toLowerCase();
      const matchId = String(o.id).includes(searchLower) || formato8Digitos(o.id).includes(searchLower);
      const matchObs = o.observaciones?.toLowerCase().includes(searchLower) || false;
      const matchUser = o.usuario_create ? [o.usuario_create.nombres, o.usuario_create.apellidos].join(' ').toLowerCase().includes(searchLower) : false;

      return matchId || matchObs || matchUser;
    });
  }, [ordenes, searchTerm, activeStatusFilter]);

  const handleIniciar = (id) => {
    toast('¿Desea iniciar el proceso de reenvasado?', {
      description: 'Esta acción descontará la materia prima de los racks y la trasladará a la mesa de trabajo.',
      duration: 8000,
      action: {
        label: 'Iniciar',
        onClick: async () => {
          setProcesandoId(id);
          try {
            await iniciarTransformacion(id, perfil.id);
            toast.success('Proceso de reenvasado iniciado. Stock movido a la mesa de trabajo.');
            fetchOrdenes();
          } catch (e) {
            toast.error('Error al iniciar reenvasado: ' + e.message);
            console.error(e);
          } finally {
            setProcesandoId(null);
          }
        }
      }
    });
  };

  const handleAnular = async (id) => {
    if (!window.confirm('¿Está seguro de anular esta orden? No se podrá modificar ni procesar en el futuro.')) return;
    try {
      await anularOrdenTransformacion(id, perfil.id);
      toast.success('Orden anulada correctamente');
      fetchOrdenes();
    } catch (e) {
      toast.error('Error al anular orden: ' + e.message);
      console.error(e);
    }
  };

  const guard = renderGuard();
  if (guard) return guard;

  return (
    <div className="p-4 sm:p-8 space-y-4 animate-in fade-in duration-500 bg-slate-50">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-brand-900 rounded-md shadow-xl shadow-brand-900/20 text-white border border-brand-800">
            <ClipboardList size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tighter leading-none">Distribución y Reenvasado</h1>
            <p className="text-sm text-slate-400 italic font-medium mt-1 uppercase tracking-widest">Fraccionamiento y Reempacado de Lotes</p>
          </div>
        </div>

        {/* SELECTOR DE ALMACENES */}
        <div className="flex items-center gap-4 relative">
          <div className='grid grid-cols-4 md:grid-cols-2 lg:grid-cols-4 gap-2'>
            {almacenesFiltrados.filter(almacen => almacen.id !== 5).map(almacen => (
              <button
                key={almacen.id}
                onClick={() => setAlmacenSel(almacenSel?.id === almacen.id ? null : almacen)}
                className={`px-4 py-2 rounded-md border-2 transition-all duration-300 flex flex-col items-center gap-1 min-w-[100px] ${
                  almacenSel?.id === almacen.id
                    ? 'bg-brand-900 border-brand-900 text-white shadow-xl shadow-brand-900/20 scale-105'
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

      {/* RUTA VACÍA SI NO HAY ALMACÉN SELECCIONADO */}
      {!almacenSel ? (
        <div className="flex flex-col items-center justify-center py-20 gap-6 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm">
          <div className="w-24 h-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center text-slate-300">
            <Warehouse size={48} />
          </div>
          <div className="text-center">
            <p className="text-lg font-black text-slate-800 uppercase tracking-tighter">Seleccione un Almacén</p>
            <p className="text-sm text-slate-400 font-medium italic">Debe elegir un almacén activo para ver y gestionar sus órdenes de reenvasado</p>
          </div>
        </div>
      ) : (
        <>

        <div className="flex flex-col md:flex-row items-start md:items-center gap-4 relative z-10 w-full">
            {/* Filtro de Semanas */}
            <div className="flex w-auto items-center gap-4 bg-white p-2 px-4 rounded-md border border-gray-100 shadow-sm shrink-0">
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

            {/* BUSCADOR */}
            <div className="flex-1 group/search relative w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within/search:text-brand-500 transition-colors" size={18} />
              <input
                type="text"
                placeholder="Buscar por nro. orden, observaciones o responsable..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 pr-6 py-3.5 bg-white border border-gray-100 rounded-md text-sm font-semibold text-slate-700 outline-none focus:ring-4 focus:ring-brand-accent/10 focus:border-brand-accent transition-all w-full shadow-sm"
              />
            </div>
            {/* BOTÓN REGISTRAR NUEVO */}
            <button
              onClick={() => setMostrarModalNuevo(true)}
              className="bg-brand-900 text-white rounded-md px-4 py-1.5 shadow-xl shadow-brand-900/10 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3 border border-brand-800 whitespace-nowrap"
            >
              <div className="p-2 bg-brand-800 rounded-xl"><Plus size={16} /></div>
              <span className="text-[10px] font-black uppercase tracking-widest">Crear Reenvasado</span>
            </button>
          </div>

          {/* KPIs / FILTROS DE ESTADO */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(statusConfig).map(([key, config]) => {
              const count = ordenes.filter(c => c.estatus === key).length;
              const isActive = activeStatusFilter === key;
              return (
                <button
                  key={key}
                  onClick={() => setActiveStatusFilter(isActive ? null : key)}
                  className={`bg-white p-4 rounded-md border transition-all duration-300 flex items-center justify-between group cursor-pointer ${
                    isActive
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

          {/* TABLA DE ORDENES */}
          <div className="bg-white rounded-md shadow-xl shadow-slate-200/40 border border-slate-100 overflow-hidden">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-10 gap-4">
                <div className="w-12 h-12 border-4 border-brand-900/10 border-t-brand-900 rounded-full animate-spin" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Consultando órdenes...</p>
              </div>
            ) : filteredOrdenes.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-100">
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nro. Orden</th>
                      <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Responsable</th>
                      <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Observaciones</th>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredOrdenes.map(o => {
                      const est = o.estatus;
                      const conf = statusConfig[est] || { label: est, color: 'bg-slate-100 text-slate-700', icon: null };
                      return (
                        <tr key={o.id} className="hover:bg-slate-50/50 transition-all">
                          <td className="px-8 py-4 font-black text-slate-800 text-xs">
                            <div className="flex flex-col gap-1.5">
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                                  <PackageCheck size={10} className="text-slate-400" />
                                  {formato8Digitos(o.id)}
                                </span>
                                <span className="whitespace-nowrap text-[9px] font-bold text-slate-400 italic">
                                  {formatDateSystemToDDMMYYYY_HHMMSS(`${o.timestamp_update ? o.timestamp_update : o.timestamp_create}`)}
                                </span>
                              </div>
                              <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest ${conf.color}`}>
                                {conf.icon}
                                {conf.label}
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="flex flex-col gap-2">
                              <ViewUser textDisplay="Creado por" usuario={o.usuario_create} timestamp={o.timestamp_create} formatDate={formatDateSystemToDDMMYYYY_HHMMSS} />
                              {o.usuario_update && (
                                <ViewUser textDisplay="Actualizado por" usuario={o.usuario_update} timestamp={o.timestamp_update} formatDate={formatDateSystemToDDMMYYYY_HHMMSS} />
                              )}
                              {o.usuario_procesa && (
                                <ViewUser textDisplay="Procesado por" usuario={o.usuario_procesa} timestamp={o.timestamp_procesa} formatDate={formatDateSystemToDDMMYYYY_HHMMSS} />
                              )}
                              {o.usuario_anula && (
                                <ViewUser textDisplay="Anulado por" usuario={o.usuario_anula} timestamp={o.timestamp_anula} formatDate={formatDateSystemToDDMMYYYY_HHMMSS} />
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4 text-xs text-slate-500 max-w-xs truncate" title={o.observaciones}>
                            {o.observaciones || <span className="text-slate-300 italic">Sin observaciones</span>}
                          </td>
                          <td className="px-8 py-4">
                            <div className="flex items-center justify-center gap-2">
                              {est === 'BORRADOR' && (
                                <>
                                  <button
                                    onClick={() => setOrdenParaEditar(o)}
                                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                    title="Editar Insumos"
                                  >
                                    <FileEdit size={16} />
                                  </button>
                                  <button
                                    onClick={() => handleIniciar(o.id)}
                                    disabled={procesandoId === o.id}
                                    className="p-1.5 text-orange-600 hover:bg-orange-50 rounded-lg transition-all disabled:opacity-50"
                                    title="Iniciar Reenvasado (Mover a Mesa)"
                                  >
                                    {procesandoId === o.id ? (
                                      <div className="w-4 h-4 border-2 border-orange-500/20 border-t-orange-500 rounded-full animate-spin" />
                                    ) : (
                                      <Play size={16} />
                                    )}
                                  </button>
                                  <button
                                    onClick={() => handleAnular(o.id)}
                                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                    title="Anular Orden"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </>
                              )}
                              {est === 'EN_PROCESO' && (
                                <>
                                  <button
                                    onClick={() => setOrdenParaEditar(o)}
                                    className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-all flex items-center gap-1 font-bold text-xs"
                                    title="Gestionar Reenvasado en Mesa"
                                  >
                                    <FileEdit size={16} />
                                    <span className="text-[9px] uppercase font-black tracking-wider">Mesa</span>
                                  </button>
                                  <button
                                    onClick={() => handleAnular(o.id)}
                                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                    title="Anular Orden"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </>
                              )}
                              {(est === 'PROCESADO' || est === 'ANULADO') && (
                                <button
                                  onClick={() => setOrdenParaVer(o)}
                                  className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-all"
                                  title="Ver Detalles"
                                >
                                  <Eye size={16} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-1 gap-2 bg-white">
                <div className="w-24 h-24 bg-slate-50 rounded-md flex items-center justify-center text-slate-300">
                  <ClipboardList size={48} />
                </div>
                <div className="text-center">
                  <p className="text-lg font-black text-slate-800 uppercase tracking-tighter">Sin órdenes registradas</p>
                  <p className="text-sm text-slate-400 font-medium italic">No se encontraron órdenes de reenvasado con los filtros seleccionados</p>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* RENDER MODALES */}
      {(mostrarModalNuevo || ordenParaEditar || ordenParaVer) && (
        <ReenvasadoModal
          empresaActiva={empresaActiva}
          sucursalActiva={sucursalActiva}
          perfil={perfil}
          almacenId={almacenSel?.id}
          nombreAlmacen={almacenSel?.nombre}
          ordenId={ordenParaEditar?.id || ordenParaVer?.id}
          modoVisualizacion={!!ordenParaVer}
          onClose={() => {
            setMostrarModalNuevo(false);
            setOrdenParaEditar(null);
            setOrdenParaVer(null);
          }}
          onUpdate={() => {
            fetchOrdenes();
          }}
        />
      )}
    </div>
  );
}
