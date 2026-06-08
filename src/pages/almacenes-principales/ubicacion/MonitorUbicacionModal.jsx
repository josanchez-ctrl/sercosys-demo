import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MapPin, Package, CheckCircle2, QrCode, X } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Modal de Confirmación de Ubicación (Put-away)
 * Sigue los estándares de ADN de Modales de Sercosys
 */
const MonitorUbicacionModal = ({ isOpen, onClose, selectedTarea, ubicaciones, onConfirm }) => {
  const [scanValue, setScanValue] = useState('');
  const [isVerified, setIsVerified] = useState(false);

  const [rackScanValue, setRackScanValue] = useState('');
  const [selectedRack, setSelectedRack] = useState(null);

  // Resetear estados al abrir con nueva tarea
  useEffect(() => {
    if (isOpen) {
      setScanValue('');
      setIsVerified(false);
      setRackScanValue('');
      setSelectedRack(null);
    }
  }, [isOpen, selectedTarea?.id]);

  const handleScan = (val) => {
    setScanValue(val);
    if (val.trim().toUpperCase() === selectedTarea?.inventario?.tracking_id?.toUpperCase()) {
      setIsVerified(true);
      toast.success('Etiqueta validada correctamente');
    }
  };

  const handleRackScan = (val) => {
    setRackScanValue(val);
    const rack = ubicaciones.find(u => u.codigo.toUpperCase() === val.trim().toUpperCase());
    if (rack) {
      setSelectedRack(rack);
      toast.success(`Rack ${rack.codigo} identificado`);
    }
  };

  if (!isOpen || !selectedTarea) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Overlay con Blur */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />

      {/* Contenedor del Modal (Redondeado Extremo) */}
      <div className="relative bg-white rounded-md shadow-2xl w-full max-w-[90vw] max-h-[90vh] overflow-hidden animate-in zoom-in duration-300 flex flex-col">

        {/* Cabecera - FIJA */}
        <div className="p-6 border-b border-gray-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-brand-50 rounded-2xl text-brand-600">
              <MapPin size={24} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight leading-tight">Confirmar Putaway</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase italic tracking-widest">Ejecución física de movimiento a Rack</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"
          >
            <X size={20} />
          </button>
        </div>

        {/* Cuerpo - FIJO, pero contenedor del área con scroll */}
        <div className="p-6 py-2 flex-1 flex flex-col min-h-0 space-y-4">

          {/* Detalle del Item (Fijo) */}
          <div className="bg-gray-50/50 px-5 py-2 rounded-md border border-gray-100 flex items-center justify-between shadow-inner shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white rounded-md border border-gray-100 flex items-center justify-center shadow-sm">
                <Package size={24} className="text-slate-400" />
              </div>
              <div>
                <p className="text-sm font-black text-slate-700 uppercase leading-none mb-1">
                  {selectedTarea.inventario?.producto?.rubro?.nombre}
                </p>
                <p className="text-[10px] font-bold text-brand-600 italic">
                  Cant: {selectedTarea.cantidad} | Lote: {selectedTarea.inventario?.lote || 'S/L'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">ID Trazabilidad</p>
              <p className="text-[11px] font-black text-brand-900 uppercase tracking-widest bg-white px-2 py-1 rounded-md border border-gray-100 shadow-sm mt-1">
                {selectedTarea.inventario?.tracking_id || 'SIN ID'}
              </p>
            </div>
          </div>

          {/* ZONAS DE ESCANEO (Fijo) */}
          <div className="space-y-1 shrink-0">
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              {/* Paso 1: Escaneo de Producto */}
              <div className={`px-4 py-2 rounded-md border-2 border-dashed transition-all duration-300 ${isVerified ? 'bg-emerald-50 border-emerald-200' : 'bg-brand-50/30 border-brand-200'}`}>
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-sm ${isVerified ? 'bg-emerald-500 text-white' : 'bg-white text-brand-600'}`}>
                    {isVerified ? <CheckCircle2 size={20} /> : <QrCode size={20} className="animate-pulse" />}
                  </div>
                  <div className="flex-1 items-center justify-center">
                    <h4 className={`text-xs font-black uppercase tracking-tight ${isVerified ? 'text-emerald-700' : 'text-slate-800'}`}>
                      1. Validar Producto
                    </h4>
                    {!isVerified && (
                      <input
                        autoFocus
                        type="text"
                        value={scanValue}
                        onChange={(e) => handleScan(e.target.value)}
                        placeholder="Escanee bulto..."
                        className="w-full mt-2 px-4 py-2 bg-white border border-brand-200 rounded-lg text-sm font-black tracking-widest text-brand-900 outline-none focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 transition-all"
                      />
                    )}
                    <div className="flex flex-row items-center justify-between">
                      {isVerified && <p className="text-[10px] font-bold text-emerald-600 uppercase italic">Producto Identificado</p>}
                      {isVerified && <p className="text-lg font-bold text-emerald-600 uppercase italic">{selectedTarea.inventario?.tracking_id}</p>}
                    </div>

                  </div>
                </div>
              </div>

              {/* Paso 2: Escaneo de Rack */}
              <div className={`px-4 py-2 rounded-md border-2 border-dashed transition-all duration-300 ${!isVerified ? 'opacity-30 grayscale' : selectedRack ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50/30 border-amber-200'}`}>
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-sm ${selectedRack ? 'bg-emerald-500 text-white' : 'bg-white text-amber-600'}`}>
                    {selectedRack ? <CheckCircle2 size={20} /> : <MapPin size={20} className={isVerified ? 'animate-bounce' : ''} />}
                  </div>
                  <div className="flex-1">
                    <h4 className={`text-xs font-black uppercase tracking-tight ${selectedRack ? 'text-emerald-700' : 'text-slate-800'}`}>
                      2. Validar Rack Destino
                    </h4>
                    {isVerified && !selectedRack && (
                      <input
                        autoFocus
                        type="text"
                        value={rackScanValue}
                        onChange={(e) => handleRackScan(e.target.value)}
                        placeholder="Escanee código del Rack..."
                        className="w-full mt-2 px-4 py-2 bg-white border border-amber-200 rounded-lg text-sm font-black tracking-widest text-amber-900 outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 transition-all"
                      />
                    )}
                    {selectedRack && (
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-[10px] font-black text-emerald-600 uppercase italic">Ubicación:</p>
                        <p className="text-lg font-bold text-emerald-600 uppercase italic">{selectedRack.codigo}</p>
                        <button
                          onClick={() => { setSelectedRack(null); setRackScanValue(''); }}
                          className="text-[9px] font-black text-amber-600 uppercase underline decoration-2 underline-offset-2"
                        >
                          Cambiar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Área de Racks - UNICA CON SCROLL */}
          <div className={`flex-1 flex flex-col min-h-0 space-y-2 transition-all duration-500 ${!isVerified ? 'opacity-20 pointer-events-none blur-[1px]' : 'opacity-100'}`}>
            <div className="flex items-center justify-between ml-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <MapPin size={12} className="text-brand-500" /> Selección de Rack de Destino
              </label>
              <span className="text-[9px] font-bold text-slate-300 uppercase italic">
                {ubicaciones.length} Racks disponibles
              </span>
            </div>

            {/* El grid es el que tiene el overflow */}
            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-brand-200 scrollbar-track-transparent bg-gray-50/50 rounded-2xl border border-gray-100 p-2">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
                {ubicaciones.map(ub => (
                  <button
                    key={ub.id}
                    onClick={() => {
                      setSelectedRack(ub);
                      setRackScanValue(ub.codigo);
                      toast.success(`Rack ${ub.codigo} seleccionado`);
                    }}
                    className={`flex flex-col items-center justify-center p-3 border transition-all group rounded-xl active:scale-95 ${selectedRack?.id === ub.id
                      ? 'bg-brand-900 border-brand-900 shadow-lg scale-105'
                      : 'bg-white border-gray-100 shadow-sm hover:border-brand-500'
                      }`}
                  >
                    <div className='flex items-center justify-center gap-2'>
                      <MapPin size={12} className={selectedRack?.id === ub.id ? 'text-white' : 'text-slate-300 group-hover:text-brand-500'} />
                      <span className={`text-xs font-black tracking-tighter ${selectedRack?.id === ub.id ? 'text-white' : 'text-slate-800'}`}>
                        {ub.codigo}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
              {ubicaciones.length === 0 && (
                <div className="p-10 text-center text-[10px] font-bold text-slate-400 italic uppercase tracking-widest">
                  No hay racks configurados en este almacén.
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Footer del Modal - FIJO */}
        <div className="p-6 border-t border-gray-100 flex items-center justify-between bg-gray-50/30 shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-3 bg-white border border-gray-200 text-slate-500 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-50 transition-all active:scale-95"
          >
            Cancelar
          </button>

          <button
            disabled={!selectedRack || !isVerified}
            onClick={() => onConfirm(selectedRack.id)}
            className={`px-10 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl transition-all active:scale-95 ${selectedRack && isVerified
              ? 'bg-brand-900 text-white shadow-brand-900/20 hover:bg-brand-800'
              : 'bg-slate-100 text-slate-300 cursor-not-allowed'
              }`}
          >
            Confirmar Ubicación
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
};

export default MonitorUbicacionModal;
