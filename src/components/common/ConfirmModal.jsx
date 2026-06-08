import React from 'react';
import { createPortal } from 'react-dom';

const ConfirmModal = ({ show, title, message, onConfirm, onCancel, icon: Icon, confirmText = "Confirmar", type = "brand" }) => {
    if (!show) return null;
    
    const colors = {
        brand: "bg-brand-900 text-white shadow-brand-900/20",
        danger: "bg-red-600 text-white shadow-red-600/20",
        warning: "bg-amber-500 text-white shadow-amber-500/20",
        success: "bg-emerald-600 text-white shadow-emerald-600/20"
    };

    const iconBg = {
        brand: "bg-brand-50 text-brand-900",
        danger: "bg-red-50 text-red-600",
        warning: "bg-amber-50 text-amber-600",
        success: "bg-emerald-50 text-emerald-600"
    };

    return createPortal(
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={onCancel} />
            <div className="relative w-full max-w-[400px] bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="p-8 flex flex-col items-center text-center">
                    <div className={`p-4 rounded-full mb-6 ${iconBg[type]}`}>
                        <Icon size={32} />
                    </div>
                    <h3 className="text-xl font-black text-slate-800 tracking-tighter uppercase mb-2">{title}</h3>
                    <p className="text-xs text-slate-400 font-bold italic px-4 uppercase tracking-widest leading-relaxed">
                        {message}
                    </p>
                </div>
                <div className="px-8 py-6 bg-slate-50/50 flex items-center gap-3 justify-center">
                    <button 
                        onClick={onCancel}
                        className="px-6 py-2.5 text-slate-400 text-[10px] font-black uppercase tracking-widest hover:text-slate-600 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={onConfirm}
                        className={`px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95 shadow-lg ${colors[type]}`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ConfirmModal;
