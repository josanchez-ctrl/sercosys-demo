import { useState, useEffect, useRef } from 'react';
import { Bell, Check, X, Info, AlertCircle, ShoppingCart } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getNotificaciones, markAsRead, markAllAsRead } from '../../services/notificationService';
import { useAuth } from '../../context/AuthContext';

export default function NotificationBell() {
  const { user, perfil } = useAuth();
  const [notificaciones, setNotificaciones] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!user || !perfil) return;
    fetchNotificaciones();

    // SUSCRIPCIÓN REALTIME: Escuchar mis notificaciones personales (Usando ID numérico)
    const channel = supabase
      .channel(`user-notifications-${perfil.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notificaciones',
          filter: `id_usuario_destino=eq.${perfil.id}`
        },
        (payload) => {
          console.log('Nueva notificación:', payload.new);
          setNotificaciones(prev => [payload.new, ...prev]);
          setUnreadCount(prev => prev + 1);
        }
      )
      .subscribe();

    // Cerrar al hacer clic fuera
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [user, perfil]);

  const fetchNotificaciones = async () => {
    try {
      const data = await getNotificaciones(perfil.id);
      setNotificaciones(data || []);
      setUnreadCount(data ? data.filter(n => !n.leido).length : 0);
    } catch (err) {
      console.error('Error cargando notificaciones:', err);
    }
  };

  const handleToggle = () => {
    setIsOpen(!isOpen);
    // Si cerramos, podríamos marcar todas como leídas opcionalmente
  };

  const handleMarkAsRead = async (id) => {
    try {
      await markAsRead(id);
      setNotificaciones(prev => prev.map(n => n.id === id ? { ...n, leido: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error(err);
    }
  };

  const handleReadAll = async () => {
    try {
      await markAllAsRead(perfil.id);
      setNotificaciones(prev => prev.map(n => ({ ...n, leido: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error(err);
    }
  };

  const getIcon = (tipo) => {
    switch (tipo) {
      case 'success': return <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><Check size={14} /></div>;
      case 'warning': return <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><AlertCircle size={14} /></div>;
      case 'error': return <div className="p-2 bg-rose-50 text-rose-600 rounded-lg"><X size={14} /></div>;
      default: return <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Info size={14} /></div>;
    }
  };

  const formatTime = (ts) => {
    const date = new Date(ts);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleToggle}
        className={`relative p-2.5 rounded-md transition-all duration-300 ${isOpen ? 'bg-brand-50 text-brand-600 shadow-inner' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}
      >
        <Bell size={22} className={unreadCount > 0 ? 'animate-swing' : ''} />
        {unreadCount > 0 && (
          <span className="absolute top-2 right-2.5 w-4 h-4 bg-rose-500 text-white text-[9px] font-black flex items-center justify-center rounded-full border-2 border-white animate-in zoom-in slide-in-from-top-1">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white rounded-[2rem] shadow-2xl border border-slate-100 overflow-hidden z-[100] animate-in fade-in zoom-in-95 slide-in-from-top-4 duration-200">
          <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Notificaciones</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleReadAll}
                className="text-[10px] font-black text-brand-600 hover:text-brand-700 uppercase tracking-widest transition-colors"
              >
                Marcar todo como leído
              </button>
            )}
          </div>

          <div className="max-h-[70vh] overflow-y-auto custom-scrollbar bg-white">
            {notificaciones.length === 0 ? (
              <div className="p-10 text-center flex flex-col items-center gap-3">
                <Bell size={40} className="text-slate-100" />
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Sin notificaciones nuevas</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {notificaciones.map((n) => (
                  <div
                    key={n.id}
                    className={`p-5 flex gap-4 transition-colors relative group ${n.leido ? 'opacity-60 grayscale-[0.5]' : 'bg-brand-50/20 hover:bg-brand-50/40'}`}
                  >
                    <div className="shrink-0">{getIcon(n.tipo)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className={`text-xs font-black truncate ${n.leido ? 'text-slate-600' : 'text-slate-900 uppercase tracking-tight'}`}>
                          {n.titulo}
                        </p>
                        <span className="text-[10px] font-bold text-slate-400 tabular-nums">
                          {formatTime(n.created_at)}
                        </span>
                      </div>
                      <p className={`text-[11px] leading-relaxed ${n.leido ? 'text-slate-400' : 'text-slate-600 font-medium'}`}>
                        {n.mensaje}
                      </p>
                    </div>
                    {!n.leido && (
                      <button
                        onClick={() => handleMarkAsRead(n.id)}
                        className="opacity-0 group-hover:opacity-100 absolute right-2 top-2 p-2 hover:bg-brand-100 rounded-lg text-brand-600 transition-all"
                        title="Marcar como leída"
                      >
                        <Check size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {notificaciones.length > 0 && (
            <div className="p-3 bg-slate-50/50 text-center border-t border-slate-100">
              <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest leading-none">Desarrollado con Sercosys Pulse 2.0</span>
            </div>
          )}
        </div>
      )}

      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes swing {
          0%, 100% { transform: rotate(0deg); }
          20% { transform: rotate(15deg); }
          40% { transform: rotate(-10deg); }
          60% { transform: rotate(5deg); }
          80% { transform: rotate(-5deg); }
        }
        .animate-swing {
          animation: swing 2s ease-in-out infinite;
          transform-origin: top center;
        }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}} />
    </div>
  );
}
