import React, { useState } from 'react';
import { Lock, Unlock, ShieldAlert, FileText } from 'lucide-react';
import { createPortal } from 'react-dom';

export default function BloqueoLoteModal({ lote, onClose, onConfirm }) {
    const [motivo, setMotivo] = useState(lote.motivo_bloqueo || '');
    const isDesbloqueo = lote.is_bloqueado;

    return createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl relative z-10 p-10 animate-in zoom-in-95 duration-300 border border-slate-100">
                <div className="flex items-center gap-4 mb-8">
                    <div className={`w-14 h-14 rounded-md flex items-center justify-center shadow-sm border ${isDesbloqueo ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                        {isDesbloqueo ? <Unlock size={28} /> : <Lock size={28} />}
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">
                            {isDesbloqueo ? 'Desbloquear Lote' : 'Bloquear Lote'}
                        </h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 italic">Cuarentena de Mercancía</p>
                    </div>
                </div>

                <div className="text-sm text-slate-600 mb-8 leading-relaxed">
                    <p>Estás a punto de <strong>{isDesbloqueo ? 'desbloquear' : 'bloquear'}</strong> el lote <span className="font-black text-slate-900 underline">{lote.lote}</span> del rubro <span className="font-black">{lote.producto?.rubro?.nombre}</span>.</p>
                    {!isDesbloqueo && (
                        <p className="mt-4 font-bold text-red-600 uppercase text-[10px] tracking-widest flex items-center gap-2">
                            <ShieldAlert size={12} /> El lote no podrá ser despachado.
                        </p>
                    )}
                </div>

                <div className="mb-8">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <FileText size={12} />
                        Motivo del {isDesbloqueo ? 'Desbloqueo' : 'Bloqueo'}
                    </label>
                    <textarea
                        autoFocus
                        value={motivo}
                        onChange={(e) => setMotivo(e.target.value)}
                        placeholder="Ej: Sospecha de daño, revisión de calidad..."
                        className="w-full h-32 px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-md text-sm focus:border-brand-200 focus:bg-white outline-none transition-all resize-none font-medium placeholder:text-slate-300"
                    />
                </div>

                <div className="flex items-center gap-4">
                    <button onClick={onClose} className="flex-1 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest hover:bg-slate-50 rounded-md transition-all">
                        Cancelar
                    </button>
                    <button
                        disabled={!motivo.trim()}
                        onClick={() => onConfirm(motivo, !isDesbloqueo)}
                        className={`flex-1 py-4 text-white rounded-md text-[11px] font-black uppercase tracking-widest shadow-xl transition-all disabled:opacity-50 active:scale-95 flex items-center justify-center gap-2 ${isDesbloqueo ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20' : 'bg-red-600 hover:bg-red-700 shadow-red-600/20'}`}
                    >
                        Confirmar Acción
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
