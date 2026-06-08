import { useState, useEffect, useMemo } from 'react';
import { useModulePermissions } from '../../../hooks/useModulePermissions';
import { ChefHat, Package, History, Scale, Plus, Search, Filter, AlertTriangle, CheckCircle2, ArrowDownCircle, ArrowUpCircle, Info, RefreshCw, Warehouse, Building2 } from 'lucide-react';
import { getComedores } from '../../../services/planificacionService';
import { getSaldosCocina, getMovimientosCocina, realizarAjusteCocina } from '../../../services/inventarioCocinaService';
import { formatearFecha, formatDateSystemToDDMMYYYY_HHMMSS, formatDateSystemToDDMMYYYYHHMMSS } from '../../../util/workDate';
import { getDecimalPlaces, formatNumber } from '../../../util/workDecimales';
import ViewUser from '../../../components/user-table/ViewUser';
import HistorialInventarioCocinaModal from './HistorialInventarioCocinaModal';
import AjusteInventarioCocinaModal from './AjusteInventarioCocinaModal';



export default function GestionInventarioCocina() {
    const { perfil, empresaActiva, renderGuard } = useModulePermissions();
    const isSuperAdmin = perfil?.F_ALL === true;

    const [loading, setLoading] = useState(true);
    const [sucursalSel, setSucursalSel] = useState(null);
    const [comedorSel, setComedorSel] = useState(null);
    const [comedores, setComedores] = useState([]);
    const [saldos, setSaldos] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    // Estado para ver historial
    const [showHistory, setShowHistory] = useState(null); // rubroId
    const [movimientos, setMovimientos] = useState([]);
    const [loadingMov, setLoadingMov] = useState(false);

    // Estado para Ajuste
    const [showAjuste, setShowAjuste] = useState(null); // item saldo


    useEffect(() => {
        if (empresaActiva?.id) {
            fetchComedores();
        }
    }, [empresaActiva?.id]);

    useEffect(() => {
        if (comedorSel?.id) {
            fetchSaldos();
        } else {
            setSaldos([]);
        }
    }, [comedorSel?.id]);

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

    const fetchSaldos = async () => {
        setLoading(true);
        try {
            const data = await getSaldosCocina(comedorSel.id);
            setSaldos(data || []);
        } catch (error) {
            console.error("Error al cargar saldos:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchHistorial = async (rubroId, productoId = null) => {
        setLoadingMov(true);
        try {
            const data = await getMovimientosCocina(comedorSel.id, rubroId, productoId);
            setMovimientos(data || []);
        } catch (error) {
            console.error("Error al cargar historial:", error);
        } finally {
            setLoadingMov(false);
        }
    };

    const handleAjuste = async (values) => {

        try {
            setLoading(true);
            const cant = Number(values.cantidad);
            await realizarAjusteCocina({
                id_empresa: empresaActiva.id,
                id_comedor: comedorSel.id,
                id_rubro: showAjuste.id_rubro,
                id_producto: showAjuste.id_producto || null,
                cantidad: values.tipo === 'AJUSTE_NEG' ? -Math.abs(cant) : Math.abs(cant),
                tipo_movimiento: values.tipo,
                observaciones: values.observaciones,
                id_usuario: perfil.id
            });
            setShowAjuste(null);
            await fetchSaldos();
        } catch (error) {
            console.error("Error al realizar ajuste:", error);
            alert("Error al procesar el ajuste");
        } finally {
            setLoading(false);
        }
    };

    const filteredSaldos = useMemo(() => {
        return saldos.filter(s =>
            s.rubro?.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.rubro?.categoria?.nombre.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [saldos, searchTerm]);

    const kpis = useMemo(() => {
        return {
            totalItems: saldos.length,
            sinStock: saldos.filter(s => Number(s.cantidad) <= 0).length,
            conStock: saldos.filter(s => Number(s.cantidad) > 0).length,
            negativos: saldos.filter(s => Number(s.cantidad) < 0).length
        };
    }, [saldos]);

    const guard = renderGuard();
    if (guard) return guard;

    return (
        <div className="p-4 space-y-2 animate-in fade-in duration-500 bg-slate-50">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-2">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-brand-50 rounded-xl text-brand-900 shadow-sm">
                        <Package size={28} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 tracking-tight leading-none">Inventario de Cocina</h1>
                        <p className="text-slate-400 text-[10px] uppercase font-black tracking-widest mt-1 italic">Existencias en despensa de comedor</p>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row items-start md:items-center gap-4 relative z-10">
                    <button
                        onClick={fetchSaldos}
                        disabled={!comedorSel || loading}
                        className="p-3 bg-white border border-slate-100 text-slate-400 rounded-md hover:text-brand-900 hover:border-brand-200 transition-all active:rotate-180 duration-500 shadow-sm"
                    >
                        <RefreshCw size={18} />
                    </button>

                    <div className="flex flex-col w-auto items-center gap-1 bg-white p-2 px-4 rounded-md border border-gray-100 shadow-sm shrink-0">
                        <div className="flex items-center gap-2 pr-4 border-r border-gray-100">
                            <Building2 size={18} className="text-brand-600" />
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase text-slate-800 leading-none">Sucursal</span>
                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Ubicación</span>
                            </div>
                        </div>
                        <select
                            value={sucursalSel?.id || ''}
                            onChange={(e) => {
                                const suc = sucursalesDisponibles.find(s => s.id?.toString() === e.target.value);
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
                            <ChefHat size={18} className="text-brand-600" />
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase text-slate-800 leading-none">Comedor</span>
                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Cocina</span>
                            </div>
                        </div>
                        <select
                            value={comedorSel?.id || ''}
                            disabled={!sucursalSel}
                            onChange={(e) => {
                                const com = comedoresFiltrados.find(c => c.id?.toString() === e.target.value);
                                setComedorSel(com || null);
                            }}
                            className="text-[10px] font-black text-brand-900 uppercase tracking-widest bg-slate-50 px-2 py-1 rounded-lg border border-transparent hover:border-brand-200 transition-all outline-none min-w-[150px] disabled:opacity-50"
                        >
                            <option value="">-- SELECCIONE --</option>
                            {comedoresFiltrados.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* KPIs */}
            {comedorSel && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <KPICard label="Total Rubros" value={kpis.totalItems} icon={<Package size={14} />} color="text-slate-600" />
                    <KPICard label="Con Existencia" value={kpis.conStock} icon={<CheckCircle2 size={14} />} color="text-emerald-600" />
                    <KPICard label="Sin Existencia" value={kpis.sinStock} icon={<AlertTriangle size={14} />} color="text-amber-600" />
                    <KPICard label="Saldos Negativos" value={kpis.negativos} icon={<Info size={14} />} color="text-red-600" />
                </div>
            )}

            {/* Buscador */}
            {comedorSel && (
                <div className="bg-white p-3 rounded-md border border-gray-100 shadow-sm flex items-center gap-4">
                    <div className="flex-1 relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                        <input
                            type="text"
                            placeholder="Buscar rubro o categoría..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-transparent rounded-lg text-[11px] font-bold text-slate-700 outline-none focus:border-brand-200 transition-all"
                        />
                    </div>
                </div>
            )}

            {/* Tabla Principal */}
            {!comedorSel ? (
                <EmptyState icon={<ChefHat size={40} />} text="Seleccione un comedor para ver inventario" />
            ) : loading ? (
                <div className="bg-white rounded-md p-20 flex flex-col items-center justify-center border border-gray-100 shadow-sm">
                    <div className="w-10 h-10 border-4 border-brand-900/10 border-t-brand-900 rounded-full animate-spin mb-4" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sincronizando Despensa...</p>
                </div>
            ) : (
                <div className="bg-white rounded-md shadow-sm border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/50 border-b border-gray-100">
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Rubro / Categoría</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Existencia Actual</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Última Act.</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-300">
                                {filteredSaldos.length > 0 ? (
                                    filteredSaldos.map(item => {
                                        const nombreDisplay = item.id_producto && item.producto
                                            ? `${item.rubro?.nombre} - ${item.producto.marca?.nombre || ''} · ${item.producto.variedad || ''}`
                                            : item.rubro?.nombre;
                                        return (
                                            <tr key={item.id} className="hover:bg-slate-50/80 transition-all group">
                                                <td className="px-6 py-1">
                                                    <div className="flex flex-col">
                                                        <span className="text-[11px] font-black text-slate-700 uppercase tracking-tight">{nombreDisplay}</span>
                                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest italic">{item.rubro?.categoria?.nombre}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-1 text-right">
                                                    <div className="flex flex-row justify-end items-center">
                                                        <span className={`text-sm font-black tabular-nums ${Number(item.cantidad) < 0 ? 'text-red-500 animate-pulse' : Number(item.cantidad) === 0 ? 'text-amber-500' : 'text-brand-900'}`}>
                                                            {formatNumber(item.cantidad, getDecimalPlaces(Number(item.cantidad)))}
                                                        </span>
                                                        <span className="px-2 py-1 bg-slate-100 rounded text-[10px] font-black text-slate-500 uppercase">
                                                            {item.rubro?.unidad?.abreviatura}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-1">
                                                    <div className="flex flex-col gap-1">
                                                        <span className="text-[9px] font-bold text-slate-400 uppercase">{formatDateSystemToDDMMYYYYHHMMSS(item.timestamp_update)}</span>
                                                        <ViewUser usuario={item.usuario_update} size="small" />
                                                    </div>
                                                </td>
                                                <td className="px-6 py-1 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => { setShowHistory(item.id_rubro); fetchHistorial(item.id_rubro, item.id_producto); }}
                                                            className="p-2 bg-slate-50 text-slate-400 rounded-md hover:bg-brand-50 hover:text-brand-900 transition-all"
                                                            title="Ver Historial"
                                                        >
                                                            <History size={16} />
                                                        </button>
                                                        <button
                                                            onClick={() => setShowAjuste(item)}
                                                            className="p-2 bg-brand-50 text-brand-900 rounded-md hover:bg-brand-900 hover:text-white transition-all shadow-sm"
                                                            title="Ajuste de Inventario"
                                                        >
                                                            <Scale size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-20 text-center opacity-30">
                                            <p className="text-[10px] font-black uppercase tracking-widest">Sin resultados</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <HistorialInventarioCocinaModal
                isOpen={!!showHistory}
                onClose={() => setShowHistory(null)}
                movimientos={movimientos}
                loading={loadingMov}
            />

            <AjusteInventarioCocinaModal
                isOpen={!!showAjuste}
                onClose={() => setShowAjuste(null)}
                item={showAjuste}
                onConfirm={handleAjuste}
                loading={loading}
            />
        </div>
    );
}

function KPICard({ label, value, icon, color }) {
    return (
        <div className="bg-white p-4 rounded-md border border-gray-100 shadow-sm flex items-center justify-between group hover:border-brand-200 transition-all">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-slate-50 ${color}`}>
                    {icon}
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {label}
                </span>
            </div>
            <span className={`text-xl font-black tabular-nums ${color}`}>
                {value}
            </span>
        </div>
    );
}

function EmptyState({ icon, text }) {
    return (
        <div className="bg-white rounded-md p-20 flex flex-col items-center justify-center border border-dashed border-slate-200 animate-in fade-in zoom-in duration-700">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 mb-4 shadow-inner">
                {icon}
            </div>
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{text}</h3>
        </div>
    );
}
