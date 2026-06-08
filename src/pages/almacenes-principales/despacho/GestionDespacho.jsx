import React, { useState, useEffect, useMemo } from 'react';
import { Truck, Search, Calendar, Warehouse, FileEdit, CheckCircle2, XCircle, AlertTriangle, Info, Clock, User, PackageCheck, MapPin, ClipboardList, ArrowRight, Eye, ChevronRight, MoreHorizontal, Building2, Plus, Trash2, Box, Package, Monitor, PackageSearch } from 'lucide-react';
import { useModulePermissions } from '../../../hooks/useModulePermissions';
import { supabase } from '../../../lib/supabase';
import { getAlmacenes } from '../../../services/almacenService';
import { getPickingsListosParaDespacho, getHistorialDespachos } from '../../../services/despachoService';
import { formato8Digitos, formatDateSystemToDDMMYYYY_HHMMSS, getDatesFromWeek, getWeekStringFromDate } from '../../../util/workDate';
import { Now } from '../../../services/nowService';
import ViewUser from '../../../components/user-table/ViewUser';
import MesaTrabajoDespachoModal from './MesaTrabajoDespachoModal';
import DespachoDetalleModal from './DespachoDetalleModal';

const statusConfig = {
    LISTO: {
        label: 'Listo para Despacho',
        color: 'bg-blue-50 text-blue-600 border-blue-200',
        icon: <Package size={14} />,
        dbStatus: 'RECOLECTADO'
    },
    'EN TRÁNSITO': {
        label: 'En Tránsito',
        color: 'bg-amber-50 text-amber-600 border-amber-200',
        icon: <Truck size={14} />,
        dbStatus: 'EN TRÁNSITO'
    },
    'RECIBIDO_PARCIAL': {
        label: 'Recibido con Diferencia',
        color: 'bg-orange-50 text-orange-600 border-orange-200',
        icon: <AlertTriangle size={14} />,
        dbStatus: 'RECIBIDO_PARCIAL'
    },
    'RECIBIDO_TOTAL': {
        label: 'Recibido Total',
        color: 'bg-emerald-50 text-emerald-600 border-emerald-200',
        icon: <CheckCircle2 size={14} />,
        dbStatus: 'RECIBIDO_TOTAL'
    }
};

export default function GestionDespacho() {
    const { perfil, empresaActiva, renderGuard } = useModulePermissions();

    const [almacenes, setAlmacenes] = useState([]);
    const [almacenSel, setAlmacenSel] = useState(null);
    const [pickings, setPickings] = useState([]);
    const [despachos, setDespachos] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeStatusFilter, setActiveStatusFilter] = useState(null);

    // Rango de semanas (Patrón Monitor)
    const [weekStart, setWeekStart] = useState('');
    const [weekEnd, setWeekEnd] = useState('');

    // Selección Masiva
    const [idsParaDespacho, setIdsParaDespacho] = useState([]);
    const [showMesaTrabajo, setShowMesaTrabajo] = useState(false);

    // Detalle de Despacho
    const [showDetalle, setShowDetalle] = useState(false);
    const [despachoSel, setDespachoSel] = useState(null);

    useEffect(() => {
        if (empresaActiva?.id) {
            loadInitialData();
        }
    }, [empresaActiva?.id]);

    useEffect(() => {
        if (empresaActiva?.id) {
            const channel = supabase
                .channel(`cambios-despacho-${empresaActiva.id}`)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'almacen_picking' }, () => fetchPickings())
                .on('postgres_changes', { event: '*', schema: 'public', table: 'almacen_despacho' }, () => fetchPickings())
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        }
    }, [empresaActiva?.id, almacenSel, weekStart, weekEnd]);

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
            fetchPickings();
        } else {
            setPickings([]);
        }
    }, [empresaActiva?.id, almacenSel, weekStart, weekEnd]);

    const fetchPickings = async () => {
        if (!almacenSel) return;
        setLoading(true);
        // Limpiamos estados anteriores para evitar ver datos de otro almacén mientras carga
        setPickings([]);
        setDespachos([]);
        try {
            const dateStart = getDatesFromWeek(weekStart).start;
            const dateEnd = getDatesFromWeek(weekEnd).end;

            // 1. Traemos Pickings (Potenciales Despachos) - FILTRADOS DESDE EL SERVIDOR
            const pickingsData = await getPickingsListosParaDespacho(empresaActiva.id, almacenSel.id, dateStart, dateEnd);
            const pickingsMapped = (pickingsData || []).map(p => ({ ...p, _tipo: 'PICKING', estatus_kpi: 'LISTO' }));

            // 2. Traemos Despachos (Ya en ruta o entregados) desde el Service
            const despachosData = await getHistorialDespachos(empresaActiva.id, almacenSel.id, dateStart, dateEnd);

            const despachosMapped = (despachosData || []).map(d => ({
                ...d,
                _tipo: 'DESPACHO',
                estatus_kpi: d.estatus === 'ENTREGADO' ? 'ENTREGADO' : d.estatus,
                usuario_picking: d.almacen_despacho_detalle?.[0]?.picking_detalle?.picking?.usuario_procesa
            }));

            setPickings(pickingsMapped);
            setDespachos(despachosMapped);
            setIdsParaDespacho([]);
        } catch (error) {
            console.error("Error cargando datos de despacho:", error);
        } finally {
            setLoading(false);
        }
    };

    const allRecords = useMemo(() => {
        const combined = [...pickings, ...despachos];

        // Filtro de seguridad: Solo lo que pertenece al almacén seleccionado
        const filteredByAlmacen = combined.filter(r =>
            r._tipo === 'PICKING'
                ? r.id_almacen === almacenSel?.id
                : r.id_almacen_origen === almacenSel?.id
        );

        // Deduplicación por ID y Tipo
        const unique = filteredByAlmacen.filter((v, i, a) =>
            a.findIndex(t => (t.id === v.id && t._tipo === v._tipo)) === i
        );

        return unique.sort((a, b) =>
            new Date(b.timestamp_update || b.timestamp_create) - new Date(a.timestamp_update || a.timestamp_create)
        );
    }, [pickings, despachos, almacenSel?.id]);

    const filteredData = useMemo(() => {
        return allRecords.filter(r => {
            const matchesSearch =
                formato8Digitos(r.id).includes(searchTerm) ||
                r.sucursal?.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                r.comedor?.nombre?.toLowerCase().includes(searchTerm.toLowerCase());

            const matchesStatus = activeStatusFilter ? r.estatus_kpi === activeStatusFilter : true;

            return matchesSearch && matchesStatus;
        });
    }, [allRecords, searchTerm, activeStatusFilter]);

    const toggleSelection = (id) => {
        setIdsParaDespacho(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const almacenesFiltrados = useMemo(() => {
        return almacenes.filter(almacen =>
            perfil?.F_ALL === true ? true : (perfil?.ids_almacenes?.includes(almacen.id))
        );
    }, [almacenes, perfil]);

    const guard = renderGuard();
    if (guard) return guard;

    return (
        <div className="p-4 sm:p-8 space-y-2 animate-in fade-in duration-500 bg-slate-50">

            {/* HEADER ESTILO MONITOR */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="p-4 bg-brand-900 rounded-md shadow-xl shadow-brand-900/20 text-white border border-brand-800">
                        <Truck size={28} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tighter leading-none">Gestión de Despachos</h1>
                        <p className="text-sm text-slate-400 italic font-medium mt-1 uppercase tracking-widest">Salida de Camiones y Guías</p>
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

            {/* BARRA DE ACCIONES ESTILO MONITOR */}
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
                        placeholder="Buscar por ID de picking o destino..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-12 pr-6 py-3 bg-white border border-gray-100 rounded-md text-sm font-semibold text-slate-700 outline-none focus:ring-4 focus:ring-brand-accent/10 focus:border-brand-accent transition-all w-full shadow-sm"
                    />
                </div>
            </div>

            {/* KPI */}
            {almacenSel && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-in fade-in zoom-in duration-500">
                    {Object.entries(statusConfig).map(([key, config]) => {
                        const count = allRecords.filter(r => r.estatus_kpi === key).length;
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

            {/* TABLA DE RESULTADOS ESTILO MONITOR */}
            <div className="bg-white rounded-md shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50">
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-gray-100 w-12 text-center">Sel</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-gray-100 whitespace-nowrap">Picking / Fecha / Estado</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-gray-100 whitespace-nowrap">Origen / Destino</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-gray-100 whitespace-nowrap text-center">Rubros</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-gray-100 whitespace-nowrap">Responsable</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-gray-100 text-center whitespace-nowrap">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-300">
                            {loading ? (
                                Array(3).fill(0).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={6} className="px-8 py-10"><div className="h-4 bg-gray-100 rounded w-full"></div></td>
                                    </tr>
                                ))
                            ) : filteredData.length > 0 ? (
                                filteredData.map((record) => {
                                    const isSelected = idsParaDespacho.includes(record.id);
                                    const status = statusConfig[record.estatus_kpi];
                                    return (
                                        <tr
                                            key={record.id}
                                            className={`group transition-all hover:bg-slate-50/80 cursor-pointer ${isSelected ? 'bg-brand-50/30' : ''}`}
                                            onClick={() => record._tipo === 'PICKING' && toggleSelection(record.id)}
                                        >
                                            <td className="px-8 py-6 text-center">
                                                {record._tipo === 'PICKING' ? (
                                                    <div className={`w-6 h-6 rounded-lg border-2 transition-all flex items-center justify-center ${isSelected ? 'bg-brand-900 border-brand-900 shadow-lg shadow-brand-900/30' : 'bg-white border-slate-200'}`}>
                                                        {isSelected && <CheckCircle2 size={14} className="text-white" />}
                                                    </div>
                                                ) : (
                                                    <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-slate-300">
                                                        <CheckCircle2 size={14} />
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex flex-col gap-1.5">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[11px] font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                                                            {record._tipo === 'PICKING' ? <PackageCheck size={10} className="text-slate-400" /> : <Truck size={10} className="text-brand-600" />}
                                                            {record._tipo === 'PICKING' ? 'PK-' : 'GUIA-'}{formato8Digitos(record.id)}
                                                        </span>
                                                        <span className="whitespace-nowrap text-[9px] font-bold text-slate-400 italic">
                                                            {formatDateSystemToDDMMYYYY_HHMMSS(record.timestamp_update || record.timestamp_create)}
                                                        </span>
                                                    </div>
                                                    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest w-fit ${status.color}`}>
                                                        {status.icon}
                                                        {status.label}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400"><Building2 size={18} /></div>
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-black text-slate-800 uppercase tracking-tight leading-none">{record.sucursal?.nombre}</span>
                                                        <span className="text-[9px] font-bold text-brand-600 uppercase tracking-widest mt-1">{record.comedor?.nombre || 'ALMACÉN GENERAL'}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 text-center">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-black text-brand-900">
                                                        {record._tipo === 'PICKING' ? (record.almacen_picking_detalle?.length || 0) : (record.almacen_despacho_detalle?.length || 0)}
                                                    </span>
                                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Rubros</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex flex-col gap-2 scale-90 origin-left">
                                                    <div className="flex flex-col gap-2">
                                                        {/* Si es despacho, mostramos quién hizo el picking primero */}
                                                        {record._tipo === 'DESPACHO' && record.usuario_picking && (
                                                            <ViewUser
                                                                textDisplay="Creado"
                                                                usuario={record.usuario_picking}
                                                                timestamp={record.almacen_despacho_detalle?.[0]?.picking_detalle?.timestamp_procesa}
                                                                formatDate={formatDateSystemToDDMMYYYY_HHMMSS}
                                                            />
                                                        )}

                                                        {/* Responsable de la acción actual (Creación del registro) */}
                                                        <ViewUser
                                                            textDisplay={record._tipo === 'PICKING' ? "Creado por" : "Despacho por"}
                                                            usuario={record.usuario_create}
                                                            timestamp={record.timestamp_create}
                                                            formatDate={formatDateSystemToDDMMYYYY_HHMMSS}
                                                        />

                                                        {record.usuario_procesa && record._tipo === 'PICKING' && (
                                                            <ViewUser textDisplay="Procesado por" usuario={record.usuario_procesa} timestamp={record.timestamp_procesa} formatDate={formatDateSystemToDDMMYYYY_HHMMSS} />
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 text-center">
                                                {record._tipo === 'DESPACHO' && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setDespachoSel(record);
                                                            setShowDetalle(true);

                                                        }}
                                                        className="p-3 bg-white border border-slate-100 text-slate-400 rounded-md hover:bg-brand-900 hover:text-white hover:border-brand-900 transition-all shadow-sm active:scale-95"
                                                    >
                                                        <Eye size={18} />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={6} className="px-8 py-6 text-center">
                                        <div className="flex flex-col items-center opacity-40">
                                            <Calendar size={48} className="mb-4 text-brand-900" />
                                            <p className="text-sm font-bold uppercase tracking-widest">
                                                {!weekStart || !weekEnd
                                                    ? 'Selecciona un rango de semanas para ver los despachos'
                                                    : 'No se encontraron despachos en este rango'}
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* BARRA DE ACCIONES ESTILO MONITOR */}
            {idsParaDespacho.length > 0 && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 animate-in slide-in-from-bottom-8 duration-500">
                    <div className="bg-brand-900 text-white px-10 py-6 rounded-[2.5rem] shadow-2xl shadow-brand-900/40 flex items-center gap-8 border border-brand-800">
                        <div className="flex flex-col">
                            <span className="text-xl font-black leading-none">{idsParaDespacho.length} Pickings</span>
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-300 mt-1">Listos para salida</span>
                        </div>
                        <div className="h-10 w-px bg-brand-800" />
                        <button
                            onClick={() => setShowMesaTrabajo(true)}
                            className="bg-white text-brand-900 px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-brand-50 transition-all active:scale-95 shadow-lg shadow-white/10"
                        >
                            Ir a Mesa de Trabajo
                        </button>
                    </div>
                </div>
            )}

            {/* MODAL DE MESA DE TRABAJO */}
            {showMesaTrabajo && (
                <MesaTrabajoDespachoModal
                    show={showMesaTrabajo}
                    onClose={() => setShowMesaTrabajo(false)}
                    pickingIds={idsParaDespacho}
                    pickingsFullData={pickings.filter(p => idsParaDespacho.includes(p.id))}
                    onSuccess={() => {
                        setShowMesaTrabajo(false);
                        setIdsParaDespacho([]);
                        fetchPickings();
                    }}
                />
            )}
            {/* MODAL DE DETALLE DE DESPACHO */}
            {showDetalle && (
                <DespachoDetalleModal
                    show={showDetalle}
                    onClose={() => {
                        setShowDetalle(false);
                        setDespachoSel(null);
                    }}
                    despacho={despachoSel}
                />
            )}
        </div>
    );
}
