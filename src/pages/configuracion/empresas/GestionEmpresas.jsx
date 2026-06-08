import { useEffect, useState, useMemo } from 'react';
import { Edit2, Search, Building2, Building, Plus, MapPin, Phone, Mail, User } from 'lucide-react';
import EmpresasModal from './EmpresasModal';
import { getEmpresas } from '../../../services/empresaService';
import { useModulePermissions } from '../../../hooks/useModulePermissions';

export default function Empresas() {
  const { perfil, renderGuard } = useModulePermissions();
  const [empresas, setEmpresas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('activos'); // 'activos' o 'inactivos'

  // Estado para el Modal
  const [modalAbierto, setModalAbierto] = useState(false);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);

  const fetchEmpresas = async () => {
    setCargando(true);
    setError(null);
    try {
      const data = await getEmpresas();
      setEmpresas(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    fetchEmpresas();
  }, []);

  // Filtrado reactivo de empresas
  const filteredEmpresas = useMemo(() => {
    return empresas.filter(c => {
      const matchesSearch =
        c.nombre?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesTab = activeTab === 'activos' ? c.estatus !== false : c.estatus === false;

      return matchesSearch && matchesTab;
    });
  }, [empresas, searchTerm, activeTab]);

  const handleEdit = (client) => {
    setClienteSeleccionado(client);
    setModalAbierto(true);
  };

  const handleAdd = () => {
    setClienteSeleccionado(null);
    setModalAbierto(true);
  };

  const guard = renderGuard();
  if (guard) return guard;


  return (
    <div className="p-4 sm:p-8 space-y-8 animate-in fade-in duration-500">
      {/* Header Premium */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-[1.5rem] bg-brand-900 flex items-center justify-center text-white shadow-2xl shadow-brand-900/20 relative group overflow-hidden">
            <Building2 size={28} className="relative z-10" />
            <div className="absolute inset-0 bg-gradient-to-br from-brand-600 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight uppercase leading-none">
              Gestión de Empresas
            </h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-3 flex items-center gap-2">
              <Building2 size={12} className="text-brand-500" />
              corporativas
            </p>
          </div>
        </div>

        <button
          onClick={handleAdd}
          className="w-full md:w-auto flex bg-brand-900 text-white px-6 py-2.5 rounded-md text-sm font-bold hover:bg-brand-600 transition-all shadow-lg shadow-brand-accent/20 items-center justify-center gap-2 active:scale-95"
        >
          <Plus size={18} />
          <span>Agregar</span>
        </button>

      </div>

      <div className="bg-white p-4 rounded-md shadow-sm border border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Tabs */}
        <div className="flex bg-gray-50 p-1 rounded-xl border border-gray-100 w-full md:w-auto">
          <button
            onClick={() => setActiveTab('activos')}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'activos'
              ? 'bg-white text-brand-900 shadow-sm'
              : 'text-gray-400 hover:text-gray-600'
              }`}
          >
            <Building2 size={16} />
            Activos
            <span className={`ml-1 px-1.5 py-0.5 rounded-md text-[10px] ${activeTab === 'activos' ? 'bg-brand-50 text-brand-accent' : 'bg-gray-200 text-gray-500'}`}>
              {empresas.filter(c => c.estatus !== false).length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('inactivos')}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'inactivos'
              ? 'bg-white text-red-600 shadow-sm'
              : 'text-gray-400 hover:text-gray-600'
              }`}
          >
            <Building size={16} />
            Inactivos
            <span className={`ml-1 px-1.5 py-0.5 rounded-md text-[10px] ${activeTab === 'inactivos' ? 'bg-red-50 text-red-600' : 'bg-gray-200 text-gray-500'}`}>
              {empresas.filter(c => c.estatus === false).length}
            </span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Buscar por Razón Social, Nombre Comercial o RIF..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:bg-white focus:ring-4 focus:ring-brand-accent/5 focus:border-brand-accent transition-all text-sm font-medium outline-none"
          />
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white rounded-md shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-6 py-4 text-left text-[11px] font-bold text-gray-400 uppercase tracking-widest">Identificación del Cliente</th>
                <th className="px-6 py-4 text-left text-[11px] font-bold text-gray-400 uppercase tracking-widest">Contacto</th>
                <th className="px-6 py-4 text-right text-[11px] font-bold text-gray-400 uppercase tracking-widest">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {cargando && (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-8 h-8 border-4 border-brand-accent/20 border-t-brand-accent rounded-full animate-spin"></div>
                      <span className="text-sm font-bold text-gray-400">Cargando registros...</span>
                    </div>
                  </td>
                </tr>
              )}
              {error && (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-red-500 font-medium">{error}</td>
                </tr>
              )}
              {!cargando && !error && filteredEmpresas.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-2 opacity-40">
                      <Building2 size={48} className="text-gray-300" />
                      <span className="text-sm font-bold text-gray-400">No se encontraron resultados</span>
                    </div>
                  </td>
                </tr>
              )}
              {!cargando && !error && filteredEmpresas.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors group border-b border-slate-50 last:border-0 text-gray-400">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-md flex items-center justify-center text-sm font-black transition-all ${activeTab === 'activos' ? 'bg-brand-900 text-white shadow-sm' : 'bg-red-50 text-red-600'}`}>
                        {(c.nombre?.[0] || '?').toUpperCase()}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[15px] font-black text-slate-700 leading-tight uppercase">{c.nombre}</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-sm font-bold text-slate-500">{c.letradni?.nombre}</span>
                          <span className="text-sm font-bold text-slate-500">{c.dni}</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 text-slate-400">
                          <MapPin size={12} />
                          <span className="text-xs font-medium truncate max-w-[250px] uppercase">{c.direccion}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 whitespace-nowrap">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <User size={14} className="text-brand-accent" />
                        <span className="text-sm font-bold text-slate-600 uppercase">{c.contacto_nombre}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-400">
                        <Phone size={12} />
                        <span className="text-xs font-medium">{c.contacto_telefono}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-400">
                        <Mail size={12} />
                        <span className="text-xs font-medium">{c.contacto_email}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 whitespace-nowrap text-right">
                    <button
                      onClick={() => handleEdit(c)}
                      className="inline-flex items-center justify-center w-11 h-11 text-slate-300 hover:text-amber-500 hover:bg-amber-100 hover:border-amber-200 border border-transparent rounded-md transition-all shadow-sm hover:shadow-amber-500/5 active:scale-90"
                      title="Editar Cliente"
                    >
                      <Edit2 size={20} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalAbierto && (
        <EmpresasModal
          perfil={perfil}
          client={clienteSeleccionado}
          onClose={() => setModalAbierto(false)}
          onUpdate={fetchEmpresas}
        />
      )}
    </div>
  );
}