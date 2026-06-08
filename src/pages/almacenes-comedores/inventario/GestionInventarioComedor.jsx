import React, { useState, useEffect, useMemo } from 'react';
import { Warehouse, Search, PackageSearch, Ban, Edit3, Lock, Unlock, AlertTriangle, ShieldAlert, BadgeDollarSign, Building2, Filter } from 'lucide-react';
import { useModulePermissions } from '../../../hooks/useModulePermissions';
import { getComedores } from '../../../services/planificacionService';
import { getInventarioComedor, ajustarInventarioComedor, bloquearLoteComedor } from '../../../services/inventarioService';
import { formatearFecha, formatDateSystemToDDMMYYYY_HHMMSS } from '../../../util/workDate';
import BloqueoLoteModal from '../../almacenes-principales/inventario/BloqueoLoteModal';
import AjusteInventarioModal from '../../almacenes-principales/inventario/AjusteInventarioModal';
import { getDesgloseLogistico, getEquivalenciasLogisticas, esLoteVencido, getExpirationBadge, getEquivalenciasCostos } from '../../../util/auxiliares';
import { getDecimalPlaces, formatNumber } from '../../../util/workDecimales';

export default function GestionInventarioComedor() {
    const { perfil, empresaActiva, renderGuard } = useModulePermissions();

    const [comedores, setComedores] = useState([]);
    const [sucursalSel, setSucursalSel] = useState(null);
    const [comedorSel, setComedorSel] = useState(null);

    const [inventario, setInventario] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Modales de Acción
    const [loteParaBloquear, setLoteParaBloquear] = useState(null);
    const [loteParaAjuste, setLoteParaAjuste] = useState(null);
    const [loadingAction, setLoadingAction] = useState(false);

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
        if (comedorSel) {
            fetchInventario();
        } else {
            setInventario([]);
        }
    }, [comedorSel]);

    const fetchInventario = async () => {
        setLoading(true);
        try {
            const data = await getInventarioComedor(comedorSel.id);
            setInventario(data);
        } catch (error) {
            console.error(error);
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

    const filteredInventario = useMemo(() => {
        return inventario.filter(item => {
            const searchLower = searchTerm.toLowerCase();
            return (
                item.producto?.rubro?.nombre?.toLowerCase().includes(searchLower) ||
                item.producto?.marca?.nombre?.toLowerCase().includes(searchLower) ||
                item.lote?.toLowerCase().includes(searchLower)
            );
        });
    }, [inventario, searchTerm]);

    const groupedInventario = useMemo(() => {
        const sorted = [...filteredInventario].sort((a, b) => {
            const nameA = a.producto?.rubro?.nombre || '';
            const nameB = b.producto?.rubro?.nombre || '';
            return nameA.localeCompare(nameB);
        });

        const grouped = [];
        let currentRubro = null;
        let currentGroupStartIndex = -1;

        sorted.forEach(item => {
            const clonedItem = { ...item };
            const rubroName = clonedItem.producto?.rubro?.nombre;

            if (rubroName !== currentRubro) {
                currentRubro = rubroName;
                currentGroupStartIndex = grouped.length;
                clonedItem.rowSpan = 1;
                clonedItem.isFirstOfGroup = true;
            } else {
                grouped[currentGroupStartIndex].rowSpan += 1;
                clonedItem.isFirstOfGroup = false;
                clonedItem.rowSpan = 0;
            }
            grouped.push(clonedItem);
        });

        return grouped;
    }, [filteredInventario]);

    const kpis = useMemo(() => {
        let totalValor = 0;
        let bloqueados = 0;
        let vencidos = 0;
        const rubrosUnicos = new Set();

        filteredInventario.forEach(item => {
            totalValor += Number(item.cantidad_actual) * Number(item.costo_unidad_base);
            if (item.is_bloqueado) bloqueados++;
            if (esLoteVencido(item.fecha_vencimiento)) vencidos++;
            if (item.producto?.rubro?.nombre) {
                rubrosUnicos.add(item.producto.rubro.nombre);
            }
        });

        return {
            totalValor,
            bloqueados,
            vencidos,
            totalLotes: filteredInventario.length,
            totalRubros: rubrosUnicos.size
        };
    }, [filteredInventario]);

    const handleBloqueoConfirm = async (motivo, is_bloqueado) => {
        const res = await bloquearLoteComedor(loteParaBloquear.id, is_bloqueado, motivo, perfil.id);
        if (res.success) {
            setLoteParaBloquear(null);
            fetchInventario();
        } else {
            alert(res.message);
        }
    };

    const handleAjusteConfirm = async (nueva_cantidad, motivo) => {
        try {
            setLoadingAction(true);
            const res = await ajustarInventarioComedor(loteParaAjuste.id, nueva_cantidad, motivo, perfil.id);
            if (res.success) {
                setLoteParaAjuste(null);
                fetchInventario();
            } else {
                alert(res.message);
            }
        } finally {
            setLoadingAction(false);
        }
    };

    const guard = renderGuard();
    if (guard) return guard;

    return (
        <div className="p-4 sm:p-8 space-y-2 animate-in fade-in duration-500 bg-slate-50">

            {/* HEADER */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="p-4 bg-brand-900 rounded-md shadow-xl shadow-brand-900/20 text-white border border-brand-800">
                        <Warehouse size={28} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tighter leading-none">Inventario Comedor</h1>
                        <p className="text-sm text-slate-400 italic font-medium mt-1 uppercase tracking-widest">Existencias en Cocina y Almacén Operativo</p>
                    </div>
                </div>

                {/* SELECTORES DE CONTEXTO (Diseño Premium Unificado) */}
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
                            <Warehouse size={18} className="text-brand-600" />
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

            {!comedorSel ? (
                <div className="flex flex-col items-center justify-center py-32 gap-6 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm mt-8">
                    <div className="w-24 h-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center text-slate-300">
                        <PackageSearch size={48} />
                    </div>
                    <div className="text-center">
                        <p className="text-lg font-black text-slate-800 uppercase tracking-tighter">Seleccione un Comedor</p>
                        <p className="text-sm text-slate-400 font-medium italic">Elija una sucursal y comedor para ver su inventario actual</p>
                    </div>
                </div>
            ) : (
                <>
                    {/* KPIs */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white p-6 rounded-[1.5rem] border border-brand-100 shadow-sm flex flex-col justify-between">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2.5 bg-brand-50 text-brand-600 rounded-xl"><PackageSearch size={20} /></div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Rubros / Lotes</span>
                            </div>
                            <div className="flex items-end gap-3">
                                <div className="flex flex-col">
                                    <span className="text-3xl font-black text-slate-800 tabular-nums leading-none">{kpis.totalRubros}</span>
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Rubros</span>
                                </div>
                                <div className="h-8 w-px bg-slate-200 mb-1" />
                                <div className="flex flex-col">
                                    <span className="text-2xl font-black text-slate-600 tabular-nums leading-none">{kpis.totalLotes}</span>
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Lotes</span>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-[1.5rem] border border-emerald-100 shadow-sm shadow-emerald-500/5 flex flex-col justify-between">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl"><BadgeDollarSign size={20} /></div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Valor Inventario</span>
                            </div>
                            <span className="text-2xl font-black text-emerald-600 tabular-nums">${formatNumber(kpis.totalValor, 2)}</span>
                        </div>
                        <div className="bg-white p-6 rounded-[1.5rem] border border-amber-100 shadow-sm shadow-amber-500/5 flex flex-col justify-between">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl"><AlertTriangle size={20} /></div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Lotes Vencidos</span>
                            </div>
                            <span className="text-3xl font-black text-amber-600 tabular-nums">{kpis.vencidos}</span>
                        </div>
                        <div className="bg-white p-6 rounded-[1.5rem] border border-red-100 shadow-sm shadow-red-500/5 flex flex-col justify-between">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2.5 bg-red-50 text-red-600 rounded-xl"><Ban size={20} /></div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Lotes Bloqueados</span>
                            </div>
                            <span className="text-3xl font-black text-red-600 tabular-nums">{kpis.bloqueados}</span>
                        </div>
                    </div>

                    {/* Buscador */}
                    <div className="flex-1 group/search relative w-full">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within/search:text-brand-500 transition-colors" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar por rubro, marca o lote..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-12 pr-6 py-3.5 bg-white border border-gray-100 rounded-md text-sm font-semibold text-slate-700 outline-none focus:ring-4 focus:ring-brand-accent/10 focus:border-brand-accent transition-all w-full shadow-sm"
                        />
                    </div>

                    {/* Tabla */}
                    <div className="bg-white rounded-md shadow-xl shadow-slate-200/40 border border-slate-100 overflow-hidden">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-32 gap-4">
                                <div className="w-12 h-12 border-4 border-brand-900/10 border-t-brand-900 rounded-full animate-spin" />
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Consultando Inventario...</p>
                            </div>
                        ) : groupedInventario.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50/80 border-b border-slate-100">
                                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Rubro / Categoría</th>
                                            <th className="px-2 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Detalles del Producto</th>
                                            <th className="px-2 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Stock (Empaques/Volumen)</th>
                                            <th className="px-2 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Costo Unitario</th>
                                            <th className="px-2 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Valor Total</th>
                                            <th className="px-2 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Estatus</th>
                                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-300">
                                        {groupedInventario.map(item => {
                                            const isBloqueado = item.is_bloqueado;

                                            const logistica = item.producto?.logistica || [];
                                            const baseLog = logistica.find(l => l.es_base) || { factor: 1, presentacion: { nombre: 'UND' } };
                                            const unidadAbrev = item.producto?.rubro?.unidad?.abreviatura || 'U';

                                            return (
                                                <tr key={item.id} className={`group transition-all hover:bg-slate-50/50 ${isBloqueado ? 'bg-red-50/20' : ''}`}>
                                                    {item.isFirstOfGroup && (
                                                        <td className="px-8 py-1 border-r border-slate-100 bg-white group-hover:bg-transparent align-top" rowSpan={item.rowSpan}>
                                                            <div className="flex flex-col gap-0.5 sticky top-5">
                                                                <span className="text-xs font-black text-slate-800 uppercase tracking-tight">{item.producto?.rubro?.nombre}</span>
                                                                <span className="text-[9px] font-bold text-brand-600 uppercase tracking-widest">{item.producto?.rubro?.categoria?.nombre}</span>
                                                            </div>
                                                        </td>
                                                    )}
                                                    <td className="px-2 py-3">
                                                        <div className="flex flex-col items-start gap-1">
                                                            <div className="flex flex-col leading-tight">
                                                                <span className="text-xs font-black text-slate-700 uppercase tracking-tight">
                                                                    {item.producto?.marca?.nombre} {item.producto?.variedad}
                                                                </span>
                                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">
                                                                    {baseLog.presentacion?.nombre || 'SIN EMPAQUE'}
                                                                </span>
                                                            </div>

                                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                                                                <div className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                                                                    <span className="text-[9px] font-black text-slate-500 uppercase">LOTE:</span>
                                                                    <span className="text-[10px] font-black text-slate-800">{item.lote || 'N/A'}</span>
                                                                </div>
                                                                {item.fecha_vencimiento && (
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                                                                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">FV:</span>
                                                                            <span className="text-[10px] font-black text-slate-800 tracking-tighter">{formatearFecha(item.fecha_vencimiento)}</span>
                                                                        </div>
                                                                        {getExpirationBadge(item.fecha_vencimiento)}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-2 py-3 text-right">
                                                        <div className="flex flex-col items-start gap-1">
                                                            {getEquivalenciasLogisticas(item.cantidad_actual, logistica, unidadAbrev).map((equiv, idx) => (
                                                                <div key={idx} className={`grid grid-cols-2 gap-x-2 w-max ${equiv.isBase ? 'border-t border-slate-100 opacity-60' : ''}`}>
                                                                    <span className={`text-xs font-black tabular-nums text-right ${equiv.isBase ? 'text-slate-500' : 'text-slate-800'}`}>
                                                                        {equiv.cantidad}
                                                                    </span>
                                                                    <span className="text-[10px] font-black uppercase text-left w-16 text-slate-400 whitespace-nowrap">
                                                                        {equiv.unidad}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </td>
                                                    <td className="px-2 py-3 text-right">
                                                        <div className="flex flex-col items-end gap-1">
                                                            {getEquivalenciasCostos(item.costo_unidad_base, item.cantidad_actual, logistica, unidadAbrev).map((equiv, idx) => (
                                                                <div key={idx} className={`grid grid-cols-2 gap-x-2 w-max ${equiv.isBase ? 'border-t border-slate-100 opacity-60' : ''}`}>
                                                                    <span className={`text-xs font-black tabular-nums text-right ${equiv.isBase ? 'text-slate-500' : 'text-slate-800'}`}>
                                                                        $ {equiv.costo}
                                                                    </span>
                                                                    <span className="text-[10px] font-black uppercase text-left w-16 text-slate-400 whitespace-nowrap">
                                                                        / {equiv.unidad}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </td>
                                                    <td className="px-2 py-1 text-right">
                                                        <span className="text-sm font-bold text-slate-800 tabular-nums">$ {formatNumber(Number(item.cantidad_actual) * Number(item.costo_unidad_base), getDecimalPlaces(Number(item.cantidad_actual) * Number(item.costo_unidad_base)))}</span>
                                                    </td>
                                                    <td className="px-2 py-1 text-center">
                                                        <div className="flex flex-col items-center gap-1">
                                                            {isBloqueado ? (
                                                                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-red-50 text-red-600 border border-red-100">
                                                                    <Lock size={10} /> Cuarentena
                                                                </span>
                                                            ) : (
                                                                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-600 border border-emerald-100">
                                                                    <Unlock size={10} /> Vigente
                                                                </span>
                                                            )}
                                                            {isBloqueado && item.usuario_bloqueo && (
                                                                <span className="text-[8px] text-slate-400 italic">Por: {item.usuario_bloqueo.nombres.split(' ')[0]}</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-1">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <button
                                                                onClick={() => setLoteParaAjuste(item)}
                                                                className="p-2 text-slate-400 hover:bg-amber-50 hover:text-amber-600 rounded-xl transition-all"
                                                                title="Ajuste Manual"
                                                            >
                                                                <Edit3 size={18} />
                                                            </button>
                                                            <button
                                                                onClick={() => setLoteParaBloquear(item)}
                                                                className={`p-2 rounded-xl transition-all ${isBloqueado ? 'text-emerald-500 hover:bg-emerald-50' : 'text-slate-400 hover:bg-red-50 hover:text-red-500'}`}
                                                                title={isBloqueado ? 'Desbloquear Lote' : 'Bloquear Lote'}
                                                            >
                                                                {isBloqueado ? <Unlock size={18} /> : <Lock size={18} />}
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-32 gap-6 bg-white">
                                <div className="w-24 h-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center text-slate-200">
                                    <PackageSearch size={48} />
                                </div>
                                <div className="text-center">
                                    <p className="text-lg font-black text-slate-800 uppercase tracking-tighter">Inventario Vacío</p>
                                    <p className="text-sm text-slate-400 font-medium italic">No hay productos en este comedor con los filtros actuales</p>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* Render Modales */}
            {loteParaBloquear && (
                <BloqueoLoteModal
                    lote={loteParaBloquear}
                    onClose={() => setLoteParaBloquear(null)}
                    onConfirm={handleBloqueoConfirm}
                />
            )}

            {loteParaAjuste && (
                <AjusteInventarioModal
                    lote={loteParaAjuste}
                    onClose={() => setLoteParaAjuste(null)}
                    onConfirm={handleAjusteConfirm}
                    loading={loadingAction}
                />
            )}
        </div>
    );
}
