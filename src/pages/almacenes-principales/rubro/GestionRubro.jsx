import { useState, useEffect } from 'react';
import { LayoutGrid, Plus, Search, Filter, Warehouse, Building2, Edit2, ChevronRight, ShieldAlert, Hand, Thermometer, Flame, AlertTriangle, Utensils } from 'lucide-react';
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

    const filteredCategorias = categorias.filter(cat =>
        cat.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rubros.some(r => r.id_categoria === cat.id && r.nombre?.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const guard = renderGuard();
    if (guard) return guard;

    return (
        <div className="p-4 sm:p-8 space-y-8 animate-in fade-in duration-500 bg-slate-50">

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
                            Clasificación secundaria por categorías <span className='font-black italic'>{empresaActiva?.nombre}</span>
                        </p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                    {/* Filtro Almacén */}
                    <div className='grid grid-cols-2 lg:grid-cols-4 gap-2'>
                        {almacenesFiltrados.map(almacen => (
                            <button
                                key={almacen.id}
                                onClick={() => setAlmacenSel(almacenSel?.id === almacen.id ? null : almacen)}
                                className={`px-3 py-1.5 rounded-md border-2 transition-all duration-300 flex flex-col items-center gap-1 min-w-[80px] ${almacenSel?.id === almacen.id
                                    ? 'bg-brand-900 border-brand-900 text-white shadow-md scale-105'
                                    : 'bg-white border-gray-100 text-slate-400 hover:border-brand-200 hover:bg-slate-50'
                                    }`}
                            >
                                <Warehouse size={14} />
                                <span className="text-[9px] font-black uppercase tracking-widest">{almacen.nombre}</span>
                            </button>
                        ))}
                    </div>

                </div>
            </div>

            {almacenSel && (
                <div className="flex items-center gap-3 relative z-10">
                    <div className="flex-1 group/search">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within/search:text-brand-500 transition-colors" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar por categoría o rubro..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-12 pr-6 py-3 bg-white border border-gray-100 rounded-md text-sm font-semibold text-slate-700 outline-none focus:ring-4 focus:ring-brand-accent/10 focus:border-brand-accent transition-all w-full shadow-sm"
                        />
                    </div>
                    <button
                        onClick={() => { setSelectedItem(null); setPreselectedCategory(null); setShowModal(true); }}
                        className="flex bg-brand-900 text-white px-6 py-2 rounded-md text-sm font-bold hover:bg-brand-600 transition-all shadow-lg shadow-brand-accent/20 items-center justify-center gap-2 active:scale-95 animate-in slide-in-from-right duration-300"
                    >
                        <Plus size={18} />
                        <span>Nuevo Rubro</span>
                    </button>
                </div>
            )}

            {/* Tabla de 3 Columnas o Estado Vacío */}
            {!almacenSel ? (
                <div className="flex flex-col items-center justify-center py-2 animate-in fade-in zoom-in duration-700">
                    <div className="p-10 bg-brand-50 rounded-[3rem] mb-6 shadow-inner group overflow-hidden relative">
                        <Warehouse size={80} className="text-brand-900 opacity-20 group-hover:scale-110 transition-transform duration-500" />
                        <div className="absolute inset-0 bg-gradient-to-t from-brand-100/50 to-transparent" />
                    </div>
                    <h2 className="text-xl font-black text-slate-400 uppercase tracking-[0.3em]">Seleccione un Almacén</h2>
                    <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mt-2 italic text-center">
                        Para visualizar las categorías y rubros asociados<br />al catálogo de <span className="text-brand-600">{empresaActiva?.nombre}</span>
                    </p>
                </div>
            ) : (
                <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/50">
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-gray-100 w-1/4">Categoría / Almacén</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-gray-100">Rubros Asociados</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-gray-100 text-right w-1/6">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-300 font-medium">
                                {loading ? (
                                    Array(5).fill(0).map((_, i) => (
                                        <tr key={i} className="animate-pulse">
                                            <td className="px-8 py-10"><div className="h-4 bg-gray-100 rounded w-2/3"></div></td>
                                            <td className="px-8 py-10"><div className="h-4 bg-gray-100 rounded w-full"></div></td>
                                            <td className="px-8 py-10"><div className="h-4 bg-gray-100 rounded w-1/2 ml-auto"></div></td>
                                        </tr>
                                    ))
                                ) : filteredCategorias.length > 0 ? (
                                    filteredCategorias.map((cat) => {
                                        const rubrosDeCat = rubros.filter(r => r.id_categoria === cat.id);
                                    
                                    // Agrupar rubros internos por inicial
                                    const groupedRubros = rubrosDeCat.reduce((acc, r) => {
                                        const letter = (r.nombre || '#').charAt(0).toUpperCase();
                                        const category = /^[A-Z]$/.test(letter) ? letter : '#';
                                        if (!acc[category]) acc[category] = [];
                                        acc[category].push(r);
                                        return acc;
                                    }, {});

                                    const sortedLetters = Object.keys(groupedRubros).sort();

                                        return (
                                            <tr
                                                key={cat.id}
                                                className="hover:bg-slate-50/80 transition-all duration-300 group/row"
                                            >
                                                {/* Columna 1: Categoría */}
                                                <td className="px-8 py-6">
                                                    <div className="flex flex-col gap-1">
                                                        <span className="text-sm font-black text-slate-700 uppercase tracking-tight group-hover/row:text-brand-900 transition-colors">
                                                            {cat.nombre}
                                                        </span>
                                                        <div className="flex items-center gap-1.5 opacity-50">
                                                            <Warehouse size={10} className="text-brand-500" />
                                                            <span className="text-[10px] font-bold uppercase tracking-widest italic">
                                                                {cat.almacenes?.nombre || 'General'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Columna 2: Rubros Agrupados por Inicial */}
                                                <td className="px-8 py-6">
                                                    <div className="flex flex-col gap-6">
                                                        {sortedLetters.length > 0 ? (
                                                            sortedLetters.map((letter) => (
                                                                <div key={letter} className="flex flex-col gap-2">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-[10px] font-black text-brand-900 bg-brand-50 w-5 h-5 flex items-center justify-center rounded-md border border-brand-100 shadow-sm">
                                                                            {letter}
                                                                        </span>
                                                                        <div className="h-[1px] flex-1 bg-slate-100" />
                                                                    </div>
                                                                    <div className="flex flex-wrap gap-2">
                                                                        {groupedRubros[letter].map((r) => (
                                                                            <div
                                                                                key={r.id}
                                                                                className={`group/badge flex items-center gap-3 pl-3 pr-2 py-1.5 rounded-xl border transition-all
                                                                                    ${r.estatus
                                                                                        ? 'bg-white border-gray-200 text-slate-600 hover:border-brand-200 hover:bg-brand-50/30 shadow-sm hover:shadow-md'
                                                                                        : 'bg-red-50 border-red-100 text-red-400 opacity-60'}`}
                                                                            >
                                                                                <div className="flex flex-col gap-0.5">
                                                                                    <div className="flex items-center gap-2">
                                                                                        <span className="text-[11px] font-black uppercase tracking-tight leading-none">
                                                                                            {r.nombre}
                                                                                        </span>
                                                                                        {r.almacen_unidades_medida?.abreviatura && (
                                                                                            <span className="text-[8px] font-black bg-slate-100 text-slate-500 px-1 py-0.5 rounded-md uppercase tracking-tighter">
                                                                                                {r.almacen_unidades_medida.abreviatura}
                                                                                            </span>
                                                                                        )}
                                                                                        {r.es_alergeno && (
                                                                                            <ShieldAlert size={12} className="text-orange-500 animate-pulse" title="Contiene Alérgenos" />
                                                                                        )}
                                                                                        {r.es_ingrediente && (
                                                                                            <Utensils size={10} className="text-emerald-500" title="Ingrediente de Cocina" />
                                                                                        )}
                                                                                        {r.solicitud_manual && (
                                                                                            <span className="text-[8px] font-black bg-amber-100 text-amber-800 px-1 py-0.5 rounded-md uppercase tracking-tighter">S.M</span>
                                                                                        )}
                                                                                        {r.requiere_marca && (
                                                                                            <span className="text-[8px] font-black bg-blue-100 text-blue-800 px-1 py-0.5 rounded-md uppercase tracking-tighter">R.M</span>
                                                                                        )}
                                                                                        {r.tipo_fraccionamiento === 'NUNCA' && (
                                                                                            <span className="text-[8px] font-black bg-slate-100 text-slate-500 px-1 py-0.5 rounded-md uppercase tracking-tighter" title="Indivisible">FIX</span>
                                                                                        )}
                                                                                        {r.tipo_fraccionamiento === 'SOLO_EJECUCION' && (
                                                                                            <span className="text-[8px] font-black bg-indigo-50 text-indigo-600 px-1 py-0.5 rounded-md uppercase tracking-tighter border border-indigo-100" title="Bulto en Despacho / Fracción en Cocina">MIX</span>
                                                                                        )}
                                                                                        {r.tipo_fraccionamiento === 'SIEMPRE' && (
                                                                                            <span className="text-[8px] font-black bg-emerald-50 text-emerald-600 px-1 py-0.5 rounded-md uppercase tracking-tighter border border-emerald-100" title="Fraccionamiento Libre">FREE</span>
                                                                                        )}
                                                                                    </div>

                                                                                    {r.almacen_rubros_merma?.length > 0 && (
                                                                                        <div className="flex items-center gap-2 mt-0.5">
                                                                                            {r.almacen_rubros_merma.map((m, idx) => (
                                                                                                <div key={idx} className="flex items-center gap-0.5" title={m.tipo_merma.nombre}>
                                                                                                    {getMermaIcon(m.tipo_merma.nombre)}
                                                                                                    <span className="text-[9px] font-black text-slate-400">{Math.round(m.valor)}%</span>
                                                                                                </div>
                                                                                            ))}
                                                                                        </div>
                                                                                    )}
                                                                                </div>

                                                                                <button
                                                                                    onClick={() => { setSelectedItem(r); setPreselectedCategory(null); setShowModal(true); }}
                                                                                    className="p-1.5 rounded-lg text-slate-300 hover:text-brand-600 hover:bg-white transition-all opacity-0 group-hover/badge:opacity-100 bg-gray-50/50"
                                                                                >
                                                                                    <Edit2 size={12} />
                                                                                </button>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest italic">
                                                                Sin rubros asignados
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Columna 3: Acciones */}
                                                <td className="px-8 py-6 text-right">
                                                    <button
                                                        onClick={() => {
                                                            setSelectedItem(null);
                                                            setPreselectedCategory(cat.id);
                                                            setShowModal(true);
                                                        }}
                                                        className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-100 text-brand-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-900 hover:text-white hover:border-brand-900 transition-all shadow-sm active:scale-95"
                                                    >
                                                        <Plus size={14} />
                                                        <span>Agregar</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={3} className="px-8 py-24 text-center">
                                            <div className="flex flex-col items-center opacity-40">
                                                <LayoutGrid size={48} className="mb-4 text-brand-900" />
                                                <p className="text-sm font-bold uppercase tracking-widest">No se encontraron registros</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
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
