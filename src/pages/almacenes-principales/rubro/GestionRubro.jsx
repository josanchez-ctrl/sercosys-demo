import { useState, useEffect, useMemo } from 'react';
import { LayoutGrid, Plus, Search, Filter, Warehouse, Building2, Edit2, ChevronRight, ShieldAlert, Hand, Thermometer, Flame, AlertTriangle, Utensils, CheckCircle2, XCircle } from 'lucide-react';
import { useModulePermissions } from '../../../hooks/useModulePermissions';
import { getCategorias } from '../../../services/categoriaService';
import { getRubros } from '../../../services/rubroService';
import { getAlmacenes } from '../../../services/almacenService';
import RubroModal from './RubroModal';

export default function GestionRubro() {
    const { perfil, empresaActiva, renderGuard } = useModulePermissions();

    const [loading, setLoading] = useState(true);
    const [categorias, setCategorias] = useState([]);
    const [rubros, setRubros] = useState([]);
    const [almacenes, setAlmacenes] = useState([]);

    // Filtros
    const [searchTerm, setSearchTerm] = useState('');
    const [almacenSel, setAlmacenSel] = useState(null);

    // Filtros de navegación moderna
    const [activeCategoryTab, setActiveCategoryTab] = useState('TODAS');
    const [activeLetterFilter, setActiveLetterFilter] = useState('TODAS');
    const [statusFilter, setStatusFilter] = useState('TODOS'); // TODOS, ACTIVOS, INACTIVOS, ALERGENOS

    const [showModal, setShowModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [preselectedCategory, setPreselectedCategory] = useState(null);

    useEffect(() => {
        if (empresaActiva?.id) {
            fetchInitialData();
        }
    }, [empresaActiva?.id]);

    useEffect(() => {
        if (empresaActiva?.id && almacenSel) {
            fetchData();
            // Reiniciar filtros al cambiar de almacén
            setActiveCategoryTab('TODAS');
            setActiveLetterFilter('TODAS');
            setStatusFilter('TODOS');
        } else {
            setCategorias([]);
            setRubros([]);
            setLoading(false);
        }
    }, [empresaActiva?.id, almacenSel]);

    const fetchInitialData = async () => {
        try {
            const alm = await getAlmacenes(empresaActiva.id);
            setAlmacenes(alm || []);
        } catch (error) {
            console.error('Error al cargar almacenes:', error);
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const [catRes, rubRes] = await Promise.all([
                getCategorias(empresaActiva.id, almacenSel.id),
                getRubros(empresaActiva.id, almacenSel.id)
            ]);
            setCategorias(catRes || []);
            setRubros(rubRes || []);
        } catch (error) {
            console.error('Error al cargar datos:', error);
        } finally {
            setLoading(false);
        }
    };

    const getMermaIcon = (nombre) => {
        const n = nombre?.toUpperCase() || '';
        if (n.includes('MANIPULACIÓN')) return <Hand size={10} className="text-amber-500" />;
        if (n.includes('DESCONGELACIÓN')) return <Thermometer size={10} className="text-blue-500" />;
        if (n.includes('COCCIÓN')) return <Flame size={10} className="text-orange-500" />;
        return <AlertTriangle size={10} className="text-slate-400" />;
    };

    const almacenesFiltrados = almacenes.filter(almacen =>
        perfil?.F_ALL === true
            ? true
            : (perfil?.ids_almacenes?.includes(almacen.id))
    );

    // Contar rubros por categoría
    const categoryCounts = useMemo(() => {
        const counts = {};
        rubros.forEach(r => {
            counts[r.id_categoria] = (counts[r.id_categoria] || 0) + 1;
        });
        return counts;
    }, [rubros]);

    // Calcular contadores de KPIs reactivos según la categoría seleccionada
    const { totalCount, activosCount, inactivosCount, alergenosCount } = useMemo(() => {
        const rubrosInCategory = rubros.filter(r => 
            activeCategoryTab === 'TODAS' || String(r.id_categoria) === String(activeCategoryTab)
        );
        return {
            totalCount: rubrosInCategory.length,
            activosCount: rubrosInCategory.filter(r => r.estatus).length,
            inactivosCount: rubrosInCategory.filter(r => !r.estatus).length,
            alergenosCount: rubrosInCategory.filter(r => r.es_alergeno).length
        };
    }, [rubros, activeCategoryTab]);

    // Filtrar Rubros Final
    const filteredRubros = useMemo(() => {
        return rubros.filter(r => {
            const cat = categorias.find(c => c.id === r.id_categoria);
            
            // 1. Búsqueda por término (reactivo)
            const matchesSearch = !searchTerm.trim() || 
                r.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                cat?.nombre?.toLowerCase().includes(searchTerm.toLowerCase());
            if (!matchesSearch) return false;

            // 2. Filtro por Categoría activa (Tabs)
            if (activeCategoryTab !== 'TODAS' && String(r.id_categoria) !== String(activeCategoryTab)) {
                return false;
            }

            // 3. Filtro por Inicial (Jumper A-Z)
            if (activeLetterFilter !== 'TODAS') {
                const letter = (r.nombre || '#').charAt(0).toUpperCase();
                const cleanLetter = /^[A-Z]$/.test(letter) ? letter : '#';
                if (cleanLetter !== activeLetterFilter) return false;
            }

            // 4. Filtro por KPI de Estado
            if (statusFilter === 'ACTIVOS' && !r.estatus) return false;
            if (statusFilter === 'INACTIVOS' && r.estatus) return false;
            if (statusFilter === 'ALERGENOS' && !r.es_alergeno) return false;

            return true;
        }).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
    }, [rubros, categorias, searchTerm, activeCategoryTab, activeLetterFilter, statusFilter]);

    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#".split("");

    const guard = renderGuard();
    if (guard) return guard;

    return (
        <div className="p-4 space-y-2 animate-in fade-in duration-500 bg-slate-50 min-h-screen">

            {/* Header Premium */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-[1.5rem] bg-brand-900 flex items-center justify-center text-white shadow-2xl shadow-brand-900/20 relative group overflow-hidden">
                        <LayoutGrid size={28} className="relative z-10" />
                        <div className="absolute inset-0 bg-gradient-to-br from-brand-600 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 tracking-tight uppercase leading-none">
                            Gestión de Rubros
                        </h1>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-3 flex items-center gap-2">
                            <Building2 size={12} className="text-brand-500" />
                            Catálogo y Clasificaciones Técnicas <span className='font-black italic'>{empresaActiva?.nombre}</span>
                        </p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                    {/* Selector de Almacén (Header) */}
                    <div className="flex items-center gap-4 relative">
                        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
                            {almacenesFiltrados.map(almacen => (
                                <button
                                    key={almacen.id}
                                    onClick={() => setAlmacenSel(almacenSel?.id === almacen.id ? null : almacen)}
                                    className={`px-4 py-2 rounded-md border-2 transition-all duration-300 flex flex-col items-center gap-1 min-w-[100px] ${
                                        almacenSel?.id === almacen.id
                                        ? 'bg-brand-900 border-brand-900 text-white shadow-xl shadow-brand-900/20 scale-105'
                                        : 'bg-white border-gray-100 text-slate-400 hover:border-brand-200 hover:bg-slate-50'
                                    }`}
                                >
                                    <Warehouse size={16} />
                                    <span className="text-[9px] font-black uppercase tracking-widest">{almacen.nombre}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {almacenSel && (
                <div className="flex flex-col gap-2 space-y-1 pt-1">

                    {/* KPIs de Estado */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
                        {/* KPI Total */}
                        <button
                            onClick={() => setStatusFilter('TODOS')}
                            className={`bg-white p-4 rounded-md border transition-all duration-300 flex items-center justify-between group cursor-pointer ${
                                statusFilter === 'TODOS'
                                ? 'border-brand-500 shadow-lg shadow-brand-500/10 ring-2 ring-brand-500/5 -translate-y-1'
                                : 'border-gray-100 shadow-sm hover:shadow-md hover:border-brand-200'
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-xl transition-colors ${statusFilter === 'TODOS' ? 'bg-brand-900 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                    <LayoutGrid size={14} />
                                </div>
                                <span className={`text-[10px] font-black uppercase tracking-widest transition-colors ${statusFilter === 'TODOS' ? 'text-brand-900' : 'text-slate-400'}`}>
                                    Total Rubros
                                </span>
                            </div>
                            <span className={`text-xl font-black tabular-nums transition-transform duration-300 ${statusFilter === 'TODOS' ? 'scale-110 text-brand-900' : 'text-slate-400'}`}>
                                {totalCount}
                            </span>
                        </button>

                        {/* KPI Activos */}
                        <button
                            onClick={() => setStatusFilter(statusFilter === 'ACTIVOS' ? 'TODOS' : 'ACTIVOS')}
                            className={`bg-white p-4 rounded-md border transition-all duration-300 flex items-center justify-between group cursor-pointer ${
                                statusFilter === 'ACTIVOS'
                                ? 'border-brand-500 shadow-lg shadow-brand-500/10 ring-2 ring-brand-500/5 -translate-y-1'
                                : 'border-gray-100 shadow-sm hover:shadow-md hover:border-brand-200'
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-xl transition-colors ${statusFilter === 'ACTIVOS' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100 shadow-inner' : 'bg-slate-100 text-slate-400'}`}>
                                    <CheckCircle2 size={14} />
                                </div>
                                <span className={`text-[10px] font-black uppercase tracking-widest transition-colors ${statusFilter === 'ACTIVOS' ? 'text-brand-900' : 'text-slate-400'}`}>
                                    Activos
                                </span>
                            </div>
                            <span className={`text-xl font-black tabular-nums transition-transform duration-300 ${statusFilter === 'ACTIVOS' ? 'scale-110 text-emerald-600' : 'text-slate-400'}`}>
                                {activosCount}
                            </span>
                        </button>

                        {/* KPI Inactivos */}
                        <button
                            onClick={() => setStatusFilter(statusFilter === 'INACTIVOS' ? 'TODOS' : 'INACTIVOS')}
                            className={`bg-white p-4 rounded-md border transition-all duration-300 flex items-center justify-between group cursor-pointer ${
                                statusFilter === 'INACTIVOS'
                                ? 'border-brand-500 shadow-lg shadow-brand-500/10 ring-2 ring-brand-500/5 -translate-y-1'
                                : 'border-gray-100 shadow-sm hover:shadow-md hover:border-brand-200'
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-xl transition-colors ${statusFilter === 'INACTIVOS' ? 'bg-red-55 text-red-600 border border-red-100 shadow-inner' : 'bg-slate-100 text-slate-400'}`}>
                                    <XCircle size={14} />
                                </div>
                                <span className={`text-[10px] font-black uppercase tracking-widest transition-colors ${statusFilter === 'INACTIVOS' ? 'text-brand-900' : 'text-slate-400'}`}>
                                    Inactivos
                                </span>
                            </div>
                            <span className={`text-xl font-black tabular-nums transition-transform duration-300 ${statusFilter === 'INACTIVOS' ? 'scale-110 text-red-600' : 'text-slate-400'}`}>
                                {inactivosCount}
                            </span>
                        </button>

                        {/* KPI Alérgenos */}
                        <button
                            onClick={() => setStatusFilter(statusFilter === 'ALERGENOS' ? 'TODOS' : 'ALERGENOS')}
                            className={`bg-white p-4 rounded-md border transition-all duration-300 flex items-center justify-between group cursor-pointer ${
                                statusFilter === 'ALERGENOS'
                                ? 'border-brand-500 shadow-lg shadow-brand-500/10 ring-2 ring-brand-500/5 -translate-y-1'
                                : 'border-gray-100 shadow-sm hover:shadow-md hover:border-brand-200'
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-xl transition-colors ${statusFilter === 'ALERGENOS' ? 'bg-orange-50 text-orange-600 border border-orange-100 shadow-inner' : 'bg-slate-100 text-slate-400'}`}>
                                    <ShieldAlert size={14} />
                                </div>
                                <span className={`text-[10px] font-black uppercase tracking-widest transition-colors ${statusFilter === 'ALERGENOS' ? 'text-brand-900' : 'text-slate-400'}`}>
                                    Alérgenos
                                </span>
                            </div>
                            <span className={`text-xl font-black tabular-nums transition-transform duration-300 ${statusFilter === 'ALERGENOS' ? 'scale-110 text-orange-600' : 'text-slate-400'}`}>
                                {alergenosCount}
                            </span>
                        </button>
                    </div>

                    {/* Tabs de Categorías */}
                    <div className="flex flex-wrap gap-2 relative z-10 border-b border-slate-200">
                        <button
                            onClick={() => { setActiveCategoryTab('TODAS'); setActiveLetterFilter('TODAS'); }}
                            className={`px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                                activeCategoryTab === 'TODAS'
                                ? 'bg-brand-900 text-white shadow-md'
                                : 'bg-white border border-slate-150 text-slate-400 hover:border-brand-200 hover:bg-slate-50'
                            }`}
                        >
                            Todas las Categorías ({rubros.length})
                        </button>
                        {categorias.map(cat => {
                            const count = categoryCounts[cat.id] || 0;
                            return (
                                <button
                                    key={cat.id}
                                    onClick={() => { setActiveCategoryTab(cat.id); setActiveLetterFilter('TODAS'); }}
                                    className={`px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                                        String(activeCategoryTab) === String(cat.id)
                                        ? 'bg-brand-900 text-white shadow-md scale-105'
                                        : 'bg-white border border-slate-150 text-slate-400 hover:border-brand-200 hover:bg-slate-50'
                                    }`}
                                >
                                    {cat.nombre} ({count})
                                </button>
                            );
                        })}
                    </div>

                    {/* Jumper Alfabético (A-Z) */}
                    <div className="flex flex-wrap gap-1 bg-white p-3 rounded-md border border-gray-100 shadow-sm relative z-10 items-center justify-center">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mr-3 hidden sm:inline">Índice A-Z:</span>
                        <button
                            onClick={() => setActiveLetterFilter('TODAS')}
                            className={`w-12 h-7 flex items-center justify-center rounded-md text-[10px] font-black uppercase transition-all ${
                                activeLetterFilter === 'TODAS'
                                ? 'bg-brand-900 text-white shadow-md'
                                : 'bg-slate-50 text-slate-400 hover:bg-slate-100 border border-slate-100'
                            }`}
                        >
                            Ver Todo
                        </button>
                        {alphabet.map(letra => {
                            const hasRubrosInLetter = rubros.some(r => {
                                if (activeCategoryTab !== 'TODAS' && String(r.id_categoria) !== String(activeCategoryTab)) return false;
                                const init = (r.nombre || '#').charAt(0).toUpperCase();
                                const clean = /^[A-Z]$/.test(init) ? init : '#';
                                return clean === letra;
                            });

                            return (
                                <button
                                    key={letra}
                                    disabled={!hasRubrosInLetter}
                                    onClick={() => setActiveLetterFilter(activeLetterFilter === letra ? 'TODAS' : letra)}
                                    className={`w-7 h-7 flex items-center justify-center rounded-md text-[10px] font-black uppercase transition-all ${
                                        activeLetterFilter === letra
                                        ? 'bg-brand-900 text-white shadow-md scale-105'
                                        : hasRubrosInLetter
                                        ? 'bg-white border border-gray-150 text-slate-600 hover:border-brand-200 hover:bg-slate-50'
                                        : 'bg-slate-50 border border-transparent text-slate-300 cursor-not-allowed opacity-30'
                                    }`}
                                >
                                    {letra}
                                </button>
                            );
                        })}
                    </div>

                    {/* Barra de Búsqueda y Creación */}
                    <div className="flex items-center gap-3 relative z-10">
                        <div className="flex-1 group/search relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within/search:text-brand-500 transition-colors" size={18} />
                            <input
                                type="text"
                                placeholder="Escriba nombre de rubro o categoría para buscar..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-12 pr-6 py-4 bg-white border border-gray-100 rounded-md text-sm font-semibold text-slate-700 outline-none focus:ring-4 focus:ring-brand-900/10 focus:border-brand-900 transition-all w-full shadow-sm"
                            />
                        </div>
                        <button
                            onClick={() => { setSelectedItem(null); setPreselectedCategory(null); setShowModal(true); }}
                            className="flex bg-brand-900 text-white px-8 py-4 rounded-md text-xs font-black uppercase tracking-widest hover:bg-brand-800 transition-all shadow-xl shadow-brand-900/20 items-center justify-center gap-2 active:scale-95 animate-in slide-in-from-right duration-300"
                        >
                            <Plus size={18} />
                            <span>Nuevo Rubro</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Contenedor de Rubros (Grid de Cards) */}
            {almacenSel && (
                <div className="relative z-10">
                    {loading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-pulse">
                            {Array(8).fill(0).map((_, i) => (
                                <div key={i} className="bg-white rounded-xl border border-gray-100 p-6 h-48 space-y-4">
                                    <div className="h-4 bg-gray-100 rounded w-1/3"></div>
                                    <div className="h-6 bg-gray-100 rounded w-3/4"></div>
                                    <div className="h-4 bg-gray-100 rounded w-full"></div>
                                    <div className="h-8 bg-gray-100 rounded w-1/4 pt-4 ml-auto"></div>
                                </div>
                            ))}
                        </div>
                    ) : filteredRubros.length > 0 ? (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-in fade-in duration-300">
                            {filteredRubros.map(r => {
                                const cat = categorias.find(c => c.id === r.id_categoria);
                                return (
                                    <div 
                                        key={r.id} 
                                        className={`bg-white rounded-md shadow-sm border p-5 flex flex-col justify-between hover:-translate-y-1 hover:shadow-md transition-all duration-300 ${
                                            r.estatus ? 'border-gray-100 hover:border-brand-200' : 'border-red-100 bg-red-50/10'
                                        }`}
                                    >
                                        <div>
                                            {/* Cabecera Card */}
                                            <div className="flex items-start justify-between gap-2">
                                                <span className="text-slate-400 text-[9px] font-black uppercase tracking-widest truncate max-w-[70%]">
                                                    {cat?.nombre || 'General'}
                                                </span>
                                                <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border ${
                                                    r.estatus 
                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                                                    : 'bg-red-50 text-red-600 border-red-200'
                                                }`}>
                                                    {r.estatus ? 'Activo' : 'Inactivo'}
                                                </span>
                                            </div>

                                            {/* Título */}
                                            <h4 className="text-slate-800 text-xs font-black uppercase tracking-tight mt-2.5 leading-snug line-clamp-2">
                                                <div className="flex items-center gap-2">
                                                    <span>{r.nombre}</span>
                                                    {r.almacen_unidades_medida?.abreviatura && (
                                                        <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md uppercase tracking-tight" title={`Unidad: ${r.almacen_unidades_medida.nombre}`}>
                                                            {r.almacen_unidades_medida.abreviatura}
                                                        </span>
                                                    )}
                                                    {r.es_alergeno && (
                                                        <span className="flex items-center gap-1 text-[9px] font-black bg-orange-50 text-orange-600 border border-orange-100 px-2 py-0.5 rounded-md uppercase tracking-tight animate-pulse">
                                                            <ShieldAlert size={10} /> Alérgeno
                                                        </span>
                                                    )}
                                                </div>
                                            </h4>

                                            {/* Badges de Atributos */}
                                            <div className="flex flex-wrap gap-1.5 mt-3.5">
                                                {/* {r.almacen_unidades_medida?.abreviatura && (
                                                    <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md uppercase tracking-tight" title={`Unidad: ${r.almacen_unidades_medida.nombre}`}>
                                                        {r.almacen_unidades_medida.abreviatura}
                                                    </span>
                                                )} */}
                                                {/* {r.es_alergeno && (
                                                    <span className="flex items-center gap-1 text-[9px] font-black bg-orange-50 text-orange-600 border border-orange-100 px-2 py-0.5 rounded-md uppercase tracking-tight animate-pulse">
                                                        <ShieldAlert size={10} /> Alérgeno
                                                    </span>
                                                )} */}
                                                {r.es_ingrediente && (
                                                    <span className="flex items-center gap-1 text-[9px] font-black bg-emerald-50 text-emerald-600 border border-emerald-100 px-2 py-0.5 rounded-md uppercase tracking-tight" title="Ingrediente">
                                                        <Utensils size={9} />
                                                    </span>
                                                )}
                                                {r.solicitud_manual && (
                                                    <span className="text-[9px] font-black bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded-md uppercase tracking-tight" title="Solicitud Manual">S.M.</span>
                                                )}
                                                {r.requiere_marca && (
                                                    <span className="text-[9px] font-black bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-md uppercase tracking-tight" title="Requiere Marca">R.M.</span>
                                                )}
                                                {r.tipo_fraccionamiento && (
                                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-tight border ${
                                                        r.tipo_fraccionamiento === 'NUNCA' ? 'bg-slate-50 text-slate-400 border-slate-100' :
                                                        r.tipo_fraccionamiento === 'SOLO_EJECUCION' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' :
                                                        'bg-emerald-50 text-emerald-600 border-emerald-100'
                                                    }`} title={r.tipo_fraccionamiento === 'NUNCA' ? 'Indivisible' : r.tipo_fraccionamiento === 'SOLO_EJECUCION' ? 'Bulto en Despacho / Fracción en Cocina' : 'Fraccionamiento Libre'}>
                                                        {r.tipo_fraccionamiento === 'NUNCA' ? 'FIX' : r.tipo_fraccionamiento === 'SOLO_EJECUCION' ? 'MIX' : 'FREE'}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Sección de Mermas */}
                                            {r.almacen_rubros_merma?.length > 0 && (
                                                <div className="mt-4 pt-3 border-t border-slate-100">
                                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Mermas Estándar</span>
                                                    <div className="flex flex-wrap gap-3">
                                                        {r.almacen_rubros_merma.map((m, idx) => (
                                                            <div key={idx} className="flex items-center gap-1" title={m.tipo_merma.nombre}>
                                                                {getMermaIcon(m.tipo_merma.nombre)}
                                                                <span className="text-[10px] font-bold text-slate-500">{m.valor}%</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Acciones */}
                                        <div className="pt-1 border-t border-slate-100 flex justify-between items-center">
                                            <span className="text-[9px] font-bold text-slate-300 italic">{/* ID: #{r.id} */}</span>
                                            <button
                                                onClick={() => { setSelectedItem(r); setPreselectedCategory(null); setShowModal(true); }}
                                                className="flex items-center gap-1.5 px-4 py-2 bg-slate-50 hover:bg-brand-50 text-slate-500 hover:text-brand-900 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-100 hover:border-brand-200 transition-all active:scale-95 shadow-sm"
                                            >
                                                <Edit2 size={10} /> Editar
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="py-40 flex flex-col items-center justify-center opacity-30 bg-white rounded-md border border-gray-100 shadow-sm">
                            <LayoutGrid size={64} className="text-slate-400 mb-4" />
                            <p className="text-xl font-black uppercase tracking-widest text-slate-400">Sin rubros coincidentes</p>
                        </div>
                    )}
                </div>
            )}

            {/* Selector de Almacén Vacío */}
            {!almacenSel && (
                <div className="flex flex-col items-center justify-center py-20 animate-in fade-in zoom-in duration-700">
                    <div className="p-10 bg-brand-50 rounded-[3rem] mb-6 shadow-inner group overflow-hidden relative">
                        <Warehouse size={80} className="text-brand-900 opacity-20 group-hover:scale-110 transition-transform duration-500" />
                        <div className="absolute inset-0 bg-gradient-to-t from-brand-100/50 to-transparent" />
                    </div>
                    <h2 className="text-xl font-black text-slate-400 uppercase tracking-[0.3em]">Seleccione un Almacén</h2>
                    <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mt-2 italic text-center leading-relaxed">
                        Para visualizar las categorías y rubros asociados<br />al catálogo de <span className="text-brand-600 font-black">{empresaActiva?.nombre}</span>
                    </p>
                </div>
            )}

            {/* Modal de Gestión */}
            {showModal && (
                <RubroModal
                    initialData={selectedItem}
                    id_categoria_preselected={preselectedCategory}
                    empresaActiva={empresaActiva}
                    perfil={perfil}
                    onClose={() => setShowModal(false)}
                    onUpdate={fetchData}
                />
            )}
        </div>
    );
}
