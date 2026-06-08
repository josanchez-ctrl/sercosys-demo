import { useState, useEffect } from 'react';
import { ArrowRightFromLine, Plus, Search, Edit2, Trash2, ClipboardList, Utensils } from 'lucide-react';
import { useModulePermissions } from '../../../hooks/useModulePermissions';
import { getRecetas, deleteReceta } from '../../../services/recetaService';
import { getRecetaTipologias } from '../../../services/recetaTipologiaService';
import { getRubros } from '../../../services/rubroService';
import { supabase } from '../../../lib/supabase';
import RecetaModal from './RecetaModal';
import ViewUser from '../../../components/user-table/ViewUser';
import { formatDateSystemToDDMMYYYY_HHMMSS } from '../../../util/workDate';

const getTipologiaBadgeStyle = (name) => {
  const uppercaseName = name?.toUpperCase() || '';
  if (uppercaseName.includes('SOPA')) return 'bg-orange-50 text-orange-600 border-orange-100';
  if (uppercaseName.includes('SECO') || uppercaseName.includes('PRINCIPAL')) return 'bg-emerald-50 text-emerald-600 border-emerald-100';
  if (uppercaseName.includes('BEBIDA') || uppercaseName.includes('JUGO')) return 'bg-sky-50 text-sky-600 border-sky-100';
  if (uppercaseName.includes('AVE') || uppercaseName.includes('POLLO') || uppercaseName.includes('CARNE') || uppercaseName.includes('PROTEINA')) return 'bg-amber-50 text-amber-600 border-amber-100';
  if (uppercaseName.includes('POSTRE')) return 'bg-pink-50 text-pink-600 border-pink-100';
  if (uppercaseName.includes('ENSALADA') || uppercaseName.includes('ENTRADA')) return 'bg-teal-50 text-teal-600 border-teal-100';
  return 'bg-slate-50 text-slate-500 border-slate-200';
};

export default function GestionRecetas() {
  const { perfil, empresaActiva, renderGuard } = useModulePermissions();

  const [loading, setLoading] = useState(true);
  const [recetas, setRecetas] = useState([]);
  const [tipologias, setTipologias] = useState([]);
  const [rubros, setRubros] = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  useEffect(() => {
    if (empresaActiva?.id) {
      fetchData();
      loadMasters();

      const channel = supabase
        .channel('recetas_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'maestro_recetas', filter: `id_empresa=eq.${empresaActiva.id}` }, () => fetchData())
        .subscribe();
      return () => supabase.removeChannel(channel);
    }
  }, [empresaActiva?.id]);

  const loadMasters = async () => {
    try {
      const [t, r, u] = await Promise.all([
        getRecetaTipologias(empresaActiva.id),
        getRubros(empresaActiva.id),
        supabase.from('almacen_unidades_medida').select('*').order('nombre')
      ]);
      setTipologias(t || []);
      setRubros(r || []);
      setUnidades(u.data || []);
    } catch (error) {
      console.error('Error loading masters:', error);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getRecetas(empresaActiva.id);
      setRecetas(res || []);
    } catch (error) {
      console.error('Error fetching recetas:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('¿Está seguro de eliminar esta receta?')) {
      try {
        await deleteReceta(id);
        fetchData();
      } catch (error) {
        alert(error.message);
      }
    }
  };

  const filteredData = recetas.filter(r =>
    r.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.codigo_ficha.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedRecetas = [...filteredData].sort((a, b) => {
    const tipA = a.tipologia?.nombre || 'SIN CLASIFICAR';
    const tipB = b.tipologia?.nombre || 'SIN CLASIFICAR';
    const compTip = tipA.localeCompare(tipB);
    if (compTip !== 0) return compTip;
    return a.codigo_ficha.localeCompare(b.codigo_ficha);
  });

  const guard = renderGuard();
  if (guard) return guard;

  return (
    <div className="p-4 sm:p-8 space-y-8 animate-in fade-in duration-500 bg-slate-50 min-h-screen">

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-md bg-brand-900 flex items-center justify-center text-white shadow-xl">
            <ClipboardList size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight uppercase leading-none">
              Maestro de Recetas
            </h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-3">
              Fichas Técnicas y Control de Operaciones
            </p>
          </div>
        </div>

        <button
          onClick={() => { setSelectedItem(null); setShowModal(true); }}
          className="flex bg-brand-900 text-white px-8 py-4 rounded-md text-sm font-black uppercase tracking-widest hover:bg-brand-600 transition-all shadow-xl shadow-brand-900/20 active:scale-95 items-center gap-2"
        >
          <Plus size={18} />
          Nueva Receta
        </button>
      </div>

      <div className="relative max-w-xl">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input
          type="text"
          placeholder="Buscar por nombre o código de ficha..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="pl-12 pr-6 py-4 bg-white border border-gray-100 rounded-md text-sm font-semibold text-slate-700 outline-none focus:ring-4 focus:ring-brand-900/10 focus:border-brand-900 transition-all w-full shadow-sm"
        />
      </div>

      <div className="space-y-12">
        {loading ? (
          <div className="border border-gray-100 rounded-2xl overflow-hidden bg-white shadow-sm p-8 space-y-4">
            {Array(5).fill(0).map((_, i) => (
              <div key={i} className="h-12 bg-slate-50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : sortedRecetas.length > 0 ? (
          <div className="bg-white rounded-md border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-gray-200">
                    <th className="px-6 py-3.5 w-[20%]">Tipología</th>
                    <th className="px-6 py-3.5 w-[15%]">Código</th>
                    <th className="px-6 py-3.5 w-[50%]">Nombre Receta</th>
                    <th className="px-6 py-3.5 w-[15%] text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-150">
                  {sortedRecetas.map(rec => {
                    const insumosCount = rec.ingredientes?.filter(i => i.id_rubro).length || 0;
                    const subrecetasCount = rec.ingredientes?.filter(i => i.id_sub_receta).length || 0;
                    const tipologiaNombre = rec.tipologia?.nombre || 'SIN CLASIFICAR';
                    
                    return (
                      <tr key={rec.id} className="hover:bg-slate-50/50 transition-all">
                        <td className="px-6 py-3.5">
                          <span className={`px-3 py-1.5 rounded-full border text-[9px] font-black uppercase tracking-wider ${getTipologiaBadgeStyle(tipologiaNombre)}`}>
                            {tipologiaNombre}
                          </span>
                        </td>
                        <td className="px-6 py-3.5">
                          <span className="text-xs font-mono font-bold text-slate-500">{rec.codigo_ficha}</span>
                        </td>
                        <td className="px-6 py-3.5">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm font-black text-slate-800 uppercase leading-tight">{rec.nombre}</span>
                            <span className="text-[10px] font-bold text-slate-400">
                              {insumosCount} Ingrediente{insumosCount !== 1 ? 's' : ''}
                              {subrecetasCount > 0 && (
                                <>
                                  <span className="mx-1.5 text-slate-300">|</span>
                                  <span className="text-brand-900 font-bold">{subrecetasCount} Subreceta{subrecetasCount !== 1 ? 's' : ''}</span>
                                </>
                              )}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-3.5">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => { setSelectedItem(rec); setShowModal(true); }}
                              className="p-2 bg-slate-50 text-slate-400 hover:text-brand-900 hover:bg-brand-50 rounded-lg transition-all border border-transparent hover:border-brand-100 shadow-sm"
                              title="Editar Receta"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(rec.id)}
                              className="p-2 bg-slate-50 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all border border-transparent hover:border-red-100 shadow-sm"
                              title="Eliminar Receta"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="py-40 flex flex-col items-center justify-center opacity-30 bg-white rounded-md border border-gray-100 shadow-sm">
            <ClipboardList size={64} className="text-slate-400 mb-4" />
            <p className="text-xl font-black uppercase tracking-widest text-slate-400">No hay recetas registradas</p>
          </div>
        )}
      </div>

      {showModal && (
        <RecetaModal
          initialData={selectedItem}
          tipologias={tipologias}
          rubros={rubros}
          unidades={unidades}
          recetasDisponibles={recetas} // Para sub-recetas
          empresaActiva={empresaActiva}
          perfil={perfil}
          onClose={() => setShowModal(false)}
          onUpdate={fetchData}
        />
      )}
    </div>
  );
}
