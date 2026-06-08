import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import Login from './pages/Login'
import MainLayout from './components/layout/MainLayout'
import Home from './pages/Home'

// Configuración
import GestionEmpresas from './pages/configuracion/empresas/GestionEmpresas'

// Comercialización
import GestionClientes from './pages/comercializacion/clientes/GestionClientes'
import GestionSucursales from './pages/comercializacion/sucursales/GestionSucursales'
import GestionComedores from './pages/comercializacion/comedores/GestionComedores'
import GestionTiposServicios from './pages/comercializacion/tipos-servicios/GestionTiposServicios'
import GestionRecetaTipologias from './pages/comercializacion/receta-tipologias/GestionRecetaTipologias'
import GestionEstructuraMenu from './pages/comercializacion/estructura-menu/GestionEstructuraMenu'

// Operaciones
import GestionRecetas from './pages/operaciones/recetas/GestionRecetas'
import GestionVerificacionPlanificacion from './pages/operaciones/verificacion-planificacion/GestionVerificacionPlanificacion'
import GestionRequisicionesAlmacen from './pages/operaciones/requisiciones-almacenes/GestionRequisicionesAlmacen'

// Operaciones Comedor
import GestionPlanificacion from './pages/operaciones-comedor/planificacion/GestionPlanificacion'
import GestionRequisicionesComedor from './pages/operaciones-comedor/requisiciones/GestionRequisicionesComedor'
import GestionEjecucion from './pages/operaciones-comedor/ejecucion/GestionEjecucion'

//Almacenes Principales
import GestionMarca from './pages/almacenes-principales/marca/GestionMarca'
import GestionCategoria from './pages/almacenes-principales/categoria/GestionCategoria'
import GestionUnidadesMedida from './pages/almacenes-principales/unidades-medida/GestionUnidadesMedida'
import GestionPresentacion from './pages/almacenes-principales/presentacion/GestionPresentacion'
import GestionRubro from './pages/almacenes-principales/rubro/GestionRubro'
import GestionProductos from './pages/almacenes-principales/producto/GestionProductos'
import GestionCotejo from './pages/almacenes-principales/cotejo/GestionCotejo'
import GestionRecepcion from './pages/almacenes-principales/recepcion/GestionRecepcion'
import GestionPicking from './pages/almacenes-principales/picking/GestionPicking'
import GestionDespacho from './pages/almacenes-principales/despacho/GestionDespacho'
import GestionInventario from './pages/almacenes-principales/inventario/GestionInventario'
import MonitorDemandas from './pages/almacenes-principales/monitor-demandas/MonitorDemandas'
import GestionUbicaciones from './pages/almacenes-principales/ubicaciones/GestionUbicaciones'
import MonitorUbicacion from './pages/almacenes-principales/ubicacion/MonitorUbicacion'
import GestionReenvasado from './pages/almacenes-principales/reenvasado/GestionReenvasado'
import GestionDespote from './pages/almacenes-principales/despote/GestionDespote'

// Almacenes Comedores
import GestionRecepcionComedor from './pages/almacenes-comedores/recepcion/GestionRecepcionComedor'
import GestionDespachoComedor from './pages/almacenes-comedores/despacho/GestionDespachoComedor'
import GestionInventarioComedor from './pages/almacenes-comedores/inventario/GestionInventarioComedor'

//Operaciones Cocina
import GestionRecepcionCocina from './pages/operaciones-cocina/recepcion/GestionRecepcionCocina'
import GestionInventarioCocina from './pages/operaciones-cocina/inventario/GestionInventarioCocina'
import GestionDespachoAlimentos from './pages/operaciones-cocina/despacho-alimentos/GestionDespachoAlimentos'

// Recursos Humanos
import GestionDepartamentos from './pages/recursos-humanos/departamentos/GestionDepartamentos'

// Finanzas (Activos)
import GestionActivos from './pages/finanzas/activos/GestionActivos'

//Compras
import GestionProveedor from './pages/compras/proveedor/GestionProveedor'

//Placeholder
import Placeholder from './pages/Placeholder'

import NetworkStatusGuard from './components/common/NetworkStatusGuard'

function App() {
  return (
    <NetworkStatusGuard>
      <Toaster richColors position="top-right" />
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />

        {/* Rutas Privadas / Operativas */}
        <Route element={<MainLayout />}>
          <Route path="/home" element={<Home />} />

          {/* Módulo: Configuración */}
          <Route path="/configuracion/empresas" element={<GestionEmpresas />} />

          {/* Módulo: Comercialización */}
          <Route path="/comercializacion/clientes" element={<GestionClientes />} />
          <Route path="/comercializacion/sucursales" element={<GestionSucursales />} />
          <Route path="/comercializacion/comedores" element={<GestionComedores />} />
          <Route path="/comercializacion/tipos-servicios" element={<GestionTiposServicios />} />
          <Route path="/comercializacion/receta-tipologias" element={<GestionRecetaTipologias />} />
          <Route path="/comercializacion/estructura-menu" element={<GestionEstructuraMenu />} />

          {/* Módulo: Operaciones */}
          <Route path="/operaciones/recetas" element={<GestionRecetas />} />

          <Route path="/operaciones/verificacion-planificacion" element={<GestionVerificacionPlanificacion />} />
          <Route path="/operaciones/requisiciones-almacenes" element={<GestionRequisicionesAlmacen />} />

          {/* Módulo: Operaciones Comedor */}
          <Route path="/operaciones-comedor/planificacion" element={<GestionPlanificacion />} />
          <Route path="/operaciones-comedor/requisiciones" element={<GestionRequisicionesComedor />} />
          <Route path="/operaciones-comedor/ejecucion" element={<GestionEjecucion />} />

          {/* Módulo: Almacenes Comedores */}
          <Route path="/almacenes-comedores/recepcion" element={<GestionRecepcionComedor />} />
          <Route path="/almacenes-comedores/despacho" element={<GestionDespachoComedor />} />
          <Route path="/almacenes-comedores/inventario" element={<GestionInventarioComedor />} />

          {/* Módulo: Almacenes Principales */}
          <Route path="/almacenes-principales/marca" element={<GestionMarca />} />
          <Route path="/almacenes-principales/categoria" element={<GestionCategoria />} />
          <Route path="/almacenes-principales/unidades-medida" element={<GestionUnidadesMedida />} />
          <Route path="/almacenes-principales/presentacion" element={<GestionPresentacion />} />
          <Route path="/almacenes-principales/rubro" element={<GestionRubro />} />
          <Route path="/almacenes-principales/productos" element={<GestionProductos />} />
          <Route path="/almacenes-principales/cotejo" element={<GestionCotejo />} />
          <Route path="/almacenes-principales/recepcion" element={<GestionRecepcion />} />
          <Route path="/almacenes-principales/picking" element={<GestionPicking />} />
          <Route path="/almacenes-principales/despacho" element={<GestionDespacho />} />
          <Route path="/almacenes-principales/monitor-demandas" element={<MonitorDemandas />} />
          <Route path="/almacenes-principales/inventario" element={<GestionInventario />} />
          <Route path="/almacenes-principales/reenvasado" element={<GestionReenvasado />} />
          <Route path="/almacenes-principales/despote" element={<GestionDespote />} />
          <Route path="/almacenes-principales/ubicaciones" element={<GestionUbicaciones />} />
          <Route path="/almacenes-principales/ubicacion-racks" element={<MonitorUbicacion />} />

          {/* Módulo: Operaciones Cocina */}
          <Route path="/operaciones-cocina/recepcion" element={<GestionRecepcionCocina />} />
          <Route path="/operaciones-cocina/inventario" element={<GestionInventarioCocina />} />
          <Route path="/operaciones-cocina/despacho" element={<GestionDespachoAlimentos />} />

          {/* Módulo: Compras */}
          <Route path="/compras/proveedores" element={<GestionProveedor />} />

          {/* Módulo: Recursos Humanos */}
          <Route path="/recursos-humanos/departamentos" element={<GestionDepartamentos />} />

          {/* Módulo: Finanzas (Activos) */}
          <Route path="/finanzas/activos" element={<GestionActivos />} />

        </Route>
      </Routes>
    </NetworkStatusGuard>
  )
}

export default App
