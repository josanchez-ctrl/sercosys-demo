-- Propósito: Historial de cambios en el costo ponderado de los productos
-- Última modificación: 2026-05-05

CREATE TABLE public.almacen_productos_costos_historial (
  id int8 PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  id_empresa int8 NOT NULL REFERENCES public.empresas(id),
  id_producto int8 NOT NULL REFERENCES public.almacen_productos(id),
  costo_anterior numeric NOT NULL,
  costo_nuevo numeric NOT NULL,
  tipo_movimiento text NOT NULL, -- 'COTEJO', 'RECEPCION', 'AJUSTE'
  id_referencia int8, -- ID del documento que originó el cambio (ej. id_cotejo)
  -- Auditoría
  timestamp_create timestamptz NOT NULL,
  id_usuario_create int8 REFERENCES public.usuarios(id)
);

-- Seguridad RLS
ALTER TABLE public.almacen_productos_costos_historial ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acceso total a usuarios autenticados" 
ON public.almacen_productos_costos_historial 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
