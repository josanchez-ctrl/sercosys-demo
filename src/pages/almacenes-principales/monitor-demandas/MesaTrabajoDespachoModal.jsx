import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, PackageSearch, AlertCircle, Loader2, Building2, ChevronRight, Truck, Warehouse, CheckCircle2, Box, Info } from 'lucide-react';
import { getDatosMesaTrabajo, subscribeToInventario, subscribeToPickings } from '../../../services/monitorDemandasService';
import { guardarPickingMasivo, getCommittedQuantities } from '../../../services/pickingService';
import { useModulePermissions } from '../../../hooks/useModulePermissions';
import { Now } from '../../../services/nowService';
import { formato8Digitos, formatDateSystemToDDMMYYYY_HHMMSS, formatearFecha } from '../../../util/workDate';

export default function MesaTrabajoDespachoModal({ ids_requisiciones, id_almacen, onClose }) {
    const { perfil, empresaActiva } = useModulePermissions();
    const [loading, setLoading] = useState(true);
    const [confirming, setConfirming] = useState(false);
    const [data, setData] = useState({ reqs: [], inventario: [] });
    const [committedQuantities, setCommittedQuantities] = useState([]);
    const [committedStock, setCommittedStock] = useState({}); // { "idProd_lote": pesoEnBase }
    const [activeDestinoId, setActiveDestinoId] = useState(null);
    const [activeTab, setActiveTab] = useState('ASIGNACION');

    const [asignaciones, setAsignaciones] = useState({});
    const [presentacionesSeleccionadas, setPresentacionesSeleccionadas] = useState({}); // { id_inv: id_codigos }

    const getExpirationStatus = (fecha) => {
        if (!fecha) return { color: 'text-slate-400', label: 'Sin Fecha', icon: null };
        const hoy = new Date();
        const vencimiento = new Date(fecha);
        const diffTime = vencimiento - hoy;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays <= 0) return { color: 'text-red-600 font-black animate-pulse', label: '¡VENCIDO!', bg: 'bg-red-50' };
        if (diffDays <= 15) return { color: 'text-red-500 font-bold', label: `Vence en ${diffDays} d`, bg: 'bg-red-50/50' };
        if (diffDays <= 30) return { color: 'text-amber-600 font-bold', label: `Vence en ${diffDays} d`, bg: 'bg-amber-50/50' };
        return { color: 'text-slate-500', label: formatearFecha(fecha), bg: 'bg-slate-50' };
    };

    // Función vital: Calcula la deuda REAL de un item (Solicitado - Despachado - Comprometido)
    const getRealPending = (item) => {
        const basePending = Number(item.cantidad_solicitada) - Number(item.cantidad_despachada || 0);
        const committed = committedQuantities
            .filter(cq => cq.id_requisicion_detalle === item.id)
            .reduce((acc, curr) => acc + (Number(curr.cantidad) * Number(curr.factor || curr.producto?.factor || 1)), 0);
        return Math.max(0, basePending - committed);
    };

    useEffect(() => {
        cargarDatos();
    }, [ids_requisiciones, id_almacen]);

    useEffect(() => {
        if (!id_almacen) return;
        const channel = subscribeToInventario(id_almacen, (payload) => {
            setData(prev => {
                const newInv = [...prev.inventario];
                const index = newInv.findIndex(i => i.id === payload.new.id);
                if (index !== -1) {
                    newInv[index] = { ...newInv[index], cantidad_actual: payload.new.cantidad_actual };
                }
                return { ...prev, inventario: newInv };
            });
        });
        return () => { channel.unsubscribe(); };
    }, [id_almacen]);

    const cargarDatos = async () => {
        setLoading(true);
        try {
            const [res, committed, cStock] = await Promise.all([
                getDatosMesaTrabajo(ids_requisiciones, id_almacen),
                getCommittedQuantities(ids_requisiciones),
                import('../../../services/pickingService').then(m => m.getCommittedStockByAlmacen(id_almacen))
            ]);
            setCommittedQuantities(committed);
            setCommittedStock(cStock);
            setData(res);
            const grouped = agruparPorDestino(res.reqs);
            if (Object.keys(grouped).length > 0) {
                setActiveDestinoId(Object.keys(grouped)[0]);
            }
            // Sugerencia FEFO eliminada a petición del usuario para evitar problemas de decimales
        } catch (error) {
            console.error("Error cargando mesa de trabajo:", error);
        } finally {
            setLoading(false);
        }
    };

    const agruparPorDestino = (reqs) => {
        const grupos = {};
        reqs.forEach(req => {
            const key = `${req.id_sucursal}_${req.id_comedor || 'N/A'}`;
            if (!grupos[key]) {
                grupos[key] = {
                    id_sucursal: req.id_sucursal,
                    id_comedor: req.id_comedor,
                    nombre_sucursal: req.sucursal?.nombre,
                    nombre_comedor: req.comedor?.nombre,
                    requisiciones: [],
                    total_items: 0
                };
            }
            grupos[key].requisiciones.push(req);
            grupos[key].total_items += req.detalle?.length || 0;
        });
        return grupos;
    };

    const generarSugerenciaFEFO = () => {
        // Función desactivada para permitir carga manual
        return;
    };

    const handleConfirmar = async (estatus = 'PENDIENTE') => {
        if (!perfil?.id || !empresaActiva?.id) return;
        const hasAsignaciones = Object.values(asignaciones).some(dest =>
            Object.values(dest).some(qty => qty > 0)
        );
        if (!hasAsignaciones) {
            alert("No hay insumos asignados para generar pickings.");
            return;
        }
        setConfirming(true);
        try {
            const pickingsParaGuardar = Object.entries(asignaciones).map(([destinoKey, items]) => {
                const dest = destinosAgrupados[destinoKey];
                if (!dest) return null;

                const pendingItems = dest.requisiciones.flatMap(r =>
                    (r.detalle || []).filter(d => d.estatus_item !== 'ANULADO' && (Number(d.cantidad_solicitada) - Number(d.cantidad_despachada || 0)) > 0.001)
                ).map(d => ({
                    ...d,
                    pendiente: Number(d.cantidad_solicitada) - Number(d.cantidad_despachada || 0)
                }));

                const explodedItems = [];
                const localAsignaciones = { ...items };

                Object.keys(localAsignaciones).forEach(id_inv => {
                    const qtyAsignadaPres = Number(localAsignaciones[id_inv]);
                    if (qtyAsignadaPres <= 0) return;

                    const loteData = data.inventario.find(i => i.id == id_inv);
                    const rubroId = loteData.producto?.id_rubro;
                    const presSelId = presentacionesSeleccionadas[id_inv];
                    const presData = loteData.presentaciones?.find(p => p.id === presSelId) || loteData.presentaciones?.find(p => p.es_base);

                    const presFactor = Number(presData?.factor || 1);
                    const isFraccionable = loteData.producto?.rubro?.tipo_fraccionamiento === 'SIEMPRE';

                    let remainingWeightFromUser = qtyAsignadaPres * presFactor;
                    const targetReqLines = pendingItems.filter(pi => pi.id_rubro === rubroId);

                    // Distribuir lo asignado entre las requisiciones
                    for (const reqLine of targetReqLines) {
                        if (remainingWeightFromUser <= 0.001) break;
                        if (reqLine.pendiente <= 0) continue;

                        let weightToTake;
                        if (isFraccionable) {
                            weightToTake = Math.min(reqLine.pendiente, remainingWeightFromUser);
                        } else {
                            // Si NO es fraccionable, tomamos unidades ENTERAS de la presentación
                            const unitsNeeded = Math.ceil(reqLine.pendiente / presFactor);
                            const unitsAvailable = Math.floor((remainingWeightFromUser + 0.001) / presFactor);
                            const unitsToTake = Math.min(unitsNeeded, unitsAvailable);
                            weightToTake = unitsToTake * presFactor;
                        }

                        if (weightToTake > 0) {
                            const unitsToTake = weightToTake / presFactor;
                            explodedItems.push({
                                id_producto: loteData.id_producto,
                                cantidad: isFraccionable ? unitsToTake : Math.round(unitsToTake),
                                lote: loteData.lote,
                                factor: presFactor,
                                id_presentacion_logistica: presData?.id,
                                fecha_vencimiento: loteData.fecha_vencimiento,
                                id_requisicion_detalle: reqLine.id,
                                costo_unidad_base: loteData.costo_unidad_base
                            });

                            remainingWeightFromUser -= weightToTake;
                            reqLine.pendiente -= weightToTake;
                        }
                    }

                    // Si después de repartir en las requisiciones aún queda peso asignado (Excedente)
                    if (remainingWeightFromUser > 0.001) {
                        const unitsSobrantes = remainingWeightFromUser / presFactor;
                        explodedItems.push({
                            id_producto: loteData.id_producto,
                            cantidad: isFraccionable ? unitsSobrantes : Math.round(unitsSobrantes),
                            lote: loteData.lote,
                            factor: presFactor,
                            id_presentacion_logistica: presData?.id,
                            fecha_vencimiento: loteData.fecha_vencimiento,
                            id_requisicion_detalle: null,
                            costo_unidad_base: loteData.costo_unidad_base
                        });
                    }
                });

                if (explodedItems.length === 0) return null;

                return {
                    id_sucursal: dest.id_sucursal,
                    id_comedor: dest.id_comedor,
                    ids_requisiciones: dest.requisiciones.map(r => r.id),
                    items: explodedItems,
                    estatus: estatus
                };
            }).filter(Boolean);

            const result = await guardarPickingMasivo(empresaActiva.id, id_almacen, perfil.id, pickingsParaGuardar);
            if (result.success) { onClose(); } else { alert("Error guardando picking: " + result.message); }
        } catch (error) {
            console.error("Error confirmando picking:", error);
            alert("Ocurrió un error inesperado al procesar el picking.");
        } finally { setConfirming(false); }
    };

    const handleAsignacionChange = (destinoKey, id_inventario, valor) => {
        let num = Math.max(0, Number(valor));
        const itemInv = data.inventario.find(i => i.id === id_inventario);
        if (!itemInv) return;

        const presSelId = presentacionesSeleccionadas[id_inventario];
        const presData = itemInv.presentaciones?.find(p => p.id === presSelId) || itemInv.presentaciones?.find(p => p.es_base);
        const presFactor = Number(presData?.factor || 1);

        const tipoFrac = itemInv.producto?.rubro?.tipo_fraccionamiento || 'SOLO_EJECUCION';

        if (presFactor > 1 || tipoFrac !== 'SIEMPRE') {
            num = Math.round(num);
        }

        const totalAsignadoOtrosEnBase = Object.entries(asignaciones).reduce((acc, [key, items]) => {
            if (key === destinoKey) return acc;
            return acc + Object.entries(items).reduce((subAcc, [idInv, qty]) => {
                const lote = data.inventario.find(i => i.id == idInv);
                const pId = presentacionesSeleccionadas[idInv];
                const p = lote?.presentaciones?.find(pres => pres.id === pId) || lote?.presentaciones?.find(pres => pres.es_base);
                return subAcc + (Number(qty) * Number(p?.factor || 1));
            }, 0);
        }, 0);

        const stockLibreEnBase = Math.max(0, Number(itemInv.cantidad_actual) - totalAsignadoOtrosEnBase);
        const stockLibreEnPres = stockLibreEnBase / presFactor;

        if (num > stockLibreEnPres) {
            const cleanedStock = Math.round(stockLibreEnPres * 10000) / 10000;
            num = (tipoFrac === 'SIEMPRE') ? cleanedStock : Math.round(cleanedStock);
        }

        setAsignaciones(prev => ({
            ...prev,
            [destinoKey]: { ...prev[destinoKey], [id_inventario]: num }
        }));
    };

    const destinosAgrupados = useMemo(() => agruparPorDestino(data.reqs), [data.reqs]);
    const destinoActivo = destinosAgrupados[activeDestinoId];

    const rubrosDelDestinoActivo = useMemo(() => {
        if (!destinoActivo) return [];
        const map = {};
        destinoActivo.requisiciones.forEach(r => {
            r.detalle.forEach(item => {
                const realPending = getRealPending(item);
                if (realPending > 0) {
                    if (!map[item.id_rubro]) {
                        map[item.id_rubro] = { id_rubro: item.id_rubro, rubro: item.rubro, total_solicitado: 0 };
                    }
                    map[item.id_rubro].total_solicitado += realPending;
                }
            });
        });
        return Object.values(map);
    }, [destinoActivo, committedQuantities]);

    const analisisNecesidades = useMemo(() => {
        const globalRubros = {};
        const comedoresList = [];
        data.reqs.forEach(req => {
            const comedorKey = `${req.sucursal?.nombre} - ${req.comedor?.nombre}`;
            if (!comedoresList.includes(comedorKey)) comedoresList.push(comedorKey);
            req.detalle.forEach(item => {
                const realPending = getRealPending(item);
                if (realPending > 0) {
                    const rubroId = item.id_rubro;
                    if (!globalRubros[rubroId]) {
                        globalRubros[rubroId] = { rubro: item.rubro, solicitudes: {}, total_solicitado: 0 };
                    }
                    globalRubros[rubroId].solicitudes[comedorKey] = (globalRubros[rubroId].solicitudes[comedorKey] || 0) + realPending;
                    globalRubros[rubroId].total_solicitado += realPending;
                }
            });
        });
        const reporte = Object.values(globalRubros).map(r => {
            const stockRubro = data.inventario.filter(inv => inv.producto?.id_rubro === r.rubro.id).reduce((acc, inv) => acc + Number(inv.cantidad_actual) * Number(inv.factor_base || 1), 0);
            const deficit = Math.max(0, r.total_solicitado - stockRubro);
            return { ...r, stock_actual: stockRubro, deficit };
        });
        return { reporte, comedores: comedoresList.sort() };
    }, [data.reqs, data.inventario, committedQuantities]);

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
            <div className="relative bg-white rounded-[2rem] shadow-2xl w-full h-full max-w-[98vw] max-h-[98vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-500 border border-slate-100">

                {/* HEADER */}
                <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100 bg-white z-10">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-brand-900 rounded-md flex items-center justify-center text-white shadow-lg shadow-brand-900/20">
                            <PackageSearch size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Mesa de Trabajo de Despacho</h2>
                            <div className="flex items-center gap-4 mt-1">
                                <button onClick={() => setActiveTab('ASIGNACION')} className={`text-[9px] font-black uppercase tracking-[0.2em] transition-all px-3 py-1 rounded-lg ${activeTab === 'ASIGNACION' ? 'bg-brand-900 text-white shadow-lg shadow-brand-900/20' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}>Asignación FEFO</button>
                                <button onClick={() => setActiveTab('NECESIDADES')} className={`text-[9px] font-black uppercase tracking-[0.2em] transition-all px-3 py-1 rounded-lg ${activeTab === 'NECESIDADES' ? 'bg-brand-900 text-white shadow-lg shadow-brand-900/20' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}>Análisis de Compras</button>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"><X size={20} /></button>
                </div>

                {/* CONTENT AREA */}
                <div className="flex-1 flex overflow-hidden bg-slate-50/50">
                    {loading ? (
                        <div className="flex-1 flex flex-col items-center justify-center">
                            <Loader2 size={40} className="animate-spin text-brand-500 mb-4" />
                            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Calculando Algoritmo FEFO...</p>
                        </div>
                    ) : (
                        activeTab === 'ASIGNACION' ? (
                            <React.Fragment>
                                {/* SIDEBAR */}
                                <div className="w-auto bg-white border-r border-slate-100 flex flex-col overflow-hidden">
                                    <div className="p-6 border-b border-slate-100"><h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Destinos a Surtir</h3></div>
                                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                                        {Object.entries(destinosAgrupados).map(([key, dest]) => {
                                            const isActive = activeDestinoId === key;
                                            return (
                                                <button key={key} onClick={() => setActiveDestinoId(key)} className={`w-full text-left p-4 rounded-md transition-all border-2 flex items-center justify-between group ${isActive ? 'border-brand-500 bg-brand-50/50 shadow-sm' : 'border-transparent hover:border-slate-200 hover:bg-slate-50'}`}>
                                                    <div className="flex flex-col gap-1">
                                                        <span className={`text-[11px] font-black uppercase tracking-tight ${isActive ? 'text-brand-900' : 'text-slate-700'}`}>{dest.nombre_sucursal}</span>
                                                        <span className={`text-[9px] font-bold uppercase tracking-widest ${isActive ? 'text-brand-600' : 'text-slate-400'}`}>{dest.nombre_comedor || 'N/A'}</span>
                                                        <div className="flex items-center gap-2 mt-2"><span className="px-2 py-0.5 bg-white rounded-md text-[8px] font-black text-slate-500 border shadow-sm">{dest.requisiciones.length} REQs</span></div>
                                                    </div>
                                                    <ChevronRight size={16} className={`${isActive ? 'text-brand-500' : 'text-slate-300 group-hover:text-slate-400'}`} />
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                {/* MAIN ASIGNACION */}
                                <div className="flex-1 flex flex-col bg-slate-50/50 overflow-hidden">
                                    {destinoActivo ? (
                                        <div className="flex-1 flex flex-col px-6 py-1 overflow-hidden">
                                            <div className="bg-white px-6 py-1 rounded-lg shadow-sm border border-slate-100 flex items-center justify-between mb-4 shrink-0">
                                                <div className="flex items-center gap-4">
                                                    <div className="p-3 bg-brand-50 text-brand-600 rounded-xl"><Building2 size={24} /></div>
                                                    <div>
                                                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Consolidado: {destinoActivo.nombre_sucursal}</h3>
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 flex items-center gap-2"><Info size={12} />{destinoActivo.requisiciones.map(r => `REQ ${formato8Digitos(r.id)}`).join(' • ')}</p>
                                                    </div>
                                                </div>
                                                <div className="text-right"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Ítems</p><p className="text-xl font-black text-brand-900 leading-none">{destinoActivo.total_items}</p></div>
                                            </div>
                                            <div className="flex-1 bg-white rounded-lg shadow-sm border border-slate-100 overflow-hidden flex flex-col">
                                                <div className="px-6 py-1 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between"><h4 className="text-[11px] font-black uppercase tracking-widest text-slate-600">Matriz de Asignación</h4></div>
                                                <div className="flex-1 overflow-y-auto">
                                                    <table className="w-full text-left border-collapse">
                                                        <thead>
                                                            <tr className="bg-white sticky top-0 z-10 shadow-sm">
                                                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">Rubro</th>
                                                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center border-b border-slate-100">Cantidad</th>
                                                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">Stock Almacén</th>
                                                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">Total Asignado</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-300">
                                                            {rubrosDelDestinoActivo.map(rubroRow => {
                                                                const lotesDisponibles = data.inventario.filter(i => i.producto?.id_rubro == rubroRow.id_rubro);
                                                                const asignacionesDestino = asignaciones[activeDestinoId] || {};
                                                                const totalAsignado = lotesDisponibles.reduce((acc, lote) => acc + (asignacionesDestino[lote.id] || 0), 0);
                                                                return (
                                                                    <tr key={rubroRow.id_rubro} className="hover:bg-slate-50/30 transition-colors">
                                                                        <td className="px-6 py-4"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400"><Box size={18} /></div><div><span className="text-xs font-black text-slate-800 uppercase block">{rubroRow.rubro?.nombre}</span><span className="text-[9px] font-bold text-slate-400 uppercase">{rubroRow.rubro?.categoria?.nombre}</span></div></div></td>
                                                                        <td className="px-6 py-4 text-center"><div><span className="text-xl font-black text-brand-900 tabular-nums">{rubroRow.total_solicitado % 1 === 0 ? rubroRow.total_solicitado : parseFloat(rubroRow.total_solicitado.toFixed(3))}</span><span className="text-[9px] font-black text-slate-400 uppercase block">{rubroRow.rubro?.unidad?.abreviatura}</span></div></td>
                                                                        <td className="px-6 py-4 align-top">
                                                                            {lotesDisponibles.length > 0 ? (
                                                                                <div className="space-y-2">
                                                                                    {lotesDisponibles.map(lote => {
                                                                                        const cantAsig = asignacionesDestino[lote.id] || 0;
                                                                                        const status = getExpirationStatus(lote.fecha_vencimiento);
                                                                                        const unidadAbrev = lote.producto?.rubro?.unidad?.abreviatura || 'UND';

                                                                                        // Presentación seleccionada para este lote
                                                                                        const presSelId = presentacionesSeleccionadas[lote.id];
                                                                                        const presSel = lote.presentaciones?.find(p => p.id === presSelId) || lote.presentaciones?.find(p => p.es_base);
                                                                                        const baseWeight = Number(lote.factor_base || 1);

                                                                                        const totalAsigOtrosEnBase = Object.entries(asignaciones).reduce((acc, [k, items]) => {
                                                                                            if (k === activeDestinoId) return acc;
                                                                                            const pId = presentacionesSeleccionadas[lote.id];
                                                                                            const p = lote.presentaciones?.find(pres => pres.id === pId) || lote.presentaciones?.find(pres => pres.es_base);
                                                                                            return acc + ((items[lote.id] || 0) * (p?.factor || 1));
                                                                                        }, 0);

                                                                                        const globalCommitted = committedStock[`${lote.id_producto}_${lote.lote || 'null'}`] || 0;
                                                                                        const dispBase = Math.max(0, Number(lote.cantidad_actual) - globalCommitted - totalAsigOtrosEnBase);
                                                                                        const cleanedDispBase = Math.round(dispBase * 10000) / 10000;
                                                                                        const rawDispEnPres = cleanedDispBase / (presSel?.factor || 1);
                                                                                        const dispEnPres = (lote.producto?.rubro?.tipo_fraccionamiento === 'SIEMPRE')
                                                                                            ? rawDispEnPres
                                                                                            : Math.round(rawDispEnPres);

                                                                                        return (
                                                                                            <div key={lote.id} className={`flex flex-col gap-3 px-4 py-3 rounded-xl border transition-all ${cantAsig > 0 ? 'bg-white border-brand-200 shadow-sm' : 'bg-slate-50 border-slate-100'}`}>
                                                                                                <div className="flex items-center justify-between">
                                                                                                    <div className="flex-1">
                                                                                                        <div className="flex flex-col items-start gap-1">
                                                                                                            <span className="text-[10px] font-black text-slate-700 uppercase">
                                                                                                                {lote.producto?.marca?.nombre} {lote.producto?.variedad}
                                                                                                            </span>
                                                                                                            <div className="flex items-center gap-2">
                                                                                                                <span className="text-[9px] font-bold text-slate-400 uppercase">Lote: {lote.lote}</span>
                                                                                                                <span className={`px-2 py-0.5 text-[8px] uppercase rounded-full font-black ${status.color} ${status.bg || ''}`}>{status.label}</span>
                                                                                                            </div>
                                                                                                        </div>
                                                                                                    </div>
                                                                                                    <div className="text-right">
                                                                                                        <div className="flex items-baseline justify-end gap-1">
                                                                                                            <span className="text-xl font-black text-brand-900 tabular-nums leading-none">
                                                                                                                {lote.producto?.rubro?.tipo_fraccionamiento === 'SIEMPRE'
                                                                                                                    ? (dispEnPres % 1 === 0 ? dispEnPres : parseFloat(dispEnPres.toFixed(3)))
                                                                                                                    : dispEnPres}
                                                                                                            </span>
                                                                                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                                                                                                {presSel?.presentacion?.nombre || 'UNIDAD'}
                                                                                                            </span>
                                                                                                        </div>
                                                                                                        <p className="text-[8px] font-bold text-slate-300 uppercase mt-1">Stock Disponible</p>
                                                                                                    </div>
                                                                                                </div>

                                                                                                {/* SELECTOR DE PRESENTACIÓN */}
                                                                                                <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
                                                                                                    <div className="flex-1 flex flex-col gap-2 px-4 py-1 rounded-md">
                                                                                                        {lote.presentaciones?.sort((a, b) => a.factor - b.factor).map(p => (
                                                                                                            <button
                                                                                                                key={p.id}
                                                                                                                onClick={() => setPresentacionesSeleccionadas(prev => ({ ...prev, [lote.id]: p.id }))}
                                                                                                                className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase transition-all border-2 ${(presSel?.id === p.id)
                                                                                                                    ? 'bg-brand-900 border-brand-900 text-white shadow-md'
                                                                                                                    : 'bg-white border-slate-100 text-slate-400 hover:border-brand-200'
                                                                                                                    }`}
                                                                                                            >
                                                                                                                {p.presentacion?.nombre}
                                                                                                                <span className="ml-1 opacity-60">
                                                                                                                    {(() => {
                                                                                                                        const basePres = lote.presentaciones?.find(bp => bp.es_base);
                                                                                                                        const factorRelativo = p.factor / (basePres?.factor || 1);
                                                                                                                        return p.es_base
                                                                                                                            ? `(${p.factor % 1 === 0 ? p.factor : p.factor.toFixed(2)} ${unidadAbrev})`
                                                                                                                            : `(${factorRelativo % 1 === 0 ? factorRelativo : factorRelativo.toFixed(1)} ${basePres?.presentacion?.nombre || 'UND'})`;
                                                                                                                    })()}
                                                                                                                </span>
                                                                                                            </button>
                                                                                                        ))}
                                                                                                    </div>
                                                                                                    <div className="w-28 flex flex-col items-center gap-1">
                                                                                                        <div className="relative w-full">
                                                                                                            <input
                                                                                                                type="number"
                                                                                                                step={lote.producto?.rubro?.tipo_fraccionamiento === 'SIEMPRE' && (presSel?.factor / lote.factor_base) <= 1.001 ? "0.01" : "1"}
                                                                                                                value={cantAsig === 0 ? '' : cantAsig}
                                                                                                                placeholder="0"
                                                                                                                onChange={(e) => handleAsignacionChange(activeDestinoId, lote.id, e.target.value)}
                                                                                                                className="w-full text-center font-black bg-white border-2 border-slate-200 focus:border-brand-500 rounded-lg py-2 text-sm text-brand-900 transition-all outline-none"
                                                                                                            />
                                                                                                            {cantAsig > 0 && (
                                                                                                                <div className="absolute -top-2 -right-2 w-5 h-5 bg-emerald-500 text-white rounded-full flex items-center justify-center animate-bounce shadow-lg border-2 border-white">
                                                                                                                    <CheckCircle2 size={10} />
                                                                                                                </div>
                                                                                                            )}
                                                                                                        </div>
                                                                                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">
                                                                                                            {cantAsig > 0 ? `${parseFloat((cantAsig * (presSel?.factor || 1)).toFixed(3))} ${unidadAbrev} TOTAL` : `Asignar ${presSel?.presentacion?.nombre}`}
                                                                                                        </span>
                                                                                                    </div>
                                                                                                </div>
                                                                                            </div>
                                                                                        );
                                                                                    })}
                                                                                </div>
                                                                            ) : (
                                                                                <div className="text-red-500 text-[10px] font-black uppercase p-3 bg-red-50 rounded-xl border border-red-100 flex items-center gap-2"><X size={14} /> Sin stock disponible</div>
                                                                            )}
                                                                        </td>
                                                                        <td>
                                                                            <div className="px-6 py-4 text-center">
                                                                                <span className="text-xl font-black text-brand-900 tabular-nums">
                                                                                    {(() => {
                                                                                        const totalAsigRubro = lotesDisponibles.reduce((acc, l) => {
                                                                                            const presSelId = presentacionesSeleccionadas[l.id];
                                                                                            const presSel = l.presentaciones?.find(p => p.id === presSelId) || l.presentaciones?.find(p => p.es_base);
                                                                                            return acc + ((asignacionesDestino[l.id] || 0) * (presSel?.factor || 1));
                                                                                        }, 0);
                                                                                        const cleaned = Math.round(totalAsigRubro * 10000) / 10000;
                                                                                        return (cleaned % 1 === 0 ? cleaned : parseFloat(cleaned.toFixed(3)));
                                                                                    })()}
                                                                                </span>
                                                                                <span className="text-[9px] font-black text-slate-400 uppercase block">{rubroRow.rubro?.unidad?.abreviatura}</span>
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex-1 flex flex-col items-center justify-center"><p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Seleccione un destino</p></div>
                                    )}
                                </div>
                            </React.Fragment>
                        ) : (
                            /* NECESIDADES TAB */
                            <div className="flex-1 flex flex-col overflow-hidden p-8 animate-in fade-in duration-500">
                                <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col h-full overflow-hidden">
                                    <div className="px-10 py-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-amber-500 rounded-md flex items-center justify-center text-white shadow-lg shadow-amber-500/20"><AlertCircle size={24} /></div>
                                            <div>
                                                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Déficit y Necesidades de Compra</h3>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Cruce de Demanda Consolidada vs Stock Real</p>
                                            </div>
                                        </div>
                                        <div className="text-center"><p className="text-[9px] font-black text-slate-400 uppercase">Rubros en Déficit</p><p className="text-2xl font-black text-red-600">{analisisNecesidades.reporte.filter(r => r.deficit > 0).length}</p></div>
                                    </div>
                                    <div className="flex-1 overflow-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead className="sticky top-0 bg-white z-20 shadow-sm"><tr><th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 bg-white">Rubro</th>{analisisNecesidades.comedores.map(com => (<th key={com} className="px-4 py-5 text-[9px] font-black uppercase text-slate-400 border-b border-slate-100 bg-white text-center"><div className="w-24 mx-auto truncate" title={com}>{com}</div></th>))}<th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400 border-b border-slate-100 bg-white text-right">Total Pedido</th><th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400 border-b border-slate-100 bg-white text-right">Stock Real (Kilos)</th><th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400 border-b border-slate-100 bg-white text-right">A Comprar</th></tr></thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {analisisNecesidades.reporte.map(r => (
                                                    <tr key={r.rubro.id} className={`hover:bg-slate-50 transition-colors ${r.deficit > 0 ? 'bg-red-50/20' : ''}`}>
                                                        <td className="px-8 py-5"><div className="flex flex-col"><span className="text-xs font-black text-slate-800 uppercase">{r.rubro.nombre}</span><span className="text-[9px] font-bold text-slate-400 uppercase">{r.rubro.unidad?.abreviatura}</span></div></td>
                                                        {analisisNecesidades.comedores.map(com => (<td key={com} className="px-4 py-5 text-center"><span className={`text-[11px] font-bold ${r.solicitudes[com] ? 'text-slate-800' : 'text-slate-200'}`}>{r.solicitudes[com] ? parseFloat(r.solicitudes[com].toFixed(3)) : '-'}</span></td>))}
                                                        <td className="px-8 py-5 text-right font-black text-slate-800 tabular-nums bg-slate-50/30">{parseFloat(r.total_solicitado.toFixed(3))}</td>
                                                        <td className="px-8 py-5 text-right font-black text-brand-600 tabular-nums">{parseFloat(r.stock_actual.toFixed(3))}</td>
                                                        <td className="px-8 py-5 text-right"><span className={`px-4 py-2 rounded-xl text-xs font-black tabular-nums ${r.deficit > 0 ? 'bg-red-600 text-white' : 'bg-emerald-100 text-emerald-700'}`}>{r.deficit > 0 ? parseFloat(r.deficit.toFixed(3)) : 'CUBIERTO'}</span></td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )
                    )}
                </div>

                {/* FOOTER */}
                <div className="sticky bottom-4 px-8 pt-4 bg-white border-t border-slate-100 flex items-center justify-end gap-3 z-10 shrink-0">
                    <div className="flex gap-4">
                        <button
                            onClick={onClose}
                            disabled={confirming}
                            className="px-6 py-3 text-slate-400 font-bold uppercase text-xs hover:bg-slate-100 rounded-md transition-all"
                        >
                            Cancelar
                        </button>

                        <button
                            onClick={() => handleConfirmar('BORRADOR')}
                            disabled={confirming || (activeTab === 'ASIGNACION' && Object.keys(asignaciones).length === 0)}
                            className="flex items-center gap-2 px-6 py-3 border border-brand-200 text-brand-900 rounded-md font-black text-xs uppercase hover:bg-brand-50 transition-all disabled:opacity-50"
                        >
                            {confirming ? 'Guardando...' : 'Guardar Borrador'}
                        </button>

                        <button
                            onClick={() => handleConfirmar('PENDIENTE')}
                            disabled={confirming || (activeTab === 'ASIGNACION' && Object.keys(asignaciones).length === 0)}
                            className="flex items-center gap-2 px-6 py-3 bg-brand-900 text-white rounded-md font-black text-xs uppercase shadow-xl hover:shadow-brand-900/40 transition-all active:scale-95 disabled:opacity-50"
                        >
                            <Truck size={16} />
                            {confirming ? 'Procesando...' : 'Confirmar y Enviar'}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
