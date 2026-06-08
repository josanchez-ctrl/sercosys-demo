-- Tabla de Tareas de Almacén (Warehouse Tasks)
-- Propósito: Gestionar movimientos físicos de inventario (Putaway, Picking, Internos)
-- Creado: 2026-05-07

CREATE TABLE public.almacen_tareas (
  id                   int8        PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  id_empresa           int8        NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  id_almacen           int8        NOT NULL REFERENCES public.almacenes(id) ON DELETE CASCADE,
  tipo_tarea           text        NOT NULL, -- 'PUTAWAY' (Entrada), 'PICKING' (Salida), 'REUBICACION' (Interno)
  id_item_inventario   int8        NOT NULL REFERENCES public.almacen_inventario(id) ON DELETE CASCADE,
  id_ubicacion_origen  int8        NOT NULL REFERENCES public.almacen_ubicaciones(id),
  id_ubicacion_destino int8        REFERENCES public.almacen_ubicaciones(id), -- Puede ser NULL al inicio del Putaway
  cantidad             numeric     NOT NULL,
  estatus              text        NOT NULL DEFAULT 'PENDIENTE', -- 'PENDIENTE', 'CONFIRMADA', 'CANCELADA'
  prioridad            int4        NOT NULL DEFAULT 1,
  
  -- Auditoría
  timestamp_create     timestamptz NOT NULL,
  timestamp_confirm    timestamptz,
  id_usuario_create    int8        REFERENCES public.usuarios(id),
  id_usuario_confirm   int8        REFERENCES public.usuarios(id)
);

COMMENT ON COLUMN public.almacen_tareas.tipo_tarea IS 'Tipo de movimiento: PUTAWAY (Hacia Rack), PICKING (Hacia Despacho), REUBICACION (Entre Racks)';
COMMENT ON COLUMN public.almacen_tareas.estatus IS 'Estado del movimiento: PENDIENTE (Esperando ejecución), CONFIRMADA (Movimiento físico realizado), CANCELADA (Tarea anulada)';

-- Seguridad RLS
ALTER TABLE public.almacen_tareas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acceso total a usuarios autenticados" 
ON public.almacen_tareas 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
