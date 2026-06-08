import { Lock } from 'lucide-react';

export default function SinEmpresa({ children }) {

    return (
        <div className="flex items-center justify-center w-full h-full bg-white border border-white/10 backdrop-blur-xl rounded-[2.5rem] p-10 shadow-2xl flex flex-col items-center text-center space-y-8 animate-in zoom-in-95 fade-in duration-500">

            {/* ── Icono Central ── */}
            <div className="relative group">
                <div className="absolute inset-0 bg-rose-500/20 blur-2xl rounded-full scale-150 group-hover:scale-110 transition-transform duration-700" />
                <div className="relative w-24 h-24 bg-gradient-to-b from-rose-500 to-rose-600 rounded-[2rem] flex items-center justify-center shadow-2xl shadow-rose-500/40 rotate-12 group-hover:rotate-0 transition-all duration-500">
                    <Lock size={42} className="text-white" />
                </div>
            </div>

            {/* ── Texto ── */}
            <div className="space-y-3">
                <h2 className="text-3xl font-black text-black tracking-tight uppercase leading-none">
                    Sin Empresa Activa
                </h2>
                <p className="text-slate-400 text-sm font-medium leading-relaxed px-4">
                    No se ha seleccionado ninguna empresa.
                </p>
            </div>
        </div>
    );
}