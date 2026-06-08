import { useState, useEffect } from 'react';
import { Warehouse, MapPin, Plus, Search, Package, ArrowRight, CheckCircle2, ChevronRight, Tag, Layers } from 'lucide-react';
import { getUbicaciones, createUbicacion, asignarUbicacionInventario } from '../../../services/ubicacionService';
import { getInventarioAlmacen } from '../../../services/inventarioService';
import { useAuth } from '../../../context/AuthContext';

const GestionUbicaciones = () => {
  const { empresaActiva, usuario, perfil } = useAuth();
  const [almacenSel, setAlmacenSel] = useState(null);
  const [ubicaciones, setUbicaciones] = useState([]);
  const [inventarioSinUbicacion, setInventarioSinUbicacion] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('PUTAWAY'); // PUTAWAY o MAPA
  
  // Estado para nueva ubicación
  const [showAddRack, setShowAddRack] = useState(false);
  const [newRack, setNewRack] = useState({ codigo: '', nombre: '' });

  // Almacenes disponibles (esto vendría de un maestro de almacenes, por ahora simulamos o filtramos del perfil)
  const almacenes = perfil?.almacenes || [];

  useEffect(() => {
    if (almacenes.length > 0 && !almacenSel) {
      setAlmacenSel(almacenes[0]);
    }
  }, [almacenes]);

  useEffect(() => {
    if (almacenSel) {
      fetchData();
    }
  }, [almacenSel, activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ubs, inv] = await Promise.all([
        getUbicaciones(almacenSel.id),
        getInventarioAlmacen(empresaActiva.id, almacenSel.id)
      ]);
      setUbicaciones(ubs);
      // Filtramos solo lo que NO tiene ubicación
      setInventarioSinUbicacion(inv.filter(i => !i.id_ubicacion));
    } catch (error) {
      console.error('Error cargando datos de ubicaciones:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRack = async () => {
    if (!newRack.codigo) return;
    try {
      await createUbicacion({
        id_almacen: almacenSel.id,
        codigo: newRack.codigo.toUpperCase(),
        nombre: newRack.nombre,
        id_usuario_create: usuario.id
      });
      setNewRack({ codigo: '', nombre: '' });
      setShowAddRack(false);
      fetchData();
    } catch (error) {
      alert('Error al crear rack: El código ya existe o datos inválidos');
    }
  };

  const handleAssign = async (item, idUbicacion) => {
    try {
      await asignarUbicacionInventario(item.id, idUbicacion, usuario.id);
      fetchData();
    } catch (error) {
      console.error('Error asignando ubicación:', error);
    }
  };

  if (!almacenSel) return (
    <div className="p-20 flex flex-col items-center justify-center text-slate-300 opacity-40">
      <Warehouse size={80} strokeWidth={1} />
      <p className="font-black uppercase tracking-widest mt-4">Seleccione un Almacén para gestionar</p>
    </div>
  );

  return (
    <div className="p-4 space-y-4 animate-in fade-in duration-500">
      
      {/* Header Jerárquico */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-md shadow-sm border border-gray-100">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-brand-50 rounded-xl text-brand-600">
            <MapPin size={24} />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight leading-tight">Gestión de Racks y Ubicaciones</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] font-black text-brand-600 uppercase tracking-widest">{almacenSel.nombre}</span>
              <ChevronRight size={12} className="text-slate-300" />
              <span className="text-[10px] font-bold text-slate-400 uppercase italic tracking-widest">Control de Almacenamiento</span>
            </div>
          </div>
        </div>

        {/* Selector de Almacén (ADN Visual Sercosys) */}
        <div className='grid grid-cols-2 lg:grid-cols-4 gap-2'>
          {almacenes.map(almacen => (
            <button
              key={almacen.id}
              onClick={() => setAlmacenSel(almacen)}
              className={`px-4 py-2 rounded-md border-2 transition-all duration-300 flex flex-col items-center gap-1 min-w-[100px] ${
                almacenSel?.id === almacen.id
                ? 'bg-brand-900 border-brand-900 text-white shadow-xl shadow-brand-900/20 scale-105'
                : 'bg-white border-gray-100 text-slate-400 hover:border-brand-200 hover:bg-slate-50'
              }`}
            >
              <Warehouse size={14} />
              <span className="text-[8px] font-black uppercase tracking-widest">{almacen.nombre}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tabs Estilo Sercosys */}
      <div className="flex gap-2">
        <button 
          onClick={() => setActiveTab('PUTAWAY')}
          className={`px-6 py-3 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'PUTAWAY' ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/20' : 'bg-white text-slate-400 hover:bg-gray-50'}`}
        >
          Mercancía por Ubicar ({inventarioSinUbicacion.length})
        </button>
        <button 
          onClick={() => setActiveTab('MAPA')}
          className={`px-6 py-3 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'MAPA' ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/20' : 'bg-white text-slate-400 hover:bg-gray-50'}`}
        >
          Mapa de Racks ({ubicaciones.length})
        </button>
      </div>

      {activeTab === 'PUTAWAY' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Lista de Mercancía Sin Ubicación */}
          <div className="lg:col-span-8 space-y-4">
            <div className="bg-white rounded-md shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 bg-gray-50/50 border-bottom border-gray-100 flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pendientes de Recepción Reciente</span>
                <Layers size={14} className="text-slate-300" />
              </div>
              <div className="divide-y divide-gray-100">
                {inventarioSinUbicacion.length === 0 ? (
                  <div className="p-10 text-center text-slate-300 italic text-sm">No hay mercancía pendiente de ubicación.</div>
                ) : (
                  inventarioSinUbicacion.map(item => (
                    <div key={item.id} className="p-4 hover:bg-slate-50 transition-all flex items-center justify-between group">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                          <Package size={18} />
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-800 uppercase tracking-tight">{item.producto_info?.rubro?.nombre} {item.producto_info?.variedad}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Lote: <span className="text-brand-600">{item.lote || 'S/L'}</span></span>
                            <span className="text-slate-300">•</span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Entrada: #{item.id_cotejo_detalle}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right mr-4">
                          <p className="text-sm font-black text-slate-700">{item.cantidad_actual} {item.producto_info?.rubro?.almacen_unidades_medida?.abreviatura}</p>
                          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter italic">Esperando Rack...</p>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <select 
                            onChange={(e) => handleAssign(item, e.target.value)}
                            className="text-[10px] font-black uppercase tracking-widest px-3 py-2 bg-white border border-brand-200 rounded-md outline-none focus:ring-2 focus:ring-brand-500/10 transition-all cursor-pointer"
                          >
                            <option value="">Seleccionar Rack</option>
                            {ubicaciones.map(ub => (
                              <option key={ub.id} value={ub.id}>{ub.codigo}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Estadísticas Rápidas */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-brand-900 p-6 rounded-md shadow-xl shadow-brand-900/20 text-white relative overflow-hidden group">
              <Warehouse className="absolute -right-4 -bottom-4 text-white/5 group-hover:scale-125 transition-transform duration-700" size={140} />
              <p className="text-[10px] font-black uppercase tracking-widest text-brand-300">Resumen de Almacén</p>
              <h3 className="text-2xl font-black mt-1">{ubicaciones.length} Racks Activos</h3>
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-[10px] font-bold py-1 border-b border-white/10">
                  <span>CAPACIDAD ESTIMADA</span>
                  <span>85%</span>
                </div>
                <div className="flex items-center justify-between text-[10px] font-bold py-1">
                  <span>PENDIENTES DE UBICAR</span>
                  <span className="text-brand-300">{inventarioSinUbicacion.length} ITEMS</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button 
              onClick={() => setShowAddRack(true)}
              className="px-6 py-3 bg-brand-900 text-white text-[10px] font-black uppercase tracking-widest rounded-md hover:bg-brand-800 transition-all shadow-xl shadow-brand-900/20 flex items-center gap-2"
            >
              <Plus size={14} /> Crear Nuevo Rack
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {ubicaciones.map(ub => (
              <div key={ub.id} className="bg-white p-4 rounded-md border border-gray-100 shadow-sm hover:border-brand-500 hover:shadow-lg transition-all group relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-brand-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                <MapPin size={12} className="text-slate-300 mb-2" />
                <h4 className="text-sm font-black text-slate-800">{ub.codigo}</h4>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest truncate">{ub.nombre || 'Ubicación Estándar'}</p>
                <div className="mt-3 pt-3 border-t border-gray-50 flex items-center justify-between">
                   <Tag size={10} className="text-brand-300" />
                   <span className="text-[8px] font-black text-brand-600 uppercase">Activo</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal para Crear Rack (Estilo Sercosys) */}
      {showAddRack && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAddRack(false)} />
          <div className="relative bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-300">
             <div className="p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-brand-50 rounded-lg text-brand-600">
                    <Plus size={20} />
                  </div>
                  <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Nuevo Rack / Ubicación</h3>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Código de Ubicación</label>
                    <input 
                      autoFocus
                      placeholder="Ej: A-01-02"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-md text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 transition-all"
                      value={newRack.codigo}
                      onChange={(e) => setNewRack({...newRack, codigo: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Descripción (Opcional)</label>
                    <input 
                      placeholder="Ej: Pasillo de Secos - Estante 1"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-md text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 transition-all"
                      value={newRack.nombre}
                      onChange={(e) => setNewRack({...newRack, nombre: e.target.value})}
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-8">
                  <button onClick={() => setShowAddRack(false)} className="flex-1 py-4 bg-slate-100 text-slate-500 text-[10px] font-black uppercase tracking-widest rounded-md hover:bg-slate-200 transition-all">Cancelar</button>
                  <button onClick={handleCreateRack} className="flex-1 py-4 bg-brand-900 text-white text-[10px] font-black uppercase tracking-widest rounded-md hover:bg-brand-800 transition-all shadow-xl shadow-brand-900/20">Crear Ubicación</button>
                </div>
             </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default GestionUbicaciones;
