import React from 'react';
import { createPortal } from 'react-dom';
import { Trash2, X, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function AnularRequisicionesAlmacenModal({ req, loading, onClose, onConfirm }) {
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden relative z-10 animate-in zoom-in-95 duration-300">
        <div className="p-10 pb-6 flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-[2rem] bg-red-50 flex items-center justify-center text-red-500 mb-6 shadow-inner">
            <Trash2 size={40} />
          </div>
          <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter leading-none mb-2">¿Anular Requisición?</h3>
          <p className="text-sm text-slate-400 italic font-medium">Esta acción devolverá la planificación asociada al estatus <span className="text-amber-500 font-bold not-italic">PENDIENTE</span> para corrección.</p>
        </div>

        <div className="px-10 py-1 bg-gray-50/30">
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Requisición</span>
              <span className="text-sm font-black text-slate-700 uppercase tracking-tighter">REQ {String(req.id).padStart(8, '0')}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Comedor</span>
              <span className="text-xs font-bold text-slate-600 uppercase">{req.comedor?.nombre}</span>
            </div>
          </div>
        </div>

        <div className="p-10 pt-6 flex flex-col gap-3">
          <button
            onClick={() => onConfirm(req)}
            disabled={loading}
            className="w-full py-4 bg-red-500 text-white font-black text-[11px] uppercase tracking-widest rounded-md shadow-lg shadow-red-500/20 hover:bg-red-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Anulando...
              </>
            ) : (
              'Confirmar Anulación'
            )}
          </button>
          <button
            onClick={onClose}
            disabled={loading}
            className="w-full py-4 bg-white border border-slate-200 text-slate-500 font-black text-[11px] uppercase tracking-widest rounded-md hover:bg-slate-50 transition-all active:scale-95"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
