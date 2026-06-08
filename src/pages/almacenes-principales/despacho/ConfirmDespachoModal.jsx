import React from 'react';
import { createPortal } from 'react-dom';
import { Truck, X } from 'lucide-react';
import { formato8Digitos } from '../../../util/workDate';

const ConfirmDespachoModal = ({ isOpen, pickingId, processing, onConfirm, onClose }) => {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[30000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-[2.5rem] w-full max-w-md p-10 shadow-2xl animate-in zoom-in-95 relative overflow-hidden">
        {/* Botón Cerrar */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-full transition-colors"
        >
          <X size={20} />
        </button>

        <div className="flex flex-col items-center text-center gap-4">
          <div className="w-20 h-20 rounded-[1.5rem] bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100 mb-2">
            <Truck size={40} />
          </div>
          <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Confirmar Despacho</h3>
          <p className="text-sm text-slate-500 font-semibold leading-relaxed">
            ¿Estás seguro de autorizar el despacho #{formato8Digitos(pickingId)}?
            <br /><br />
            Esta acción es <span className="text-red-500 font-black">IRREVERSIBLE</span> y descontará el inventario del almacén central.
          </p>
        </div>

        <div className="flex flex-col gap-3 mt-8">
          <button
            disabled={processing}
            onClick={onConfirm}
            className="w-full py-4 bg-emerald-600 text-white rounded-md font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-600/30 hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processing ? 'Procesando...' : 'Sí, Autorizar y Despachar'}
          </button>
          <button
            disabled={processing}
            onClick={onClose}
            className="w-full py-4 bg-slate-100 text-slate-500 rounded-md font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95 disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>, document.body
  );
};

export default ConfirmDespachoModal;
