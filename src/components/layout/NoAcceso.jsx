import { Lock, ArrowLeft, ShieldAlert } from 'lucide-react';

export default function NoAcceso() {
    const handleBack = () => {
        if (window.history.length > 1) {
            window.history.back();
        } else {
            window.location.href = '/';
        }
    };

    return (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-6 overflow-hidden">
            {/* ── Backdrop Dinámico ── */}
            <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-2xl transition-all duration-700" />

            {/* ── Orbes de Luz ── */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-brand-500/10 rounded-full blur-[120px] animate-pulse" />
            <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-rose-500/5 rounded-full blur-[100px]" />

            {/* ── Card Principal ── */}
            <div className="relative w-full max-w-md bg-white border border-white/10 backdrop-blur-xl rounded-[2.5rem] p-10 shadow-2xl flex flex-col items-center text-center space-y-8 animate-in zoom-in-95 fade-in duration-500">

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
                        Acceso Restringido
                    </h2>
                    <div className="flex items-center justify-center gap-2 text-rose-400">
                        <ShieldAlert size={14} />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em]">Protocolo de Seguridad</span>
                    </div>
                    <p className="text-slate-400 text-sm font-medium leading-relaxed px-4">
                        Tu perfil actual no posee los privilegios necesarios para interactuar con esta función.
                        <br />
                        Contacta al administrador para solicitar acceso.
                    </p>
                </div>

                {/* ── Acciones ── */}
                <div className="w-full pt-4">
                    <button
                        onClick={handleBack}
                        className="group w-full py-4 bg-white text-slate-900 rounded-md font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:bg-slate-100 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3"
                    >
                        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                        Regresar
                    </button>
                </div>

                {/* ── Footer Decorativo ── */}
                <div className="pt-2">
                    <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">Sercosys Security Management</span>
                </div>
            </div>
        </div>
    );
}
