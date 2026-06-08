/**
 * Configuración del menú de navegación lateral.
 *
 * Cada función tiene:
 *   - perms: Array de columnas booleanas del perfil para visibilidad.
 *   - actions: Matriz de acciones con id (F_x) y label personalizado.
 */
export const menuConfig = [
  //Configuración
  {
    id: 'configuracion',
    label: 'Configuración',
    icon: 'Settings',
    functions: [
      {
        id: 'configuracion-empresas',
        label: 'Empresas',
        icon: 'ArrowRightFromLine',
        path: '/configuracion/empresas',
        pageDescription: 'Gestión de empresas y organizaciones corporativas.',
        perms: ['F_ALL'],
        actions: []
      }
    ]
  },
  //Recursos Humanos
  {
    id: 'recursos-humanos',
    label: 'Recursos Humanos',
    icon: 'Users',
    functions: [
      {
        id: 'recursos-humanos-departamentos',
        label: 'Departamentos',
        icon: 'ArrowRightFromLine',
        path: '/recursos-humanos/departamentos',
        pageDescription: 'Gestión de Departamentos.',
        perms: ['F_ALL'],
        actions: []
      }
    ]
  },
  //Comercialización
  {
    id: 'comercializacion',
    label: 'Comercialización',
    icon: 'Briefcase',
    functions: [
      {
        id: 'comercializacion-clientes',
        label: 'Clientes',
        icon: 'ArrowRightFromLine',
        path: '/comercializacion/clientes',
        pageDescription: 'Gestión de Clientes Internos y Externos.',
        perms: ['F_ALL'],
        actions: []
      },
      {
        id: 'comercializacion-sucursales',
        label: 'Sucursales',
        icon: 'ArrowRightFromLine',
        path: '/comercializacion/sucursales',
        pageDescription: 'Gestión de sedes y locaciones de servicio.',
        perms: ['F_ALL'],
        actions: []
      },
      {
        id: 'comercializacion-tipos-servicios',
        label: 'Tipos de Servicios',
        icon: 'ArrowRightFromLine',
        path: '/comercializacion/tipos-servicios',
        pageDescription: 'Gestión de Tipos de Servicios.',
        perms: ['F_ALL'],
        actions: []
      },
      {
        id: 'comercializacion-receta-tipologias',
        label: 'Tipologías de Recetas',
        icon: 'ArrowRightFromLine',
        path: '/comercializacion/receta-tipologias',
        pageDescription: 'Categorías de recetas (Aves, Res, etc).',
        perms: ['F_ALL'],
        actions: []
      },
      {
        id: 'comercializacion-estructura-menu',
        label: 'Clasificación por Tipo de Servicio',
        icon: 'ArrowRightFromLine',
        path: '/comercializacion/estructura-menu',
        pageDescription: 'Definición de composición de menús por nivel.',
        perms: ['F_ALL'],
        actions: []
      },
      {
        id: 'comercializacion-comedores',
        label: 'Comedores',
        icon: 'ArrowRightFromLine',
        path: '/comercializacion/comedores',
        pageDescription: 'Gestión de comedores por sucursal.',
        perms: ['F_ALL'],
        actions: []
      },
    ]
  },
  //Operaciones
  {
    id: 'operaciones',
    label: 'Operaciones',
    icon: 'ClipboardList',
    functions: [
      {
        id: 'operaciones-maestro-recetas',
        label: 'Maestro de Recetas',
        icon: 'ArrowRightFromLine',
        path: '/operaciones/recetas',
        pageDescription: 'Fichas técnicas and composición de platos.',
        perms: ['F_ALL'],
        actions: []
      },
      {
        id: 'operaciones-verificacion-planificacion',
        label: 'Verificación Planificación',
        icon: 'ShieldCheck',
        path: '/operaciones/verificacion-planificacion',
        pageDescription: 'Aprobación y verificación de menús semanales por gerencia.',
        perms: ['F_ALL'],
        actions: []
      },
      {
        id: 'operaciones-requisiciones-almacenes',
        label: 'Requisiciones Almacenes',
        icon: 'ShoppingCart',
        path: '/operaciones/requisiciones-almacenes',
        pageDescription: 'Gestión y anulación de requisiciones de insumos.',
        perms: ['F_ALL'],
        actions: []
      }
    ]
  },
  //Operaciones Comedor
  {
    id: 'operaciones-comedor',
    label: 'Operaciones Comedor',
    icon: 'ChefHat',
    functions: [
      {
        id: 'operaciones-comedor-planificacion',
        label: 'Planificación de Menú',
        icon: 'CalendarDays',
        path: '/operaciones-comedor/planificacion',
        pageDescription: 'Planificación semanal de menús e insumos operativos.',
        perms: ['F_ALL'],
        actions: []
      },
      {
        id: 'operaciones-comedor-requisiciones',
        label: 'Requisiciones Comedor',
        icon: 'ClipboardList',
        path: '/operaciones-comedor/requisiciones',
        pageDescription: 'Consulta de estatus de requisiciones solicitadas.',
        perms: ['F_ALL'],
        actions: []
      },
      {
        id: 'operaciones-comedor-ejecucion',
        label: 'Ejecución Diaria',
        icon: 'ChefHat',
        path: '/operaciones-comedor/ejecucion',
        pageDescription: 'Aprobación diaria de menús y generación de demandas internas.',
        perms: ['F_ALL'],
        actions: []
      }
    ]
  },
  //Almacenes Principales
  {
    id: 'almacenes-principales',
    label: 'Almacenes Principales',
    icon: 'Warehouse',
    functions: [
      {
        id: 'almacenes-principales-marca',
        label: 'Marca',
        icon: 'ArrowRightFromLine',
        path: '/almacenes-principales/marca',
        pageDescription: 'Definición de Renglones por Servicio',
        perms: ['F_ALL'],
        actions: []
      },
      {
        id: 'almacenes-principales-categoria',
        label: 'Categorias',
        icon: 'ArrowRightFromLine',
        path: '/almacenes-principales/categoria',
        pageDescription: 'Gestión de Categorias.',
        perms: ['F_ALL'],
        actions: []
      },
      {
        id: 'almacenes-principales-unidades-medida',
        label: 'Unidades de Medida',
        icon: 'ArrowRightFromLine',
        path: '/almacenes-principales/unidades-medida',
        pageDescription: 'Guardar Clasificación',
        perms: ['F_ALL'],
        actions: []
      },
      {
        id: 'almacenes-principales-presentacion',
        label: 'Presentación',
        icon: 'ArrowRightFromLine',
        path: '/almacenes-principales/presentacion',
        pageDescription: 'Gestión de Presentación.',
        perms: ['F_ALL'],
        actions: []
      },
      {
        id: 'almacenes-principales-rubro',
        label: 'Rubro',
        icon: 'ArrowRightFromLine',
        path: '/almacenes-principales/rubro',
        pageDescription: 'Gestión de Rubro.',
        perms: ['F_ALL'],
        actions: []
      },
      {
        id: 'almacenes-principales-productos',
        label: 'Productos',
        icon: 'ArrowRightFromLine',
        path: '/almacenes-principales/productos',
        pageDescription: 'Gestión de Productos.',
        perms: ['F_ALL'],
        actions: []
      },
      {
        id: 'almacenes-principales-cotejo',
        label: 'Cotejo',
        icon: 'ArrowRightFromLine',
        path: '/almacenes-principales/cotejo',
        pageDescription: 'Gestión de Cotejo entre productos.',
        perms: ['F_ALL'],
        actions: []
      },
      {
        id: 'almacenes-principales-recepcion',
        label: 'Recepción',
        icon: 'ArrowRightFromLine',
        path: '/almacenes-principales/recepcion',
        pageDescription: 'Gestión de Recepción.',
        perms: ['F_ALL'],
        actions: []
      },
      {
        id: 'almacenes-principales-monitor-demandas',
        label: 'Monitor de Demandas',
        icon: 'ArrowRightFromLine',
        path: '/almacenes-principales/monitor-demandas',
        pageDescription: 'Supervisión centralizada de requisiciones por almacén y origen.',
        perms: ['F_ALL'],
        actions: []
      },
      {
        id: 'almacenes-principales-picking',
        label: 'Picking',
        icon: 'ArrowRightFromLine',
        path: '/almacenes-principales/picking',
        pageDescription: 'Gestión de Picking.',
        perms: ['F_ALL'],
        actions: []
      },
      {
        id: 'almacenes-principales-despacho',
        label: 'Despacho',
        icon: 'ArrowRightFromLine',
        path: '/almacenes-principales/despacho',
        pageDescription: 'Gestión de Despacho de mercancía.',
        perms: ['F_ALL'],
        actions: []
      },
      {
        id: 'almacenes-principales-inventario',
        label: 'Inventario',
        icon: 'ArrowRightFromLine',
        path: '/almacenes-principales/inventario',
        pageDescription: 'Gestión de Inventario.',
        perms: ['F_ALL'],
        actions: []
      },
      {
        id: 'almacenes-principales-reenvasado',
        label: 'Reenvasado',
        icon: 'ArrowRightFromLine',
        path: '/almacenes-principales/reenvasado',
        pageDescription: 'Fraccionamiento y reempacado de lotes a granel.',
        perms: ['F_ALL'],
        actions: []
      },
      {
        id: 'almacenes-principales-ubicaciones',
        label: 'Gestión de Racks',
        icon: 'MapPin',
        path: '/almacenes-principales/ubicaciones',
        pageDescription: 'Mantenimiento de Racks y Estructura de Almacén.',
        perms: ['F_ALL'],
        actions: []
      },
      {
        id: 'almacenes-principales-monitor-ubicacion',
        label: 'Ubicar Mercancía (Put-away)',
        icon: 'ArrowRightFromLine',
        path: '/almacenes-principales/ubicacion-racks',
        pageDescription: 'Operación de guardado de productos en racks desde recepción.',
        perms: ['F_ALL'],
        actions: []
      },
      {
        id: 'almacenes-principales-despote',
        label: 'Despote / Procesamiento',
        icon: 'Layers',
        path: '/almacenes-principales/despote',
        pageDescription: 'Procesamiento de carne, cortes de valor, mermas y balance de masa.',
        perms: ['F_ALL'],
        actions: []
      }

    ]
  },
  //Almacenes Comedores
  {
    id: 'almacenes-comedores',
    label: 'Almacenes Comedores',
    icon: 'Warehouse',
    functions: [
      {
        id: 'almacenes-comedores-recepcion',
        label: 'Recepción',
        icon: 'ArrowRightFromLine',
        path: '/almacenes-comedores/recepcion',
        pageDescription: 'Recepción de productos.',
        perms: ['F_ALL'],
        actions: []
      },
      {
        id: 'almacenes-comedores-despacho',
        label: 'Despacho Demanda',
        icon: 'ArrowRightFromLine',
        path: '/almacenes-comedores/despacho',
        pageDescription: 'Gestión de picking y despacho interno del comedor a cocina.',
        perms: ['F_ALL'],
        actions: []
      },
      {
        id: 'almacenes-comedores-inventario',
        label: 'Inventario',
        icon: 'ArrowRightFromLine',
        path: '/almacenes-comedores/inventario',
        pageDescription: 'Gestión de inventario en el comedor.',
        perms: ['F_ALL'],
        actions: []
      }
    ]
  },
  //Operaciones Cocina
  {
    id: 'operaciones-cocina',
    label: 'Operaciones Cocina',
    icon: 'ChefHat',
    functions: [
      {
        id: 'operaciones-cocina-recepcion',
        label: 'Recepción',
        icon: 'ArrowRightFromLine',
        path: '/operaciones-cocina/recepcion',
        pageDescription: 'Recepción de productos.',
        perms: ['F_ALL'],
        actions: []
      },
      {
        id: 'operaciones-cocina-inventario',
        label: 'Inventario de Cocina',
        icon: 'ArrowRightFromLine',
        path: '/operaciones-cocina/inventario',
        pageDescription: 'Gestión de existencias y auditoría de movimientos en despensa de cocina.',
        perms: ['F_ALL'],
        actions: []
      },
      {
        id: 'operaciones-cocina-despacho',
        label: 'Despacho de Alimentos',
        icon: 'ArrowRightFromLine',
        path: '/operaciones-cocina/despacho',
        pageDescription: 'Despacho y control logístico de comidas elaboradas y utensilios.',
        perms: ['F_ALL'],
        actions: []
      }
    ]
  },
  //Compras
  {
    id: 'compras',
    label: 'Compras',
    icon: 'ChefHat',
    functions: [
      {
        id: 'compras-proveedores',
        label: 'Proveedores',
        icon: 'ArrowRightFromLine',
        path: '/compras/proveedores',
        pageDescription: 'Gestión de Proveedores.',
        perms: ['F_ALL'],
        actions: []
      }
    ]
  },
  //Finanzas
  {
    id: 'finanzas',
    label: 'Finanzas',
    icon: 'Landmark',
    functions: [
      {
        id: 'finanzas-activos',
        label: 'Activos',
        icon: 'ArrowRightFromLine',
        path: '/finanzas/activos',
        pageDescription: 'Gestión de Activos.',
        perms: ['F_ALL'],
        actions: []
      }
    ]
  }

];

export function hasAccess(perfil, perms) {
  if (!perms || perms.length === 0) return true;
  if (!perfil) return false;
  return perms.some(perm => perfil[perm] === true);
}

export function getMenuForPerfil(perfil, empresaActiva) {
  const idsFuncionesEmpresa = empresaActiva?.ids_funciones;
  const tieneFiltroEmpresa = Array.isArray(idsFuncionesEmpresa);
  const sinEmpresa = !empresaActiva?.id;

  return menuConfig
    .map(module => {
      const esModuloConfig = module.id === 'configuracion';

      // Si no hay empresa activa y no es el módulo de configuración, ocultar funciones
      if (sinEmpresa && !esModuloConfig) {
        return { ...module, functions: [] };
      }

      const functions = module.functions.filter(func => {
        const canUser = hasAccess(perfil, func.perms);
        const canEmpresa = esModuloConfig || !tieneFiltroEmpresa || idsFuncionesEmpresa.includes(func.id);
        return canUser && canEmpresa;
      });

      return { ...module, functions };
    })
    .filter(module => module.functions.length > 0);
}
