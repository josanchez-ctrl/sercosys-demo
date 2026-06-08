import { useState, useEffect, useMemo } from 'react';
import { MapPin, Phone, Mail, User, Plus, Edit2, Search, Building2, Building, ChevronRight, Users, CheckCircle2 } from 'lucide-react';
import { useModulePermissions } from '../../../hooks/useModulePermissions';
import { getSucursales } from '../../../services/sucursalService';
import { getClientes } from '../../../services/clienteService';
import SucursalesModal from './SucursalesModal';

export default function GestionSucursales() {
  const { perfil, empresaActiva, renderGuard } = useModulePermissions();

  // Estados de datos
  const [sucursales, setSucursales] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  // Estados de UI y Filtros
  const [activeTab, setActiveTab] = useState('activos');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [sucursalParaEditar, setSucursalParaEditar] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [busquedaClientes, setBusquedaClientes] = useState('');
  const [clienteSeleccionadoId, setClienteSeleccionadoId] = useState(null);

  useEffect(() => {
    if (empresaActiva?.id) {
      cargarTodo(empresaActiva.id);
    }
  }, [empresaActiva?.id]);

  const cargarTodo = async (id_empresa) => {
    setCargando(true);
    try {
      const [dataSucursales, dataClientes] = await Promise.all([
        getSucursales(id_empresa),
        getClientes()
      ]);
      setSucursales(dataSucursales || []);
      setClientes(dataClientes || []);
    } catch (err) {
      setError('No se pudieron cargar los datos de gestión');
    } finally {
      setCargando(false);
    }
  };

  // Filtrado de Clientes para el Sidebar
  const clientesFiltrados = useMemo(() => {
    return clientes.filter(c =>
      c.nombre?.toLowerCase().includes(busquedaClientes.toLowerCase()) ||
      c.dni?.toLowerCase().includes(busquedaClientes.toLowerCase())
    );
  }, [clientes, busquedaClientes]);

  // Filtrado de Sucursales (Tab + Cliente + Buscador)
  const sucursalesFiltradas = useMemo(() => {
    return sucursales.filter(s => {
      const matchesSearch =
        s.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
        s.nombre_responsable?.toLowerCase().includes(busqueda.toLowerCase());

      const matchesTab = activeTab === 'activos' ? s.estatus !== false : s.estatus === false;
      const matchesCliente = clienteSeleccionadoId ? s.id_cliente === clienteSeleccionadoId : true;

      return matchesSearch && matchesTab && matchesCliente;
    });
  }, [sucursales, busqueda, activeTab, clienteSeleccionadoId]);

  const clienteActivo = useMemo(() =>
    clientes.find(c => c.id === clienteSeleccionadoId),
    [clientes, clienteSeleccionadoId]);

  const handleOpenModal = (sucursal = null) => {
    setSucursalParaEditar(sucursal);
    setModalAbierto(true);
  };

  const guard = renderGuard();
  if (guard) return guard;

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-slate-50/50 animate-in fade-in duration-500">

      {/* SIDEBAR DE CLIENTES (MAESTRO) */}
      <aside className="w-72 bg-white border-r border-gray-100 flex flex-col shadow-sm">
        <div className="p-4 border-b border-gray-50 bg-slate-50/30">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 bg-brand-50 rounded-md text-brand-900">
              <Users size={14} />
            </div>
            <h2 className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Directorio de Clientes</h2>
          </div>

          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-brand-500 transition-colors" size={14} />
            <input
              type="text"
              placeholder="Buscar cliente..."
              value={busquedaClientes}
              onChange={(e) => setBusquedaClientes(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-gray-100 rounded-xl text-[11px] font-bold text-slate-600 outline-none focus:ring-4 focus:ring-brand-accent/5 focus:border-brand-accent transition-all placeholder:text-slate-300"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
          <button
            onClick={() => setClienteSeleccionadoId(null)}
            className={`w-full flex items-center justify-between p-3 rounded-xl transition-all group ${!clienteSeleccionadoId ? 'bg-brand-900 text-white shadow-lg shadow-brand-900/20' : 'text-slate-400 hover:bg-slate-50'}`}
          >
            <div className="flex items-center gap-3">
              <Building2 size={16} className={!clienteSeleccionadoId ? 'text-brand-300' : 'text-slate-300'} />
              <span className="text-[11px] font-black uppercase tracking-widest">Todos los Clientes</span>
            </div>
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${!clienteSeleccionadoId ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}`}>
              {sucursales.length}
            </span>
          </button>

          <div className="pt-4 pb-2 px-3">
            <div className="h-px bg-gray-100 w-full" />
          </div>

          {clientesFiltrados.map(cliente => {
            const count = sucursales.filter(s => s.id_cliente === cliente.id).length;
            const isActive = clienteSeleccionadoId === cliente.id;
            return (
              <button
                key={cliente.id}
                onClick={() => setClienteSeleccionadoId(cliente.id)}
                className={`w-full flex items-center justify-between p-3 rounded-xl transition-all group ${isActive ? 'bg-white border-2 border-brand-900 text-brand-900 shadow-sm' : 'text-slate-500 hover:bg-white hover:shadow-sm border-2 border-transparent'}`}
              >
                <div className="flex items-center gap-3">
                  <User size={16} className={isActive ? 'text-brand-500' : 'text-slate-300'} />
                  <div className="flex flex-col items-start">
                    <span className={`text-[10px] font-black uppercase tracking-tight truncate max-w-[140px] ${isActive ? 'text-brand-900' : 'text-slate-600'}`}>
                      {cliente.nombre}
                    </span>
                    <span className="text-[8px] font-bold text-slate-300 tabular-nums">{cliente.dni}</span>
                  </div>
                </div>
                {count > 0 && (
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${isActive ? 'bg-brand-900 text-white' : 'bg-slate-50 text-slate-400 group-hover:bg-brand-50 group-hover:text-brand-500'}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </aside>

      {/* PANEL PRINCIPAL (DETALLE) */}
      <main className="flex-1 flex flex-col overflow-hidden">

        {/* Header Dinámico - Congruente */}
        <header className="px-6 py-4 bg-white border-b border-gray-100 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-gradient-brand flex items-center justify-center text-white shadow-lg">
              <MapPin size={20} />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-800 tracking-tight uppercase leading-none">
                Sedes por <span className="text-gradient">Cliente</span>
              </h1>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">
                {clienteActivo ? `Gestionando: ${clienteActivo.nombre}` : 'Todas las sedes operativas'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative group mr-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-brand-500 transition-colors" size={16} />
              <input
                type="text"
                placeholder="Buscar en sedes..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-64 pl-10 pr-4 py-2 bg-gray-50/50 border border-gray-100 rounded-xl text-sm font-semibold text-slate-600 outline-none focus:ring-4 focus:ring-brand-accent/5 focus:border-brand-accent transition-all"
              />
            </div>

            <button
              onClick={() => handleOpenModal()}
              className="flex bg-brand-900 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-brand-600 transition-all shadow-lg shadow-brand-accent/20 items-center gap-2 active:scale-95"
            >
              <Plus size={18} />
              <span>Nueva Sede</span>
            </button>
          </div>
        </header>

        {/* CONTENIDO FILTRADO */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">

          <div className="flex items-center justify-between mb-6">
            <div className="flex bg-white p-1 rounded-xl border border-gray-100 shadow-sm">
              {['activos', 'inactivos'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex items-center gap-2 px-6 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === tab
                    ? 'bg-brand-900 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-600'
                    }`}
                >
                  {tab === 'activos' ? <CheckCircle2 size={14} /> : <Building size={14} />}
                  {tab}
                  <span className={`ml-2 px-1.5 py-0.5 rounded-md text-[9px] ${activeTab === tab ? 'bg-white/20' : 'bg-gray-100 text-gray-500'}`}>
                    {sucursales.filter(s => (activeTab === 'activos' ? s.estatus !== false : s.estatus === false) && (clienteSeleccionadoId ? s.id_cliente === clienteSeleccionadoId : true)).length}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-slate-50/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Identificación</th>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Responsable / Contacto</th>
                    {!clienteSeleccionadoId && <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Cliente</th>}
                    <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 bg-white">
                  {cargando ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-20 text-center">
                        <div className="flex flex-col items-center gap-4">
                          <div className="w-12 h-12 border-4 border-brand-accent/20 border-t-brand-accent rounded-full animate-spin"></div>
                          <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Sincronizando Sedes...</span>
                        </div>
                      </td>
                    </tr>
                  ) : sucursalesFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-24 text-center">
                        <div className="flex flex-col items-center gap-4 opacity-40">
                          <div className="p-6 bg-slate-50 rounded-[2.5rem]">
                            <MapPin size={48} className="text-slate-300" />
                          </div>
                          <div className="space-y-1">
                            <span className="text-sm font-black text-slate-500 uppercase block tracking-widest">No hay sedes registradas</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Aún no se han configurado sucursales para este criterio</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    sucursalesFiltradas.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/50 transition-all group border-b border-slate-50 last:border-0">
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-black transition-all ${activeTab === 'activos' ? 'bg-brand-50 text-brand-900' : 'bg-slate-100 text-slate-400'}`}>
                              <Building2 size={20} />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm font-black text-slate-700 leading-tight uppercase tracking-tight">{s.nombre}</span>
                              <div className="flex items-center gap-1.5 mt-1 text-slate-400">
                                <MapPin size={10} className="text-brand-500" />
                                <span className="text-[10px] font-bold truncate max-w-[250px] uppercase tracking-wide">{s.direccion || 'Sin dirección registrada'}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                                <User size={12} />
                              </div>
                              <span className="text-[11px] font-black text-slate-600 uppercase">{s.nombre_responsable || 'NO ASIGNADO'}</span>
                            </div>
                            <div className="flex items-center gap-4 pl-8">
                              <div className="flex items-center gap-1.5 text-slate-400">
                                <Phone size={10} />
                                <span className="text-[10px] font-bold tabular-nums">{s.telefono_responsable || 'S/N'}</span>
                              </div>
                              {s.email_responsable && (
                                <div className="flex items-center gap-1.5 text-slate-400">
                                  <Mail size={10} />
                                  <span className="text-[10px] font-bold">{s.email_responsable.toLowerCase()}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        {!clienteSeleccionadoId && (
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-2 px-3 py-1 bg-slate-50 border border-slate-100 rounded-full w-fit">
                              <User size={10} className="text-slate-400" />
                              <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">
                                {s.clientes?.nombre || 'INTERNA / GLOBAL'}
                              </span>
                            </div>
                          </td>
                        )}
                        <td className="px-6 py-5 text-right">
                          <button
                            type="button"
                            onClick={() => handleOpenModal(s)}
                            className="inline-flex items-center justify-center w-10 h-10 text-slate-300 hover:text-brand-900 hover:bg-white hover:shadow-md rounded-xl transition-all active:scale-90 border border-transparent hover:border-slate-100"
                          >
                            <Edit2 size={18} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {modalAbierto && (
        <SucursalesModal
          empresaActiva={empresaActiva}
          perfil={perfil}
          nombre_cliente={clienteActivo?.nombre || empresaActiva?.nombre}
          sucursal={sucursalParaEditar}
          clienteSeleccionadoId={clienteSeleccionadoId}
          onClose={() => setModalAbierto(false)}
          onUpdate={() => cargarTodo(empresaActiva?.id)}
        />
      )}
    </div>
  );
}
