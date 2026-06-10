import { useState, useEffect } from 'react';
import { ArrowRightFromLine, Plus, Search, Edit2, Trash2, ClipboardList, Utensils, AlertTriangle, Copy } from 'lucide-react';
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

// Helper recursivo para determinar si una receta contiene alérgenos (directa o indirectamente)
const checkAlergenoRecursivo = (recetaId, recetasMap, visitados = new Set()) => {
  if (visitados.has(recetaId)) return false;
  visitados.add(recetaId);

  const receta = recetasMap.get(recetaId);
  if (!receta) return false;

  // 1. Alérgenos directos en insumos
  const tieneAlergenoDirecto = receta.ingredientes?.some(ing => ing.rubro?.es_alergeno === true);
  if (tieneAlergenoDirecto) return true;

  // 2. Alérgenos indirectos en subrecetas
  const tieneAlergenoIndirecto = receta.ingredientes?.some(ing => {
    if (ing.id_sub_receta) {
      return checkAlergenoRecursivo(ing.id_sub_receta, recetasMap, visitados);
    }
    return false;
  });

  return tieneAlergenoIndirecto || false;
};

export default function GestionRecetas() {
  const { perfil, empresaActiva, renderGuard } = useModulePermissions();

  const [loading, setLoading] = useState(true);
  const [recetas, setRecetas] = useState([]);
  const [tipologias, setTipologias] = useState([]);
  const [rubros, setRubros] = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTipologiaId, setActiveTipologiaId] = useState(null);
  const [subrecetaFilter, setSubrecetaFilter] = useState('TODAS'); // TODAS, CON, SIN
  const [onlyAllergens, setOnlyAllergens] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isCloneMode, setIsCloneMode] = useState(false);

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
      
      // Construir mapa para la búsqueda recursiva
      const recetasMap = new Map(res?.map(r => [r.id, r]) || []);
      
      // Mapear recetas con su propiedad virtual de alérgenos
      const recetasProcesadas = res?.map(r => ({
        ...r,
        contiene_alergenos: checkAlergenoRecursivo(r.id, recetasMap)
      })) || [];

      setRecetas(recetasProcesadas);
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

  const filteredData = recetas.filter(r => {
    // 1. Filtro por búsqueda
    const matchesSearch = r.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.codigo_ficha.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    // 2. Filtro por tipología activa (KPI)
    if (activeTipologiaId && Number(r.id_tipologia) !== Number(activeTipologiaId)) {
      return false;
    }

    // 3. Filtro por subrecetas (Tabs)
    const subrecetasCount = r.ingredientes?.filter(i => i.id_sub_receta).length || 0;
    const tieneSubreceta = subrecetasCount > 0;
    if (subrecetaFilter === 'CON' && !tieneSubreceta) return false;
    if (subrecetaFilter === 'SIN' && tieneSubreceta) return false;

    // 4. Filtro por alérgenos (Switch)
    if (onlyAllergens && !r.contiene_alergenos) return false;

    return true;
  });

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
          onClick={() => { setSelectedItem(null); setIsCloneMode(false); setShowModal(true); }}
          className="flex bg-brand-900 text-white px-8 py-4 rounded-md text-sm font-black uppercase tracking-widest hover:bg-brand-600 transition-all shadow-xl shadow-brand-900/20 active:scale-95 items-center gap-2"
        >
          <Plus size={18} />
          Nueva Receta
        </button>
      </div>

      {/* Barra de KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-1">
        {/* KPI Total */}
        <button
          onClick={() => setActiveTipologiaId(null)}
          className={`bg-white p-4 rounded-md border transition-all duration-300 flex items-center justify-between group cursor-pointer ${
            activeTipologiaId === null
            ? 'border-brand-500 shadow-lg shadow-brand-500/10 ring-2 ring-brand-500/5 -translate-y-1'
            : 'border-gray-100 shadow-sm hover:shadow-md hover:border-brand-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl transition-colors ${activeTipologiaId === null ? 'bg-brand-900 text-white' : 'bg-slate-100 text-slate-400'}`}>
              <Utensils size={14} />
            </div>
            <span className={`text-[10px] font-black uppercase tracking-widest transition-colors ${activeTipologiaId === null ? 'text-brand-900' : 'text-slate-400'}`}>
              TODAS
            </span>
          </div>
          <span className={`text-xl font-black tabular-nums transition-transform duration-300 ${activeTipologiaId === null ? 'scale-110 text-brand-900' : 'text-slate-400'}`}>
            {recetas.length}
          </span>
        </button>

        {/* KPIs por Tipología */}
        {tipologias.map(t => {
          const count = recetas.filter(r => Number(r.id_tipologia) === Number(t.id)).length;
          const isActive = activeTipologiaId === t.id;
          const badgeStyle = getTipologiaBadgeStyle(t.nombre);
          
          return (
            <button
              key={t.id}
              onClick={() => setActiveTipologiaId(isActive ? null : t.id)}
              className={`bg-white p-4 rounded-md border transition-all duration-300 flex items-center justify-between group cursor-pointer ${
                isActive
                ? 'border-brand-500 shadow-lg shadow-brand-500/10 ring-2 ring-brand-500/5 -translate-y-1'
                : 'border-gray-100 shadow-sm hover:shadow-md hover:border-brand-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl transition-colors text-[9px] font-black uppercase tracking-wider ${badgeStyle}`}>
                  {t.abreviatura || t.nombre}
                </div>
                <span className={`text-[10px] font-black uppercase tracking-widest transition-colors ${isActive ? 'text-brand-900' : 'text-slate-400'} truncate`}>
                  {t.nombre}
                </span>
              </div>
              <span className={`text-xl font-black tabular-nums transition-transform duration-300 ${isActive ? 'scale-110 text-brand-900' : 'text-slate-400'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Buscar por nombre o código de ficha..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-12 pr-6 py-4 bg-white border border-gray-100 rounded-md text-sm font-semibold text-slate-700 outline-none focus:ring-4 focus:ring-brand-900/10 focus:border-brand-900 transition-all w-full shadow-sm"
          />
        </div>

        {/* Controles de Refinamiento */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-[2rem] border border-gray-100 shadow-sm">
          {/* Tabs de Subrecetas */}
          <div className="flex gap-2">
            {[
              { id: 'TODAS', label: 'Todas' },
              { id: 'CON', label: 'Con Subreceta' },
              { id: 'SIN', label: 'Sin Subreceta' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setSubrecetaFilter(tab.id)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  subrecetaFilter === tab.id
                  ? 'bg-brand-900 text-white shadow-md'
                  : 'bg-slate-50 border border-slate-100 text-slate-400 hover:border-brand-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Toggle de Alérgenos */}
          <button
            onClick={() => setOnlyAllergens(!onlyAllergens)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 transition-all ${
              onlyAllergens
              ? 'bg-amber-50 border-amber-500 text-amber-700 shadow-md scale-105 font-bold'
              : 'bg-white border-gray-150 text-slate-400 hover:border-brand-200'
            }`}
          >
            <AlertTriangle size={14} className={onlyAllergens ? 'text-amber-600' : 'text-slate-300'} />
            <span className="text-[10px] font-black uppercase tracking-widest">⚠️ Solo Alérgenos</span>
          </button>
        </div>
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
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-black text-slate-800 uppercase leading-tight">{rec.nombre}</span>
                              {rec.contiene_alergenos && (
                                <span 
                                  className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[8px] font-black uppercase tracking-widest animate-pulse"
                                  title="Esta receta contiene alérgenos en sus ingredientes directos o subrecetas"
                                >
                                  <AlertTriangle size={8} /> Alérgenos
                                </span>
                              )}
                            </div>
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
                              onClick={() => { setSelectedItem(rec); setIsCloneMode(false); setShowModal(true); }}
                              className="p-2 bg-slate-50 text-slate-400 hover:text-brand-900 hover:bg-brand-50 rounded-lg transition-all border border-transparent hover:border-brand-100 shadow-sm"
                              title="Editar Receta"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => { setSelectedItem(rec); setIsCloneMode(true); setShowModal(true); }}
                              className="p-2 bg-slate-50 text-slate-400 hover:text-brand-900 hover:bg-brand-50 rounded-lg transition-all border border-transparent hover:border-brand-100 shadow-sm"
                              title="Duplicar Receta"
                            >
                              <Copy size={14} />
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
          isClone={isCloneMode}
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
