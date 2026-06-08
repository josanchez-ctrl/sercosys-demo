import { useState, useEffect, Fragment } from 'react';
import { useModulePermissions } from '../../../hooks/useModulePermissions';
import {
    Plus, Search, Edit2, Landmark, RefreshCw, Bookmark,
    Filter, Package, Layers, Info, CheckCircle2,
    Clock, XCircle, MoreVertical, Warehouse
} from 'lucide-react';
import {
    getActivos, saveActivo, registerBatchActivos, getAlmacenActivosConfig
} from '../../../services/activoService';
import { getDepartamentos } from '../../../services/departamentoService';
import { getSucursales } from '../../../services/sucursalService';
import { toast } from 'sonner';
import { formatNumber } from '../../../util/workDecimales';

// Nuevos componentes refactorizados
import ActivosModal from './ActivosModal';
import ActivosBatchModal from './ActivosBatchModal';

export default function GestionActivos() {
    const { perfil, empresaActiva, renderGuard } = useModulePermissions();

    // Data states
    const [activos, setActivos] = useState([]);
    const [categorias, setCategorias] = useState([]);
    const [rubros, setRubros] = useState([]);
    const [productos, setProductos] = useState([]);
    const [sucursales, setSucursales] = useState([]);
    const [departamentos, setDepartamentos] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filter states
    const [searchTerm, setSearchTerm] = useState('');
    const [filterSucursal, setFilterSucursal] = useState('ALL');
    const [activeStatusFilter, setActiveStatusFilter] = useState(null);

    // Modal states
    const [showModal, setShowModal] = useState(false);
    const [showBatchModal, setShowBatchModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (empresaActiva?.id) {
            initData();
        }
    }, [empresaActiva?.id]);

    const initData = async () => {
        setLoading(true);
        try {
            const [act, configResult, suc, dep] = await Promise.all([
                getActivos(empresaActiva.id),
                getAlmacenActivosConfig(empresaActiva.id),
                getSucursales(empresaActiva.id),
                getDepartamentos(empresaActiva.id)
            ]);
            setActivos(act || []);
            setCategorias(configResult.categorias || []);
            setRubros(configResult.rubros || []);
            setProductos(configResult.productos || []);
            setSucursales(suc || []);
            setDepartamentos(dep || []);
        } catch (error) {
            console.error(error);
            toast.error("Error al cargar datos");
        } finally {
            setLoading(false);
        }
    };

    const handleSaveSingle = async (values) => {
        if (!empresaActiva?.id || !perfil?.id) {
            toast.error("Sesión o empresa no válida");
            return;
        }
        setSaving(true);
        try {
            await saveActivo({
                ...values,
                id_empresa: empresaActiva.id,
                id_usuario: perfil.id,
                id: selectedItem?.id
            });
            toast.success(selectedItem ? "Activo actualizado" : "Activo registrado");
            setShowModal(false);
            initData();
        } catch (error) {
            console.error(error);
            toast.error("Error al guardar activo");
        } finally {
            setSaving(false);
        }
    };

    const handleSaveBatch = async (values) => {
        if (!empresaActiva?.id || !perfil?.id) {
            toast.error("Sesión o empresa no válida");
            return;
        }
        setSaving(true);
        try {
            await registerBatchActivos({
                ...values,
                id_empresa: empresaActiva.id,
                id_usuario: perfil.id
            });
            toast.success("Capitalización masiva completada");
            setShowBatchModal(false);
            initData();
        } catch (error) {
            console.error(error);
            toast.error("Error en registro masivo");
        } finally {
            setSaving(false);
        }
    };

    const statusConfig = {
        ACTIVO: { label: 'Disponibles', color: 'bg-emerald-50 text-emerald-600 border-emerald-200', icon: <CheckCircle2 size={12} /> },
        MANTENIMIENTO: { label: 'Mantenimiento', color: 'bg-amber-50 text-amber-600 border-amber-200', icon: <Clock size={12} /> },
        BAJA: { label: 'De Baja', color: 'bg-red-50 text-red-600 border-red-200', icon: <XCircle size={12} /> },
    };

    const filtered = activos.filter(a => {
        const matchesSearch =
            a.codigo_inventario.toLowerCase().includes(searchTerm.toLowerCase()) ||
            a.serial?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            a.producto?.variedad?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            a.producto?.marca?.nombre?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesSucursal = filterSucursal === 'ALL' || a.id_sucursal_actual?.toString() === filterSucursal;
        const matchesStatus = !activeStatusFilter || a.estatus_operativo === activeStatusFilter;
        return matchesSearch && matchesSucursal && matchesStatus;
    });

    const guard = renderGuard();
    if (guard) return guard;

    return (
        <div className="p-4 space-y-2 animate-in fade-in duration-500 bg-slate-50">
            {/* Header / Command Center */}
            <div className="flex flex-col xl:flex-row gap-6 mb-6">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-md bg-brand-900 flex items-center justify-center text-white shadow-2xl shadow-brand-900/20">
                        <Landmark size={28} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 tracking-tight leading-none uppercase">Activos Logísticos</h1>
                        <p className="text-slate-400 text-[10px] uppercase font-black tracking-widest mt-1 italic italic">Control de Inventario Permanente</p>
                    </div>
                </div>

                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-brand-500 transition-colors" size={16} />
                        <input
                            type="text"
                            placeholder="SERIAL, CÓDIGO O MARCA..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-6 py-3 bg-white border border-gray-100 rounded-md text-[10px] font-black text-slate-600 outline-none focus:ring-4 focus:ring-brand-500/5 focus:border-brand-200 transition-all shadow-sm"
                        />
                    </div>

                    <div className="relative flex items-center bg-white border border-gray-100 rounded-md px-4 shadow-sm">
                        <Warehouse size={16} className="text-slate-300 mr-2" />
                        <select
                            value={filterSucursal}
                            onChange={(e) => setFilterSucursal(e.target.value)}
                            className="w-full bg-transparent py-3 text-[10px] font-black text-slate-600 outline-none uppercase"
                        >
                            <option value="ALL">TODAS LAS SUCURSALES</option>
                            {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                        </select>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={() => { setSelectedItem(null); setShowModal(true); }}
                            className="flex-1 px-4 bg-brand-900 text-white rounded-md font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-brand-800 transition-all shadow-lg shadow-brand-900/20 active:scale-95"
                        >
                            <Plus size={16} /> Individual
                        </button>
                        <button
                            onClick={() => setShowBatchModal(true)}
                            className="flex-1 px-4 bg-slate-800 text-white rounded-md font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-700 transition-all shadow-lg active:scale-95"
                        >
                            <Package size={16} /> Masivo
                        </button>
                    </div>
                </div>
            </div>

            {/* KPIs / Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                {Object.entries(statusConfig).map(([key, config]) => {
                    const count = activos.filter(a => a.estatus_operativo === key).length;
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
                                <div className={`p-2 rounded-xl transition-colors ${isActive ? config.color.split(' ')[0] + ' ' + config.color.split(' ')[1] : config.color.split(' ').slice(0, 2).join(' ')}`}>
                                    {config.icon}
                                </div>
                                <span className={`text-[10px] font-black uppercase tracking-widest transition-colors ${isActive ? 'text-brand-900' : 'text-slate-400'}`}>
                                    {config.label}
                                </span>
                            </div>
                            <span className={`text-xl font-black tabular-nums transition-transform duration-300 ${isActive ? 'scale-110' : ''} ${config.color.split(' ').find(c => c.startsWith('text-'))}`}>
                                {count}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Main Content Table */}
            <div className="bg-white border border-gray-100 rounded-md shadow-sm overflow-hidden flex flex-col flex-1">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50/50 border-b border-gray-100">
                            <tr>
                                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 whitespace-nowrap">Rubro</th>
                                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 whitespace-nowrap">Código</th>
                                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                    <span>Descripción</span>
                                </th>
                                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Estatus</th>
                                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Ubicación</th>
                                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Condición</th>
                                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 text-center w-16">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-300">
                            {loading ? (
                                Array(5).fill(0).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td className="px-4 py-4"><div className="h-4 bg-slate-100 rounded w-24"></div></td>
                                        <td className="px-4 py-4"><div className="h-4 bg-slate-100 rounded w-20"></div></td>
                                        <td className="px-4 py-4"><div className="h-10 bg-slate-100 rounded w-48"></div></td>
                                        <td className="px-4 py-4"><div className="h-4 bg-slate-100 rounded w-20"></div></td>
                                        <td className="px-4 py-4"><div className="h-4 bg-slate-100 rounded w-32"></div></td>
                                        <td className="px-4 py-4"><div className="h-4 bg-slate-100 rounded w-20"></div></td>
                                        <td className="px-4 py-4"><div className="h-8 bg-slate-100 rounded w-8 mx-auto"></div></td>
                                    </tr>
                                ))
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-20 text-center opacity-40">
                                        <div className="flex flex-col items-center justify-center">
                                            <Landmark size={48} className="mb-4 text-slate-400" />
                                            <p className="text-sm font-black uppercase tracking-widest text-slate-500">No se encontraron activos</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                (() => {
                                    const sorted = [...filtered].sort((a, b) => {
                                        const rubroA = a.producto?.rubro?.nombre || 'SIN RUBRO';
                                        const rubroB = b.producto?.rubro?.nombre || 'SIN RUBRO';

                                        // 1. Agrupar/Ordenar por Rubro
                                        const rubroCompare = rubroA.localeCompare(rubroB);
                                        if (rubroCompare !== 0) return rubroCompare;

                                        // 2. Ordenar internamente por Código de Inventario
                                        const codA = a.codigo_inventario || '';
                                        const codB = b.codigo_inventario || '';
                                        return codA.localeCompare(codB);
                                    });

                                    // Contar activos por cada Rubro para el cálculo de rowSpan
                                    const rubroCounts = {};
                                    sorted.forEach(item => {
                                        const rName = item.producto?.rubro?.nombre || 'SIN RUBRO';
                                        rubroCounts[rName] = (rubroCounts[rName] || 0) + 1;
                                    });

                                    return sorted.map((item, index) => {
                                        const rubroName = item.producto?.rubro?.nombre || 'SIN RUBRO';
                                        const prevRubroName = index > 0 ? (sorted[index - 1].producto?.rubro?.nombre || 'SIN RUBRO') : null;
                                        const isFirstOfGroup = rubroName !== prevRubroName;

                                        return (
                                            <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                                                {isFirstOfGroup && (
                                                    <td rowSpan={rubroCounts[rubroName]} className="px-4 py-1 align-middle border-r border-gray-100 bg-white font-black text-slate-800">
                                                        <div className="flex items-center gap-2 animate-in fade-in duration-300">
                                                            <Layers size={14} className="text-brand-900 shrink-0" />
                                                            <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest truncate max-w-[180px]" title={rubroName}>
                                                                {rubroName}
                                                            </span>
                                                        </div>
                                                    </td>
                                                )}
                                                <td className="px-4 py-1 align-middle">
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-black text-brand-900 bg-brand-50 px-2 py-1 rounded-md tracking-widest w-fit mb-1">
                                                            {item.codigo_inventario}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-1 align-middle">
                                                    <div className="flex flex-col gap-0.5">
                                                        <p className="text-xs font-black text-slate-700 uppercase"><span className="text-slate-500">{item.producto?.marca?.nombre || ''} {item.producto?.variedad || ''}</span></p>
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase truncate max-w-[200px]" title={item.serial ? `S/N: ${item.serial}` : 'SIN SERIAL'}>{item.serial ? `S/N: ${item.serial}` : 'SIN SERIAL'}</p>
                                                        <p className="text-[10px] font-black text-slate-600 tabular-nums">{formatNumber(item.peso, 1)} KG</p>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-1 align-middle">
                                                    <div className={`px-2 py-0.5 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-1 w-fit ${item.estatus_operativo === 'ACTIVO' ? 'bg-emerald-50 text-emerald-700' :
                                                        item.estatus_operativo === 'MANTENIMIENTO' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
                                                        }`}>
                                                        <span className={`w-1.5 h-1.5 rounded-full ${item.estatus_operativo === 'ACTIVO' ? 'bg-emerald-500' :
                                                            item.estatus_operativo === 'MANTENIMIENTO' ? 'bg-amber-500' : 'bg-red-500'
                                                            }`} />
                                                        {item.estatus_operativo}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-1 align-middle">
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-black text-slate-600 uppercase flex items-center gap-1 mb-0.5">
                                                            <Warehouse size={10} className="text-slate-400 shrink-0" />
                                                            <span className="truncate max-w-[150px]" title={item.sucursal?.nombre || item.sucursales?.nombre || 'ALMACÉN CENTRAL'}>
                                                                {item.sucursal?.nombre || item.sucursales?.nombre || 'ALMACÉN CENTRAL'}
                                                            </span>
                                                        </span>
                                                        <span className="text-[9px] font-bold text-slate-400 uppercase ml-3 truncate max-w-[150px]" title={item.departamento?.nombre || item.departamentos?.nombre || 'SIN ASIGNAR'}>
                                                            DEPTO: {item.departamento?.nombre || item.departamentos?.nombre || 'SIN ASIGNAR'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-1 align-middle">
                                                    <span className="text-[9px] font-black text-slate-500 uppercase bg-slate-100 px-2 py-1 rounded-md tracking-widest">
                                                        {item.condicion}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-1 align-middle text-center">
                                                    <button
                                                        onClick={() => { setSelectedItem(item); setShowModal(true); }}
                                                        className="p-2 text-slate-300 hover:text-brand-900 hover:bg-brand-50 rounded-md transition-all opacity-0 group-hover:opacity-100"
                                                        title="Editar Activo"
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    });
                                })()
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modales refactorizados */}
            {showModal && (
                <ActivosModal
                    selectedItem={selectedItem}
                    categorias={categorias}
                    rubros={rubros}
                    productos={productos}
                    departamentos={departamentos}
                    sucursales={sucursales}
                    saving={saving}
                    onCancel={() => setShowModal(false)}
                    onSave={handleSaveSingle}
                />
            )}

            {showBatchModal && (
                <ActivosBatchModal
                    categorias={categorias}
                    rubros={rubros}
                    productos={productos}
                    departamentos={departamentos}
                    sucursales={sucursales}
                    saving={saving}
                    onCancel={() => setShowBatchModal(false)}
                    onSave={handleSaveBatch}
                />
            )}
        </div>
    );
}
