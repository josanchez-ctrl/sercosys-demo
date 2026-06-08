import { useState, useEffect } from 'react';
import { Type, Plus, Search, Edit2, Trash2 } from 'lucide-react';
import { useModulePermissions } from '../../../hooks/useModulePermissions';
import { getRecetaTipologias, saveRecetaTipologia } from '../../../services/recetaTipologiaService';
import { supabase } from '../../../lib/supabase';
import RecetaTipologiaModal from './RecetaTipologiaModal';
import ViewUser from '../../../components/user-table/ViewUser';
import { formatDateSystemToDDMMYYYY_HHMMSS } from '../../../util/workDate';

export default function GestionRecetaTipologias() {
  const { perfil, empresaActiva, renderGuard } = useModulePermissions();

  const [loading, setLoading] = useState(true);
  const [tipologias, setTipologias] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  useEffect(() => {
    if (empresaActiva?.id) {
      fetchData();
      const channel = supabase
        .channel('receta_tipologia_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'receta_tipologias', filter: `id_empresa=eq.${empresaActiva.id}` }, () => fetchData())
        .subscribe();
      return () => supabase.removeChannel(channel);
    }
  }, [empresaActiva?.id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getRecetaTipologias(empresaActiva.id);
      setTipologias(res || []);
    } catch (error) {
      console.error('Error fetching tipologias:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredData = tipologias.filter(t =>
    t.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const guard = renderGuard();
  if (guard) return guard;

  return (
    <div className="p-4 sm:p-8 space-y-8 animate-in fade-in duration-500 bg-slate-50 min-h-screen">

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-md bg-brand-900 flex items-center justify-center text-white shadow-xl">
            <Type size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight uppercase leading-none">
              Tipologías de Recetas
            </h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-3">
              Categorización para Planificación de Menús
            </p>
          </div>
        </div>

        <button
          onClick={() => { setSelectedItem(null); setShowModal(true); }}
          className="flex bg-brand-900 text-white px-8 py-4 rounded-md text-sm font-black uppercase tracking-widest hover:bg-brand-600 transition-all shadow-xl shadow-brand-900/20 active:scale-95 items-center gap-2"
        >
          <Plus size={18} />
          Nueva Tipología
        </button>
      </div>

      <div className="relative max-w-xl">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input
          type="text"
          placeholder="Buscar tipología..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="pl-12 pr-6 py-4 bg-white border border-gray-100 rounded-md text-sm font-semibold text-slate-700 outline-none focus:ring-4 focus:ring-brand-900/10 focus:border-brand-900 transition-all w-full shadow-sm"
        />
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50/50">
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-gray-100">Nombre</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-gray-100">Abreviatura</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-gray-100 text-center">Estatus</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-gray-100">Auditoría</th>
              <th className="px-8 py-5 text-right border-b border-gray-100"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              Array(3).fill(0).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td colSpan={4} className="px-8 py-8"><div className="h-4 bg-gray-100 rounded w-full"></div></td>
                </tr>
              ))
            ) : filteredData.length > 0 ? (
              filteredData.map(item => (
                <tr key={item.id} className="hover:bg-slate-50/50 transition-all group">
                  <td className="px-8 py-6 font-black text-slate-700 uppercase tracking-tight text-sm">
                    <div className="flex items-center gap-2">
                      {item.nombre}
                      {item.es_base && (
                        <span className="text-[8px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200 tracking-tighter">BASE</span>
                      )}
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className="text-[10px] font-black text-brand-900 bg-brand-50 px-3 py-1 rounded-lg uppercase">
                      {item.abreviatura || 'N/A'}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${item.estatus ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                      {item.estatus ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-8 py-6">
                    <ViewUser textDisplay="Creado por" usuario={item.usuario_create} timestamp={item.timestamp_create} formatDate={formatDateSystemToDDMMYYYY_HHMMSS} />
                  </td>
                  <td className="px-8 py-6 text-right">
                    <button
                      onClick={() => { setSelectedItem(item); setShowModal(true); }}
                      className="p-2 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                    >
                      <Edit2 size={18} />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-8 py-20 text-center opacity-30 italic text-sm font-bold uppercase tracking-widest">No hay tipologías registradas</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <RecetaTipologiaModal
          initialData={selectedItem}
          empresaActiva={empresaActiva}
          perfil={perfil}
          onClose={() => setShowModal(false)}
          onUpdate={fetchData}
        />
      )}
    </div>
  );
}
