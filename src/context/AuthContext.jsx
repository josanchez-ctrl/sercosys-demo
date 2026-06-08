import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getEmpresaById } from '../services/empresaService';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [loading, setLoading] = useState(true);
  const [clienteActivo, setEmpresaActivo] = useState(() => {
    return localStorage.getItem('sercosys_active_client') || null;
  });
  const [empresaActiva, setEmpresaActiva] = useState(null);
  const [isAuthRestored, setIsAuthRestored] = useState(false);

  // Función para traer el perfil (no bloquea la pantalla)
  const fetchUserProfile = async (userId) => {

    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id_auth', userId)
        .single();

      if (error) {
        console.error("Error obteniendo perfil:", error.message);
        return null;
      }
      return data;
    } catch (e) {
      console.error("Excepción en fetchUserProfile:", e);
      return null;
    }
  };

  const cambiarEmpresa = async (clienteId) => {
    try {
      const data = await getEmpresaById(clienteId);
      if (data && data.id) {
        setEmpresaActivo(clienteId);
        setEmpresaActiva(data);
        localStorage.setItem('sercosys_active_client', clienteId);
      }
    } catch (e) {
      console.error("Error cambiando cliente:", e);
    }
  };

  const resetEmpresa = () => {
    setEmpresaActivo(null);
    setEmpresaActiva(null);
    localStorage.removeItem('sercosys_active_client');
  };

  const handleProfileLoaded = async (perfilData) => {
    setPerfil(perfilData);
    if (perfilData && perfilData.ids_clientes && perfilData.ids_clientes.length > 0) {
      const current = localStorage.getItem('sercosys_active_client');

      const savedId = current ? parseInt(current) : null;
      // Verificamos acceso
      const tieneAccesoAlGuardado = savedId && perfilData.ids_clientes.some(id => Number(id) === Number(savedId));

      if (tieneAccesoAlGuardado) {
        await cambiarEmpresa(savedId);
      } else if (perfilData.ids_clientes.length === 1) {
        await cambiarEmpresa(perfilData.ids_clientes[0]);
      }
    }
    setIsAuthRestored(true);
  };

  useEffect(() => {
    // Paso 1: Obtener la sesión rápidamente y desbloquear la pantalla
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user || null);
      setLoading(false);

      // Paso 2: Cargar el perfil y empresa en background
      if (session?.user) {
        fetchUserProfile(session.user.id).then(handleProfileLoaded);
      } else {
        setIsAuthRestored(true);
      }
    }).catch((e) => {
      console.error("Error en getSession:", e);
      setLoading(false);
      setIsAuthRestored(true);
    });

    // Listener de cambios de sesión (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user || null);

      if (session?.user) {
        fetchUserProfile(session.user.id).then(handleProfileLoaded);
      } else {
        setPerfil(null);
        setEmpresaActiva(null);
        setIsAuthRestored(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Paso 3: Mantener el perfil sincronizado en tiempo real para reflejar cambios de permisos inmediatamente
  useEffect(() => {
    if (!perfil?.id) return;

    const channel = supabase
      .channel(`perfil-realtime-${perfil.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'usuarios',
          filter: `id=eq.${perfil.id}`
        },
        (payload) => {
          console.log("Perfil actualizado en tiempo real:", payload.new);
          setPerfil(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [perfil?.id]);

  const signIn = async (email, password) => {
    return await supabase.auth.signInWithPassword({ email, password });
  };

  const signOut = async () => {
    return await supabase.auth.signOut();
  };

  const value = { user, perfil, session, loading, isAuthRestored, clienteActivo, empresaActiva, cambiarEmpresa, resetEmpresa, signIn, signOut };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-brand-accent border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-gray-500 font-medium">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
