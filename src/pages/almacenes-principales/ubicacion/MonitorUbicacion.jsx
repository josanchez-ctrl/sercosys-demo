import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Warehouse, MapPin, Search, Package, ArrowRight, CheckCircle2, ChevronRight, Layers, AlertCircle, Truck, QrCode } from 'lucide-react';
import { getUbicaciones } from '../../../services/ubicacionService';
import { getTareasPendientes, confirmarTareaUbicacion } from '../../../services/tareaService';
import { getAlmacenes } from '../../../services/almacenService';
import { useModulePermissions } from '../../../hooks/useModulePermissions';
import { formatDateSystemToDDMMYYYYHHMMSS } from '../../../util/workDate';
import MonitorUbicacionModal from './MonitorUbicacionModal';

const MonitorUbicacion = () => {
  //const { empresaActiva, usuario, perfil } = useAuth();
  const { perfil, empresaActiva, renderGuard } = useModulePermissions();
  const [almacenSel, setAlmacenSel] = useState(null);
  const [almacenes, setAlmacenes] = useState([]);
  const [ubicaciones, setUbicaciones] = useState([]);
  const [tareas, setTareas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTarea, setSelectedTarea] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // Carga inicial de almacenes
  useEffect(() => {
    if (empresaActiva?.id) {
      const fetchAlmacenes = async () => {
        try {
          const res = await getAlmacenes(empresaActiva.id);
          setAlmacenes(res || []);
          /* if (res?.length > 0 && !almacenSel) {
            setAlmacenSel(res[0]);
          } */
        } catch (error) {
          console.error('Error cargando almacenes:', error);
          toast.error('Error al cargar almacenes autorizados');
        }
      };
      fetchAlmacenes();
    }
  }, [empresaActiva?.id]);

  useEffect(() => {
    if (almacenSel) {
      fetchData();
    }
  }, [almacenSel]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ubs, tasks] = await Promise.all([
        getUbicaciones(almacenSel.id),
        getTareasPendientes(empresaActiva.id, almacenSel.id, 'PUTAWAY')
      ]);

      setUbicaciones(ubs.filter(u => u.codigo !== 'PLAYA')); // Solo racks en el destino
      setTareas(tasks);
    } catch (error) {
      console.error('Error cargando datos:', error);
      toast.error('Error al cargar tareas del almacén');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmarTarea = async (idUbicacion) => {
    if (!selectedTarea || !idUbicacion) return;

    try {
      await confirmarTareaUbicacion(selectedTarea.id, idUbicacion, perfil.id);
      toast.success('Tarea confirmada y producto ubicado');
      setShowModal(false);
      setSelectedTarea(null);
      fetchData();
    } catch (error) {
      console.error('Error confirmando tarea:', error);
      toast.error('No se pudo confirmar la tarea de ubicación');
    }
  };

  const filteredTareas = tareas.filter(t =>
    t.inventario?.producto?.rubro?.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.inventario?.lote?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.inventario?.tracking_id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const guard = renderGuard();
  if (guard) return guard;

  return (
    <div className="p-4 space-y-4 animate-in fade-in duration-500">

      {/* Header Jerárquico - SIEMPRE VISIBLE */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-md shadow-sm border border-gray-100">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-brand-50 rounded-xl text-brand-600">
            <Truck size={24} />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight leading-tight">Monitor de Ubicación (Put-away)</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] font-black text-brand-600 uppercase tracking-widest">
                {almacenSel?.nombre || 'Sín Selección'}
              </span>
              <ChevronRight size={12} className="text-slate-300" />
              <span className="text-[10px] font-bold text-slate-400 uppercase italic tracking-widest">Gestión de Racks</span>
            </div>
          </div>
        </div>

        <div className='grid grid-cols-2 lg:grid-cols-4 gap-2'>
          {almacenes.map(almacen => (
            <button
              key={almacen.id}
              onClick={() => setAlmacenSel(almacen)}
              className={`px-4 py-2 rounded-md border-2 transition-all duration-300 flex flex-col items-center gap-1 min-w-[100px] ${almacenSel?.id === almacen.id
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

      {!almacenSel ? (
        <div className="p-20 flex flex-col items-center justify-center text-slate-300 opacity-40 bg-white rounded-md border border-dashed border-gray-200">
          <Warehouse size={80} strokeWidth={1} />
          <p className="font-black uppercase tracking-widest mt-4">Seleccione un Almacén para gestionar</p>
        </div>
      ) : (
        <>
          {/* KPIs de Estado (Filtros Interactivos) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-md border border-gray-100 shadow-sm flex items-center justify-between group hover:border-brand-200 transition-all">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-xl group-hover:scale-110 transition-transform">
                  <AlertCircle size={16} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-brand-900 transition-colors">Putaway Pendientes</span>
              </div>
              <span className="text-2xl font-black tabular-nums text-amber-600">{tareas.length}</span>
            </div>

            <div className="bg-white p-4 rounded-md border border-gray-100 shadow-sm flex items-center justify-between group hover:border-brand-200 transition-all">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-brand-50 text-brand-600 rounded-xl group-hover:scale-110 transition-transform">
                  <MapPin size={16} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-brand-900 transition-colors">Racks Disponibles</span>
              </div>
              <span className="text-2xl font-black tabular-nums text-brand-900">{ubicaciones.length}</span>
            </div>

            <div className="bg-brand-900 p-4 rounded-md shadow-lg shadow-brand-900/20 text-white flex items-center justify-between group">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-xl group-hover:rotate-12 transition-transform">
                  <CheckCircle2 size={16} />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-widest text-brand-200">Estado WMS</span>
                  <span className="text-[8px] font-bold italic text-brand-400">Flujo de Ubicación Activo</span>
                </div>
              </div>
              <span className="text-xs font-black bg-brand-800 px-2 py-1 rounded border border-brand-700">ONLINE</span>
            </div>
          </div>

          {/* Buscador */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Buscar por Rubro o Lote..."
              className="w-full pl-12 pr-4 py-4 bg-white border border-gray-100 rounded-md text-sm font-bold text-slate-700 shadow-sm focus:ring-4 focus:ring-brand-500/5 focus:border-brand-500 outline-none transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Grid de Productos Pendientes */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loading ? (
              <div className="col-span-full p-20 flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-900"></div>
              </div>
            ) : filteredTareas.length === 0 ? (
              <div className="col-span-full bg-white p-12 rounded-md border border-dashed border-gray-200 text-center">
                <Package size={48} className="mx-auto text-slate-200 mb-4" />
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest italic">No hay tareas de ubicación pendientes</p>
              </div>
            ) : (
              filteredTareas.map(tarea => (
                <div key={tarea.id} className="bg-white rounded-md border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col overflow-hidden group">
                  <div className="p-4 flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-sm font-black text-slate-800 uppercase leading-tight">{tarea.inventario?.producto?.rubro?.nombre}</h4>
                        <p className="text-[10px] font-bold text-slate-400 italic mt-0.5">
                          {tarea.inventario?.producto?.marca?.nombre} {tarea.inventario?.producto?.variedad}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[8px] font-black bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full uppercase">Prioridad {tarea.prioridad}</span>
                        <div className="p-2 bg-slate-50 rounded-lg text-slate-400 group-hover:bg-brand-50 group-hover:text-brand-600 transition-colors">
                          <Package size={16} />
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <div className="bg-gray-50/50 p-2 rounded border border-gray-100">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Lote</p>
                        <p className="text-[10px] font-black text-brand-600">{tarea.inventario?.lote || 'S/L'}</p>
                      </div>
                      <div className="bg-gray-50/50 p-2 rounded border border-gray-100 text-right">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Cantidad</p>
                        <p className="text-[10px] font-black text-slate-800">
                          {tarea.cantidad} {tarea.inventario?.producto?.rubro?.unidades_medida?.abreviatura}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-gray-50 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Desde: {tarea.origen?.codigo}</span>
                      </div>
                      <span className="text-[8px] font-bold text-slate-400 italic">{formatDateSystemToDDMMYYYYHHMMSS(tarea.timestamp_create)}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedTarea(tarea);
                      setShowModal(true);
                    }}
                    className="w-full py-3 bg-brand-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-brand-800 transition-all flex items-center justify-center gap-2"
                  >
                    Ejecutar Tarea <ArrowRight size={12} />
                  </button>
                </div>
              ))
            )}
          </div>

          <MonitorUbicacionModal 
            isOpen={showModal}
            onClose={() => {
              setShowModal(false);
              setSelectedTarea(null);
            }}
            selectedTarea={selectedTarea}
            ubicaciones={ubicaciones}
            onConfirm={handleConfirmarTarea}
          />
        </>
      )}

    </div>
  );
};

export default MonitorUbicacion;
