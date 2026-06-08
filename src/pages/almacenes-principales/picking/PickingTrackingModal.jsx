import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Scan,
  MapPin,
  CheckCircle2,
  Package,
  ChevronRight,
  AlertCircle,
  Clock,
  Check
} from 'lucide-react';
import { getPickingById, actualizarRecoleccionPicking, finalizarTrackingPicking } from '../../../services/pickingService';
import { supabase } from '../../../lib/supabase';
import { toast } from 'sonner';

export default function PickingTrackingModal({ pickingId, onClose, onUpdate, perfil }) {
  const [loading, setLoading] = useState(true);
  const [picking, setPicking] = useState(null);
  const [items, setItems] = useState([]);
  const [scanValue, setScanValue] = useState('');
  const [processing, setProcessing] = useState(false);
  const [lastScanned, setLastScanned] = useState(null);
  const scanInputRef = useRef(null);

  useEffect(() => {
    if (pickingId) fetchData();
  }, [pickingId]);

  useEffect(() => {
    // Mantener el foco en el input del escáner
    const timer = setInterval(() => {
      if (scanInputRef.current && document.activeElement !== scanInputRef.current && !processing) {
        scanInputRef.current.focus();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [processing]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await getPickingById(pickingId);
      setPicking(data);

      const pickingDetails = data.detalle || [];

      // 1. Obtener ubicaciones actuales desde el inventario real
      if (pickingDetails.length > 0) {
        const productIds = [...new Set(pickingDetails.map(d => d.id_producto))];
        const { data: invData } = await supabase
          .from('almacen_inventario')
          .select('id_producto, lote, ubicacion:id_ubicacion(nombre, codigo)')
          .in('id_producto', productIds)
          .gt('cantidad_actual', 0);

        const locMap = {};
        invData?.forEach(inv => {
          const key = `${inv.id_producto}_${inv.lote || ''}`;
          // Priorizamos el código, si no nombre
          locMap[key] = inv.ubicacion?.codigo || inv.ubicacion?.nombre || 'SIN UBICACIÓN';
        });

        // 2. Mapear items con su ubicación real
        const itemsWithLoc = pickingDetails.map(d => ({
          ...d,
          ubicacion_codigo: locMap[`${d.id_producto}_${d.lote || ''}`] || 'SIN UBICACIÓN'
        }));
        setItems(itemsWithLoc);
      } else {
        setItems([]);
      }
    } catch (error) {
      console.error('Error al cargar picking:', error);
      toast.error('No se pudo cargar la información del picking');
    } finally {
      setLoading(false);
    }
  };

  const handleScan = async (e) => {
    e.preventDefault();
    const trimmedValue = scanValue.trim();
    if (!trimmedValue || processing) return;

    setProcessing(true);
    try {
      // 1. Resolver código de barras
      const { data: solved, error } = await supabase.rpc('fn_resolver_codigo_barras', {
        p_id_empresa: picking.id_empresa,
        p_codigo: trimmedValue
      });

      if (error || !solved) {
        toast.error('Código no reconocido');
        setScanValue('');
        return;
      }

      // 2. Buscar en la lista de items del picking
      // Consideramos producto y presentación logistica
      const targetItem = items.find(it =>
        it.id_producto === solved.id_producto &&
        it.id_presentacion_logistica === solved.id_presentacion_logistica &&
        (it.cantidad_recolectada || 0) < it.cantidad
      );

      if (!targetItem) {
        // Buscar si existe pero ya está completo
        const alreadyDone = items.find(it =>
          it.id_producto === solved.id_producto &&
          it.id_presentacion_logistica === solved.id_presentacion_logistica
        );

        if (alreadyDone) {
          toast.warning('Este producto ya fue completado');
        } else {
          toast.error('Producto no pertenece a este picking');
        }
        setScanValue('');
        return;
      }

      // 3. Incrementar cantidad recolectada (siempre sumamos 1 unidad de la presentación escaneada)
      const nuevaCantidad = Number(targetItem.cantidad_recolectada || 0) + 1;

      await actualizarRecoleccionPicking(targetItem.id, nuevaCantidad, perfil.id);

      // Actualizar estado local
      setItems(prev => prev.map(it =>
        it.id === targetItem.id ? { ...it, cantidad_recolectada: nuevaCantidad } : it
      ));

      setLastScanned(solved);
      toast.success(`${solved.rubro} recolectado (${nuevaCantidad}/${targetItem.cantidad})`);
      setScanValue('');

    } catch (error) {
      console.error('Error en escaneo:', error);
      toast.error('Error al procesar escaneo');
    } finally {
      setProcessing(false);
    }
  };

  const handleFinalizar = async () => {
    const incompletos = items.filter(it => (it.cantidad_recolectada || 0) < it.cantidad);

    if (incompletos.length > 0) {
      if (!confirm(`Faltan ${incompletos.length} ítems por recolectar. ¿Deseas finalizar de todos modos?`)) {
        return;
      }
    }

    try {
      await finalizarTrackingPicking(pickingId, perfil.id);
      toast.success('Picking validado correctamente');
      onUpdate();
      onClose();
    } catch (error) {
      console.error('Error al finalizar picking:', error);
      toast.error('Error al actualizar el estado del picking');
    }
  };

  // Agrupar items por ubicación para el recorrido
  const groupedItems = items.reduce((acc, it) => {
    const loc = it.ubicacion_codigo || 'SIN UBICACIÓN';
    if (!acc[loc]) acc[loc] = [];
    acc[loc].push(it);
    return acc;
  }, {});

  const totalPlanificado = items.reduce((acc, it) => acc + Number(it.cantidad), 0);
  const totalRecolectado = items.reduce((acc, it) => acc + Number(it.cantidad_recolectada || 0), 0);
  const porcentaje = totalPlanificado > 0 ? (totalRecolectado / totalPlanificado) * 100 : 0;

  if (!picking && loading) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-slate-50 w-full h-full max-h-[99vh] sm:max-w-[99vw] md:max-w-[50vw] rounded-md shadow-2xl flex flex-col overflow-hidden">

        {/* Header con Escáner */}
        <div className="bg-brand-900 px-6 py-2 text-white shrink-0">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-xl font-black uppercase tracking-tight leading-tight">Tracking de Picking</h3>
              <p className="text-[10px] font-bold text-brand-300 italic">ID: #{pickingId.toString().padStart(8, '0')}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-all">
              <X size={20} />
            </button>
          </div>

          {/* Barra de Progreso */}
          <div className="mb-2">
            <div className="flex justify-between items-end mb-1">
              <span className="text-[9px] font-black uppercase tracking-widest text-brand-200">Progreso de Recolección</span>
              <span className="text-lg font-black tabular-nums leading-none">{porcentaje.toFixed(0)}%</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-400 transition-all duration-500 shadow-[0_0_10px_rgba(52,211,153,0.5)]"
                style={{ width: `${porcentaje}%` }}
              />
            </div>
          </div>

          {/* Input de Escáner Invisible/Always Focused */}
          {porcentaje < 100 && (
            <form onSubmit={handleScan} className="relative group">
              <div className={`absolute inset-y-0 left-4 flex items-center transition-colors ${processing ? 'text-amber-400' : 'text-brand-300'}`}>
                <Scan size={20} className={processing ? 'animate-pulse' : ''} />
              </div>
              <input
                ref={scanInputRef}
                type="text"
                value={scanValue}
                onChange={(e) => setScanValue(e.target.value)}
                placeholder={processing ? "PROCESANDO..." : "ESCANEA PRODUCTO O LOTE"}
                disabled={processing}
                autoFocus
                className="w-full bg-white/10 border-2 border-white/20 rounded-lg py-2 pl-12 pr-4 text-sm font-black placeholder:text-white/30 outline-none focus:border-white/40 focus:bg-white/20 transition-all text-white"
              />
            </form>
          )}
        </div>

        {/* Cuerpo: Lista de Productos */}
        <div className="flex-1 overflow-y-auto px-4 py-1 space-y-1">
          {Object.entries(groupedItems).sort().map(([loc, locItems]) => (
            <div key={loc} className="space-y-1 grid grid-cols-4 items-center justify-center border-b border-gray-500">
              <div className="col-span-1 flex items-center gap-2 px-2">
                <MapPin size={14} className="text-brand-500" />
                <span className="text-sm font-black uppercase tracking-[0.2em] text-slate-800">{loc}</span>
              </div>

              <div className="col-span-3 grid gap-1 flex-1">
                {locItems.map(it => {
                  const isComplete = (it.cantidad_recolectada || 0) >= it.cantidad;
                  const isPartial = (it.cantidad_recolectada || 0) > 0 && !isComplete;

                  return (
                    <div
                      key={it.id}
                      className={`bg-white px-4 py-1 rounded-md border transition-all duration-300 flex items-center gap-4 ${isComplete ? 'border-emerald-200 bg-emerald-50/30' : 'border-gray-100'
                        }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isComplete ? 'bg-emerald-500 text-white' : 'bg-slate-50 text-slate-400'
                        }`}>
                        {isComplete ? <CheckCircle2 size={24} /> : <Package size={24} />}
                      </div>

                      <div className="flex-1 flex flex-row items-center justify-between min-w-0">
                        <h4 className="text-[11px] font-black text-slate-800 uppercase truncate">
                          <span className='flex flex-col'>
                            <span className="text-xs text-brand-800">{it.producto?.rubro?.nombre} {it.producto?.marca?.nombre}</span>
                            <span className="text-[9px] text-brand-600">{it.producto?.variedad}</span>
                          </span>
                        </h4>
                        <div className="flex flex-col text-right">
                          {it.lote && (
                          <p className="text-[9px] font-bold text-slate-400 uppercase italic">
                            <span>LOTE: {it.lote || 'N/A'}</span>
                          </p>
                          )}
                          <p className="text-[9px] font-bold text-slate-400 uppercase italic">
                            <span> {it.presentacion_logistica?.presentacion?.nombre}</span>
                          </p>
                        </div>

                      </div>

                      <div className="text-right shrink-0">
                        <div className="flex items-center gap-1 justify-end leading-none">
                          <span className={`text-lg font-black tabular-nums ${isComplete ? 'text-emerald-600' : isPartial ? 'text-amber-600' : 'text-slate-400'}`}>
                            {parseFloat((it.cantidad_recolectada || 0).toFixed(3))}
                          </span>
                          <span className="text-[10px] font-bold text-slate-300">/ {parseFloat(it.cantidad.toFixed(3))}</span>
                        </div>
                        <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 block mt-1">
                          {it.presentacion_logistica?.presentacion?.nombre}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-2 bg-white border-t border-gray-100 flex justify-end gap-3 sticky bottom-0">
          <button
            onClick={onClose}
            className="px-6 py-2 text-sm font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition-all"
          >
            Pausar y Salir
          </button>
          <button
            onClick={handleFinalizar}
            disabled={items.some(it => (it.cantidad_recolectada || 0) < it.cantidad)}
            className="bg-brand-900 text-white px-8 py-2 rounded-lg text-sm font-black uppercase tracking-widest hover:bg-brand-800 transition-all shadow-xl shadow-brand-900/20 active:scale-95 flex items-center gap-2 disabled:opacity-40 disabled:pointer-events-none disabled:hover:bg-brand-900 disabled:shadow-none disabled:cursor-not-allowed"
          > 
            <Check size={18} /> Finalizar Picking
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}
