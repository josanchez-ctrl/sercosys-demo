import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { formato8Digitos } from '../../../util/workDate';

const AnularDespachoModal = ({ isOpen, pickingId, motivo, setMotivo, processing, onConfirm, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[30000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-md w-full max-w-md p-10 shadow-2xl animate-in zoom-in-95 relative overflow-hidden">
        {/* Botón Cerrar */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-full transition-colors"
        >
          <X size={20} />
        </button>

        <div className="flex flex-col items-center text-center gap-4">
          <div className="w-20 h-20 rounded-[1.5rem] bg-red-50 flex items-center justify-center text-red-600 border border-red-100 mb-2">
            <AlertTriangle size={40} />
          </div>
          <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Anular Picking</h3>
          <p className="text-sm text-slate-500 font-semibold leading-relaxed">
            ¿Por qué deseas anular el picking #{formato8Digitos(pickingId)}?
            <br />
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2 block">Se requiere un motivo obligatorio</span>
          </p>
        </div>

        <div className="mt-8 space-y-4">
          <textarea
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            placeholder="Escribe el motivo de la anulación aquí..."
            className="w-full h-32 p-6 bg-slate-50 border border-slate-100 rounded-md text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-red-500/10 focus:border-red-500 transition-all resize-none"
          />

          <div className="flex flex-col gap-3">
            <button
              disabled={processing || !motivo.trim()}
              onClick={onConfirm}
              className="w-full py-4 bg-red-600 text-white rounded-md font-black text-xs uppercase tracking-widest shadow-xl shadow-red-600/30 hover:bg-red-700 transition-all active:scale-95 disabled:opacity-50"
            >
              {processing ? 'Anulando...' : 'Confirmar Anulación'}
            </button>
            <button
              disabled={processing}
              onClick={onClose}
              className="w-full py-4 bg-slate-100 text-slate-500 rounded-md font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95 disabled:opacity-50"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnularDespachoModal;
