import { useState, useEffect, useMemo } from 'react';
import { ClipboardList, Plus, Search, Box, Tags, Building2, Edit2, Warehouse, QrCode } from 'lucide-react';
import { useModulePermissions } from '../../../hooks/useModulePermissions';
import { getProductos } from '../../../services/productoService';
import { getAlmacenes } from '../../../services/almacenService';
import ProductosModal from './ProductosModal';

export default function GestionProductos() {
    const { perfil, empresaActiva, renderGuard } = useModulePermissions();

    const [loading, setLoading] = useState(true);
    const [productos, setProductos] = useState([]);
    const [almacenes, setAlmacenes] = useState([]);
    const [almacenSel, setAlmacenSel] = useState(null);
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
            const [almacenesData, res] = await Promise.all([
                getAlmacenes(empresaActiva.id),
                getProductos(empresaActiva.id)
            ]);
            setAlmacenes(almacenesData);
            setProductos(res || []);
        } catch (error) {
            console.error('Error al cargar productos:', error);
        } finally {
            setLoading(false);
        }
    };

    const almacenesFiltrados = almacenes.filter(almacen =>
        perfil?.F_ALL === true
            ? true
            : (perfil?.ids_almacenes?.includes(almacen.id))
    );

    const filteredData = productos.filter(p => {
        const search = searchTerm.toLowerCase();
        return (
            (p.rubro?.nombre?.toLowerCase().includes(search) ||
                p.marca?.nombre?.toLowerCase().includes(search) ||
                p.variedad?.toLowerCase().includes(search) ||
                p.presentacion?.nombre?.toLowerCase().includes(search))
            &&
            p.rubro?.categoria?.id_almacen === almacenSel?.id
        );
    });

    const groupedData = useMemo(() => {
        const groups = {};
        filteredData.forEach(p => {
            const rid = p.id_rubro;
            if (!groups[rid]) {
                groups[rid] = {
                    rubro: p.rubro,
                    productos: []
                };
            }
            groups[rid].productos.push(p);
        });
        return Object.values(groups).sort((a, b) =>
            (a.rubro?.nombre || '').localeCompare(b.rubro?.nombre || '')
        );
    }, [filteredData]);

    const guard = renderGuard();
    if (guard) return guard;

    return (
        <div className="p-4 sm:p-8 space-y-2 animate-in fade-in duration-500 bg-slate-50">

            {/* Header Premium - Congruente */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-md border border-gray-100 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-md bg-gradient-brand flex items-center justify-center text-white shadow-lg relative group overflow-hidden">
                        <ClipboardList size={24} className="relative z-10" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 tracking-tight uppercase leading-none">
                            Catálogo de <span className="text-gradient">Productos</span>
                        </h1>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1.5 flex items-center gap-2">
                            <Building2 size={10} className="text-brand-500" />
                            Listado maestro de insumos: <span className='italic'>{empresaActiva?.nombre}</span>
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-4 relative">
                    <div className='grid grid-cols-2 lg:grid-cols-4 gap-2'>
                        {almacenesFiltrados.filter(almacen => almacen.id !=5).map(almacen => (
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
                <>
                    <div className="flex items-center gap-1 relative">
                        <div className="flex-1 group/search">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within/search:text-brand-500 transition-colors" size={18} />
                            <input
                                type="text"
                                placeholder="Buscar por rubro, marca o presentación..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-12 pr-6 py-3 bg-white border border-gray-100 rounded-md text-sm font-semibold text-slate-700 outline-none focus:ring-4 focus:ring-brand-accent/10 focus:border-brand-accent transition-all shadow-sm"
                            />
                        </div>
                        <button
                            onClick={() => { setSelectedItem(null); setShowModal(true); }}
                            className="w-auto bg-brand-900 text-white px-6 py-2.5 rounded-md text-sm font-bold hover:bg-brand-600 transition-all shadow-lg shadow-brand-accent/20 items-center justify-center gap-2 active:scale-95"
                        >
                            <span className='flex items-center gap-2'>
                                <Plus size={18} />
                                <span>Agregar Producto</span>
                            </span>
                        </button>
                    </div>

                    <div className="bg-white rounded-md shadow-premium border border-gray-100 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50/50">
                                        <th className="w-[25%] px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-gray-100">Rubro / Categoría</th>
                                        <th className="w-[70%] px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-gray-100">Productos & Variantes</th>
                                        <th className="w-[5%] px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-gray-100 text-right">Acción</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-300">
                                    {loading ? (
                                        Array(3).fill(0).map((_, i) => (
                                            <tr key={i} className="animate-pulse">
                                                <td colSpan={3} className="px-8 py-10"><div className="h-4 bg-gray-100 rounded w-full"></div></td>
                                            </tr>
                                        ))
                                    ) : groupedData.length > 0 ? (
                                        groupedData.map((group) => (
                                            <tr key={group.rubro.id} className="hover:bg-slate-50/30 transition-all ">
                                                <td className="px-2 py-2 align-top">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-3 bg-brand-50 rounded-md text-brand-900 shadow-sm border border-brand-100/50">
                                                            <Tags size={20} />
                                                        </div>
                                                        <div>
                                                            <span className="flex flex-col text-sm font-black text-slate-800 uppercase tracking-tight">
                                                                {group.rubro?.nombre}
                                                                <span className="text-[9px] font-black text-brand-600 bg-brand-50/50 px-2 py-0.5 rounded-lg uppercase tracking-tighter">
                                                                    {group.rubro.categoria.nombre}
                                                                </span>
                                                            </span>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <span className="text-[9px] font-black text-brand-600 bg-brand-50/50 px-2 py-0.5 rounded-lg uppercase tracking-tighter">
                                                                    ({group.productos.length}) {group.productos.length === 1 ? 'Variante' : 'Variantes'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-2 py-2">
                                                    <div className="grid grid-cols-1 gap-2">
                                                        {group.productos.map(p => (
                                                            <div
                                                                key={p.id}
                                                                className="group/item bg-white border border-gray-100 rounded-md overflow-hidden hover:border-brand-300 hover:shadow-xl hover:shadow-brand-900/5 transition-all duration-300"
                                                            >
                                                                <div className="grid grid-cols-1 md:grid-cols-12 items-stretch">

                                                                    {/* COLUMNA 1: IDENTIFICACIÓN (3/12) */}
                                                                    <div className="md:col-span-3 p-4 flex flex-col justify-center bg-slate-50/30">
                                                                        <div className="flex items-center gap-2">
                                                                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight leading-tight">
                                                                                {p.marca?.nombre} {p.variedad && <span className="text-brand-600 block text-[11px] font-bold mt-1 italic">{p.variedad}</span>}
                                                                            </h3>
                                                                            {!p.estatus && (
                                                                                <span className="text-[8px] font-black bg-red-50 text-red-500 px-1.5 py-0.5 rounded uppercase self-start mt-1">Inactivo</span>
                                                                            )}
                                                                        </div>
                                                                    </div>

                                                                    {/* COLUMNA 2: LOGÍSTICA (6/12) */}
                                                                    <div className="md:col-span-6 border-x border-gray-100 flex flex-col justify-center divide-y divide-gray-50">
                                                                        {(p.logistica || []).sort((a, b) => (a.orden || 0) - (b.orden || 0) || a.factor - b.factor).map((log, lidx, arr) => {
                                                                            // 1. Intentamos buscar por ID guardado
                                                                            let parent = log.id_referencia ? arr.find(item => item.id === log.id_referencia) : null;

                                                                            // 2. Fallback: Si no hay ID, adivinamos el mejor padre (para datos viejos)
                                                                            if (!log.es_base && !parent) {
                                                                                const potentialParents = arr
                                                                                    .map((p, pIdx) => ({ ...p, originalIdx: pIdx }))
                                                                                    .filter((p, pIdx) => {
                                                                                        // Si tienen ID, comparamos IDs. Si no, comparamos índices.
                                                                                        const isSame = p.id && log.id ? p.id === log.id : pIdx === lidx;
                                                                                        return !isSame && p.factor > 0 && p.factor < log.factor;
                                                                                    })
                                                                                    .filter(p => {
                                                                                        const ratio = log.factor / p.factor;
                                                                                        return Math.abs(ratio - Math.round(ratio)) < 0.0001;
                                                                                    })
                                                                                    .sort((a, b) => b.factor - a.factor);

                                                                                if (potentialParents.length > 0) parent = potentialParents[0];
                                                                            }

                                                                            // Si hay id_referencia, usamos la cantidad guardada. 
                                                                            // Si no hay (dato viejo), calculamos el ratio real.
                                                                            const displayValue = (log.id_referencia && parent)
                                                                                ? (log.cantidad_referencia || 1)
                                                                                : (parent ? (log.factor / parent.factor) : log.factor);

                                                                            const refName = parent ? (parent.presentacion?.nombre || 'REF') : p.rubro?.almacen_unidades_medida?.abreviatura;

                                                                            return (
                                                                                <div key={lidx} className={`flex items-center justify-between px-4 py-2 text-[10px] ${log.es_base ? 'bg-brand-50/20' : 'bg-white'}`}>
                                                                                    <div className="flex items-center gap-2">
                                                                                        <span className={`font-black uppercase tracking-tighter ${log.es_base ? 'text-brand-900' : 'text-slate-500'}`}>
                                                                                            {log.presentacion?.nombre || 'UNIDAD'}
                                                                                        </span>
                                                                                        <div className="flex items-center gap-1">
                                                                                            <span className="text-[9px] font-black text-brand-700 bg-brand-50 px-1.5 py-0.5 rounded tabular-nums">
                                                                                                {Number(displayValue).toLocaleString()} {refName}
                                                                                            </span>
                                                                                            {!log.es_base && parent && (
                                                                                                <span className="text-[8px] font-bold italic">
                                                                                                    ({Number(log.factor).toLocaleString()} {p.rubro?.almacen_unidades_medida?.abreviatura})
                                                                                                </span>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                    <span className="flex gap-1 items-center font-mono font-bold group-hover/item:text-brand-700 transition-colors tracking-widest">
                                                                                        <QrCode size={12} /> {log.codigo_barras || 'SIN CÓDIGO'}
                                                                                    </span>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>

                                                                    {/* COLUMNA 3: CONTROL (2/12) */}
                                                                    {(() => {
                                                                        const refLog = (p.logistica || []).find(l => l.id === p.id_logistica_stock_minimo);
                                                                        const displayFactor = refLog?.factor || 1;
                                                                        const displayValue = (p.stock_minimo || 0) / displayFactor;
                                                                        const unitName = refLog?.presentacion?.nombre || p.rubro?.almacen_unidades_medida?.abreviatura || 'UNID';

                                                                        return (
                                                                            <div className="md:col-span-2 p-4 flex flex-col items-center justify-center bg-slate-50/10 border-l border-gray-50">
                                                                                <div className={`flex flex-col items-center justify-center w-full py-2 rounded-xl border border-dashed transition-all duration-300 ${p.stock_minimo > 0 ? 'bg-amber-50/30 border-amber-200 text-amber-700' : 'bg-slate-50 border-slate-200 text-slate-300'}`}>
                                                                                    <span className="text-[8px] font-black uppercase tracking-widest opacity-60">Stock Mínimo</span>
                                                                                    <div className="flex flex-col items-center leading-none">
                                                                                        <div className="flex items-baseline gap-1">
                                                                                            <span className="text-lg font-black tabular-nums">{displayValue % 1 === 0 ? displayValue : displayValue.toFixed(1)}</span>
                                                                                            <span className="text-[9px] font-bold uppercase">{unitName}</span>
                                                                                        </div>
                                                                                        {refLog && (
                                                                                            <span className="text-[8px] font-bold text-brand-600  mt-0.5">
                                                                                                ({p.stock_minimo} {p.rubro?.almacen_unidades_medida?.abreviatura})
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })()}

                                                                    {/* COLUMNA 4: ACCIONES (1/12) */}
                                                                    <div className="md:col-span-1 flex items-center justify-center pr-4 opacity-0 group-hover/item:opacity-100 transition-all duration-300 border-l border-gray-50/50">
                                                                        <button
                                                                            onClick={() => { setSelectedItem(p); setShowModal(true); }}
                                                                            className="p-2 text-slate-400 hover:text-brand-900 hover:bg-brand-50 rounded-lg transition-all active:scale-90"
                                                                            title="Editar Variante"
                                                                        >
                                                                            <Edit2 size={16} />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="px-2 py-2 align-top text-right">
                                                    <button
                                                        onClick={() => { setSelectedItem({ id_rubro: group.rubro.id }); setShowModal(true); }}
                                                        className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-100 text-brand-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-900 hover:text-white hover:border-brand-900 transition-all shadow-sm active:scale-95"
                                                    >
                                                        <Plus size={14} className="group-hover:rotate-90 transition-transform duration-300" />
                                                        <span>Agregar</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={3} className="px-8 py-24 text-center">
                                                <div className="flex flex-col items-center opacity-40">
                                                    <ClipboardList size={48} className="mb-4 text-brand-900" />
                                                    <p className="text-sm font-bold uppercase tracking-widest">No se encontraron productos agrupados</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {/* Modal de Gestión */}
            {showModal && (
                <ProductosModal
                    initialData={selectedItem}
                    empresaActiva={empresaActiva}
                    perfil={perfil}
                    almacenSel={almacenSel}
                    onClose={() => setShowModal(false)}
                    onUpdate={fetchData}
                />
            )}
        </div>
    );
}
