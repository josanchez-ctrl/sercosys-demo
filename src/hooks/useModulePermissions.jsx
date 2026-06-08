import React, { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { menuConfig, hasAccess } from '../config/menuConfig';
import SinEmpresa from '../components/layout/SinEmpresa';
import NoAcceso from '../components/layout/NoAcceso';

/**
 * Hook para gestionar permisos y contexto de empresa de forma centralizada.
 * Detecta automáticamente el requerimiento del módulo basado en la URL.
 */
export const useModulePermissions = () => {
  const { perfil, empresaActiva, isAuthRestored } = useAuth();
  const location = useLocation();

  // 1. Encontrar la función actual en la configuración del menú
  const currentFunc = useMemo(() => {
    for (const module of menuConfig) {
      const found = module.functions.find(f => f.path === location.pathname);
      if (found) return { ...found, moduleId: module.id };
    }
    return null;
  }, [location.pathname]);

  // 2. Determinar si es un módulo de configuración (estos no requieren empresaActiva)
  const esModuloConfig = currentFunc?.moduleId === 'configuracion';

  // 3. Validar permisos del perfil (F_ALL es maestro)
  const tienePermiso = useMemo(() => {
    if (!currentFunc) return true; // Rutas fuera del menú (como /home) se consideran libres o manejadas manualmente
    return hasAccess(perfil, currentFunc.perms);
  }, [perfil, currentFunc]);

  // 4. Validar si la empresa tiene esta función habilitada
  const empresaTieneFuncion = useMemo(() => {
    if (esModuloConfig || !empresaActiva?.ids_funciones) return true;
    return empresaActiva.ids_funciones.includes(currentFunc?.id);
  }, [empresaActiva, currentFunc, esModuloConfig]);

  /**
   * Valida un permiso específico adicional (ej: F_55 para editar)
   * @param {string} permCode - El código del permiso (ej: 'F_55')
   * @returns {boolean}
   */
  const tieneAccesoEspecifico = (permCode) => {
    if (!perfil) return false;
    return perfil.F_ALL === true || perfil[permCode] === true;
  };

  /**
   * Renderiza el guardia de seguridad si es necesario.
   * Uso: const guard = renderGuard(); if (guard) return guard;
   */
  const renderGuard = () => {
    // Si todavía estamos restaurando la auth/empresa tras un F5, no mostrar nada (o un pequeño loader)
    if (!isAuthRestored) return null;

    // Si no es config y no hay empresa
    if (!esModuloConfig && !empresaActiva) {
      return <SinEmpresa />;
    }

    // Si no tiene permiso de perfil o la empresa no tiene la función
    if (!tienePermiso || !empresaTieneFuncion) {
      return <NoAcceso />;
    }

    return null;
  };

  return {
    perfil,
    empresaActiva,
    tienePermiso,
    empresaTieneFuncion,
    renderGuard,
    tieneAccesoEspecifico,
    currentFunc
  };
};
