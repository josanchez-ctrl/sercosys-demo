import { useState, useEffect } from 'react';
import { Ruler, Plus, Search, Scale, Building2, Edit2 } from 'lucide-react';
import { useModulePermissions } from '../../../hooks/useModulePermissions';
import { getUnidadesMedida } from '../../../services/unidadesmedidaService';
import UnidadesMedidaModal from './UnidadesMedidaModal';

export default function GestionUnidadesMedida() {
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
            const res = await getUnidadesMedida(empresaActiva.id);
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

    const guard = renderGuard();
    if (guard) return guard;

    return (
        <div className="p-4 sm:p-8 space-y-8 animate-in fade-in duration-500 bg-slate-50 min-h-screen">

            {/* Header Premium */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-[1.5rem] bg-brand-900 flex items-center justify-center text-white shadow-2xl shadow-brand-900/20 relative group overflow-hidden">
                        <Ruler size={28} className="relative z-10" />
                        <div className="absolute inset-0 bg-gradient-to-br from-brand-600 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 tracking-tight uppercase leading-none">
                            Gestión de Unidades de Medida
                        </h1>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-3 flex items-center gap-2">
                            <Building2 size={12} className="text-brand-500" />
                            Catálogo de unidades de medida <span className='font-black italic'>{empresaActiva?.nombre}</span>
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
                        placeholder="Buscar categoría..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-12 pr-6 py-3 bg-gray-50 border border-gray-100 rounded-md text-sm font-semibold text-slate-700 outline-none focus:ring-4 focus:ring-brand-accent/10 focus:border-brand-accent transition-all w-full shadow-sm"
                    />
                </div>
            </div>

            {/* Grid de Datos */}
            <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50">
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-gray-100">Nombre</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-gray-100">Abreviatura</th>
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
                            ) : filteredData.length > 0 ? (
                                filteredData.map((item) => (
                                    <tr
                                        key={item.id}
                                        className="hover:bg-slate-50 transition-all duration-300 group/row cursor-default"
                                    >
                                        <td className="px-8 py-1 text-sm font-bold text-slate-700 uppercase tracking-tight">
                                            {item.nombre}
                                        </td>
                                        <td className="px-8 py-1">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-gray-100 text-gray-500 rounded-lg group-hover/row:bg-brand-50 group-hover/row:text-brand-600 transition-colors">
                                                    <Scale size={16} />
                                                </div>
                                                <span className="text-xs font-black uppercase text-slate-400 tracking-tight group-hover/row:text-brand-700 transition-colors">
                                                    {/* Aquí iría el nombre del almacén si se hace resolve, por ahora el ID o placeholder */}
                                                    {item.abreviatura || 'General'}
                                                </span>
                                            </div>
                                        </td>
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

            {/* Modal de Gestión */}
            {showModal && (
                <UnidadesMedidaModal
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
