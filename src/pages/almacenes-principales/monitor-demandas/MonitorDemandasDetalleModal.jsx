import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Package, Box, CheckCircle2, AlertCircle, FileText, Ban, Trash2, CheckCircle } from 'lucide-react';
import { getRequisicionDetalleByAlmacen, getStockByAlmacen, anularItemsDemandaMasivo } from '../../../services/monitorDemandasService';
import { useModulePermissions } from '../../../hooks/useModulePermissions';
import { formato8Digitos } from '../../../util/workDate';

const AnularItemsModal = ({ items, onClose, onConfirm }) => {
    const [motivo, setMotivo] = useState('');
    const isMultiple = items.length > 1;

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl relative z-10 p-10 animate-in zoom-in-95 duration-300 border border-slate-100">
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-14 h-14 bg-red-50 rounded-md flex items-center justify-center text-red-600 shadow-sm border border-red-100">
                        <Ban size={28} />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">
                            {isMultiple ? `Anular ${items.length} Rubros` : 'Anular Rubro'}
                        </h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 italic">Corte de Saldo Administrativo</p>
                    </div>
                </div>

                <div className="text-sm text-slate-600 mb-8 leading-relaxed">
                    {isMultiple ? (
                        <React.Fragment>
                            Estás por anular el saldo de <span className="font-black text-slate-900 underline decoration-red-200 decoration-4">{items.length} ítems</span> de esta requisición.
                            <div className="mt-3 p-3 bg-slate-50 rounded-xl max-h-32 overflow-y-auto border border-slate-100">
                                {items.map(it => (
                                    <div key={it.id} className="text-[10px] font-bold uppercase text-slate-500 py-1 border-b border-slate-200 last:border-0">• {it.rubro?.nombre}</div>
                                ))}
                            </div>
                        </React.Fragment>
                    ) : (
                        <p>¿Estás seguro de anular el saldo pendiente del rubro <span className="font-black text-slate-900 underline decoration-red-200 decoration-4">"{items[0].rubro?.nombre}"</span>?</p>
                    )}
                    <p className="mt-4 font-bold text-red-600 uppercase text-[10px] tracking-widest flex items-center gap-2">
                        <AlertCircle size={12} /> Esta acción es irreversible.
                    </p>
                </div>

                <div className="mb-8">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <FileText size={12} />
                        Motivo de la Anulación
                    </label>
                    <textarea
                        autoFocus
                        value={motivo}
                        onChange={(e) => setMotivo(e.target.value)}
                        placeholder="Ej: No hay stock disponible, Cambio de marca, etc."
                        className="w-full h-32 px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-md text-sm focus:border-red-200 focus:bg-white outline-none transition-all resize-none font-medium placeholder:text-slate-300"
                    />
                </div>

                <div className="flex items-center gap-4">
                    <button
                        onClick={onClose}
                        className="flex-1 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest hover:bg-slate-50 rounded-md transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        disabled={!motivo.trim()}
                        onClick={() => onConfirm(motivo)}
                        className="flex-1 py-4 bg-red-600 text-white rounded-md text-[11px] font-black uppercase tracking-widest shadow-xl shadow-red-600/20 hover:bg-red-700 transition-all disabled:opacity-50 active:scale-95 flex items-center justify-center gap-2"
                    >
                        Confirmar Anulación
                    </button>
                </div>
            </div>
        </div>
    );
};

export default function MonitorDemandasDetalleModal({ id_requisicion, id_almacen, onClose, onUpdate }) {
    const { perfil } = useModulePermissions();
    const [loading, setLoading] = useState(true);
    const [req, setReq] = useState(null);
    const [stockMap, setStockMap] = useState({});
    const [itemsParaAnular, setItemsParaAnular] = useState(null);
    const [selectedIds, setSelectedIds] = useState([]);

    useEffect(() => {
        if (id_requisicion && id_almacen) {
            fetchData();
        }
    }, [id_requisicion, id_almacen]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [requisicion, inventarioMap] = await Promise.all([
                getRequisicionDetalleByAlmacen(id_requisicion, id_almacen),
                getStockByAlmacen(id_almacen)
            ]);
            setReq(requisicion);
            setStockMap(inventarioMap || {});
        } catch (error) {
            console.error("Error cargando detalle de demanda:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmAnular = async (motivo) => {
        if (!itemsParaAnular?.length) return;

        try {
            const ids = itemsParaAnular.map(it => it.id);
            const res = await anularItemsDemandaMasivo(ids, perfil.id, motivo);
            if (res.success) {
                setItemsParaAnular(null);
                setSelectedIds([]);
                fetchData();
                if (onUpdate) onUpdate();
            } else {
                alert("Error: " + res.message);
            }
        } catch (error) {
            console.error("Error anulando ítems:", error);
        }
    };

    const toggleSelection = (id) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const toggleSelectAll = () => {
        if (!req?.detalle) return;
        const pendings = req.detalle.filter(it => it.estatus_item !== 'ANULADO' && it.estatus_item !== 'PROCESADO');
        if (selectedIds.length === pendings.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(pendings.map(it => it.id));
        }
    };

    const handleAnularSeleccionados = () => {
        const selectedItems = req.detalle.filter(it => selectedIds.includes(it.id));
        setItemsParaAnular(selectedItems);
    };

    const isFullyProcessed = useMemo(() => {
        if (!req?.detalle) return false;
        return req.detalle.every(it => it.estatus_item === 'ANULADO' || it.estatus_item === 'PROCESADO');
    }, [req?.detalle]);

    const handleFinalizarDespachoLocal = async () => {
        // Ya no cerramos la requisición globalmente por la fuerza.
        // La lógica de base de datos (fn_procesar_despacho) se encarga de cerrarla
        // solo cuando TODOS los almacenes hayan terminado.
        // Aquí solo refrescamos para que el Monitor lo mande al historial.
        if (onUpdate) onUpdate();
        onClose();
    };

    const sortedItems = useMemo(() => {
        if (!req?.detalle) return [];
        return [...req.detalle].sort((a, b) => {
            const isAnuladoA = a.estatus_item === 'ANULADO';
            const isAnuladoB = b.estatus_item === 'ANULADO';
            const isSurtidoA = a.estatus_item === 'PROCESADO';
            const isSurtidoB = b.estatus_item === 'PROCESADO';

            const pendingA = isAnuladoA ? 0 : Math.max(0, Number(a.cantidad_solicitada) - Number(a.cantidad_despachada || 0));
            const pendingB = isAnuladoB ? 0 : Math.max(0, Number(b.cantidad_solicitada) - Number(b.cantidad_despachada || 0));
            const hasStockA = (stockMap[a.id_rubro] || 0) >= pendingA;
            const hasStockB = (stockMap[b.id_rubro] || 0) >= pendingB;

            if (isAnuladoA && !isAnuladoB) return 1;
            if (!isAnuladoA && isAnuladoB) return -1;

            const scoreA = isSurtidoA ? 3 : (hasStockA ? 2 : 1);
            const scoreB = isSurtidoB ? 3 : (hasStockB ? 2 : 1);

            return scoreB - scoreA;
        });
    }, [req?.detalle, stockMap]);

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            <div className="bg-white w-full max-w-5xl rounded-[2.5rem] shadow-2xl overflow-hidden relative z-10 animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">

                {/* Cabecera */}
                <div className="px-10 py-8 flex items-start justify-between bg-white relative z-20 border-b border-slate-100">
                    <div className="flex items-center gap-6">
                        <div className="w-16 h-16 rounded-[2rem] bg-brand-900 flex items-center justify-center text-white shadow-2xl shadow-brand-900/20 border border-brand-800 relative group overflow-hidden">
                            <Package size={32} className="relative z-10" />
                            <div className="absolute inset-0 bg-gradient-to-br from-brand-600 to-transparent opacity-50" />
                        </div>
                        <div>
                            <div className="flex items-center gap-3">
                                <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter leading-none">Detalle de Demanda</h3>
                                <span className={`px-3 py-1 border text-[9px] font-black uppercase tracking-[0.15em] rounded-lg shadow-sm ${req?.estatus === 'PROCESADA' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'
                                    }`}>
                                    {req?.estatus || 'PENDIENTE'}
                                </span>
                            </div>
                            <p className="text-sm text-slate-400 italic font-medium mt-1">
                                REQ {formato8Digitos(id_requisicion)} <span className="mx-1 font-normal opacity-30">|</span> Supervisión de Almacén
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-slate-50 rounded-md transition-all text-slate-400">
                        <X size={24} />
                    </button>
                </div>

                {/* Cuerpo */}
                <div className="flex-1 overflow-y-auto p-10 bg-gray-50/30 relative">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-64 gap-4">
                            <div className="w-12 h-12 border-4 border-brand-900/10 border-t-brand-900 rounded-full animate-spin" />
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sincronizando Almacén...</p>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            {/* Información de la REQ */}
                            <div className="grid grid-cols-3 gap-6">
                                <div className="bg-white p-6 rounded-[1.5rem] shadow-sm border border-slate-100 group hover:border-brand-200 transition-all">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Destino</p>
                                    <p className="text-sm font-black text-slate-700 uppercase">{req?.sucursal?.nombre}</p>
                                    <p className="text-[10px] font-bold text-brand-600 italic mt-1 uppercase">{req?.comedor?.nombre || 'ALMACÉN GENERAL'}</p>
                                </div>
                                <div className="bg-white p-6 rounded-[1.5rem] shadow-sm border border-slate-100">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Fecha Emisión</p>
                                    <p className="text-sm font-black text-slate-700">{new Date(req?.timestamp_create).toLocaleDateString('es-VE', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                                    <p className="text-[10px] font-bold text-slate-400 italic mt-1 uppercase">Prioridad Estándar</p>
                                </div>
                                <div className="bg-white p-6 rounded-[1.5rem] shadow-sm border border-slate-100">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Items Totales</p>
                                    <p className="text-sm font-black text-slate-700">{req?.detalle?.length || 0} Rubros solicitados</p>
                                    <div className="mt-2 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full transition-all duration-1000 ${isFullyProcessed ? 'bg-emerald-500 w-full' : 'bg-brand-900 w-[40%]'}`} />
                                    </div>
                                </div>
                            </div>

                            {/* Tabla de Rubros */}
                            <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/40 border border-slate-100 overflow-hidden">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50/80 border-b border-slate-100">
                                            <th className="px-8 py-5 w-16 text-center">
                                                {req?.estatus !== 'PROCESADA' && (
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedIds.length > 0 && selectedIds.length === req?.detalle?.filter(it => it.estatus_item !== 'ANULADO' && it.estatus_item !== 'SURTIDO').length}
                                                        onChange={toggleSelectAll}
                                                        className="w-5 h-5 rounded-lg border-2 border-slate-300 text-brand-600 focus:ring-brand-500 transition-all cursor-pointer"
                                                    />
                                                )}
                                            </th>
                                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Rubro / Categoría</th>
                                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">UM</th>
                                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Cant. Pedida</th>
                                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Saldo Real</th>
                                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {sortedItems.map(item => {
                                            const stockAvailable = stockMap[item.id_rubro] || 0;
                                            const isAnulado = item.estatus_item === 'ANULADO';
                                            const isSurtido = item.estatus_item === 'PROCESADO';
                                            const isCerrado = isAnulado || isSurtido;
                                            const isSelected = selectedIds.includes(item.id);

                                            const pendingQty = isAnulado ? 0 : Math.max(0, Number(item.cantidad_solicitada) - Number(item.cantidad_despachada || 0));
                                            const hasFullStock = stockAvailable >= (pendingQty - 0.001);

                                            return (
                                                <tr
                                                    key={item.id}
                                                    className={`transition-all group ${isAnulado ? 'opacity-50 grayscale bg-slate-50/30' : isSelected ? 'bg-brand-50/30' : 'hover:bg-slate-50/50'}`}
                                                    onClick={() => !isCerrado && req?.estatus !== 'PROCESADA' && toggleSelection(item.id)}
                                                >
                                                    <td className="px-8 py-5 text-center">
                                                        {!isCerrado && req?.estatus !== 'PROCESADA' && (
                                                            <input
                                                                type="checkbox"
                                                                checked={isSelected}
                                                                onChange={() => toggleSelection(item.id)}
                                                                onClick={(e) => e.stopPropagation()}
                                                                className="w-5 h-5 rounded-lg border-2 border-slate-300 text-brand-600 focus:ring-brand-500 transition-all cursor-pointer"
                                                            />
                                                        )}
                                                    </td>
                                                    <td className="px-8 py-5">
                                                        <div className="flex items-center gap-4">
                                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isAnulado ? 'bg-slate-100 text-slate-400' :
                                                                isSurtido ? 'bg-emerald-50 text-emerald-600' :
                                                                    hasFullStock ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                                                                }`}>
                                                                {isAnulado ? <Ban size={18} /> : isSurtido ? <CheckCircle2 size={18} /> : <Box size={18} />}
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-xs font-black text-slate-800 uppercase">{item.rubro?.nombre}</span>
                                                                <span className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{item.rubro?.categoria?.nombre}</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-5 text-center">
                                                        <span className="px-3 py-1 bg-slate-100 text-slate-600 text-[10px] font-black rounded-lg uppercase tracking-widest">
                                                            {item.rubro?.unidad?.abreviatura}
                                                        </span>
                                                    </td>
                                                    <td className="px-8 py-5 text-right font-black text-slate-400 tabular-nums">
                                                        {parseFloat(Number(item.cantidad_solicitada).toFixed(3))}
                                                    </td>
                                                    <td className="px-8 py-5 text-right">
                                                        <div className="flex flex-col items-end">
                                                            <span className={`text-xl font-black tabular-nums leading-none ${isAnulado ? 'text-slate-400 line-through' :
                                                                isSurtido ? 'text-emerald-600' :
                                                                    hasFullStock ? 'text-emerald-600' : 'text-red-600'
                                                                }`}>
                                                                {parseFloat(pendingQty.toFixed(3))}
                                                            </span>
                                                            <span className={`text-[8px] font-black uppercase tracking-widest mt-1 ${isAnulado ? 'text-slate-400' :
                                                                isSurtido ? 'text-emerald-400' :
                                                                    hasFullStock ? 'text-emerald-400' : 'text-red-400'
                                                                }`}>
                                                                {isAnulado ? 'Corte de Saldo' : isSurtido ? 'Despachado' : 'Por Surtir'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-5 text-center">
                                                        {/* Permitimos acción si el ítem NO está cerrado, ignorando el estatus global si hay inconsistencia */}
                                                        {!isCerrado ? (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setItemsParaAnular([item]); }}
                                                                className="p-3 bg-red-50 text-red-500 rounded-md hover:bg-red-600 hover:text-white transition-all shadow-sm active:scale-90"
                                                                title="Anular este rubro"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        ) : (
                                                            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${isAnulado ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-600'}`}>
                                                                {isAnulado ? 'ANULADO' : (isSurtido || pendingQty <= 0.001) ? 'LISTO' : 'PROCESADA'}
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-10 py-6 bg-white border-t border-slate-100 flex items-center justify-between relative z-30">
                    <div className="flex items-center gap-4">
                        {selectedIds.length > 0 && (
                            <div className="flex items-center gap-3 animate-in slide-in-from-left-4 duration-300">
                                <span className="text-xs font-black text-slate-800 uppercase bg-brand-50 px-4 py-2 rounded-xl border border-brand-100">
                                    {selectedIds.length} Rubros seleccionados
                                </span>
                                <button
                                    onClick={handleAnularSeleccionados}
                                    className="flex items-center gap-2 px-6 py-2.5 bg-red-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-red-600/20 hover:bg-red-700 transition-all active:scale-95"
                                >
                                    <Ban size={14} />
                                    Anular Selección
                                </button>
                            </div>
                        )}

                        {isFullyProcessed && (
                            <button
                                onClick={handleFinalizarDespachoLocal}
                                className="flex items-center gap-3 px-8 py-3 bg-emerald-600 text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-xl shadow-emerald-600/20 hover:bg-emerald-700 transition-all active:scale-95 animate-bounce-short"
                            >
                                <CheckCircle size={18} />
                                Confirmar Despacho Local
                            </button>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="px-8 py-3 text-slate-400 font-black uppercase tracking-widest text-xs hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all"
                    >
                        Cerrar Detalle
                    </button>
                </div>

                {/* Modales de Confirmación */}
                {itemsParaAnular && (
                    <AnularItemsModal
                        items={itemsParaAnular}
                        onClose={() => setItemsParaAnular(null)}
                        onConfirm={handleConfirmAnular}
                    />
                )}
            </div>
        </div>,
        document.body
    );
}
