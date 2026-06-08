import { useState, useEffect } from 'react';
import { ArrowRightFromLine, Plus, Search, Edit2, Utensils, MapPin } from 'lucide-react';
import { useModulePermissions } from '../../../hooks/useModulePermissions';
import { getComedores } from '../../../services/comedorService';
import { getSucursales } from '../../../services/sucursalService';
import { getTiposServicios } from '../../../services/tipoServicioService';
import { getEstructurasMenu } from '../../../services/estructuraMenuService';
import { supabase } from '../../../lib/supabase';
import ComedorModal from './ComedorModal';
import ViewUser from '../../../components/user-table/ViewUser';
import { formatDateSystemToDDMMYYYY_HHMMSS } from '../../../util/workDate';

export default function GestionComedores() {
  const { perfil, empresaActiva, renderGuard } = useModulePermissions();

  const [loading, setLoading] = useState(true);
  const [comedores, setComedores] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [tiposServicios, setTiposServicios] = useState([]);
  const [estructuras, setEstructuras] = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  useEffect(() => {
    if (empresaActiva?.id) {
      fetchData();
      loadMasters();

      const channel = supabase
        .channel('comedores_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'comedores', filter: `id_empresa=eq.${empresaActiva.id}` }, () => fetchData())
        .subscribe();
      return () => supabase.removeChannel(channel);
    }
  }, [empresaActiva?.id]);

  const loadMasters = async () => {
    try {
      const [s, ts, e, u] = await Promise.all([
        getSucursales(empresaActiva.id),
        getTiposServicios(empresaActiva.id),
        getEstructurasMenu(empresaActiva.id),
        supabase.from('almacen_unidades_medida').select('*').order('nombre')
      ]);
      setSucursales(s || []);
      setTiposServicios(ts || []);
      setEstructuras(e || []);
      setUnidades(u.data || []);
    } catch (error) {
      console.error('Error loading masters:', error);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getComedores(empresaActiva.id);
      setComedores(res || []);
    } catch (error) {
      console.error('Error fetching comedores:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredData = comedores.filter(c =>
    c.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.sucursal?.nombre?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const guard = renderGuard();
  if (guard) return guard;

  return (
    <div className="p-4 sm:p-8 space-y-2 animate-in fade-in duration-500 bg-slate-50 min-h-screen">

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-md bg-brand-900 flex items-center justify-center text-white shadow-xl">
            <ArrowRightFromLine size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight uppercase leading-none">
              Gestión de Comedores
            </h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-3">
              Configuración Operativa y Servicios Activos
            </p>
          </div>
        </div>

        <button
          onClick={() => { setSelectedItem(null); setShowModal(true); }}
          className="flex bg-brand-900 text-white px-8 py-4 rounded-md text-sm font-black uppercase tracking-widest hover:bg-brand-600 transition-all shadow-xl shadow-brand-900/20 active:scale-95 items-center gap-2"
        >
          <Plus size={18} />
          Nuevo Comedor
        </button>
      </div>

      <div className="relative max-w-xl">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input
          type="text"
          placeholder="Buscar comedor o sucursal..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="pl-12 pr-6 py-4 bg-white border border-gray-100 rounded-md text-sm font-semibold text-slate-700 outline-none focus:ring-4 focus:ring-brand-900/10 focus:border-brand-900 transition-all w-full shadow-sm"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {loading ? (
          Array(3).fill(0).map((_, i) => (
            <div key={i} className="h-64 bg-white rounded-[2.5rem] border border-gray-100 animate-pulse" />
          ))
        ) : filteredData.length > 0 ? (
          filteredData.map(com => (
            <div key={com.id} className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-xl transition-all p-8 flex flex-col gap-6 group relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-brand-50 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform" />

              <div className="flex justify-between items-start relative z-10">
                <div className="flex flex-col gap-1">
                  <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight leading-tight">{com.nombre}</h3>
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <MapPin size={12} className="text-brand-900" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">{com.sucursal?.nombre}</span>
                  </div>
                </div>
                <button
                  onClick={() => { setSelectedItem(com); setShowModal(true); }}
                  className="p-3 bg-slate-50 text-slate-400 hover:text-brand-900 hover:bg-brand-50 rounded-md transition-all shadow-sm"
                >
                  <Edit2 size={18} />
                </button>
              </div>

              <div className="space-y-3 relative z-10">
                <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em] mb-2">Servicios Configurados</p>
                <div className="flex flex-wrap gap-2">
                  {com.servicios_config?.map(srv => (
                    <div key={srv.id} className="flex flex-col bg-slate-50 border border-slate-100 rounded-xl p-2 min-w-[80px]">
                      <span className="text-[9px] font-black text-brand-900 uppercase truncate">{srv.tipo_servicio?.nombre}</span>
                      <span className="text-[8px] font-bold text-slate-400 uppercase italic truncate">{srv.estructura?.nombre}</span>
                    </div>
                  ))}
                  {(!com.servicios_config || com.servicios_config.length === 0) && (
                    <span className="text-[9px] font-bold text-red-400 italic">Sin servicios configurados</span>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-50 flex justify-between items-center mt-auto">
                <ViewUser textDisplay="Modificado" usuario={com.usuario_update || com.usuario_create} timestamp={com.timestamp_update || com.timestamp_create} formatDate={formatDateSystemToDDMMYYYY_HHMMSS} />
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full py-40 flex flex-col items-center justify-center opacity-30">
            <Utensils size={64} className="text-slate-400 mb-4" />
            <p className="text-xl font-black uppercase tracking-widest text-slate-400">No hay comedores registrados</p>
          </div>
        )}
      </div>

      {showModal && (
        <ComedorModal
          initialData={selectedItem}
          sucursales={sucursales}
          tiposServicios={tiposServicios}
          estructuras={estructuras}
          unidades={unidades}
          empresaActiva={empresaActiva}
          perfil={perfil}
          onClose={() => setShowModal(false)}
          onUpdate={fetchData}
        />
      )}
    </div>
  );
}
