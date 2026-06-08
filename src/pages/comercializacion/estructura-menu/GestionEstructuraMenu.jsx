import { useState, useEffect } from 'react';
import { ClipboardList, Plus, Search, Edit2, Layers, CheckSquare, Square, Trash2, ArrowRight } from 'lucide-react';
import { useModulePermissions } from '../../../hooks/useModulePermissions';
import { getEstructurasMenu } from '../../../services/estructuraMenuService';
import { getRecetaTipologias } from '../../../services/recetaTipologiaService';
import { getTiposServicios } from '../../../services/tipoServicioService';
import { supabase } from '../../../lib/supabase';
import EstructuraMenuModal from './EstructuraMenuModal';
import ViewUser from '../../../components/user-table/ViewUser';
import { formatDateSystemToDDMMYYYY_HHMMSS } from '../../../util/workDate';

export default function GestionEstructuraMenu() {
  const { perfil, empresaActiva, renderGuard } = useModulePermissions();

  const [loading, setLoading] = useState(true);
  const [estructuras, setEstructuras] = useState([]);
  const [tipologias, setTipologias] = useState([]); // Cache para mostrar nombres en el dashboard
  const [tiposServicios, setTiposServicios] = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  useEffect(() => {
    if (empresaActiva?.id) {
      fetchData();
      getRecetaTipologias(empresaActiva.id).then(setTipologias);
      getTiposServicios(empresaActiva.id).then(setTiposServicios);
      supabase.from('almacen_unidades_medida').select('*').order('nombre').then(res => setUnidades(res.data || []));

      const channel = supabase
        .channel('estructura_menu_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'estructura_menu_base', filter: `id_empresa=eq.${empresaActiva.id}` }, () => fetchData())
        .subscribe();
      return () => supabase.removeChannel(channel);
    }
  }, [empresaActiva?.id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getEstructurasMenu(empresaActiva.id);
      setEstructuras(res || []);
    } catch (error) {
      console.error('Error fetching estructuras:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredData = estructuras.filter(e =>
    e.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const guard = renderGuard();
  if (guard) return guard;

  return (
    <div className="p-4 sm:p-8 space-y-2 animate-in fade-in duration-500 bg-slate-50 min-h-screen">

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-md bg-brand-900 flex items-center justify-center text-white shadow-xl">
            <ClipboardList size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight uppercase leading-none">
              Clasificación por Tipo de Servicio
            </h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-3">
              Configuración de Renglones por Nivel de Servicio
            </p>
          </div>
        </div>

        <button
          onClick={() => { setSelectedItem(null); setShowModal(true); }}
          className="flex bg-brand-900 text-white px-8 py-4 rounded-md text-sm font-black uppercase tracking-widest hover:bg-brand-600 transition-all shadow-xl shadow-brand-900/20 active:scale-95 items-center gap-2"
        >
          <Plus size={18} />
          Nueva Clasificación
        </button>
      </div>

      <div className="relative max-w-xl">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input
          type="text"
          placeholder="Buscar estructura (Ej: Básico, VIP)..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="pl-12 pr-6 py-4 bg-white border border-gray-100 rounded-md text-sm font-semibold text-slate-700 outline-none focus:ring-4 focus:ring-brand-900/10 focus:border-brand-900 transition-all w-full shadow-sm"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {loading ? (
          Array(2).fill(0).map((_, i) => (
            <div key={i} className="h-64 bg-white rounded-[2.5rem] border border-gray-100 animate-pulse" />
          ))
        ) : filteredData.length > 0 ? (
          filteredData.map(est => (
            <div key={est.id} className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-xl transition-all p-8 flex flex-col gap-6 group relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-brand-50 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform" />

              <div className="flex justify-between items-start relative z-10">
                <div className="flex flex-col gap-1">
                  <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">{est.nombre}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[9px] font-black text-brand-900 bg-brand-50 px-2 py-0.5 rounded-lg border border-brand-100 uppercase tracking-widest">
                      {est.slots?.length || 0} Renglones (Slots)
                    </span>
                    {est.id_tipo_servicio && (
                      <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100 uppercase tracking-widest">
                        {tiposServicios.find(ts => ts.id === est.id_tipo_servicio)?.nombre || 'Servicio Vinculado'}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setSelectedItem(est); setShowModal(true); }}
                    className="p-3 bg-slate-50 text-slate-400 hover:text-brand-900 hover:bg-brand-50 rounded-md transition-all"
                  >
                    <Edit2 size={18} />
                  </button>
                </div>
              </div>

              {/* Vista previa de Slots */}
              <div className="space-y-3 relative z-10">
                {est.slots?.sort((a, b) => a.orden - b.orden).map(slot => (
                  <div key={slot.id} className="flex flex-col gap-2 p-4 bg-slate-50/50 rounded-md border border-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black text-slate-700 uppercase tracking-tight flex items-center gap-2">
                        <Layers size={12} className="text-brand-900" /> {slot.nombre}
                      </span>
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest italic">Orden {slot.orden}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {slot.tipologias?.map(t => (
                        <span key={t.id_tipologia} className="text-[9px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-100">
                          {t.tipologia_info?.nombre}
                        </span>
                      ))}
                      {(!slot.tipologias || slot.tipologias.length === 0) && (
                        <span className="text-[9px] font-bold text-red-400 italic">Sin tipologías asignadas</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-slate-50 flex justify-between items-center">
                <ViewUser textDisplay="Última mod." usuario={est.usuario_update || est.usuario_create} timestamp={est.timestamp_update || est.timestamp_create} formatDate={formatDateSystemToDDMMYYYY_HHMMSS} />
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full py-40 flex flex-col items-center justify-center opacity-30">
            <ClipboardList size={64} className="text-slate-400 mb-4" />
            <p className="text-xl font-black uppercase tracking-widest text-slate-400">No hay estructuras definidas</p>
          </div>
        )}
      </div>

      {showModal && (
        <EstructuraMenuModal
          initialData={selectedItem}
          tipologias={tipologias}
          tiposServicios={tiposServicios}
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
