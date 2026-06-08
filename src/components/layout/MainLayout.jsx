import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import {
  Briefcase, LogOut, ChefHat, PackageSearch, Users, Settings, Menu, ChevronDown,
  ChevronRight, UserCog, Building2, MapPin, Layers, UtensilsCrossed, GitBranch,
  ClipboardList, UserCheck, ShieldCheck, Shield, ClipboardCheck, Store, Package,
  ShoppingCart, ArrowRightFromLine, ListTree, BarChart3, Check, CalendarDays, ArrowLeftRight, Warehouse, Landmark
} from 'lucide-react';
import logoImage from '../../assets/logo_core.png';
import { getMenuForPerfil, menuConfig } from '../../config/menuConfig';
/* import NotificationBell from './NotificationBell'; */
import GlobalClientSelector from '../common/GlobalClientSelector';

// Mapa de íconos disponibles (deben coincidir con los 'icon' en menuConfig.js)
const ICONS = {
  Settings, PackageSearch, ChefHat, Users, UserCog, Warehouse, Landmark, Briefcase, Building2, MapPin,
  Layers, UtensilsCrossed, GitBranch, ClipboardList, UserCheck, ShieldCheck, Shield, ClipboardCheck,
  Store, Package, ShoppingCart, ArrowRightFromLine, ListTree, BarChart3, Check, CalendarDays
};

export default function MainLayout() {
  const { user, perfil, empresaActiva, signOut, resetEmpresa } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Extraer el módulo activo basándonos en la URL actual
  const [expandedModule, setExpandedModule] = useState(() => {
    if (location.pathname.startsWith('/configuracion')) return 'configuracion';
    return null;
  });

  // Proteger las rutas que usen este Layout
  useEffect(() => {
    if (!user) navigate('/login', { replace: true });
  }, [user, navigate]);

  // Si cambia la URL, asegurarnos de expandir el módulo correcto
  useEffect(() => {
    if (location.pathname.startsWith('/configuracion')) setExpandedModule('configuracion');
    //else if (location.pathname.startsWith('/comida')) setExpandedModule('comida');
    //else if (location.pathname.startsWith('/inventario')) setExpandedModule('inventario');
  }, [location.pathname]);

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  // Calcular menú visible para el usuario actual (se recalcula cuando cambia perfil o empresa)
  const visibleMenu = useMemo(() => getMenuForPerfil(perfil, empresaActiva), [perfil, empresaActiva]);

  // Calcular el título y descripción del navbar según la URL actual
  const { currentTitle, currentDescription } = useMemo(() => {
    /* if (location.pathname === '/home') {
      return { currentTitle: 'Panel Principal', currentDescription: 'Vista general y selección de módulos operativos.' };
    } */
    // Buscar en toda la config (no solo en el menú filtrado) para que no cambie si el perfil aún carga
    for (const module of menuConfig) {
      for (const func of module.functions) {
        if (func.path === location.pathname) {
          return { currentTitle: func.pageTitle || func.label, currentDescription: func.pageDescription || '' };
        }
      }
    }
    return { currentTitle: '', currentDescription: '' };
  }, [location.pathname]);

  const toggleModule = (moduleId) => {
    setExpandedModule(expandedModule === moduleId ? null : moduleId);
  };

  const handleNavigation = (path) => {
    navigate(path);
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Overlay para todas las resoluciones */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-gray-900/10 z-20 transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-30 w-80 bg-gradient-brand text-white transition-transform duration-500 ease-in-out flex flex-col shadow-2xl border-r border-white/5 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div
          onClick={() => handleNavigation('/home')}
          className="h-16 flex items-center gap-3 px-4 border-b border-brand-800 bg-brand-900/50 cursor-pointer hover:bg-brand-800 transition-colors"
        >
          <img src={logoImage} alt="SERCOSYS CORE" className="h-10 w-auto object-contain shadow-2xl transition-transform hover:scale-105" />
          <div className="flex flex-col">
            <span className="text-sm font-black tracking-tighter leading-none">SERCOSYS</span>
            <span className="text-[10px] font-black tracking-[0.2em] text-brand-300 leading-none mt-0.5">CORE</span>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto custom-scrollbar">
          {visibleMenu.map((module) => {
            const isExpanded = expandedModule === module.id;
            const IconComponent = ICONS[module.icon];

            return (
              <div key={module.id} className="space-y-1">
                {/* Botón Principal del Módulo */}
                <button
                  onClick={() => toggleModule(module.id)}
                  className={`w-full flex items-center justify-between px-0.5 py-2 rounded-lg transition-colors text-sm font-medium ${isExpanded
                    ? 'bg-brand-800 text-white'
                    : 'text-brand-100 hover:bg-brand-800 hover:text-white'
                    }`}
                >
                  <div className="flex items-center gap-1">
                    {IconComponent && <IconComponent size={20} className={isExpanded ? 'text-brand-accent' : 'text-brand-300'} />}
                    {module.label}
                  </div>
                  {module.functions.length > 0 && (
                    isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />
                  )}
                </button>

                {/* Submenú de Funciones */}
                {isExpanded && module.functions.length > 0 && (
                  <div className="pl-1 pr-2 space-y-1">
                    {module.functions.map((func) => {
                      const isActive = location.pathname === func.path;
                      const IconComponent = ICONS[func.icon];
                      return (
                        <button
                          key={func.id}
                          onClick={() => handleNavigation(func.path)}
                          className={`w-full flex items-center gap-2 px-1 py-1 rounded-md text-sm transition-colors ml-2 ${isActive
                            ? 'bg-brand-accent/20 text-brand-accent font-semibold'
                            : 'text-brand-300 hover:text-white hover:bg-brand-800/50'
                            }`}
                        >
                          {/* <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-brand-accent' : 'bg-current opacity-50'}`}></span> */}
                          {IconComponent ? (
                            <IconComponent size={12} className={isExpanded ? 'text-brand-accent' : 'text-brand-300'} />
                          ) : (
                            <div className="w-3 h-3 rounded-full bg-brand-700/50" />
                          )}
                          {func.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Perfil del Usuario y Cerrar Sesión en el fondo de la barra */}
        <div className="p-4 border-t border-brand-800">
          <div className="px-3 flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-brand-700 flex flex-shrink-0 items-center justify-center text-sm font-bold border border-brand-800">
              {user?.email?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs lg:text-sm font-medium text-white truncate">{user?.email}</p>
              <p className="text-[9px] lg:text-xs text-brand-400 truncate">{perfil?.nombres} {perfil?.apellidos}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-brand-200 hover:text-white hover:bg-brand-800 rounded-lg transition-colors border border-brand-800"
          >
            <LogOut size={16} />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Contenedor Derecho (Navbar + Content) */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Navbar Superior - Más compacto */}
        <header className="h-14 glass sticky top-0 flex items-center justify-between px-4 z-20">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:outline-none transition-colors"
            >
              <Menu size={24} />
            </button>
            {/* <div className="hidden sm:block">
              <h2 className="text-xl font-semibold text-gray-800 leading-tight">{currentTitle}</h2>
              {currentDescription && (
                <p className="text-xs text-gray-500">{currentDescription}</p>
              )}
            </div> */}
          </div>

          <div className="flex items-center gap-4">
            {empresaActiva && (
              <button
                onClick={() => {
                  resetEmpresa();
                  navigate('/home');
                }}
                title="Cambiar de Empresa"
                className="p-2.5 bg-slate-50 text-slate-400 hover:text-brand-900 hover:bg-brand-50 rounded-xl transition-all border border-slate-100 flex items-center gap-2 group"
              >
                <ArrowLeftRight size={18} className="group-hover:rotate-180 transition-transform duration-500" />
                <span className="hidden lg:block text-[10px] font-black uppercase tracking-widest">Cambiar Empresa</span>
              </button>
            )}
            <GlobalClientSelector />
            {/* <NotificationBell /> */}
          </div>
        </header>

        {/* Aquí se inyectan dinámicamente las Rutas (Páginas hijas) */}
        <main className="flex-1 overflow-y-auto bg-slate-50/50 rounded-tl-md shadow-inner border-t border-l border-white/50 animate-in fade-in slide-in-from-bottom-2 duration-500 p-2">
          <Outlet />
        </main>

      </div>
    </div>
  );
}
