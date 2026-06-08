import { useState, useEffect, useMemo, Fragment } from 'react';
import { Tag, Plus, Search, Filter, Warehouse, Building2, Edit2, AlertTriangle, Hand, Thermometer, Flame } from 'lucide-react';
import { useModulePermissions } from '../../../hooks/useModulePermissions';
import { getCategorias } from '../../../services/categoriaService';
import CategoriaModal from './CategoriaModal';

export default function GestionCategoria() {
    const { perfil, empresaActiva, renderGuard } = useModulePermissions();

    const [loading, setLoading] = useState(true);
    const [data, setData] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [almacenes, setAlmacenes] = useState([]);
    const [almacenSel, setAlmacenSel] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);

    useEffect(() => {
        if (empresaActiva?.id) {
            fetchInitialData();
        }
    }, [empresaActiva?.id]);

    useEffect(() => {
        if (empresaActiva?.id && almacenSel) {
            fetchData();
        } else {
            setData([]);
            setLoading(false);
        }
    }, [empresaActiva?.id, almacenSel]);

    const fetchInitialData = async () => {
        try {
            const res = await import('../../../services/almacenService').then(m => m.getAlmacenes(empresaActiva.id));
            setAlmacenes(res || []);
        } catch (error) {
            console.error('Error al cargar almacenes:', error);
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await getCategorias(empresaActiva.id, almacenSel.id);
            setData(res || []);
        } catch (error) {
            console.error('Error al cargar categorías:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredData = data.filter(item =>
        item.nombre?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Agrupación por Almacén e interna Alfabética
    const groupedData = useMemo(() => {
        const sorted = [...filteredData].sort((a, b) => {
            const warehouseA = a.almacenes?.nombre || 'GENERAL';
            const warehouseB = b.almacenes?.nombre || 'GENERAL';
            if (warehouseA !== warehouseB) return warehouseA.localeCompare(warehouseB);
            return (a.nombre || '').localeCompare(b.nombre || '');
        });

        const groups = {};
        sorted.forEach(item => {
            const warehouse = item.almacenes?.nombre || 'GENERAL';
            if (!groups[warehouse]) groups[warehouse] = [];
            groups[warehouse].push(item);
        });
        return groups;
    }, [filteredData]);

    const guard = renderGuard();
    if (guard) return guard;

    return (
        <div className="p-4 sm:p-8 space-y-2 animate-in fade-in duration-500 bg-slate-50">

            {/* Header Premium */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-md bg-brand-900 flex items-center justify-center text-white shadow-2xl shadow-brand-900/20 relative group overflow-hidden">
                        <Tag size={28} className="relative z-10" />
                        <div className="absolute inset-0 bg-gradient-to-br from-brand-600 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 tracking-tight uppercase leading-none">
                            Gestión de Categorías
                        </h1>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-3 flex items-center gap-2">
                            <Building2 size={12} className="text-brand-500" />
                            Catálogo de clasificación por almacén <span className='font-black italic'>{empresaActiva?.nombre}</span>
                        </p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                    {/* Filtro Almacén */}
                    <div className='grid grid-cols-2 lg:grid-cols-4 gap-2'>
                        {almacenes.map(almacen => (
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
                <div className="flex items-center gap-3 relative z-10 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex-1 group/search">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within/search:text-brand-500 transition-colors" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar categoría..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-12 pr-6 py-3 bg-white border border-gray-100 rounded-md text-sm font-semibold text-slate-700 outline-none focus:ring-4 focus:ring-brand-accent/10 focus:border-brand-accent transition-all w-full shadow-sm"
                        />
                    </div>
                    <button
                        onClick={() => { setSelectedItem(null); setShowModal(true); }}
                        className="flex bg-brand-900 text-white px-6 py-2 rounded-md text-sm font-bold hover:bg-brand-600 transition-all shadow-lg shadow-brand-accent/20 items-center justify-center gap-2 active:scale-95"
                    >
                        <Plus size={18} />
                        <span>Agregar</span>
                    </button>
                </div>
            )}

            {/* Tabla de 3 Columnas o Estado Vacío */}
            {!almacenSel ? (
                <div className="flex flex-col items-center justify-center py-32 animate-in fade-in zoom-in duration-700">
                    <div className="p-10 bg-brand-50 rounded-[3rem] mb-6 shadow-inner group overflow-hidden relative">
                        <Warehouse size={80} className="text-brand-900 opacity-20 group-hover:scale-110 transition-transform duration-500" />
                        <div className="absolute inset-0 bg-gradient-to-t from-brand-100/50 to-transparent" />
                    </div>
                    <h2 className="text-xl font-black text-slate-400 uppercase tracking-[0.3em]">Seleccione un Almacén</h2>
                    <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mt-2 italic text-center">
                        Para visualizar las categorías asociadas al catálogo de <span className="text-brand-600">{empresaActiva?.nombre}</span>
                    </p>
                </div>
            ) : (
                <div className="bg-white rounded-md shadow-sm border border-gray-100 overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/50">
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-gray-100">Nombre</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-gray-100">Mermas</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-gray-100">Estado</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-gray-100 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-300">
                                {loading ? (
                                    Array(5).fill(0).map((_, i) => (
                                        <tr key={i} className="animate-pulse">
                                            <td colSpan={4} className="px-8 py-6">
                                                <div className="h-4 bg-gray-100 rounded-lg w-full"></div>
                                            </td>
                                        </tr>
                                    ))
                                ) : filteredData.length > 0 ? (
                                    filteredData.map((item) => (
                                        <tr
                                            key={item.id}
                                            className="hover:bg-slate-50 transition-all duration-300 group/row cursor-default"
                                        >
                                            <td className="px-8 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-brand-200 group-hover/row:bg-brand-500 transition-colors" />
                                                    <span className="text-sm font-bold text-slate-700 uppercase tracking-tight">
                                                        {item.nombre}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-1">
                                                {item.mermas && item.mermas.length > 0 && (
                                                    <div className="flex flex-wrap gap-1">
                                                        {item.mermas.map((m, idx) => {
                                                            const nombre = m.tipo_merma?.nombre?.toUpperCase();
                                                            const colorIcon = nombre?.includes('COCCIÓN') ? 'text-orange-500' :
                                                                nombre?.includes('DESCONGELACIÓN') ? 'text-blue-500' :
                                                                    nombre?.includes('MANIPULACIÓN') ? 'text-amber-500' : 'text-slate-400';

                                                            return (
                                                                <div
                                                                    key={idx}
                                                                    title={m.tipo_merma?.nombre}
                                                                    className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100/50 border border-slate-200 rounded-lg text-[9px] font-black text-slate-500 uppercase tracking-wider group/badge hover:bg-slate-200 transition-colors shadow-sm"
                                                                >
                                                                    {nombre?.includes('MANIPULACIÓN') && <Hand size={20} className={colorIcon} />}
                                                                    {nombre?.includes('DESCONGELACIÓN') && <Thermometer size={20} className={colorIcon} />}
                                                                    {nombre?.includes('COCCIÓN') && <Flame size={20} className={colorIcon} />}
                                                                    {!['MANIPULACIÓN', 'DESCONGELACIÓN', 'COCCIÓN'].some(t => nombre?.includes(t)) && <AlertTriangle size={9} className={colorIcon} />}

                                                                    <span className="text-brand-600 font-black">{m.tipo_merma?.letra}</span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </td>
                                            {/* <td className="px-8 py-1 text-center">
                                                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-50 rounded-lg border border-slate-100 opacity-60 group-hover/row:opacity-100 transition-opacity">
                                                        <Tag size={12} className="text-slate-400" />
                                                        <span className="text-[10px] font-black uppercase text-slate-500">
                                                            {item.almacenes?.abreviatura || 'GEN'}
                                                        </span>
                                                    </div>
                                                </td> */}
                                            <td className="px-8 py-1">
                                                <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${item.estatus
                                                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                                    : 'bg-red-50 text-red-600 border border-red-100'
                                                    }`}>
                                                    {item.estatus ? 'ACTIVO' : 'INACTIVO'}
                                                </span>
                                            </td>
                                            <td className="px-8 py-1 text-right">
                                                <button
                                                    onClick={() => { setSelectedItem(item); setShowModal(true); }}
                                                    className="inline-flex items-center justify-center w-11 h-11 text-slate-300 hover:text-brand-accent hover:bg-brand-50 hover:border-brand-100 border border-transparent rounded-md transition-all shadow-sm hover:shadow-brand-accent/5 active:scale-90"
                                                    title="Editar Categoría"
                                                >
                                                    <Edit2 size={20} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={4} className="px-8 py-20 text-center">
                                            <div className="flex flex-col items-center opacity-40">
                                                <Tag size={48} className="mb-4" />
                                                <p className="text-sm font-bold uppercase tracking-widest">No se encontraron categorías</p>
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
                <CategoriaModal
                    initialData={selectedItem}
                    preselectedAlmacenId={almacenSel?.id}
                    empresaActiva={empresaActiva}
                    perfil={perfil}
                    onClose={() => setShowModal(false)}
                    onUpdate={fetchData}
                />
            )}
        </div>
    );
}
