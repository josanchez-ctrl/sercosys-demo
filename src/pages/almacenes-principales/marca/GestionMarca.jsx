import { useState, useEffect, useMemo, Fragment } from 'react';
import { BadgeCheck, Tag, Plus, Search, Scale, Warehouse, Building2, Edit2 } from 'lucide-react';
import { useModulePermissions } from '../../../hooks/useModulePermissions';
import { getMarcas } from '../../../services/marcaService';
import MarcaModal from './MarcaModal';

export default function GestionMarca() {
    const { perfil, empresaActiva, renderGuard } = useModulePermissions();

    const [loading, setLoading] = useState(true);
    const [data, setData] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);

    useEffect(() => {
        if (empresaActiva?.id) {
            fetchData();
        }
    }, [empresaActiva?.id]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await getMarcas(empresaActiva.id);
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

    // Lógica de Agrupación Alfabética
    const groupedData = useMemo(() => {
        const sorted = [...filteredData].sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
        const groups = {};
        sorted.forEach(item => {
            const letter = (item.nombre || '#').charAt(0).toUpperCase();
            const category = /^[A-Z]$/.test(letter) ? letter : '#';
            if (!groups[category]) groups[category] = [];
            groups[category].push(item);
        });
        return groups;
    }, [filteredData]);

    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#".split("");

    const guard = renderGuard();
    if (guard) return guard;

    return (
        <div className="p-4 sm:p-8 space-y-8 animate-in fade-in duration-500 bg-slate-50 min-h-screen relative">
            
            {/* Índice Alfabético Flotante (Quick Jump) */}
            <div className="fixed right-4 top-1/2 -translate-y-1/2 z-50 hidden xl:flex flex-col gap-0.5 bg-white/80 backdrop-blur-md p-1.5 rounded-2xl shadow-2xl border border-white/50 max-h-[85vh] overflow-y-auto scrollbar-hide">
                {alphabet.map(letter => {
                    const hasItems = groupedData[letter];
                    return (
                        <button
                            key={letter}
                            onClick={() => {
                                const el = document.getElementById(`group-${letter}`);
                                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }}
                            disabled={!hasItems}
                            className={`w-5 h-5 flex items-center justify-center text-[8px] font-black rounded-md transition-all ${
                                hasItems 
                                ? 'text-brand-900 hover:bg-brand-500 hover:text-white cursor-pointer' 
                                : 'text-slate-300 cursor-not-allowed opacity-30'
                            }`}
                        >
                            {letter}
                        </button>
                    );
                })}
            </div>

            {/* Header Premium */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-[1.5rem] bg-brand-900 flex items-center justify-center text-white shadow-2xl shadow-brand-900/20 relative group overflow-hidden">
                        <BadgeCheck size={28} className="relative z-10" />
                        <div className="absolute inset-0 bg-gradient-to-br from-brand-600 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 tracking-tight uppercase leading-none">
                            Gestión de Marcas
                        </h1>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-3 flex items-center gap-2">
                            <Building2 size={12} className="text-brand-500" />
                            Catálogo de marcas <span className='font-black italic'>{empresaActiva?.nombre}</span>
                        </p>
                    </div>
                </div>

                <button
                    onClick={() => { setSelectedItem(null); setShowModal(true); }}
                    className="w-full md:w-auto flex bg-brand-900 text-white px-6 py-2.5 rounded-md text-sm font-bold hover:bg-brand-600 transition-all shadow-lg shadow-brand-accent/20 items-center justify-center gap-2 active:scale-95"
                >
                    <Plus size={18} />
                    <span>Agregar</span>
                </button>

            </div>

            <div className="flex items-center gap-3 relative z-10">
                <div className="w-full group/search">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within/search:text-brand-500 transition-colors" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-12 pr-6 py-3 bg-gray-50 border border-gray-100 rounded-md text-sm font-semibold text-slate-700 outline-none focus:ring-4 focus:ring-brand-accent/10 focus:border-brand-accent transition-all w-full shadow-sm"
                    />
                </div>
            </div>

            {/* Grid de Datos */}
            <div className="bg-white rounded-md shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50">
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-gray-100">Nombre</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-gray-100">Estado</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-gray-100 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loading ? (
                                Array(5).fill(0).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={4} className="px-8 py-6">
                                            <div className="h-4 bg-gray-100 rounded-lg w-full"></div>
                                        </td>
                                    </tr>
                                ))
                            ) : Object.keys(groupedData).length > 0 ? (
                                Object.entries(groupedData).map(([letter, items]) => (
                                    <Fragment key={letter}>
                                        {/* Sticky Header de la Letra */}
                                        <tr id={`group-${letter}`} className="bg-slate-50/90 backdrop-blur-sm sticky top-0 z-20">
                                            <td colSpan={3} className="px-8 py-2 border-y border-slate-100 shadow-sm">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xl font-black text-brand-900">{letter}</span>
                                                    <div className="h-[2px] flex-1 bg-gradient-to-r from-brand-200 to-transparent rounded-full opacity-50" />
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white px-3 py-1 rounded-full border border-slate-100 shadow-sm">
                                                        {items.length} {items.length === 1 ? 'Marca' : 'Marcas'}
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                        {items.map((item) => (
                                            <tr
                                                key={item.id}
                                                className="hover:bg-slate-50 transition-all duration-300 group/row cursor-default"
                                            >
                                                <td className="px-8 py-3 text-sm font-bold text-slate-700 uppercase tracking-tight">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-brand-200 group-hover/row:bg-brand-500 transition-colors" />
                                                        {item.nombre}
                                                    </div>
                                                </td>
                                                <td className="px-8 py-3">
                                                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${item.estatus
                                                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                                        : 'bg-red-50 text-red-600 border border-red-100'
                                                        }`}>
                                                        {item.estatus ? 'ACTIVO' : 'INACTIVO'}
                                                    </span>
                                                </td>
                                                <td className="px-8 py-3 text-right">
                                                    <button
                                                        onClick={() => { setSelectedItem(item); setShowModal(true); }}
                                                        className="inline-flex items-center justify-center w-11 h-11 text-slate-300 hover:text-brand-accent hover:bg-brand-50 hover:border-brand-100 border border-transparent rounded-md transition-all shadow-sm hover:shadow-brand-accent/5 active:scale-90"
                                                        title="Editar Marca"
                                                    >
                                                        <Edit2 size={20} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </Fragment>
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

            {/* Modal de Gestión */}
            {showModal && (
                <MarcaModal
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
