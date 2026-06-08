import { Building2, ShieldCheck, Globe, ArrowRight, LayoutDashboard, Database, UserCheck, Hexagon } from "lucide-react";
import logoImage from '../assets/logo_core.png';
import logoImageCompleto from '../assets/logo_core_completo.png';
import { useAuth } from '../context/AuthContext';

export default function Home() {
  const { empresaActiva, isAuthRestored, perfil } = useAuth();

  if (!isAuthRestored) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <div className="w-10 h-10 border-4 border-brand-900/10 border-t-brand-900 rounded-full animate-spin" />
        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Cargando Entorno...</p>
      </div>
    );
  }

  if (empresaActiva) {
    return (
      <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">

        {/* Banner de Bienvenida - Compacto & Profesional */}
        <section className="relative overflow-hidden glass p-6 flex flex-col md:flex-row items-center gap-8 shadow-premium border-b border-white/20">
          <div className="relative w-28 h-28 flex-shrink-0 bg-white rounded-md flex items-center justify-center shadow-2xl ring-2 ring-white/10 overflow-hidden group p-4 border border-gray-50">
            <img src={logoImage} alt="SERCOSYS CORE" className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-700" />
            <div className="absolute inset-0 bg-gradient-to-br from-brand-900/5 to-transparent pointer-events-none" />
          </div>

          <div className="relative space-y-3 text-center md:text-left">
            <div>
              <span className="text-[9px] font-black text-brand-600 bg-brand-50 px-3 py-1 rounded-md uppercase tracking-widest mb-2 inline-block">
                Sercosys Core ERP
              </span>
              <h1 className="text-3xl font-black text-slate-800 tracking-tight uppercase leading-tight">
                Bienvenido, <span className="text-gradient">{perfil?.nombres || ''} {perfil?.apellidos || ''}</span>
              </h1>
            </div>
            <p className="text-slate-500 font-semibold text-sm max-w-2xl">
              Unidad de Negocio activa: <span className="text-slate-800 italic">{empresaActiva.nombre}</span>.
              Selecciona una función en el menú para comenzar.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2 justify-center md:justify-start">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-md shadow-sm border border-gray-50">
                <ShieldCheck size={14} className="text-emerald-500" />
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Seguridad OK</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-md shadow-sm border border-gray-50">
                <Globe size={14} className="text-blue-500" />
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Cloud Active</span>
              </div>
            </div>
          </div>
        </section>

        {/* Accesos Rápidos - Densos */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { title: 'Logística', desc: 'Gestión de Stock e Inventario', icon: Database, color: 'text-brand-900' },
            { title: 'Operaciones', desc: 'Planificación y Producción', icon: LayoutDashboard, color: 'text-indigo-600' },
            { title: 'Comercial', desc: 'Clientes y Sedes', icon: UserCheck, color: 'text-blue-600' }
          ].map((item, i) => (
            <div key={i} className="group bg-white p-6 rounded-md border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 cursor-pointer">
              <div className={`p-3 rounded-lg bg-slate-50 w-fit mb-4 group-hover:bg-brand-900 group-hover:text-white transition-colors duration-300 ${item.color}`}>
                <item.icon size={20} />
              </div>
              <h3 className="text-base font-black text-slate-800 uppercase tracking-tight mb-1">{item.title}</h3>
              <p className="text-xs font-bold text-slate-400 mb-4">{item.desc}</p>
              <div className="flex items-center gap-2 text-[9px] font-black text-brand-900 uppercase tracking-widest group-hover:gap-3 transition-all">
                Explorar <ArrowRight size={12} />
              </div>
            </div>
          ))}
        </div>

      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-1 flex flex-col items-center justify-center space-y-8 animate-in fade-in duration-500">
      <div className="text-center space-y-6">
        <div className="relative inline-flex p-1 bg-white rounded-md text-brand-900 border border-brand-50 shadow-lg">
          <img src={logoImageCompleto} alt="SERCOSYS CORE" className="h-60 w-auto object-contain" />
        </div>

        <div className="space-y-2">
          <h1 className="text-4xl font-black text-slate-800 tracking-tight uppercase leading-none">
            Selecciona <span className="text-gradient">Empresa</span>
          </h1>
          <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px]">Portal de Acceso Sercosys</p>
        </div>

        <div className="max-w-xs mx-auto p-5 glass border border-white/50">
          <p className="text-slate-600 text-sm font-bold italic">
            Elige una unidad arriba para comenzar.
          </p>
        </div>
      </div>
    </div>
  );
}
