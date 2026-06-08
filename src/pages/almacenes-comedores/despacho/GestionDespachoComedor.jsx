import React, { useState, useEffect, useMemo } from 'react';
import { Package, Search, Clock, CheckCircle2, Warehouse, Filter, ClipboardCheck, Truck, List, Building2, Calendar, XCircle, PackageCheck } from 'lucide-react';
import { useModulePermissions } from '../../../hooks/useModulePermissions';
import { getComedores } from '../../../services/planificacionService';
import { getEjecucionesDespacho } from '../../../services/ejecucionService';
import DespachoComedoresModal from './DespachoComedoresModal';
import { getWeekStringFromDate, getDatesFromWeek, formatearFecha, formatToISODate, getDayNameLongString, formato8Digitos, formatDateSystemToDDMMYYYY_HHMMSS } from '../../../util/workDate';
import { Now } from '../../../services/nowService';
import ViewUser from '../../../components/user-table/ViewUser';

const statusConfig = {
    PENDIENTE: { label: 'Pendiente', color: 'bg-amber-50 text-amber-600 border-amber-200', icon: <Clock size={12} /> },
    PROCESADO: { label: 'Despachado', color: 'bg-emerald-50 text-emerald-600 border-emerald-200 shadow-sm shadow-emerald-900/10', icon: <CheckCircle2 size={12} /> },
    ANULADO: { label: 'Anulado', color: 'bg-red-50 text-red-600 border-red-200', icon: <XCircle size={12} /> },
};

export default function GestionDespachoComedor() {
    const { perfil, empresaActiva, renderGuard } = useModulePermissions();
    const [loading, setLoading] = useState(false);

    // Selectores de Contexto
    const [sucursalSelected, setSucursalSelected] = useState('');
    const [comedorSelected, setComedorSelected] = useState('');
    const [comedores, setComedores] = useState([]);

    // Filtros de Rango
    // Rango de semanas
    const [weekStart, setWeekStart] = useState('');
    const [weekEnd, setWeekEnd] = useState('');
    const [activeStatusFilter, setActiveStatusFilter] = useState('PENDIENTE');

    const [ejecuciones, setEjecuciones] = useState([]);
    const [selectedItem, setSelectedItem] = useState(null);
    const [showDespacho, setShowDespacho] = useState(false);

    const isSuperAdmin = perfil?.F_ALL === true;

    useEffect(() => {
        if (empresaActiva?.id) fetchComedores();
    }, [empresaActiva?.id]);

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
        if (comedorSelected && weekStart && weekEnd) {
            fetchEjecuciones();
        } else {
            setEjecuciones([]);
        }
    }, [comedorSelected, weekStart, weekEnd]);

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
            //const dateEnd = getDatesFromWeek(weekEnd).end;
            const dateEnd = getDatesFromWeek(weekStart).end;
            const data = await getEjecucionesDespacho(comedorSelected, dateStart, dateEnd);
            setEjecuciones(data || []);
        } catch (error) {
            console.error('Error al cargar despachos:', error);
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

    useEffect(() => {
        if (sucursalSelected && comedoresFiltrados.length === 1) {
            setComedorSelected(comedoresFiltrados[0].id);
        }
    }, [sucursalSelected, comedoresFiltrados]);

    const filteredEjecuciones = useMemo(() => {
        let result = [...ejecuciones];
        if (activeStatusFilter) {
            result = result.filter(e => e.estatus === activeStatusFilter);
        }
        return result.sort((a, b) => new Date(a.fecha_ejecucion) - new Date(b.fecha_ejecucion));
    }, [ejecuciones, activeStatusFilter]);

    const guard = renderGuard();
    if (guard) return guard;

    return (
        <div className="p-4 space-y-2 animate-in fade-in duration-500 bg-slate-50">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-brand-50 text-brand-900 rounded-xl shadow-sm border border-brand-100">
                        <Truck size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-slate-800 tracking-tighter uppercase">Gestión de Despacho</h1>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest italic">Prioridad y control de suministros para cocina</p>
                    </div>
                </div>
            </div>

            {/* Filtros Premium */}
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
                        value={sucursalSelected}
                        onChange={(e) => { setSucursalSelected(e.target.value); setComedorSelected(''); }}
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
                        value={comedorSelected}
                        disabled={!sucursalSelected}
                        onChange={(e) => setComedorSelected(e.target.value)}
                        className="text-[10px] font-black text-brand-900 uppercase tracking-widest bg-slate-50 px-2 py-1 rounded-lg border border-transparent hover:border-brand-200 transition-all outline-none min-w-[150px] disabled:opacity-50"
                    >
                        <option value="">-- SELECCIONE --</option>
                        {comedoresFiltrados.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                </div>

                <div className="flex flex-col w-auto items-center gap-4 bg-white p-2 px-4 rounded-md border border-gray-100 shadow-sm animate-in slide-in-from-right duration-700 shrink-0">
                    <div className="flex items-center gap-2 pr-4 border-r border-gray-100">
                        <Calendar size={18} className="text-brand-600" />
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase text-slate-800 leading-none">Aprobación</span>
                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Semanas</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex flex-col gap-0.5">
                            <input
                                type="week"
                                value={weekStart}
                                onChange={(e) => setWeekStart(e.target.value)}
                                className="text-[10px] font-black text-brand-900 uppercase tracking-widest bg-slate-50 px-2 py-1 rounded-lg border border-transparent hover:border-brand-200 transition-all outline-none"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {Object.entries(statusConfig).map(([key, config]) => {
                    const count = ejecuciones.filter(c => c.estatus === key).length;
                    const isActive = activeStatusFilter === key;
                    return (
                        <button
                            key={key}
                            onClick={() => setActiveStatusFilter(isActive ? null : key)}
                            className={`bg-white p-4 rounded-md border transition-all duration-300 flex items-center justify-between group cursor-pointer ${isActive ? 'border-brand-500 shadow-lg shadow-brand-500/10 ring-2 ring-brand-500/5 -translate-y-1' : 'border-gray-100 shadow-sm hover:shadow-md hover:border-brand-200'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-xl transition-colors ${isActive ? config.color.split(' ')[0] + ' ' + config.color.split(' ')[1] : 'bg-slate-50 text-slate-400'}`}>
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

            {/* Tabla de Resultados */}
            <div className="bg-white rounded-md shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50 border-b border-gray-100">
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Servicio / Fecha / Estado</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Menús (Despacho)</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Auditoría Registro</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-300">
                            {loading ? (
                                Array(3).fill(0).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={4} className="px-6 py-10 bg-slate-50/30"></td>
                                    </tr>
                                ))
                            ) : (!sucursalSelected || !comedorSelected) ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-6 text-center">
                                        <div className="flex flex-col items-center gap-4 opacity-40">
                                            <Warehouse size={48} className="text-brand-900" />
                                            <p className="text-[11px] font-black uppercase tracking-widest text-slate-800">Seleccione una sucursal y comedor para ver despachos</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredEjecuciones.length === 0 ? (
                                weekStart === "" ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-6 text-center">
                                            <div className="flex flex-col items-center gap-4 opacity-60">
                                                <XCircle size={48} />
                                                <p className="text-[11px] font-black uppercase tracking-widest">Seleccione una semana para ver despachos</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-6 text-center">
                                            <div className="flex flex-col items-center gap-4 text-emerald-500 opacity-60">
                                                <CheckCircle2 size={48} />
                                                <p className="text-[11px] font-black uppercase tracking-widest">¡Todo al día en esta semana!</p>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            ) : (
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
                                            <div className="flex flex-col justify-center items-center gap-0.5">
                                                <div className="grid grid-cols-3 gap-x-2 gap-y-0.5 w-full">
                                                    <span className="text-[8px] text-slate-400 uppercase font-black tracking-tighter text-right">Servicio</span>
                                                    <span className="text-[8px] text-slate-400 uppercase font-black tracking-tighter text-left">Plato</span>
                                                    <span className="text-[8px] text-slate-400 uppercase font-black tracking-tighter text-right">Cant.</span>
                                                </div>
                                                {ejec.recetas.map(r => (
                                                    <div key={r.id} className="grid grid-cols-3 gap-x-2 gap-y-0.5 w-full text-[8px]">
                                                        <span className="font-black text-brand-900/60 text-right">{r.slot?.nombre}:</span>
                                                        <span className="text-slate-400 uppercase tracking-tighter text-left truncate">{r.receta_info?.nombre}</span>
                                                        <span className="text-slate-600 text-right font-black">{r.comensales}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-2">
                                                <ViewUser textDisplay="Creado" usuario={ejec.usuario_create} timestamp={ejec.timestamp_create} formatDate={formatDateSystemToDDMMYYYY_HHMMSS} />
                                                {ejec.usuario_procesa && (
                                                    <ViewUser textDisplay="Despachado" usuario={ejec.usuario_procesa} timestamp={ejec.timestamp_procesa} formatDate={formatDateSystemToDDMMYYYY_HHMMSS} />
                                                )}
                                                {ejec.usuario_anula && (
                                                    <ViewUser textDisplay="Anulado" usuario={ejec.usuario_anula} timestamp={ejec.timestamp_anula} formatDate={formatDateSystemToDDMMYYYY_HHMMSS} />
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {ejec.estatus === 'PENDIENTE' && (
                                                <button
                                                    onClick={() => { setSelectedItem(ejec); setShowDespacho(true); }}
                                                    className="flex items-center gap-2 px-4 py-2 bg-brand-900 text-white rounded-md text-[9px] font-black uppercase tracking-widest hover:bg-slate-900 transition-all shadow-md shadow-brand-900/10 active:scale-95 group/btn ml-auto"
                                                >
                                                    <Truck size={12} className="group-hover/btn:translate-x-1 transition-transform" />
                                                    Despachar
                                                </button>
                                            )}
                                            {ejec.estatus === 'PROCESADO' && (
                                                <button
                                                    onClick={() => { setSelectedItem(ejec); setShowDespacho(true); }}
                                                    className="flex items-center gap-2 px-4 py-2 bg-white text-slate-600 border border-slate-200 rounded-md text-[9px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm active:scale-95 group/btn ml-auto"
                                                >
                                                    <Search size={12} className="group-hover/btn:scale-110 transition-transform" />
                                                    Ver Detalle
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal de Despacho */}
            {showDespacho && selectedItem && (
                <DespachoComedoresModal
                    ejecucionId={selectedItem.id}
                    onClose={() => { setShowDespacho(false); setSelectedItem(null); fetchEjecuciones(); }}
                    onUpdate={fetchEjecuciones}
                />
            )}
        </div>
    );
}
