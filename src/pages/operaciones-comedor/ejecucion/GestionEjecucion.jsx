import { useState, useEffect, useMemo } from 'react';
import { useModulePermissions } from '../../../hooks/useModulePermissions';
import { ChefHat, Plus, Calendar, Filter, ClipboardCheck, Clock, CheckCircle2, XCircle, ChevronLeft, ChevronRight, Search, FileText, User, Hash, PackageCheck } from 'lucide-react';
import { getWeekStringFromDate, getDatesFromWeek, formatearFecha, formatToISODate, getDayNameLongString, formato8Digitos, formatDateSystemToDDMMYYYY_HHMMSS } from '../../../util/workDate';
import { getComedores, getServiciosConfig } from '../../../services/planificacionService';
import { getEjecucionesByComedor, cerrarEjecucion } from '../../../services/ejecucionService';
import { Now } from '../../../services/nowService';
import EjecucionModal from './EjecucionModal';
import ViewUser from '../../../components/user-table/ViewUser';

const statusConfig = {
    BORRADOR: { label: 'Borrador', color: 'bg-slate-50 text-slate-500 border-slate-200', icon: <Clock size={12} /> },
    PENDIENTE: { label: 'Pendiente', color: 'bg-amber-50 text-amber-600 border-amber-200', icon: <ClipboardCheck size={12} /> },
    PROCESADO: { label: 'Procesado', color: 'bg-emerald-50 text-emerald-600 border-emerald-200 shadow-sm shadow-emerald-900/10', icon: <CheckCircle2 size={12} /> },
    CERRADO: { label: 'Cerrado', color: 'bg-brand-900 text-white border-brand-900 shadow-lg shadow-brand-900/20', icon: <PackageCheck size={12} /> },
    ANULADO: { label: 'Anulado', color: 'bg-red-50 text-red-600 border-red-200', icon: <XCircle size={12} /> },
};

export default function GestionEjecucion() {
    const { perfil, empresaActiva, renderGuard } = useModulePermissions();

    const [loading, setLoading] = useState(true);
    const [weekStart, setWeekStart] = useState('');
    const [weekEnd, setWeekEnd] = useState('');
    const [activeStatusFilter, setActiveStatusFilter] = useState(null);

    const [sucursalSelected, setSucursalSelected] = useState('');
    const [comedorSelected, setComedorSelected] = useState('');
    const [comedores, setComedores] = useState([]);
    const [servicios, setServicios] = useState([]);
    const [ejecuciones, setEjecuciones] = useState([]);

    const [showModal, setShowModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);

    const isSuperAdmin = perfil?.F_ALL === true;

    useEffect(() => {
        const initDates = async () => {
            const nowStr = await Now();
            const weekStr = getWeekStringFromDate(new Date(nowStr));
            setWeekStart(weekStr);
            setWeekEnd(weekStr);
        };
        initDates();
    }, []);

    useEffect(() => {
        if (empresaActiva?.id) {
            fetchComedores();
        }
    }, [empresaActiva?.id]);

    useEffect(() => {
        if (comedorSelected && weekStart && weekEnd) {
            fetchEjecuciones();
            fetchServicios();
        }
    }, [comedorSelected, weekStart, weekEnd]);

    const fetchServicios = async () => {
        try {
            const data = await getServiciosConfig(comedorSelected);
            setServicios(data || []);
        } catch (error) {
            console.error("Error al cargar servicios config:", error);
        }
    };

    const fetchComedores = async () => {
        try {
            const data = await getComedores(empresaActiva.id);
            setComedores(data || []);

            const sucs = Array.from(new Set((data || []).map(c => c.id_sucursal)))
                .filter(id => isSuperAdmin || !perfil.ids_sucursales || perfil.ids_sucursales.includes(id));
            if (sucs.length === 1) setSucursalSelected(sucs[0]);
        } catch (error) {
            console.error("Error al cargar comedores:", error);
        }
    };

    const fetchEjecuciones = async () => {
        setLoading(true);
        try {
            const dateStart = getDatesFromWeek(weekStart).start;
            const dateEnd = getDatesFromWeek(weekEnd).end;
            const res = await getEjecucionesByComedor(comedorSelected, dateStart, dateEnd);
            console.log("res", res)
            setEjecuciones(res || []);
        } catch (error) {
            console.error('Error al cargar ejecuciones:', error);
        } finally {
            setLoading(false);
        }
    };

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

    // Auto-selección de Comedor
    useEffect(() => {
        if (sucursalSelected && comedoresFiltrados.length === 1) {
            setComedorSelected(comedoresFiltrados[0].id);
        }
    }, [sucursalSelected, comedoresFiltrados]);

    const filteredEjecuciones = useMemo(() => {
        let list = [...ejecuciones];
        if (activeStatusFilter) {
            list = list.filter(e => e.estatus === activeStatusFilter);
        }
        return list.sort((a, b) => new Date(b.fecha_ejecucion) - new Date(a.fecha_ejecucion));
    }, [ejecuciones, activeStatusFilter]);

    const handleCerrar = async (ejec) => {
        if (!window.confirm(`¿Estás seguro de CERRAR DEFINITIVAMENTE el servicio de ${ejec.servicio?.nombre}? Esto descargará el inventario de cocina y no podrá revertirse.`)) return;
        
        try {
            await cerrarEjecucion(ejec.id, perfil.id);
            await fetchEjecuciones();
        } catch (error) {
            console.error("Error al cerrar ejecución:", error);
            alert("Error al cerrar la ejecución: " + error.message);
        }
    };

    const guard = renderGuard();
    if (guard) return guard;

    return (
        <div className="p-4 space-y-2 animate-in fade-in duration-500 bg-slate-50 min-h-screen">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-brand-50 rounded-xl text-brand-900 shadow-sm">
                        <ChefHat size={28} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 tracking-tight leading-none">Ejecución Diaria</h1>
                        <p className="text-slate-400 text-[10px] uppercase font-black tracking-widest mt-1 italic">Gestión de menús y servicios operativos</p>
                    </div>
                </div>

                <button
                    disabled={!comedorSelected}
                    onClick={() => { setSelectedItem(null); setShowModal(true); }}
                    className={`flex items-center gap-2 px-6 py-3 bg-brand-900 text-white rounded-md text-xs font-black uppercase shadow-xl shadow-brand-900/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100`}
                >
                    <Plus size={18} /> Nueva Ejecución
                </button>
            </div>

            {/* Selectores de Contexto */}
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4 relative z-10">
                {/* Nivel 1: Sucursal */}
                <div className="flex w-auto items-center gap-4 bg-white p-2 px-4 rounded-md border border-gray-100 shadow-sm shrink-0">
                    <div className="flex items-center gap-2 pr-4 border-r border-gray-100">
                        <Filter size={18} className="text-brand-600" />
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase text-slate-800 leading-none">Sucursal</span>
                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Ubicación</span>
                        </div>
                    </div>
                    <select
                        value={sucursalSelected}
                        onChange={(e) => {
                            setSucursalSelected(e.target.value);
                            setComedorSelected('');
                        }}
                        className="text-[10px] font-black text-brand-900 uppercase tracking-widest bg-slate-50 px-2 py-1.5 rounded-lg border border-transparent hover:border-brand-200 transition-all outline-none min-w-[150px]"
                    >
                        <option value="">-- SELECCIONE --</option>
                        {sucursalesDisponibles.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                    </select>
                </div>

                {/* Nivel 2: Comedor */}
                <div className="flex w-auto items-center gap-4 bg-white p-2 px-4 rounded-md border border-gray-100 shadow-sm shrink-0">
                    <div className="flex items-center gap-2 pr-4 border-r border-gray-100">
                        <ChefHat size={18} className="text-brand-600" />
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase text-slate-800 leading-none">Comedor</span>
                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Servicio</span>
                        </div>
                    </div>
                    <select
                        value={comedorSelected}
                        disabled={!sucursalSelected}
                        onChange={(e) => setComedorSelected(e.target.value)}
                        className="text-[10px] font-black text-brand-900 uppercase tracking-widest bg-slate-50 px-2 py-1.5 rounded-lg border border-transparent hover:border-brand-200 transition-all outline-none min-w-[150px] disabled:opacity-50"
                    >
                        <option value="">-- SELECCIONE --</option>
                        {comedoresFiltrados.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                </div>

                {/* Filtro de Semanas (Diseño solicitado) */}
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
            </div>

            {/* KPIs */}
            {comedorSelected && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                    {Object.entries(statusConfig).map(([key, config]) => {
                        const count = ejecuciones.filter(c => c.estatus === key).length;
                        const isActive = activeStatusFilter === key;
                        return (
                            <button
                                key={key}
                                onClick={() => setActiveStatusFilter(isActive ? null : key)}
                                className={`bg-white p-4 rounded-md border transition-all duration-300 flex items-center justify-between group cursor-pointer ${isActive ? 'border-brand-500 shadow-lg shadow-brand-500/10 ring-2 ring-brand-500/5 -translate-y-1' : 'border-gray-100 shadow-sm hover:shadow-md hover:border-brand-200'}`}
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

            {/* Contenido Principal */}
            {!comedorSelected ? (
                <div className="bg-white rounded-md p-20 flex flex-col items-center justify-center border border-dashed border-slate-200 animate-in fade-in zoom-in duration-700">
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 mb-4">
                        <ChefHat size={40} />
                    </div>
                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Seleccione Comedor</h3>
                </div>
            ) : loading ? (
                <div className="bg-white rounded-md p-20 flex flex-col items-center justify-center border border-gray-100 shadow-sm">
                    <div className="w-10 h-10 border-4 border-brand-900/10 border-t-brand-900 rounded-full animate-spin mb-4" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sincronizando Ejecuciones...</p>
                </div>
            ) : (
                <div className="bg-white rounded-md shadow-sm border border-gray-100 overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/50 border-b border-gray-100">
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Servicio / Fecha / Estado</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Comensales</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Menús</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Auditoría Registro</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredEjecuciones.length > 0 ? (
                                    filteredEjecuciones.map(ejec => (
                                        <tr key={ejec.id} className="hover:bg-slate-50 transition-all group">
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-1.5">
                                                    <span className="text-[10px] font-black text-brand-900 bg-brand-50 px-2 py-1 rounded border border-brand-100 uppercase tracking-widest">
                                                        {ejec.servicio?.nombre}
                                                    </span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[11px] font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                                                            <PackageCheck size={10} className="text-slate-400" />
                                                            {formato8Digitos(ejec.id)}
                                                        </span>
                                                        <span className="whitespace-nowrap text-[9px] font-bold text-slate-400 italic">
                                                            {getDayNameLongString(ejec.fecha_ejecucion)} - {formatearFecha(ejec.fecha_ejecucion)}
                                                        </span>
                                                    </div>
                                                    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest ${statusConfig[ejec.estatus]?.color}`}>
                                                        {statusConfig[ejec.estatus]?.icon}
                                                        {statusConfig[ejec.estatus]?.label}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex flex-col items-center">
                                                    <span className="text-xs font-black text-slate-700">
                                                        {ejec.recetas?.reduce((acc, r) =>
                                                            r.receta_info?.tipologia_receta?.es_base ? acc + (Number(r.comensales) || 0) : acc, 0) || 0
                                                        }
                                                    </span>
                                                    <span className="text-[8px] text-slate-400 uppercase font-black tracking-tighter">Reales</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {/* <span className="px-2 py-1 bg-slate-100 rounded text-[10px] font-black text-slate-600">
                                                    {ejec.recetas?.length || 0}
                                                </span> */}
                                                <div className="flex flex-col justify-center items-center gap-0.5">
                                                    {/* Headers */}
                                                    <div className="grid grid-cols-3 gap-x-2 gap-y-0.5 w-full">
                                                        <span className="text-[8px] text-slate-400 uppercase font-black tracking-tighter text-right">Servicio</span>
                                                        <span className="text-[8px] text-slate-400 uppercase font-black tracking-tighter text-left">Plato</span>
                                                        <span className="text-[8px] text-slate-400 uppercase font-black tracking-tighter text-right">Comensales</span>
                                                    </div>

                                                    {/* Filas de datos */}
                                                    {ejec.recetas?.map(r => (
                                                        <div key={r.id} className="grid grid-cols-3 gap-x-2 gap-y-0.5 w-full text-[8px]">
                                                            <span className="font-black text-brand-900/60 text-right">{r.slot?.nombre}:</span>
                                                            <span className="text-slate-400 uppercase tracking-tighter text-left">{r.receta_info?.nombre}</span>
                                                            <span className="text-slate-600 text-right">{r.comensales}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-2">
                                                    <ViewUser textDisplay="Creado" usuario={ejec.usuario_create} timestamp={ejec.timestamp_create} formatDate={formatDateSystemToDDMMYYYY_HHMMSS} />
                                                    {ejec.usuario_update && (
                                                        <ViewUser textDisplay="Editado" usuario={ejec.usuario_update} timestamp={ejec.timestamp_update} formatDate={formatDateSystemToDDMMYYYY_HHMMSS} />
                                                    )}
                                                    {ejec.usuario_procesa && (
                                                        <ViewUser textDisplay="Procesado" usuario={ejec.usuario_procesa} timestamp={ejec.timestamp_procesa} formatDate={formatDateSystemToDDMMYYYY_HHMMSS} />
                                                    )}
                                                    {ejec.usuario_anula && (
                                                        <ViewUser textDisplay="Anulado" usuario={ejec.usuario_anula} timestamp={ejec.timestamp_anula} formatDate={formatDateSystemToDDMMYYYY_HHMMSS} />
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {ejec.estatus === 'PROCESADO' && (
                                                        <button
                                                            onClick={() => handleCerrar(ejec)}
                                                            className="p-2 rounded-md bg-emerald-500 text-white hover:bg-emerald-600 transition-all shadow-md active:scale-95"
                                                            title="Cerrar Servicio y Descargar Stock"
                                                        >
                                                            <PackageCheck size={16} />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => { setSelectedItem(ejec); setShowModal(true); }}
                                                        className={`p-2 rounded-md transition-all ${ejec.estatus === 'BORRADOR' ? 'bg-brand-50 text-brand-900 hover:bg-brand-900 hover:text-white' : 'bg-slate-50 text-slate-400 hover:bg-slate-200'}`}
                                                        title="Gestionar Ejecución"
                                                    >
                                                        <Search size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="7" className="px-6 py-20 text-center opacity-30">
                                            <div className="flex flex-col items-center justify-center">
                                                <FileText size={40} className="mb-2" />
                                                <p className="text-[10px] font-black uppercase tracking-widest">No hay registros en este rango</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {showModal && (
                <EjecucionModal
                    initialData={selectedItem}
                    comedorSel={{ id: comedorSelected }}
                    serviciosDisponibles={servicios}
                    empresaActiva={empresaActiva}
                    perfil={perfil}
                    onClose={() => setShowModal(false)}
                    onUpdate={fetchEjecuciones}
                />
            )}
        </div>
    );
}
