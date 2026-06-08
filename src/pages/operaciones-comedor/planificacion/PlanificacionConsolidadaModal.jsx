import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Calculator, Utensils, Download, Loader2, AlertCircle, Calendar, Warehouse, ChevronDown } from 'lucide-react';
import { getConsolidadoSnapshot } from '../../../services/planificacionService';
import { formatToISODate } from '../../../util/workDate';
import { getDecimalPlaces } from '../../../util/workDecimales';

const PlanificacionConsolidadaModal = ({ planId, planDetalle = [], insumosOperativos = [], onClose, weekDays }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [comensales, setComensales] = useState({ diario: [0, 0, 0, 0, 0, 0, 0], total: 0 });
  const [totalesGasto, setTotalesGasto] = useState({ total: 0, porAlmacen: {}, sinPrecio: 0, costoPorPlato: 0 });
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadSnapshot = async () => {
      if (!planId) return;
      setLoading(true);
      try {
        const snapshot = await getConsolidadoSnapshot(planId);


        // --- CÁLCULO DE COMENSALES (Filtrando por Tipología Base) ---
        const comensalesDiarios = [0, 0, 0, 0, 0, 0, 0];
        planDetalle?.forEach(d => {
          // Solo sumamos comensales si la tipología de la receta es "Base" (Principal)
          if (d.receta?.tipologia?.es_base) {
            const dayIdx = weekDays.findIndex(wd => formatToISODate(wd) === String(d.fecha).substring(0, 10));
            if (dayIdx !== -1) comensalesDiarios[dayIdx] += Number(d.comensales || 0);
          }
        });
        const totalComensales = comensalesDiarios.reduce((a, b) => a + b, 0);
        // ------------------------------------------------------------

        // Procesar los datos agrupando por Almacén > Categoría > Rubro
        const grouping = {};

        snapshot.forEach(row => {
          const almacen = row.rubro?.categoria?.almacenes?.nombre || 'ALMACÉN NO DEFINIDO';
          const categoria = row.rubro?.categoria?.nombre || 'OTRO';
          const rubroId = row.id_rubro;

          if (!grouping[almacen]) grouping[almacen] = {};
          if (!grouping[almacen][categoria]) grouping[almacen][categoria] = {};

          if (!grouping[almacen][categoria][rubroId]) {
            const costoGuardado = Number(row.costo_unitario || 0);
            const costoLive = Number(row.rubro?.costo_info?.[0]?.costo_ponderado_global || 0);

            grouping[almacen][categoria][rubroId] = {
              nombre: row.rubro?.nombre || 'Desconocido',
              unidad: row.rubro?.unidad?.abreviatura || 'un',
              categoriaNombre: categoria,
              diario: [0, 0, 0, 0, 0, 0, 0],
              total_neto: 0,
              cantidad_manual: 0,
              merma_pct: 0,
              costo_unitario: costoGuardado > 0 ? costoGuardado : costoLive
            };
          }

          const dayIdx = weekDays.findIndex(wd => formatToISODate(wd) === String(row.fecha).substring(0, 10));

          // Si id_receta_raiz es null, es un insumo manual guardado en el snapshot
          if (!row.id_receta_raiz) {
            grouping[almacen][categoria][rubroId].cantidad_manual += Number(row.cantidad_neta || 0);
          } else {
            grouping[almacen][categoria][rubroId].total_neto += Number(row.cantidad_neta || 0);
            if (dayIdx !== -1) {
              grouping[almacen][categoria][rubroId].diario[dayIdx] += Number(row.cantidad_neta || 0);
            }
          }
          grouping[almacen][categoria][rubroId].merma_pct = Number(row.merma_pct || 0);
        });

        // 2. Procesar Insumos Operativos (Manuales) - Solo si NO vienen ya en el snapshot
        // (Si el snapshot ya tiene datos, significa que ya están congelados allí)
        if (snapshot.length === 0) {
          insumosOperativos.forEach(row => {
            const rubro = row.rubro;
            const almacen = rubro?.categoria?.almacenes?.nombre || 'ALMACÉN NO DEFINIDO';
            const categoria = rubro?.categoria?.nombre || 'OTRO';
            const rubroId = row.id_rubro;

            if (!grouping[almacen]) grouping[almacen] = {};
            if (!grouping[almacen][categoria]) grouping[almacen][categoria] = {};

            if (!grouping[almacen][categoria][rubroId]) {
              grouping[almacen][categoria][rubroId] = {
                nombre: rubro?.nombre,
                unidad: rubro?.unidad?.abreviatura || 'un',
                categoriaNombre: categoria,
                diario: [0, 0, 0, 0, 0, 0, 0],
                total_neto: 0,
                cantidad_manual: 0,
                merma_pct: (rubro?.mermas || []).reduce((acc, m) => acc + Number(m.valor), 0),
                costo_unitario: Number(rubro?.costo_info?.[0]?.costo_ponderado_global || 0)
              };
            }
            grouping[almacen][categoria][rubroId].cantidad_manual += Number(row.cantidad || 0);
          });
        }

        // 3. Transformar a estructura plana para el renderizado
        const allItems = Object.entries(grouping).flatMap(([almacen, categorias]) =>
          Object.entries(categorias).flatMap(([categoria, rubros]) =>
            Object.values(rubros).map(item => {
              const totalNetoManual = item.total_neto + item.cantidad_manual;
              const factorMerma = item.merma_pct / 100;
              const cantMerma = totalNetoManual * factorMerma;
              const totalBruto = totalNetoManual + cantMerma;
              return {
                almacen,
                ...item,
                categoriaNombre: item.categoriaNombre || categoria,
                cant_merma: cantMerma,
                total_bruto: totalBruto,
                techo: Math.ceil(totalBruto)
              };
            })
          )
        ).sort((a, b) => a.categoriaNombre.localeCompare(b.categoriaNombre) || a.nombre.localeCompare(b.nombre));

        const finalStructure = Array.from(new Set(allItems.map(i => i.almacen))).sort().map(almacen => ({
          almacen,
          items: allItems.filter(i => i.almacen === almacen).sort((a, b) => a.categoriaNombre.localeCompare(b.categoriaNombre) || a.nombre.localeCompare(b.nombre))
        }));

        // 4. Calcular Gasto Estimado y Métricas de Transparencia
        const sinPrecio = allItems.filter(item => (item.costo_unitario || 0) <= 0).length;
        const totalGastoGlobal = allItems.reduce((acc, item) => acc + (item.total_bruto * item.costo_unitario), 0);
        const gastoPorAlmacen = allItems.reduce((acc, item) => {
          const subtotal = item.total_bruto * item.costo_unitario;
          acc[item.almacen] = (acc[item.almacen] || 0) + subtotal;
          return acc;
        }, {});

        const costoPorPlato = totalComensales > 0 ? totalGastoGlobal / totalComensales : 0;

        setData(finalStructure);
        setComensales({ diario: comensalesDiarios, total: totalComensales });
        setTotalesGasto({
          total: totalGastoGlobal,
          porAlmacen: gastoPorAlmacen,
          sinPrecio,
          costoPorPlato
        });
      } catch (err) {
        console.error("Error al cargar snapshot:", err);
        setError("No se pudo cargar el consolidado. Guarde el borrador primero.");
      } finally {
        setLoading(false);
      }
    };

    loadSnapshot();
  }, [planId, weekDays]);

  const [expandedAlmacenes, setExpandedAlmacenes] = useState({});

  const toggleAlmacen = (name) => {
    setExpandedAlmacenes(prev => ({ ...prev, [name]: !prev[name] }));
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose} />
      <div className="relative w-full h-full max-w-[98vw] max-h-[98vh] bg-white rounded-md shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
        <div className="px-8 py-6 border-b border-slate-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-brand-50 rounded-md text-brand-600"><Calculator size={24} /></div>
            <div>
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Consolidado de Insumos</h3>
              <p className="text-xs text-slate-400 italic">Snapshot de explosión industrial (Agrupado por Almacén)</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => window.print()} className="p-3 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-xl transition-all" title="Exportar / Imprimir"><Download size={20} /></button>
            <button onClick={onClose} className="p-3 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"><X size={20} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar px-8 bg-slate-50/30 space-y-1">
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center">
              <Loader2 className="w-10 h-10 text-brand-600 animate-spin mb-4" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Consultando Snapshot...</p>
            </div>
          ) : error ? (
            <div className="h-64 flex flex-col items-center justify-center text-center max-w-md mx-auto">
              <AlertCircle size={48} className="text-amber-500 mb-4" />
              <h4 className="text-lg font-black text-slate-800 uppercase tracking-tight">Snapshot no disponible</h4>
              <p className="text-sm text-slate-400 mt-2">{error}</p>
              <button onClick={onClose} className="mt-6 px-6 py-2 bg-brand-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-brand-900/20 active:scale-95 transition-all">Volver y Guardar</button>
            </div>
          ) : data.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center">
              <Utensils size={48} className="mx-auto mb-4 opacity-10" />
              <p className="text-sm font-black uppercase tracking-tighter italic text-slate-300">No hay insumos registrados para esta planificación</p>
            </div>
          ) : (
            <>
              {/* KPIs Gerenciales Elegantes */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-1 animate-in fade-in slide-in-from-top-4 duration-700">
                {/* Platos Totales */}
                <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4 group hover:shadow-md transition-all border-l-4 border-l-brand-500">
                  <div className="p-3 bg-brand-50 rounded-2xl text-brand-600 group-hover:bg-brand-900 group-hover:text-white transition-colors">
                    <Utensils size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Platos Semanales</p>
                    <div className="flex items-baseline gap-2">
                      <p className="text-2xl font-black text-slate-800 tabular-nums">{comensales.total.toLocaleString()}</p>
                      <span className="text-[10px] font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full">
                        ≈ ${totalesGasto.costoPorPlato.toFixed(2)} C/U
                      </span>
                    </div>
                  </div>
                </div>

                {/* Gasto Total */}
                <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4 group hover:shadow-md transition-all border-l-4 border-l-emerald-500">
                  <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                    <Calculator size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Inversión Estimada</p>
                    <div className="flex flex-col">
                      <p className="text-2xl font-black text-emerald-700 tabular-nums">
                        ≈ ${totalesGasto.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      {totalesGasto.sinPrecio > 0 && (
                        <p className="text-[8px] font-black text-amber-600 uppercase flex items-center gap-1 mt-1 flex items-center">
                          <AlertCircle size={10} /> <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full text-sm">{totalesGasto.sinPrecio}</span> rubros por cotizar
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1">
                  {/* Desglose por Almacén */}
                  {Object.entries(totalesGasto.porAlmacen).map(([almacen, subtotal]) => (
                    <div key={almacen} className="bg-slate-50/50 px-5 py-1 rounded-md border border-slate-200/50 flex flex-col justify-center hover:bg-white transition-colors">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 truncate">{almacen}</p>
                      <p className="text-lg font-black text-slate-700 tabular-nums">${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                  ))}
                </div>
              </div>

              {data.map((grupoAlmacen, aIdx) => (
                <div key={aIdx} className="bg-white rounded-md border border-slate-100 shadow-sm overflow-hidden animate-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${aIdx * 100}ms` }}>
                  <button onClick={() => toggleAlmacen(grupoAlmacen.almacen)} className="w-full px-8 py-5 bg-slate-50/50 flex items-center justify-between hover:bg-slate-100/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-brand-900 rounded-xl flex items-center justify-center text-white shadow-lg shadow-brand-900/20"><Warehouse size={16} /></div>
                      <div className="text-left">
                        <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider">{grupoAlmacen.almacen}</h4>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{new Set(grupoAlmacen.items.map(i => i.categoriaNombre)).size} Categorías | {grupoAlmacen.items.length} Rubros</p>
                      </div>
                    </div>
                    <div className={`p-2 rounded-lg bg-white border border-slate-100 text-slate-400 transition-transform duration-300 ${expandedAlmacenes[grupoAlmacen.almacen] ? 'rotate-180' : ''}`}> <ChevronDown size={18} /> </div>
                  </button>

                  {expandedAlmacenes[grupoAlmacen.almacen] && (
                    <div className="p-2 animate-in fade-in duration-300">
                      <div className="rounded-md border border-slate-50 overflow-hidden shadow-sm">
                        <table className="w-full text-left border-collapse">
                          <thead className="bg-slate-50/80">
                            <tr>
                              <th className="px-6 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400 w-72">Rubro / Ingrediente</th>
                              {['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'].map((day, idx) => (
                                <th key={day} className="px-2 py-2 text-[9px] font-black uppercase tracking-widest text-center text-slate-400 w-16">
                                  <div>{day}</div>
                                  <div className="text-[9px] text-brand-600 font-black mt-0.5 bg-brand-50/50 rounded py-0.5"><span className="flex items-center justify-center text-slate-800"><Utensils size={8} /> <span className='ml-1'>{comensales.diario[idx] || '-'}</span></span></div>
                                </th>
                              ))}
                              <th className="px-4 py-2 text-[9px] font-black uppercase tracking-widest text-brand-600 text-center bg-brand-50/30">
                                <div>Neto</div>
                                <div className="text-[9px] text-brand-600 font-black mt-0.5 bg-brand-50/50 rounded py-0.5"><span className="flex items-center justify-center text-slate-800"><Utensils size={8} /> <span className='ml-1'>{comensales.total || '-'}</span></span></div>
                              </th>
                              <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-indigo-600 text-center bg-indigo-50/30">Manual</th>
                              <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-amber-600 text-center">Bruto<br />(+Merma)</th>
                              <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-emerald-600 text-center">Costo Unit.</th>
                              <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-white text-center bg-emerald-600">Total $</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-300">
                            {grupoAlmacen.items.map((item, iIdx) => (
                              <tr key={iIdx} className="hover:bg-slate-50/50 transition-all group">
                                <td className="px-6 py-1">
                                  <p className="text-[11px] font-bold text-slate-800 uppercase leading-tight group-hover:text-brand-900 transition-colors">{item.nombre}</p>
                                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                                    {item.categoriaNombre} <span className="mx-1 text-slate-200">|</span> {item.unidad}
                                  </p>
                                </td>
                                {item.diario.map((val, dIdx) => (
                                  <td key={dIdx} className={`px-2 py-1 text-[11px] font-bold text-center ${val > 0 ? 'text-slate-600' : 'text-slate-100'}`}>
                                    {val > 0 ? val.toFixed(getDecimalPlaces(val)) : '-'}
                                  </td>
                                ))}
                                <td className="px-4 py-1 text-[11px] font-black text-brand-700 text-center bg-brand-50/10">{item.total_neto.toFixed(getDecimalPlaces(item.total_neto))}</td>
                                <td className="px-4 py-1 text-[11px] font-black text-indigo-700 text-center bg-indigo-50/10">{item.cantidad_manual > 0 ? item.cantidad_manual.toFixed(getDecimalPlaces(item.cantidad_manual)) : '-'}</td>
                                <td className="px-4 py-1 text-right">
                                  <div className="flex flex-col items-right">
                                    <span className="text-md font-bold text-amber-600">
                                      {(((item.total_neto + item.cantidad_manual) * (1 + (item.merma_pct / 100)))).toFixed(getDecimalPlaces(((item.total_neto + item.cantidad_manual) * (1 + (item.merma_pct / 100)))))}
                                      <span className="ml-1 text-[9px] text-slate-400 font-black uppercase">{item.unidad}</span>
                                    </span>
                                    {item.merma_pct > 0 && (
                                      <span className="text-[8px] font-black text-green-600 uppercase">
                                        <span className="text-slate-600">{(item.total_neto + item.cantidad_manual).toFixed(getDecimalPlaces(item.total_neto + item.cantidad_manual))}</span> +{item.merma_pct}%
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-1 text-center">
                                  <p className="text-[10px] font-black text-slate-400 tabular-nums">
                                    {item.costo_unitario > 0
                                      ? `$${item.costo_unitario.toFixed(2)}`
                                      : '--'}
                                  </p>
                                </td>
                                <td className="px-4 py-1 text-right bg-emerald-50/30">
                                  <p className="text-[11px] font-black text-emerald-700 tabular-nums">
                                    {((item.total_neto + item.cantidad_manual) * (1 + (item.merma_pct / 100)) * item.costo_unitario) > 0
                                      ? `$${((item.total_neto + item.cantidad_manual) * (1 + (item.merma_pct / 100)) * item.costo_unitario).toFixed(2)}`
                                      : '--'}
                                  </p>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-slate-50/50">
                            <tr>
                              <td colSpan={11} className="px-6 py-3 text-right text-[10px] font-black uppercase tracking-widest text-slate-500">
                                Total Estimado {grupoAlmacen.almacen}:
                              </td>
                              <td className="px-4 py-3 text-right bg-emerald-600 text-white font-black text-sm tabular-nums">
                                {grupoAlmacen.items.reduce((acc, item) => {
                                  const bruto = (item.total_neto + item.cantidad_manual) * (1 + (item.merma_pct / 100));
                                  return acc + (bruto * item.costo_unitario);
                                }, 0) > 0
                                  ? `$${grupoAlmacen.items.reduce((acc, item) => {
                                    const bruto = (item.total_neto + item.cantidad_manual) * (1 + (item.merma_pct / 100));
                                    return acc + (bruto * item.costo_unitario);
                                  }, 0).toFixed(2)}`
                                  : '--'}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>

        {/* Footer Informativo */}
        <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-brand-600 rounded-full" />
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Almacenes: {data.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-slate-400" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Semana: {weekDays[0].toLocaleDateString()} al {weekDays[6].toLocaleDateString()}</span>
            </div>
          </div>
          <p className="text-[9px] text-slate-400 italic">Los valores "Techo" consideran el redondeo al entero superior para compras operativas.</p>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PlanificacionConsolidadaModal;
