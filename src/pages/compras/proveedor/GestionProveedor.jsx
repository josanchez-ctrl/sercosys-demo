import React, { useState, useEffect, useMemo } from 'react';
import {
    Users,
    Plus,
    Search,
    Edit2,
    CheckCircle2,
    XCircle,
    Mail,
    Phone,
    MapPin
} from 'lucide-react';
import { getProveedores, updateProveedor } from '../../../services/proveedorService';
import { useModulePermissions } from '../../../hooks/useModulePermissions';
import ProveedorModal from './ProveedorModal';
import { toast } from 'sonner';

const GestionProveedor = () => {
    const { perfil, empresaActiva, renderGuard } = useModulePermissions();
    const [proveedores, setProveedores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeStatusFilter, setActiveStatusFilter] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [proveedorEdit, setProveedorEdit] = useState(null);

    useEffect(() => {
        if (empresaActiva?.id) {
            fetchProveedores();
        }
    }, [empresaActiva]);

    const fetchProveedores = async () => {
        try {
            setLoading(true);
            const data = await getProveedores(empresaActiva.id);
            setProveedores(data);
        } catch (error) {
            console.error(error);
            toast.error('Error al cargar proveedores');
        } finally {
            setLoading(false);
        }
    };

    const filteredProveedores = useMemo(() => {
        return proveedores.filter(p => {
            const searchStr = `${p.nombre} ${p.dni}`.toLowerCase();
            const matchesSearch = searchStr.includes(searchTerm.toLowerCase());

            const matchesStatus = activeStatusFilter === null ||
                (activeStatusFilter === 'ACTIVO' && p.estatus) ||
                (activeStatusFilter === 'INACTIVO' && !p.estatus);

            return matchesSearch && matchesStatus;
        });
    }, [proveedores, searchTerm, activeStatusFilter]);

    const statusConfig = {
        ACTIVO: { label: 'Activos', color: 'bg-emerald-50 text-emerald-600 border-emerald-200', icon: <CheckCircle2 size={12} /> },
        INACTIVO: { label: 'Inactivos', color: 'bg-red-50 text-red-600 border-red-200', icon: <XCircle size={12} /> },
    };

    const handleToggleStatus = async (proveedor) => {
        try {
            await updateProveedor(proveedor.id, { estatus: !proveedor.estatus });
            toast.success(`Proveedor ${proveedor.estatus ? 'desactivado' : 'activado'}`);
            fetchProveedores();
        } catch (error) {
            toast.error('Error al actualizar estado');
        }
    };

    const guard = renderGuard();
    if (guard) return guard;

    return (
        <div className="p-4 space-y-2 animate-in fade-in duration-500 bg-slate-50 min-h-screen">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-brand-50 rounded-xl">
                        <Users className="text-brand-900" size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-slate-800 uppercase tracking-tight">Gestión de Proveedores</h1>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest italic">Compras y Suministros</p>
                    </div>
                </div>

                <button
                    onClick={() => { setProveedorEdit(null); setIsModalOpen(true); }}
                    className="flex items-center justify-center gap-2 bg-brand-900 text-white px-6 py-2.5 rounded-md font-bold shadow-lg shadow-brand-900/20 active:scale-95 transition-all uppercase text-xs tracking-widest"
                >
                    <Plus size={16} />
                    Nuevo Proveedor
                </button>
            </div>

            {/* KPIs / Filtros */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-2">
                {Object.entries(statusConfig).map(([key, config]) => {
                    const count = proveedores.filter(p => (key === 'ACTIVO' ? p.estatus : !p.estatus)).length;
                    const isActive = activeStatusFilter === key;
                    return (
                        <button
                            key={key}
                            onClick={() => setActiveStatusFilter(isActive ? null : key)}
                            className={`bg-white p-4 rounded-md border transition-all duration-300 flex items-center justify-between group cursor-pointer ${isActive
                                ? 'border-brand-500 shadow-lg shadow-brand-500/10 ring-2 ring-brand-500/5 -translate-y-1'
                                : 'border-gray-100 shadow-sm hover:shadow-md hover:border-brand-200'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-xl transition-colors ${isActive ? config.color : 'bg-gray-50 text-gray-400'}`}>
                                    {config.icon}
                                </div>
                                <span className={`text-[10px] font-black uppercase tracking-widest transition-colors ${isActive ? 'text-brand-900' : 'text-slate-400'}`}>
                                    {config.label}
                                </span>
                            </div>
                            <span className={`text-xl font-black tabular-nums transition-transform duration-300 ${isActive ? 'scale-110' : ''} ${isActive ? config.color.split(' ')[1] : 'text-slate-300'}`}>
                                {count}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Buscador */}
            <div className="bg-white p-2 rounded-md border border-gray-100 shadow-sm flex items-center gap-3">
                <Search className="text-slate-400 ml-2" size={18} />
                <input
                    type="text"
                    placeholder="Buscar por nombre, DNI o RIF..."
                    className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-slate-600 placeholder:text-slate-300 font-medium py-2"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Tabla */}
            <div className="bg-white rounded-md shadow-sm border border-gray-100 overflow-hidden mt-2">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50/50">
                            <tr>
                                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-gray-100">Razón Social</th>
                                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-gray-100">DNI / RIF</th>
                                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-gray-100">Contacto</th>
                                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-gray-100 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="4" className="px-4 py-8 text-center text-slate-400 text-sm italic">Cargando proveedores...</td>
                                </tr>
                            ) : filteredProveedores.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="px-4 py-8 text-center">
                                        <div className="flex flex-col items-center opacity-40">
                                            <Users size={48} className="text-slate-300" />
                                            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-2">No se encontraron resultados</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredProveedores.map((p) => (
                                    <tr key={p.id} className="hover:bg-slate-50 transition-all group">
                                        <td className="px-4 py-4">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-700 text-sm uppercase">{p.nombre}</span>
                                                <div className="flex items-center gap-1 mt-1">
                                                    <MapPin size={10} className="text-slate-300" />
                                                    <span className="text-[10px] text-slate-400 truncate max-w-[300px]">{p.direccion || 'Sin dirección registrada'}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-[10px] font-black tabular-nums">
                                                {p.letrasdni?.nombre}-{p.dni}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="space-y-1">
                                                {p.email && (
                                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                                        <Mail size={12} className="text-slate-300" />
                                                        <span>{p.email}</span>
                                                    </div>
                                                )}
                                                {p.telefono && (
                                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                                        <Phone size={12} className="text-slate-300" />
                                                        <span>{p.telefono}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                                <button
                                                    onClick={() => { setProveedorEdit(p); setIsModalOpen(true); }}
                                                    className="p-2 bg-white border border-gray-100 hover:bg-brand-50 text-slate-400 hover:text-brand-600 rounded-lg shadow-sm transition-all"
                                                    title="Editar"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleToggleStatus(p)}
                                                    className={`p-2 bg-white border border-gray-100 rounded-lg shadow-sm transition-all ${p.estatus ? 'hover:bg-red-50 text-red-400' : 'hover:bg-emerald-50 text-emerald-400'}`}
                                                    title={p.estatus ? 'Desactivar' : 'Activar'}
                                                >
                                                    {p.estatus ? <XCircle size={14} /> : <CheckCircle2 size={14} />}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {isModalOpen && (
                <ProveedorModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onSuccess={fetchProveedores}
                    proveedor={proveedorEdit}
                />
            )}
        </div>
    );
};

export default GestionProveedor;
