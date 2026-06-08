import React from 'react';
import { createPortal } from 'react-dom';
import { Check, X, Loader2 } from 'lucide-react';
import { formatearFecha } from '../../../util/workDate';

export default function AprobarPlanificacionModal({ plan, comedores, onClose, onConfirm, loading }) {
    const comedor = comedores.find(c => c.id === plan.id_comedor);
    const sucursal = comedores.find(c => c.id === plan.id_comedor)?.sucursal?.nombre;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            <div className="bg-white w-auto h-auto max-w-md max-h-[98vh] rounded-[1.5rem] shadow-2xl overflow-hidden relative z-10 animate-in zoom-in-95 duration-300">
                {/* Cabecera */}
                <div className="p-8 pb-4 flex items-start justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500">
                            <Check size={28} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Aprobar Planificación</h3>
                            <p className="text-xs text-slate-400 italic font-medium">Se generará la requisición automática de insumos</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-xl transition-all text-slate-400">
                        <X size={20} />
                    </button>
                </div>

                {/* Cuerpo */}
                <div className="px-8 py-1 bg-gray-50/30">
                    <div className="bg-white p-6 rounded-md border border-slate-100 shadow-sm space-y-4">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Sucursal</span>
                            <span className="text-sm font-bold text-slate-700">{sucursal}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Comedor</span>
                            <span className="text-sm font-bold text-slate-700">{comedor?.nombre}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Servicio</span>
                            <span className="text-sm font-bold text-slate-700">{plan.servicio_config?.tipo_servicio?.nombre}</span>
                        </div>
                        <div className="flex justify-between">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Semana Inicio</span>
                                <span className="text-sm font-bold text-slate-700">{formatearFecha(plan.semana_inicio)}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Semana Fin</span>
                                <span className="text-sm font-bold text-slate-700">{formatearFecha(plan.semana_fin)}</span>
                            </div>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed border-t border-slate-50 pt-1 text-justify">
                            Al aprobar esta planificación, el sistema calculará automáticamente los insumos consolidados y generará una requisición para los almacenes correspondientes.
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="sticky bottom-4 px-8 pt-4 flex items-center justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        disabled={loading}
                        onClick={onConfirm}
                        className="flex items-center gap-2 px-8 py-3 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 active:scale-95 disabled:opacity-50"
                    >
                        {loading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                        <span className="text-[10px] font-black uppercase tracking-widest">Confirmar Aprobación</span>
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
