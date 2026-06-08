import React, { useState, useEffect, useMemo } from 'react';
import {
    Calendar, Clock, Loader2, CheckCircle2,
    Warehouse, XCircle, Package, ArrowRight, Filter, Truck, PackageCheck, List
} from 'lucide-react';
import { getDespachosRecepcion, procesarRecepcionRemision } from '../../../services/recepcionCocinaService';
import { getComedores } from '../../../services/comedorService';
import { useModulePermissions } from '../../../hooks/useModulePermissions';
import { Now } from '../../../services/nowService';
import { formatToISODate, formatearFecha, getDayNameLongString, formato8Digitos, formatDateSystemToDDMMYYYY_HHMMSS } from '../../../util/workDate';
import RecepcionCocinaModal from './RecepcionCocinaModal';
import ViewUser from '../../../components/user-table/ViewUser';

const statusConfig = {
    PENDIENTE: { label: 'En Tránsito', color: 'bg-amber-50 text-amber-600 border-amber-200', icon: <Clock size={12} /> },
    RECIBIDO: { label: 'Recibido', color: 'bg-emerald-50 text-emerald-600 border-emerald-200 shadow-sm shadow-emerald-900/10', icon: <CheckCircle2 size={12} /> },
    ANULADO: { label: 'Anulado', color: 'bg-red-50 text-red-600 border-red-200', icon: <XCircle size={12} /> },
};

export default function GestionRecepcionCocina() {
    const { perfil, empresaActiva, renderGuard } = useModulePermissions();
    const [loading, setLoading] = useState(false);

    // Selectores de Contexto
    const [sucursalSelected, setSucursalSelected] = useState('');
    const [comedorSelected, setComedorSelected] = useState('');
    const [comedores, setComedores] = useState([]);

    // Filtros
    const [date, setDate] = useState('');
    const [activeStatusFilter, setActiveStatusFilter] = useState('PENDIENTE');
    const [despachos, setDespachos] = useState([]);
    const [selectedDespacho, setSelectedDespacho] = useState(null);
    const [showModal, setShowModal] = useState(false);

    const isSuperAdmin = perfil?.F_ALL === true;

    useEffect(() => {
        if (empresaActiva?.id) fetchInitialData();
    }, [empresaActiva?.id]);

    useEffect(() => {
        if (comedorSelected && date) {
            fetchDespachos();
        } else {
            setDespachos([]);
        }
    }, [comedorSelected, date]);

    const fetchInitialData = async () => {
        try {
            const data = await getComedores(empresaActiva.id);
            setComedores(data || []);

            const sucs = Array.from(new Set((data || []).map(c => c.id_sucursal)))
                .filter(id => isSuperAdmin || !perfil.ids_sucursales || perfil.ids_sucursales.includes(id));

            if (sucs.length === 1) setSucursalSelected(sucs[0]);

            const now = await Now();
            setDate(formatToISODate(now));
        } catch (error) {
            console.error("Error al cargar datos iniciales:", error);
        }
    };

    const fetchDespachos = async () => {
        setLoading(true);
        try {
            const data = await getDespachosRecepcion(comedorSelected, date, date);
            setDespachos(data || []);
        } catch (error) {
            console.error('Error al cargar remisiones:', error);
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
    }, [comedores, isSuperAdmin, perfil]);

    const comedoresFiltrados = useMemo(() => {
        return comedores.filter(c =>
            c.id_sucursal == sucursalSelected &&
            (isSuperAdmin || !perfil.ids_comedores || perfil.ids_comedores.includes(c.id))
        );
    }, [comedores, sucursalSelected, perfil, isSuperAdmin]);

    const despachosFiltrados = useMemo(() => {
        let result = [...despachos];
        if (activeStatusFilter) {
            result = result.filter(d => d.estatus === activeStatusFilter);
        }

        // Si estamos en RECIBIDO, agrupamos por ejecución (servicio)
        if (activeStatusFilter === 'RECIBIDO') {
            const groups = {};
            result.forEach(d => {
                const key = d.id_ejecucion;
                if (!groups[key]) {
                    groups[key] = {
                        ...d,
                        ids_remisiones: [d.id],
                        detalles_consolidados: JSON.parse(JSON.stringify(d.detalles || []))
                    };
                } else {
                    groups[key].ids_remisiones.push(d.id);
                    // Consolidar detalles por producto y lote
                    d.detalles?.forEach(det => {
                        const existing = groups[key].detalles_consolidados.find(item =>
                            item.id_producto === det.id_producto && item.lote === det.lote
                        );
                        if (existing) {
                            existing.cantidad_entregada = Number(existing.cantidad_entregada) + Number(det.cantidad_entregada);
                            existing.cantidad_recibida = Number(existing.cantidad_recibida || 0) + Number(det.cantidad_recibida || 0);
                        } else {
                            groups[key].detalles_consolidados.push(JSON.parse(JSON.stringify(det)));
                        }
                    });
                    // Mantener el timestamp más reciente
                    if (new Date(d.timestamp_despacho) > new Date(groups[key].timestamp_despacho)) {
                        groups[key].timestamp_despacho = d.timestamp_despacho;
                    }
                }
            });
            return Object.values(groups).map(g => ({
                ...g,
                detalles: g.detalles_consolidados,
                isGrouped: true
            })).sort((a, b) => b.id - a.id);
        }

        return result.sort((a, b) => b.id - a.id);
    }, [despachos, activeStatusFilter]);

    const guard = renderGuard();
    if (guard) return guard;

    return (
        <div className="p-4 space-y-2 animate-in fade-in duration-500 bg-slate-50">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-brand-50 text-brand-900 rounded-xl shadow-sm border border-brand-100">
                        <PackageCheck size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-slate-800 tracking-tighter uppercase">Recepción de Mercancía</h1>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest italic">Cotejo y confirmación de remisiones en cocina</p>
                    </div>
                </div>
            </div>

            {/* Filtros Premium */}
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4 relative z-10">
                <div className="flex flex-col w-auto items-center bg-white p-2 px-4 rounded-md border border-gray-100 shadow-sm shrink-0">
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

                <div className="flex flex-col w-auto items-center bg-white p-2 px-4 rounded-md border border-gray-100 shadow-sm shrink-0">
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

                <div className="flex flex-col w-auto items-center bg-white p-2 px-4 rounded-md border border-gray-100 shadow-sm animate-in slide-in-from-right duration-700 shrink-0">
                    <div className="flex items-center gap-2 pr-4 border-r border-gray-100">
                        <Calendar size={18} className="text-brand-600" />
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase text-slate-800 leading-none">Fecha</span>
                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Consulta</span>
                        </div>
                    </div>
                    <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="text-[10px] font-black text-brand-900 uppercase tracking-widest bg-slate-50 px-2 py-1 rounded-lg border border-transparent hover:border-brand-200 transition-all outline-none"
                    />
                </div>
            </div>

            {/* KPIs */}
            {sucursalSelected && comedorSelected && date && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {Object.entries(statusConfig).map(([key, config]) => {
                        const count = despachos.filter(d => d.estatus === key).length;
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
            )}

            {/* Tabla de Resultados */}
            <div className="bg-white rounded-md shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50 border-b border-gray-100">
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Remisión / Servicio</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Ítems Despachados</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Responsable</th>
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
                            ) : (!sucursalSelected || !comedorSelected || !date) ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-6 text-center">
                                        <div className="flex flex-col items-center gap-4 opacity-40">
                                            <Warehouse size={48} className="text-brand-900" />
                                            <p className="text-[11px] font-black uppercase tracking-widest text-slate-800">Seleccione una sucursal, un comedor y una fecha para ver remisiones</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : ((sucursalSelected && comedorSelected && date) && despachosFiltrados.length === 0) ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-6 text-center">
                                        <div className="flex flex-col items-center gap-4 text-emerald-500 opacity-60">
                                            <CheckCircle2 size={48} />
                                            <p className="text-[11px] font-black uppercase tracking-widest">¡Todo recibido en esta fecha!</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                despachosFiltrados.map(desp => (
                                    <tr key={desp.id} className="hover:bg-slate-50 transition-all group">
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1.5">
                                                {desp.isGrouped ? (
                                                    <div className="flex flex-wrap gap-1">
                                                        {desp.ids_remisiones.map(id => (
                                                            <span key={id} className="text-[8px] font-black text-brand-900 bg-brand-50 px-1.5 py-0.5 rounded border border-brand-100 uppercase tracking-tighter">
                                                                REM-{formato8Digitos(id)}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] font-black text-brand-900 bg-brand-50 px-2 py-1 rounded border border-brand-100 uppercase tracking-widest inline-block w-fit">
                                                        REM-{formato8Digitos(desp.id)}
                                                    </span>
                                                )}
                                                {/* <div className="flex items-center gap-2">
                                                    <span className="text-[11px] font-black text-slate-800 uppercase tracking-tight">
                                                        {desp.ejecucion?.servicio?.nombre || 'SERVICIO GENERAL'}
                                                    </span>
                                                </div>
                                                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest w-fit ${statusConfig[desp.estatus]?.color}`}>
                                                    {statusConfig[desp.estatus]?.icon}
                                                    {statusConfig[desp.estatus]?.label}
                                                </div> */}
                                                <div className="flex flex-col gap-1.5">
                                                    <span className="text-[10px] font-black text-brand-900 bg-brand-50 px-2 py-1 rounded border border-brand-100 uppercase tracking-widest">
                                                        {desp.ejecucion?.servicio?.nombre || 'SERVICIO GENERAL'}
                                                    </span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[11px] font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                                                            <PackageCheck size={10} className="text-slate-400" />
                                                            {formato8Digitos(desp.ejecucion.id)}
                                                        </span>
                                                        <span className="whitespace-nowrap text-[9px] font-bold text-slate-400 italic">
                                                            {getDayNameLongString(desp.ejecucion.fecha_ejecucion)} - {formatearFecha(desp.ejecucion.fecha_ejecucion)}
                                                        </span>
                                                    </div>
                                                    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest ${statusConfig[desp.estatus]?.color}`}>
                                                        {statusConfig[desp.estatus]?.icon}
                                                        {statusConfig[desp.estatus]?.label}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex flex-col items-center">
                                                <span className="text-xl font-black text-slate-700 leading-none">{desp.detalles?.length || 0}</span>
                                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Productos</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-2">
                                                <ViewUser textDisplay="Despachado por" usuario={desp.usuario_despacho} timestamp={desp.timestamp_despacho} formatDate={formatDateSystemToDDMMYYYY_HHMMSS} />
                                                {desp.usuario_recepciona && (
                                                    <ViewUser textDisplay="Recibido por" usuario={desp.usuario_recepciona} timestamp={desp.timestamp_recepcion} formatDate={formatDateSystemToDDMMYYYY_HHMMSS} />
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => { setSelectedDespacho(desp); setShowModal(true); }}
                                                className="flex items-center gap-2 px-4 py-2 bg-brand-900 text-white rounded-md text-[9px] font-black uppercase tracking-widest hover:bg-slate-900 transition-all shadow-md shadow-brand-900/10 active:scale-95 group/btn ml-auto"
                                            >
                                                <ArrowRight size={12} className="group-hover/btn:translate-x-1 transition-transform" />
                                                {desp.estatus === 'PENDIENTE' ? 'Cotejar y Recibir' : 'Ver Detalles'}
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal de Recepción */}
            {showModal && (
                <RecepcionCocinaModal
                    despacho={selectedDespacho}
                    onClose={() => {
                        setShowModal(false);
                        setSelectedDespacho(null);
                        fetchDespachos();
                    }}
                />
            )}
        </div>
    );
}
