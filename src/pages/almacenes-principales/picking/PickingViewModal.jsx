import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, PackageSearch, FileText, Layers, Truck, MapPin, Warehouse, ClipboardList, CheckCircle2, XCircle } from 'lucide-react';
import { formato8Digitos, formatearFecha, getDiasRestantes, formatDateSystemToDDMMYYYY } from '../../../util/workDate';
import { getPickingById } from '../../../services/pickingService';
import { supabase } from '../../../lib/supabase';

const PickingViewModal = ({ isOpen, onClose, pickingId, onAuthorize, onAnular }) => {
  const [loading, setLoading] = useState(true);
  const [picking, setPicking] = useState(null);
  const [ubicaciones, setUbicaciones] = useState({}); // { 'idProd_lote': 'Ubicación' }

  useEffect(() => {
    if (isOpen && pickingId) {
      const loadData = async () => {
        try {
          setLoading(true);
          const data = await getPickingById(pickingId);
          setPicking(data);

          // Cargar ubicaciones actuales en tiempo real
          if (data?.detalle?.length > 0) {
            const productIds = [...new Set(data.detalle.map(d => d.id_producto))];

            const { data: locations } = await supabase
              .from('almacen_inventario')
              .select('id_producto, lote, ubicacion:id_ubicacion(nombre)')
              .in('id_producto', productIds)
              .gt('cantidad_actual', 0);

            const locMap = {};
            locations?.forEach(loc => {
              const key = `${loc.id_producto}_${loc.lote || ''}`;
              locMap[key] = loc.ubicacion?.nombre;
            });
            setUbicaciones(locMap);
          }
        } catch (error) {
          console.error('Error al cargar picking:', error);
        } finally {
          setLoading(false);
        }
      };
      loadData();
    }
  }, [isOpen, pickingId]);

  const getExpirationBadge = (fecha) => {
    if (!fecha) return null;
    const dias = getDiasRestantes(fecha);
    let color = 'bg-emerald-50 text-emerald-600 border border-emerald-100';
    let text = `Vence en ${dias} d`;
    if (dias <= 0) {
      color = 'bg-red-50 text-red-600 border border-red-100';
      text = 'Vencido';
    } else if (dias <= 30) {
      color = 'bg-orange-50 text-orange-600 border border-orange-100';
    }
    return <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter ${color}`}>{text}</span>;
  };

  const consolidatedNeeds = useMemo(() => {
    if (!picking?.detalle) return {};
    const needs = {};

    picking.detalle.forEach(d => {
      const rubroId = d.producto?.id_rubro;
      if (rubroId && !needs[rubroId]) {
        needs[rubroId] = {
          nombre: d.producto?.rubro?.nombre || 'RUBRO',
          unidad: d.producto?.rubro?.unidad?.abreviatura || 'UND',
          categoria: d.producto?.rubro?.categoria?.nombre || 'GENERAL',
        };
      }
    });

    return needs;
  }, [picking]);

  if (!isOpen) return null;

  const isAuditMode = picking?.estatus === 'PENDIENTE';

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-6xl bg-slate-50 rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300 max-h-[90vh] flex flex-col">

        {/* Header Premium */}
        <div className="bg-white px-8 py-6 border-b border-gray-100 flex items-center justify-between relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-500 to-brand-900" />
          <div className="flex items-center gap-4">
            <div className="p-3 bg-brand-900 rounded-md text-white shadow-xl shadow-brand-900/20">
              <PackageSearch className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-2xl font-black text-gray-900 tracking-tight">
                  Picking {formato8Digitos(picking?.id || 0)}
                </h3>
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${picking?.estatus === 'PENDIENTE' ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'}`}>
                  {picking?.estatus}
                </span>
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-1 italic">
                {isAuditMode ? 'Auditoría de Despacho' : 'Visor de Historial'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 opacity-40">
              <div className="w-12 h-12 border-4 border-brand-900 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-sm font-black uppercase">Cargando...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Info General */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-white p-4 rounded-md border border-gray-100 shadow-sm flex items-center gap-3">
                  <Warehouse className="text-brand-500 w-5 h-5" />
                  <div>
                    <span className="text-[8px] font-black text-slate-400 uppercase leading-none">Almacén</span>
                    <p className="text-[11px] font-bold text-slate-700 uppercase">{picking?.almacen?.nombre}</p>
                  </div>
                </div>
                <div className="bg-white p-4 rounded-md border border-gray-100 shadow-sm flex items-center gap-3">
                  <MapPin className="text-blue-500 w-5 h-5" />
                  <div>
                    <span className="text-[8px] font-black text-slate-400 uppercase leading-none">Destino</span>
                    <p className="text-[11px] font-bold text-slate-700 uppercase truncate">{picking?.sucursal?.nombre}</p>
                    <p className="text-[11px] font-bold text-slate-700 uppercase truncate">{picking?.comedor?.nombre}</p>
                  </div>
                </div>
                <div className="bg-white p-4 rounded-md border border-gray-100 shadow-sm flex items-center gap-3">
                  <Truck className="text-orange-500 w-5 h-5" />
                  <div>
                    <span className="text-[8px] font-black text-slate-400 uppercase leading-none">Fecha</span>
                    <p className="text-[11px] font-bold text-slate-700 uppercase">{formatDateSystemToDDMMYYYY(picking?.timestamp_create)}</p>
                  </div>
                </div>
                <div className="bg-white p-4 rounded-md border border-gray-100 shadow-sm flex items-center gap-3">
                  <ClipboardList className="text-purple-500 w-5 h-5" />
                  <div>
                    <span className="text-[8px] font-black text-slate-400 uppercase leading-none">Requisiciones</span>
                    <div className="flex gap-1">
                      {picking?.id_requisicion && picking.id_requisicion.length > 0 ? (
                        picking.id_requisicion.map(id => (
                          <span key={id} className="text-[9px] font-black text-purple-600">#{formato8Digitos(id)}</span>
                        ))
                      ) : (
                        <span className="text-[9px] font-black text-slate-400 italic uppercase">Manual</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* MATRIZ DE PICKING */}
              <div className="space-y-1">
                <div className="flex items-center gap-6 px-8 py-1 bg-slate-100/50 rounded-xl mb-2">
                  <div className="w-[20%] text-[10px] font-black uppercase tracking-widest text-slate-400">Rubro</div>
                  <div className="flex-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Detalles de Carga (Lotes)</div>
                  <div className="w-[15%] text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Total Despachado</div>
                </div>

                {Object.entries(consolidatedNeeds).map(([rubroId, need]) => {
                  const rubroDetalle = picking.detalle.filter(d => d.producto?.id_rubro === parseInt(rubroId));
                  const unidadTotal = rubroDetalle.reduce((acc, curr) => acc + (Number(curr.cantidad) * Number(curr.factor || curr.producto?.factor || 1)), 0);

                  return (
                    <div key={rubroId} className="flex items-center gap-6 bg-white rounded-[2rem] border border-slate-100 px-6 py-1 shadow-sm hover:border-slate-200 transition-all mb-4">
                      <div className="w-[20%]">
                        <h4 className="text-xs font-black text-slate-800 uppercase leading-tight whitespace-nowrap">{need.nombre}</h4>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{need.categoria} | {need.unidad}</span>
                      </div>

                      <div className="flex-1 flex flex-col divide-y divide-slate-300">
                        {(() => {
                          // Agrupación interna por producto y lote
                          const groups = {};
                          rubroDetalle.forEach(det => {
                            const key = `${det.id_producto}_${det.lote || 'N/A'}`;
                            if (!groups[key]) {
                              groups[key] = { ...det, cantidad: 0 };
                            }
                            groups[key].cantidad += Number(det.cantidad);
                          });

                          return Object.values(groups).map((det, dIdx) => {
                            const cantidadEntera = parseFloat(Number(det.cantidad).toFixed(3));
                            const factorActual = Number(det.factor || det.producto?.factor || 1);
                            const subtotalUnidad = parseFloat((Number(det.cantidad) * factorActual).toFixed(3));
                            const presentacionNombre = det.presentacion_logistica?.presentacion?.nombre || '';

                            return (
                              <div key={dIdx} className="flex items-center gap-4 py-1">
                                <div className="flex-1 flex flex-col min-w-0">
                                  <span className="text-[11px] font-black text-slate-600 uppercase truncate">
                                    {det.producto?.marca?.nombre} {det.producto?.variedad} {presentacionNombre} {factorActual}{need.unidad}
                                  </span>
                                  <div className="flex gap-3 text-[9px] font-bold italic text-slate-400">
                                    {det.lote && (
                                      <span>LOTE: <span className="text-slate-500 not-italic">{det.lote || 'N/A'}</span></span>
                                    )}
                                    {det.fecha_vencimiento && (
                                      <span>FV: <span className="text-slate-500 not-italic">{det.fecha_vencimiento ? formatearFecha(det.fecha_vencimiento) : 'N/A'}</span></span>
                                    )}
                                    {getExpirationBadge(det.fecha_vencimiento)}
                                    <div className="flex items-center gap-1 text-emerald-600 font-black uppercase">
                                      <MapPin size={10} />
                                      <span>Ubicación Actual: {ubicaciones[`${det.id_producto}_${det.lote || ''}`] || 'Buscando...'}</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="w-32 flex flex-col items-end border-l border-slate-50 pl-4">
                                  <span className="text-sm font-black text-brand-900">{cantidadEntera} {presentacionNombre || 'UND'}</span>
                                  <span className="text-xs font-black text-slate-500 uppercase">{subtotalUnidad} {need.unidad}</span>
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>

                      <div className="w-[15%] text-right border-l border-slate-50 py-2">
                        <span className="text-2xl font-black text-brand-900 leading-none">{parseFloat(unidadTotal.toFixed(3))}</span>
                        <p className="text-[9px] font-black text-slate-300 uppercase mt-1">{need.unidad}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {picking?.observaciones && (
                <div className="bg-brand-50/30 border border-brand-100 p-6 rounded-[2.5rem] mt-8">
                  <div className="flex items-center gap-2 mb-2 text-brand-700">
                    <FileText className="w-4 h-4" />
                    <span className="text-[11px] font-black uppercase tracking-widest text-brand-900">Observaciones del Picking</span>
                  </div>
                  <p className="text-slate-600 italic text-sm">{picking.observaciones}</p>
                </div>
              )}

              {picking?.estatus === 'ANULADO' && picking?.observacion_anula && (
                <div className="bg-red-50/30 border border-red-100 p-6 rounded-[2.5rem] mt-4">
                  <div className="flex items-center gap-2 mb-2 text-red-700">
                    <XCircle className="w-4 h-4" />
                    <span className="text-[11px] font-black uppercase tracking-widest text-red-900">Motivo de Anulación</span>
                  </div>
                  <p className="text-red-600 font-bold italic text-sm">"{picking.observacion_anula}"</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-5 bg-white border-t border-gray-100 flex items-center justify-between shadow-[0_-10px_20px_rgba(0,0,0,0.02)]">
          <div className="flex flex-col">
            <span className="text-[8px] font-black text-slate-400 uppercase leading-none">Documento</span>
            <span className="flex items-center gap-1.5 text-[10px] font-black text-emerald-600 uppercase">
              <CheckCircle2 size={12} />
              {isAuditMode ? 'Listo para Autorizar' : 'Cerrado'}
            </span>
          </div>

          <div className="flex gap-4">
            {isAuditMode ? (
              <>
                <button onClick={onClose} className="px-6 py-3 text-slate-400 font-bold uppercase text-xs">Cancelar</button>
                {onAnular && (
                  <>
                    <button
                      onClick={() => onAnular && onAnular()}
                      className="flex items-center gap-2 px-4 py-3 text-red-600 font-black uppercase text-xs hover:bg-red-50 rounded-md transition-all"
                    >
                      <X size={16} />Anular Picking
                    </button>

                    <button
                      onClick={() => onAuthorize && onAuthorize()}
                      className="flex items-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-md font-black text-xs uppercase shadow-xl hover:bg-emerald-700 transition-all active:scale-95 shadow-emerald-900/20"
                    >
                      <Truck size={16} />Autorizar Despacho
                    </button>
                  </>
                )}
              </>
            ) : (
              <button type="button" onClick={onClose} className="px-6 py-3 text-slate-400 font-bold uppercase tracking-widest text-xs">Cancelar</button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PickingViewModal;
