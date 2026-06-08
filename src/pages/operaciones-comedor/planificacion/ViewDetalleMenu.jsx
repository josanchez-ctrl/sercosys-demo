import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ChefHat, Calendar, Users, UtensilsCrossed, Calculator, TrendingUp, DollarSign, Loader2 } from 'lucide-react';
import { getConsolidadoSnapshot } from '../../../services/planificacionService';

const ViewDetalleMenu = ({ plan, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [costosSnapshot, setCostosSnapshot] = useState([]);

  useEffect(() => {
    const loadCosts = async () => {
      if (!plan?.id) return;
      setLoading(true);
      try {
        const snapshot = await getConsolidadoSnapshot(plan.id);
        setCostosSnapshot(snapshot || []);
      } catch (error) {
        console.error("Error cargando costos para vista menú:", error);
      } finally {
        setLoading(false);
      }
    };
    loadCosts();
  }, [plan?.id]);

  if (!plan) return null;

  // Agrupar detalle por fecha con análisis de costos vinculados al snapshot
  const menuPorDia = (plan.detalle || []).reduce((acc, curr) => {
    const fecha = String(curr.fecha).substring(0, 10);
    if (!acc[fecha]) acc[fecha] = { recipes: [], comensalesTotal: 0, costoDiarioUnitario: 0 };

    // Match robusto: comparamos IDs como números y fechas ignorando la hora
    const insumosDeEstaReceta = costosSnapshot.filter(s => {
      const matchId = Number(s.id_receta_raiz) === Number(curr.id_receta);
      const matchFecha = s.fecha && String(s.fecha).substring(0, 10) === fecha;
      return matchId && matchFecha;
    });

    const comensalesReceta = Number(curr.comensales || 1);

    // Si el snapshot ya trae total_estimado (nuevo), lo usamos. 
    // Si no, lo calculamos usando el costo del rubro (legacy/fallback)
    const costoTotalReceta = insumosDeEstaReceta.reduce((sum, ins) => {
      if (ins.total_estimado) return sum + Number(ins.total_estimado);
      // Fallback: cantidad_neta * costo_unitario del primer info
      const cU = Number(ins.costo_unitario || ins.rubro?.costo_info?.[0]?.costo_ponderado_global || 0);
      return sum + (Number(ins.cantidad_neta || 0) * cU);
    }, 0);

    const costoUnitarioReceta = comensalesReceta > 0 ? costoTotalReceta / comensalesReceta : 0;

    acc[fecha].recipes.push({
      nombre: curr.receta?.nombre || 'Receta sin nombre',
      tipologia: curr.receta?.tipologia?.nombre || 'General',
      esBase: curr.receta?.tipologia?.es_base || false,
      costo: costoUnitarioReceta
    });

    if (curr.receta?.tipologia?.es_base) {
      acc[fecha].comensalesTotal += comensalesReceta;
    }

    acc[fecha].costoDiarioUnitario += costoUnitarioReceta;

    return acc;
  }, {});

  // Totales Gerenciales para el Dashboard
  const totalesSemana = Object.values(menuPorDia).reduce((acc, dia) => {
    acc.inversionTotal += (dia.costoDiarioUnitario * dia.comensalesTotal);
    acc.platosTotales += dia.comensalesTotal;
    return acc;
  }, { inversionTotal: 0, platosTotales: 0 });

  const costoPromedioSemanal = totalesSemana.platosTotales > 0
    ? totalesSemana.inversionTotal / totalesSemana.platosTotales
    : 0;

  const fechasOrdenadas = Object.keys(menuPorDia).sort();

  const getFullDayName = (dateStr) => {
    const date = new Date(dateStr + 'T12:00:00'); // Evitar problemas de timezone
    const days = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];
    return days[date.getDay()];
  };

  const formatFechaDisplay = (dateStr) => {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  };

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose} />

      <div className="relative w-full max-w-[96vw] max-h-[96vh] bg-white rounded-md shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300 h-[90vh]">
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-50 flex items-center justify-between shrink-0 bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-brand-900 rounded-md text-white shadow-lg shadow-brand-900/20">
              <ChefHat size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Detalle del Menú</h3>
              <p className="text-xs text-slate-400 italic">Resumen semanal de servicios</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-3 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Dashboard de Resumen Rápido */}
        <div className="px-8 pt-1 grid grid-cols-3 gap-4 shrink-0">
          <div className="bg-slate-50 px-4 py-1 rounded-md border border-slate-100 flex items-center justify-center text-center gap-2">
            <div className="p-2 bg-brand-50 rounded-md text-brand-600"><TrendingUp size={16} /></div>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Inversión Estimada</p>
              <p className="text-lg font-black text-slate-800">${totalesSemana.inversionTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
          </div>
          <div className="bg-brand-900 px-4 py-1 rounded-md flex items-center justify-center text-center shadow-lg shadow-brand-900/20 gap-2">
            <div className="p-2 bg-white/10 rounded-md text-white"><DollarSign size={16} /></div>
            <div>
              <p className="text-[9px] font-black text-white/50 uppercase tracking-widest">Costo Prom. Plato</p>
              <p className="text-lg font-black text-white">${costoPromedioSemanal.toFixed(2)}</p>
            </div>
          </div>
          <div className="bg-slate-50 px-4 py-1 rounded-md border border-slate-100 flex items-center justify-center text-center gap-2">
            <div className="p-2 bg-emerald-50 rounded-md text-emerald-600"><Users size={16} /></div>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Servicios Totales</p>
              <p className="text-lg font-black text-slate-800">{totalesSemana.platosTotales.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-8 space-y-4 custom-scrollbar">
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center">
              <Loader2 className="w-10 h-10 text-brand-600 animate-spin mb-4" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Analizando costos de recetas...</p>
            </div>
          ) : fechasOrdenadas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-300">
              <UtensilsCrossed size={48} className="opacity-20 mb-4" />
              <p className="font-bold uppercase tracking-widest text-xs">No hay recetas planificadas</p>
            </div>
          ) : (
            <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
              {fechasOrdenadas.map((fecha) => (
                <div key={fecha} className="group animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-white border border-slate-100 flex items-center justify-center shadow-sm">
                        <Calendar size={14} className="text-brand-600" />
                      </div>
                      <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-widest">
                        {getFullDayName(fecha)} <span className="text-slate-400 font-medium ml-1">{formatFechaDisplay(fecha)}</span>
                      </h4>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col items-end">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Costo Menú</p>
                        <p className="text-sm font-black text-emerald-600">${menuPorDia[fecha].costoDiarioUnitario.toFixed(2)}</p>
                      </div>
                      <div className="flex items-center gap-1 bg-brand-50 px-3 py-1.5 rounded-xl border border-brand-100 shadow-sm shadow-brand-900/5">
                        <Users size={10} className="text-brand-600" />
                        <span className="text-[10px] font-black text-brand-900">{menuPorDia[fecha].comensalesTotal}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-[1.5rem] p-5 border border-slate-100 group-hover:border-brand-200 group-hover:shadow-xl group-hover:shadow-brand-900/5 transition-all duration-500 relative overflow-hidden">
                    {/* Decoración sutil */}
                    <div className="absolute top-0 right-0 p-4 opacity-[0.03] text-brand-900 rotate-12"><UtensilsCrossed size={80} /></div>

                    <div className="grid grid-cols-1 gap-3 relative z-10">
                      {menuPorDia[fecha].recipes.map((receta, idx) => (
                        <div key={idx} className="flex items-center justify-between group/item">
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full shrink-0 ${receta.esBase ? 'bg-brand-600 shadow-sm shadow-brand-900/50' : 'bg-slate-300'}`} />
                            <div className="flex flex-col">
                              <span className={`text-xs font-bold leading-tight ${receta.esBase ? 'text-slate-800 text-sm' : 'text-slate-500'}`}>{receta.nombre}</span>
                              <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{receta.tipologia}</span>
                            </div>
                          </div>
                          <span className="text-[10px] font-black text-slate-600 tabular-nums transition-all duration-300 group-hover/item:text-brand-900 group-hover/item:scale-110">
                            ${receta.costo.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
          >
            Cerrar Vista
          </button>
        </div>
      </div>
    </div>
    , document.body);
};

export default ViewDetalleMenu;
