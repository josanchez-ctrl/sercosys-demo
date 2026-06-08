import { useState, useEffect, useRef } from 'react';
import { Building2, ChevronDown, Check, Globe } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getEmpresas, getEmpresasByIds } from '../../services/empresaService';

export default function GlobalClientSelector() {
  const { perfil, clienteActivo, empresaActiva, cambiarEmpresa } = useAuth();
  const [empresas, setEmpresas] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!perfil) return;

    if (perfil.F_ALL) {
      // Si tiene permiso F_ALL, cargar todos los clientes
      getEmpresas()
        .then(setEmpresas)
        .catch(console.error);
    } else if (perfil.ids_clientes?.length > 0) {
      // Si no, filtrar por los IDs asignados
      getEmpresasByIds(perfil.ids_clientes)
        .then(setEmpresas)
        .catch(console.error);
    }
  }, [perfil]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // No bloqueamos el renderizado si solo hay una empresa, permitimos que el usuario vea el detalle
  const displayNombre = empresaActiva?.nombre || 'Cargando...';

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-3 px-4 py-2 rounded-xl transition-all duration-300 border h-10 ${isOpen
          ? 'bg-brand-50 border-brand-200 text-brand-700 shadow-sm'
          : 'bg-white border-slate-200 text-slate-700 hover:border-brand-300 hover:bg-slate-50 shadow-sm hover:shadow-md'
          }`}
      >
        <div className={`p-1 rounded-lg ${isOpen ? 'bg-brand-100 text-brand-600' : 'bg-slate-100 text-slate-500'}`}>
          <Building2 size={14} />
        </div>
        <div className="flex flex-col items-start leading-tight">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Empresa Activa</span>
          <span className="text-xs font-black uppercase tracking-tight truncate max-w-[150px]">
            {empresaActiva?.nombre || 'Seleccionar...'}
          </span>
        </div>
        <ChevronDown size={14} className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-white rounded-md shadow-2xl border border-slate-100 overflow-hidden z-[110] animate-in fade-in zoom-in-95 slide-in-from-top-2">
          <div className="p-4 bg-slate-50/50 border-b border-slate-100">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Cambiar Unidad de Negocio</h3>
          </div>

          <div className="max-h-60 overflow-y-auto py-2">
            {empresas.map((emp) => (
              <button
                key={emp.id}
                onClick={() => {
                  cambiarEmpresa(emp.id);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${clienteActivo === emp.id
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-slate-600 hover:bg-slate-50'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black ${clienteActivo === emp.id ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-500'
                    }`}>
                    {emp.letra?.nombre || emp.nombre.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className={`text-xs font-black uppercase tracking-tight ${clienteActivo === emp.id ? 'text-brand-900' : 'text-slate-800'}`}>
                      {emp.nombre}
                    </p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Sercosys Unit</p>
                  </div>
                </div>
                {clienteActivo === emp.id && <Check size={16} className="text-brand-600" />}
              </button>
            ))}
          </div>

          <div className="p-3 bg-slate-50/50 text-center border-t border-slate-100">
            <div className="flex items-center justify-center gap-2 text-[9px] font-black text-slate-300 uppercase tracking-widest">
              <Globe size={10} />
              <span>Entorno Corporativo Multi-Empresa</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
