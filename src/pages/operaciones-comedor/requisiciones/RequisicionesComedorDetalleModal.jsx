import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ClipboardList, Clock, ChevronDown, ChevronRight, Warehouse, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { formato8Digitos } from '../../../util/workDate';
import { getRequisicionById } from '../../../services/requisicionService';

export default function RequisionesComedorDetalleModal({ req: initialReq, onClose, onAnular }) {
    const [req, setReq] = useState(initialReq);
    const [loading, setLoading] = useState(!initialReq.detalle || initialReq.detalle.length === 0);
    const [expandedAlmacenes, setExpandedAlmacenes] = useState({});

    useEffect(() => {
        // Si no hay detalles, o el detalle viene vacío, intentamos cargar la data completa
        if (!initialReq.detalle || initialReq.detalle.length === 0) {
            fetchFullData();
        }
    }, [initialReq.id]);

    const fetchFullData = async () => {
        setLoading(true);
        try {
            const fullReq = await getRequisicionById(initialReq.id);
            setReq(fullReq);
        } catch (error) {
            console.error("Error cargando detalles de REQ:", error);
        } finally {
            setLoading(false);
        }
    };

    // Agrupar ítems por almacén (basado en el estado actual req)
    const groupedItems = req.detalle?.reduce((acc, item) => {
        const almacenNombre = item.rubro?.categoria?.almacen?.nombre || 'SIN ALMACÉN';
        if (!acc[almacenNombre]) acc[almacenNombre] = [];
        acc[almacenNombre].push(item);
        return acc;
    }, {});

    const toggleAlmacen = (almacen) => {
        setExpandedAlmacenes(prev => ({
            ...prev,
            [almacen]: !prev[almacen]
        }));
    };

    const canAnular = req.estatus === 'PENDIENTE';

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden relative z-10 animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
                {/* Cabecera Modal */}
                <div className="px-10 py-8 flex items-start justify-between bg-white relative z-20 border-b border-slate-100">
                    <div className="flex items-center gap-6">
                        <div className="w-16 h-16 rounded-[2rem] bg-brand-50 flex items-center justify-center text-brand-600 shadow-inner border border-brand-100">
                            <ClipboardList size={32} />
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter leading-none">Consolidado de Insumos</h3>
                            <p className="text-sm text-slate-400 italic font-medium mt-1">REQ {formato8Digitos(req.id)} <span className="mx-1 font-normal opacity-30">|</span> Snapshot de Explosión</p>
                            <div className="flex items-center gap-2 mb-2">
                                {/* <span className="px-3 py-1 bg-slate-900 text-white text-[9px] font-black uppercase tracking-[0.15em] rounded-lg shadow-sm flex items-center gap-2">
                                    <Warehouse size={10} className="text-brand-400" />
                                    {req.comedor?.sucursal?.nombre || 'SUCURSAL'}
                                </span>
                                <span className="px-3 py-1 bg-brand-50 text-brand-700 border border-brand-100 text-[9px] font-black uppercase tracking-[0.15em] rounded-lg">
                                    {req.comedor?.nombre || 'COMEDOR'}
                                </span> */}
                                <span className={`px-3 py-1 text-[9px] font-black uppercase tracking-[0.15em] rounded-lg border shadow-sm ${req.estatus === 'PROCESADO' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                    req.estatus === 'ANULADA' ? 'bg-red-50 text-red-600 border-red-100' :
                                        'bg-amber-50 text-amber-600 border-amber-100'
                                    }`}>
                                    {req.estatus}
                                </span>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-slate-50 rounded-md transition-all text-slate-400">
                        <X size={24} />
                    </button>
                </div>

                {/* Cuerpo Modal (Snapshot Area) */}
                <div className="px-10 overflow-y-auto custom-scrollbar flex-1 bg-gray-50/30 relative">
                    {loading && (
                        <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center animate-in fade-in duration-300">
                            <Loader2 className="w-12 h-12 text-brand-600 animate-spin mb-4" />
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Sincronizando Detalles...</p>
                        </div>
                    )}

                    <div className="space-y-4">
                        {!loading && Object.keys(groupedItems || {}).length === 0 && (
                            <div className="py-20 flex flex-col items-center justify-center text-slate-300 border-2 border-dashed border-slate-100 rounded-[2rem]">
                                <RefreshCw size={48} className="mb-4 opacity-20" />
                                <p className="text-sm font-bold uppercase tracking-widest italic">No se detectaron rubros en esta requisición</p>
                                <button onClick={fetchFullData} className="mt-4 text-[10px] font-black text-brand-600 uppercase hover:underline">Reintentar Sincronización</button>
                            </div>
                        )}

                        {Object.entries(groupedItems || {}).map(([almacen, items], aIdx) => {
                            const isExpanded = expandedAlmacenes[almacen];
                            return (
                                <div key={almacen} className="bg-white rounded-md border border-slate-100 shadow-sm overflow-hidden animate-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${aIdx * 100}ms` }}>
                                    {/* Header Acordeón Industrial */}
                                    <button
                                        onClick={() => toggleAlmacen(almacen)}
                                        className="w-full px-8 py-5 bg-slate-50/50 flex items-center justify-between hover:bg-slate-100/50 transition-colors"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-brand-900 rounded-xl flex items-center justify-center text-white shadow-lg shadow-brand-900/20">
                                                <Warehouse size={16} />
                                            </div>
                                            <div className="text-left">
                                                <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider">{almacen}</h4>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                                    {new Set(items.map(i => i.rubro?.categoria?.nombre)).size} Categorías | {items.length} Rubros
                                                </p>
                                            </div>
                                        </div>
                                        <div className={`p-2 rounded-lg bg-white border border-slate-100 text-slate-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                                            <ChevronDown size={18} />
                                        </div>
                                    </button>

                                    {/* Contenido Acordeón */}
                                    {isExpanded && (
                                        <div className="p-2 animate-in fade-in duration-300">
                                            <div className="rounded-md border border-slate-50 overflow-hidden shadow-sm">
                                                <table className="w-full text-left border-collapse">
                                                    <thead className="bg-slate-50/80">
                                                        <tr>
                                                            <th className="px-8 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Rubro | Categoría | Unidad</th>
                                                            <th className="px-8 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right">Cant. Solicitada</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {items.map(item => (
                                                            <tr key={item.id} className="hover:bg-slate-50/50 transition-all group">
                                                                <td className="px-8 py-4">
                                                                    <div className="flex flex-col">
                                                                        <span className="text-[11px] font-bold text-slate-800 uppercase tracking-tight group-hover:text-brand-900 transition-colors">
                                                                            {item.rubro?.nombre} <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{item.observaciones ? `(Obs: ${item.observaciones})` : ''}</span>
                                                                        </span>
                                                                        <div className="flex items-center gap-1.5 mt-0.5">
                                                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                                                                                {item.rubro?.categoria?.nombre}
                                                                            </span>
                                                                            <span className="text-[9px] text-slate-200">|</span>
                                                                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">
                                                                                {item.rubro?.unidad?.abreviatura}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td className="px-8 py-4 text-right">
                                                                    <div className="flex flex-col items-end">
                                                                        <span className="text-base font-black text-brand-900 tabular-nums leading-none">
                                                                            {Number(item.cantidad_solicitada).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                                                                        </span>
                                                                        <span className="text-[8px] font-black text-brand-400 uppercase tracking-widest mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                            Sujeto a Stock
                                                                        </span>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {req.observaciones && (
                            <div className="mt-8 p-8 bg-amber-50/50 rounded-[2.5rem] border border-amber-100/50 animate-in fade-in slide-in-from-bottom duration-700 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-10">
                                    <Clock size={48} />
                                </div>
                                <p className="text-[10px] font-black text-amber-600 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                                    <Clock size={12} className="text-amber-500" /> Notas del Solicitante
                                </p>
                                <p className="text-sm font-medium text-amber-800 italic leading-relaxed">
                                    "{req.observaciones}"
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Modal Industrial */}
                <div className="p-10 pt-6 bg-white border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Rubros Detectados</span>
                            <span className="text-xl font-black text-slate-800 leading-none mt-1">{req.detalle?.length || 0}</span>
                        </div>
                        <button
                            onClick={fetchFullData}
                            disabled={loading}
                            className="p-3 hover:bg-slate-50 rounded-xl transition-all text-brand-600 disabled:opacity-30"
                            title="Refrescar Datos"
                        >
                            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-3 text-[11px] font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest transition-colors"
                        >
                            Cerrar
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}