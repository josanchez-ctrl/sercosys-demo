import React, { useState, useEffect, useRef } from 'react';
import { WifiOff, RefreshCw, Zap } from 'lucide-react';
import { supabase } from '../../lib/supabase';

/**
 * NetworkStatusGuard v3
 * Monitorea la conexión usando el WebSocket de Supabase + Heartbeat.
 * Muestra un modal premium con "Super Blur" para proteger el estado de la app.
 */
export default function NetworkStatusGuard({ children }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showReload, setShowReload] = useState(false);
  const [initialCheckDone, setInitialCheckDone] = useState(false);
  const heartbeatInterval = useRef(null);

  // Ya no usamos fetch para evitar 401 y riesgos de bloqueo de IP
  useEffect(() => {
    // 1. Canal de Control de Supabase (Escuchamos el WebSocket)
    const channel = supabase.channel('network-guard');

    const handleStatus = (status) => {
      if (status === 'SUBSCRIBED') {
        setIsOnline(true);
        setShowReload(false);
      }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setIsOnline(false);
      }
    };

    channel.subscribe(handleStatus);

    // 2. Listeners del Navegador
    const handleConnect = () => {
      setIsOnline(true);
      setShowReload(false);
    };

    const handleDisconnect = () => setIsOnline(false);

    window.addEventListener('online', handleConnect);
    window.addEventListener('offline', handleDisconnect);

    // Verificación inicial mínima
    setInitialCheckDone(true);

    return () => {
      //supabase.removeChannel(channel);
      window.removeEventListener('online', handleConnect);
      window.removeEventListener('offline', handleDisconnect);
    };
  }, []);

  // Contador para el botón de recarga (5 min)
  useEffect(() => {
    let timer;
    if (!isOnline) {
      timer = setTimeout(() => setShowReload(true), 300000);
    }
    return () => clearTimeout(timer);
  }, [isOnline]);

  const handleManualReload = () => window.location.reload();

  return (
    <div className="relative min-h-screen">
      {/* 
        Si estamos offline y es la carga inicial (F5), NO renderizamos los hijos.
        Esto evita que los guardias de seguridad (NoAcceso) se disparen por error.
      */}
      {(!initialCheckDone || isOnline) ? children : (
        <div className="fixed inset-0 z-0">
          {/* Opcional: Podríamos renderizar un skeleton aquí */}
        </div>
      )}

      {/* Modal de Conexión Perdida */}
      {!isOnline && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/40 backdrop-blur-[100px] animate-in fade-in duration-700 p-4">
          <div className="bg-white/90 border border-white max-w-md w-full rounded-[2.5rem] p-10 shadow-2xl flex flex-col items-center text-center relative overflow-hidden scale-in-center animate-in zoom-in-95">

            <div className="absolute top-0 right-0 p-4 opacity-5">
              <Zap size={120} className="text-brand-900" />
            </div>

            <div className="relative mb-8">
              <div className="absolute inset-0 bg-rose-500 rounded-full blur-2xl opacity-20 animate-pulse"></div>
              <div className="w-24 h-24 bg-rose-50 text-rose-600 rounded-[2rem] flex items-center justify-center shadow-xl shadow-rose-500/10 relative border border-rose-100 rotate-[-10deg]">
                <WifiOff size={48} strokeWidth={2.5} />
              </div>
            </div>

            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-4 leading-none">
              Señal de Red Perdida
            </h2>
            <p className="text-slate-500 font-bold text-sm leading-relaxed mb-8 px-4">
              Hemos detectado una interrupción en la conexión con los servicios de <span className="text-brand-600">Sercosys</span>.
              <br /><br />
              No cierres la pestaña; la reconexión es automática.
            </p>

            {showReload ? (
              <button
                onClick={handleManualReload}
                className="group w-full py-4 bg-brand-900 text-white rounded-md font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-brand-900/20 hover:bg-brand-800 transition-all flex items-center justify-center gap-3 active:scale-95"
              >
                <RefreshCw size={18} className="group-hover:rotate-180 transition-transform duration-500" />
                Refrescar Conexión
              </button>
            ) : (
              <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-50 px-6 py-3 rounded-xl border border-slate-100 shadow-inner">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></div>
                Monitoreando Señal en Tiempo Real...
              </div>
            )}

            <div className="mt-8 pt-6 border-t border-slate-100 w-full">
              <span className="text-[8px] font-black text-slate-300 uppercase tracking-[0.3em]">
                Sercosys Core v2 • Smart Network Guard
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

