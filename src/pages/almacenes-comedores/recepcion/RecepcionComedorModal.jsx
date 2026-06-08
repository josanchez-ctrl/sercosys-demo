import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Formik, Form, Field, FieldArray } from 'formik';
import * as Yup from 'yup';
import { X, PackageCheck, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import { formatearFecha, formato8Digitos } from '../../../util/workDate';
import { recibirDespacho } from '../../../services/recepcionComedorService';
import { Now } from '../../../services/nowService';
import { supabase } from '../../../lib/supabase';
import { toast } from 'sonner';
import { Scan, Package, Check, Eye, CheckCircle2 } from 'lucide-react';

export default function RecepcionComedorModal({ despacho, onClose, onSuccess, perfil }) {
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [scanValue, setScanValue] = useState('');
  const [processing, setProcessing] = useState(false);
  const scanInputRef = React.useRef(null);

  const isReadOnly = despacho.estatus !== 'EN TRÁNSITO';
  const detalles = despacho.almacen_despacho_detalle || [];

  const initialValues = {
    detalles: detalles.map(d => {
      const pickDet = d.picking_detalle || {};
      const prod = pickDet.producto || {};
      return {
        id_detalle: d.id,
        id_picking_detalle: d.id_picking_detalle,
        producto: prod,
        picking_detalle: pickDet,
        lote: pickDet.lote || 'N/A',
        fecha_vencimiento: pickDet.fecha_vencimiento ? formatearFecha(pickDet.fecha_vencimiento) : 'N/A',
        cantidad_enviada: Number(d.cantidad_enviada),
        cantidad_recibida: isReadOnly ? Number(d.cantidad_recibida || 0) : 0,
        factor: Number(pickDet.factor || 1),
        observacion: d.observacion_recepcion || ''
      };
    })
  };

  React.useEffect(() => {
    if (!isReadOnly) {
      const timer = setInterval(() => {
        if (scanInputRef.current && document.activeElement !== scanInputRef.current && !processing) {
          scanInputRef.current.focus();
        }
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [isReadOnly, processing]);

  const handleScan = async (e, setFieldValue, values) => {
    e.preventDefault();
    const trimmedValue = scanValue.trim();
    if (!trimmedValue || processing) return;

    setProcessing(true);
    try {
      const { data: solved, error } = await supabase.rpc('fn_resolver_codigo_barras', {
        p_id_empresa: despacho.id_empresa,
        p_codigo: trimmedValue
      });

      if (error || !solved) {
        toast.error('Código no reconocido');
        setScanValue('');
        return;
      }

      // Buscar en los items del despacho
      const targetIndex = values.detalles.findIndex(it =>
        it.producto?.id === solved.id_producto &&
        it.picking_detalle?.id_presentacion_logistica === solved.id_presentacion_logistica &&
        (it.cantidad_recibida < it.cantidad_enviada)
      );

      if (targetIndex === -1) {
        // Buscar si ya está completo
        const alreadyDone = values.detalles.find(it =>
          it.producto?.id === solved.id_producto &&
          it.picking_detalle?.id_presentacion_logistica === solved.id_presentacion_logistica
        );

        if (alreadyDone) {
          toast.warning('Este ítem ya fue recibido completamente');
        } else {
          toast.error('Producto no pertenece a este despacho');
        }
        setScanValue('');
        return;
      }

      // Incrementar cantidad recibida (asumiendo que escanea 1 unidad de la presentación)
      const currentVal = Number(values.detalles[targetIndex].cantidad_recibida || 0);
      const newVal = currentVal + 1;
      
      setFieldValue(`detalles.${targetIndex}.cantidad_recibida`, newVal);
      toast.success(`${solved.rubro} recibido (${newVal}/${values.detalles[targetIndex].cantidad_enviada})`);
      setScanValue('');

    } catch (error) {
      console.error('Error en escaneo:', error);
      toast.error('Error al procesar escaneo');
    } finally {
      setProcessing(false);
    }
  };

  const validationSchema = Yup.object().shape({
    detalles: Yup.array().of(
      Yup.object().shape({
        cantidad_recibida: Yup.number()
          .min(0, 'No puede ser negativa')
          .required('Requerida'),
        observacion: Yup.string()
          .when(['cantidad_recibida', 'cantidad_enviada'], ([recibida, enviada], schema) => {
            if (Number(recibida) !== Number(enviada)) {
              return schema.required('Debe indicar un motivo por la diferencia');
            }
            return schema;
          })
      })
    )
  });

  const handleSubmit = async (values) => {
    if (isReadOnly) {
      onClose();
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      // Formatear payload (devolver a unidades base dividiendo por el factor si fuese necesario, pero nuestro RPC espera lo mismo que enviamos?)
      // Ojo: En picking enviamos "empaques". Si la cantidad recibida es en unidades volumétricas (factor), 
      // el comedor_inventario guarda en "empaques" o "volumen"? 
      // fn_recibir_despacho espera "cantidad" en la misma unidad que se guardó en picking_detalle. 
      // El picking_detalle tiene la cantidad en EMPAQUES.
      // Por tanto, debemos enviar la cantidad_recibida dividida por el factor.

      const payload = values.detalles.map((item, index) => {
        const factor = Number(detalles[index]?.picking_detalle?.producto?.factor || 1);
        return {
          id_detalle: item.id_detalle,
          cantidad_recibida: Number(item.cantidad_recibida), // Ya viene en empaques (UND)
          observacion: item.observacion || ''
        };
      });

      const nowStr = await Now();
      const res = await recibirDespacho(despacho.id, perfil.id, payload, nowStr);

      if (res.success) {
        onSuccess();
      } else {
        setErrorMsg(res.error || 'Ocurrió un error al procesar la recepción.');
      }
    } catch (error) {
      console.error(error);
      setErrorMsg('Error de red o servidor.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderContent = () => (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white rounded-md shadow-xl w-auto h-auto max-w-[98vw] max-h-[96vh] flex flex-col overflow-hidden">

        {/* HEADER */}
        <div className="shrink-0 px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-white relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-500 to-brand-900" />
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-md flex items-center justify-center border shadow-inner ${isReadOnly ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-brand-50 border-brand-100 text-brand-600'}`}>
              <PackageCheck size={24} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight leading-none">
                {isReadOnly ? 'Detalle de Recepción' : 'Recibir Despacho'} #{formato8Digitos(despacho.id)}
              </h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1 italic">
                Origen: {despacho.almacen?.nombre || 'Almacén Principal'} • {formatearFecha(despacho.fecha_despacho)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-3 text-slate-400 hover:bg-slate-50 hover:text-slate-600 rounded-xl transition-colors active:scale-95"
            disabled={submitting}
          >
            <X size={24} strokeWidth={2.5} />
          </button>
        </div>

        {/* BODY CON FORMIK */}
        <div className="flex-1 overflow-y-auto bg-slate-50/50 px-6 py-1">
          {errorMsg && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-md flex items-start gap-3 text-red-600">
              <AlertCircle size={20} className="shrink-0 mt-0.5" />
              <p className="text-sm font-bold">{errorMsg}</p>
            </div>
          )}

          <Formik
            initialValues={initialValues}
            validationSchema={validationSchema}
            onSubmit={handleSubmit}
          >
            {({ values, errors, touched, setFieldValue }) => (
              <Form id="recepcion-form" className="space-y-1">
                
                {/* ESCÁNER */}
                {!isReadOnly && (
                  <div className="bg-white px-8 py-2 rounded-md border border-slate-100 shadow-sm flex items-center gap-4 animate-in slide-in-from-top duration-500">
                    <div className="p-3 bg-brand-50 rounded-xl text-brand-600">
                      <Scan size={20} />
                    </div>
                    <div className="flex-1">
                      <input
                        ref={scanInputRef}
                        type="text"
                        placeholder={processing ? "PROCESANDO ESCANEO..." : "ESCANEA EL PRODUCTO O INGRESA TRK PARA CONFIRMAR"}
                        className="w-full bg-transparent border-none text-sm font-black text-slate-700 placeholder:text-slate-300 outline-none uppercase tracking-widest"
                        value={scanValue}
                        onChange={(e) => setScanValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleScan(e, setFieldValue, values);
                          }
                        }}
                        disabled={processing}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        values.detalles.forEach((_, idx) => {
                          setFieldValue(`detalles.${idx}.cantidad_recibida`, values.detalles[idx].cantidad_enviada);
                        });
                        toast.success('Se han marcado todos los productos como recibidos');
                      }}
                      className="px-4 py-2 bg-slate-100 text-slate-600 rounded-md text-[10px] font-black uppercase tracking-widest hover:bg-emerald-50 hover:text-emerald-600 transition-all border border-slate-200"
                    >
                      Recibir Todo
                    </button>
                  </div>
                )}

                <FieldArray name="detalles">
                  {() => (
                    <div className="bg-white rounded-md border border-slate-100 shadow-sm overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-100">
                              <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Producto & Presentación</th>
                              <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Lote / FV</th>
                              <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Cant. Enviada</th>
                              <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest w-40 text-right">Cant. Recibida</th>
                              <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest w-64">Observación (Mermas)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-300">
                            {values.detalles.map((item, index) => {
                              const p = item.producto;
                              const pickDet = item.picking_detalle;
                              const errCant = errors.detalles?.[index]?.cantidad_recibida;
                              const errObs = errors.detalles?.[index]?.observacion;
                              const isDiference = Number(item.cantidad_recibida) !== Number(item.cantidad_enviada);

                              return (
                                <tr key={item.id_detalle} className={`transition-colors hover:bg-slate-50/50 ${isDiference ? 'bg-amber-50/20' : ''}`}>
                                  <td className="px-8 py-1">
                                    <div className="flex items-center gap-4">
                                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                                        Number(item.cantidad_recibida) >= Number(item.cantidad_enviada) 
                                        ? 'bg-emerald-50 border-emerald-100 text-emerald-600' 
                                        : 'bg-slate-50 border-slate-100 text-slate-400'
                                      }`}>
                                        {Number(item.cantidad_recibida) >= Number(item.cantidad_enviada) 
                                          ? <CheckCircle2 size={18} /> 
                                          : <Package size={18} />
                                        }
                                      </div>
                                      <div className="flex flex-col">
                                        <span className="flex flex-col text-xs font-black text-slate-700 uppercase tracking-tight leading-none mb-1">
                                          <span>{p?.rubro?.nombre}</span>
                                          <span> {p?.marca?.nombre} {p?.variedad}</span>
                                        </span>
                                        <span className="text-[9px] font-bold text-slate-400 uppercase italic">
                                          {(() => {
                                            const basePres = p?.presentaciones?.find(bp => bp.es_base);
                                            const baseFactor = basePres?.factor || 1;
                                            const baseNombre = basePres?.presentacion?.nombre || 'UND';
                                            const ratio = (item.factor || 1) / baseFactor;

                                            const presNombre = pickDet?.presentacion_logistica?.presentacion?.nombre || 'UND';
                                            const ratioStr = ratio > 1 ? `${ratio % 1 === 0 ? ratio : ratio.toFixed(1)}${baseNombre}` : '';

                                            return `${presNombre} ${ratioStr} | ${item.factor}${p?.rubro?.unidad?.abreviatura || ''}`;
                                          })()}
                                        </span>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-6 py-1">
                                    <div className="flex flex-col items-center justify-center">
                                      <span className="text-[10px] font-black text-slate-400 uppercase leading-none">L: {item.lote}</span>
                                      <span className="text-[9px] font-bold text-slate-300 uppercase mt-1">FV: {item.fecha_vencimiento}</span>
                                    </div>
                                  </td>
                                  <td className="px-8 py-1 text-right">
                                    <div className="flex flex-col items-end">
                                      <div className="flex items-center gap-1">
                                        <span className="text-sm font-bold text-slate-800 tabular-nums">{parseFloat(item.cantidad_enviada.toFixed(3))}</span>
                                        <span className="text-[9px] font-black text-slate-400">UND</span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <span className="text-xs font-bold text-slate-400 tabular-nums">{parseFloat((item.cantidad_enviada * item.factor).toFixed(3))}</span>
                                        <span className="text-[9px] font-black text-slate-400 tracking-tighter">{p?.rubro?.unidad?.abreviatura}</span>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-8 py-1 text-right">
                                    <div className="flex flex-col items-end gap-1">
                                      <div className="relative w-full max-w-[120px]">
                                        <Field
                                          type="number"
                                          name={`detalles.${index}.cantidad_recibida`}
                                          disabled={isReadOnly || submitting}
                                          className={`w-full h-9 pl-3 pr-8 bg-slate-50 border-2 rounded-md text-sm font-black tabular-nums outline-none focus:ring-4 focus:ring-brand-500/10 transition-all
                                            ${errCant ? 'border-red-200 text-red-700 bg-red-50' : 'border-transparent text-slate-800 focus:border-brand-500 shadow-inner'}`}
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-400 pointer-events-none uppercase">
                                          UND
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1 px-1">
                                        <span className="text-xs font-black text-brand-900 tabular-nums">
                                          {parseFloat((Number(values.detalles[index].cantidad_recibida || 0) * item.factor).toFixed(3))}
                                        </span>
                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">
                                          {p?.rubro?.unidad?.abreviatura}
                                        </span>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-8 py-1">
                                    <Field
                                      type="text"
                                      name={`detalles.${index}.observacion`}
                                      disabled={isReadOnly || submitting}
                                      placeholder={isDiference ? "Indique el motivo..." : "Conforme"}
                                      className={`w-full h-10 px-4 bg-slate-50 border-2 rounded-md text-[11px] font-bold outline-none focus:ring-4 focus:ring-brand-500/10 transition-all
                                        ${errObs ? 'border-red-100 text-red-700 placeholder-red-300 bg-red-50' : 'border-transparent text-slate-700 focus:border-brand-500 placeholder-slate-300 shadow-inner'}`}
                                    />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </FieldArray>
              </Form>
            )}
          </Formik>
        </div>

        {/* FOOTER */}
        <div className="shrink-0 px-8 py-6 border-t border-slate-100 bg-white flex justify-end gap-3 rounded-b-md">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-8 py-3 bg-slate-50 text-slate-400 rounded-md hover:bg-slate-100 active:scale-95 transition-all text-[11px] font-black uppercase tracking-widest disabled:opacity-50"
          >
            {isReadOnly ? 'Cerrar Vista' : 'Cancelar'}
          </button>
          {!isReadOnly && (
            <button
              type="submit"
              form="recepcion-form"
              disabled={submitting}
              className="px-10 py-3 bg-brand-900 text-white rounded-md hover:bg-brand-800 active:scale-95 transition-all text-[11px] font-black uppercase tracking-[0.2em] shadow-xl shadow-brand-900/20 flex items-center gap-3 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Procesando...</span>
                </>
              ) : (
                <>
                  <PackageCheck size={18} />
                  <span>Confirmar Recepción</span>
                </>
              )}
            </button>
          )}
        </div>

      </div>
    </div>
  );

  return createPortal(renderContent(), document.body);
}
