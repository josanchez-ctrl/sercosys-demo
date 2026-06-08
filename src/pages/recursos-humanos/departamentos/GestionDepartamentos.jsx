import { useState, useEffect } from 'react';
import { useModulePermissions } from '../../../hooks/useModulePermissions';
import {
    ArrowRightFromLine, Plus, Search, Edit2,
    Layers, Hash
} from 'lucide-react';
import { getDepartamentos, saveDepartamento } from '../../../services/departamentoService';
import { toast } from 'sonner';
import DepartamentosModal from './DepartamentosModal';

export default function GestionDepartamentos() {
    const { perfil, empresaActiva, renderGuard } = useModulePermissions();
    const [departamentos, setDepartamentos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (empresaActiva?.id) fetchDepartamentos();
    }, [empresaActiva?.id]);

    const fetchDepartamentos = async () => {
        setLoading(true);
        try {
            const data = await getDepartamentos(empresaActiva.id);
            setDepartamentos(data || []);
        } catch (error) {
            console.error(error);
            toast.error("Error al cargar departamentos");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (payload) => {
        if (!empresaActiva?.id || !perfil?.id) {
            toast.error("Sesión o empresa no válida");
            return;
        }
        setSaving(true);
        try {
            await saveDepartamento({
                ...payload,
                id_empresa: empresaActiva.id,
                id_usuario: perfil.id
            });
            toast.success(selectedItem ? "Departamento actualizado" : "Departamento creado");
            setShowModal(false);
            fetchDepartamentos();
        } catch (error) {
            console.error(error);
            toast.error("Error al guardar departamento");
        } finally {
            setSaving(false);
        }
    };

    const filtered = departamentos.filter(d =>
        d.nombre.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const guard = renderGuard();
    if (guard) return guard;

    return (
        <div className="p-4 space-y-2 animate-in fade-in duration-500 bg-slate-50">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-2">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-md bg-brand-900 flex items-center justify-center text-white shadow-2xl shadow-brand-900/20">
                        <ArrowRightFromLine size={28} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 tracking-tight leading-none uppercase">Departamentos</h1>
                        <p className="text-slate-400 text-[10px] uppercase font-black tracking-widest mt-1 italic">Estructura Organizacional</p>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                    <div className="relative group w-full md:w-80">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-brand-500 transition-colors" size={18} />
                        <input
                            type="text"
                            placeholder="BUSCAR DEPARTAMENTO..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-6 py-3 bg-white border border-gray-100 rounded-md text-xs font-bold text-slate-600 outline-none focus:ring-4 focus:ring-brand-500/5 focus:border-brand-200 transition-all shadow-sm"
                        />
                    </div>

                    <button
                        onClick={() => { setSelectedItem(null); setShowModal(true); }}
                        className="w-full md:w-auto px-6 py-3 bg-brand-900 text-white rounded-md font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-brand-800 transition-all shadow-lg shadow-brand-900/20 active:scale-95"
                    >
                        <Plus size={16} />
                        Agregar Departamento
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="bg-white rounded-md shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50">
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-gray-100 w-16 text-center">#</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-gray-100">Nombre del Departamento</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-gray-100 text-center">Estado</th>
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
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-8 py-20 text-center">
                                        <div className="flex flex-col items-center opacity-20">
                                            <Layers size={60} className="mb-4" />
                                            <p className="text-sm font-black uppercase tracking-widest">No se encontraron departamentos</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filtered.map(item => (
                                    <tr key={item.id} className="hover:bg-slate-50 transition-all duration-300 group/row">
                                        <td className="px-8 py-4 text-center">
                                            <span className="text-[10px] font-black text-slate-300 tabular-nums">
                                                {item.orden || 0}
                                            </span>
                                        </td>
                                        <td className="px-8 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-1.5 h-1.5 rounded-full bg-brand-200 group-hover/row:bg-brand-500 transition-colors" />
                                                <span className="text-sm font-bold text-slate-700 uppercase tracking-tight">
                                                    {item.nombre}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-4 text-center">
                                            <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${item.estatus
                                                ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                                : 'bg-red-50 text-red-600 border border-red-100'
                                                }`}>
                                                {item.estatus ? 'ACTIVO' : 'INACTIVO'}
                                            </span>
                                        </td>
                                        <td className="px-8 py-4 text-right">
                                            <button
                                                onClick={() => { setSelectedItem(item); setShowModal(true); }}
                                                className="inline-flex items-center justify-center w-10 h-10 text-slate-300 hover:text-brand-accent hover:bg-brand-50 border border-transparent rounded-md transition-all shadow-sm active:scale-90"
                                            >
                                                <Edit2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <DepartamentosModal
                    selectedItem={selectedItem}
                    saving={saving}
                    onCancel={() => setShowModal(false)}
                    onSave={handleSave}
                />
            )}
        </div>
    );
}
