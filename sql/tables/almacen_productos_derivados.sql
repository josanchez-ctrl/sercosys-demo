-- Propósito: Relación de productos origen (insumos) y sus correspondientes subproductos o cortes válidos (derivados)
-- Última modificación: 2026-05-27

CREATE TABLE IF NOT EXISTS public.almacen_productos_derivados (
  id                   int8        PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  id_producto_origen   int8        NOT NULL REFERENCES public.almacen_productos(id) ON DELETE CASCADE,
  id_producto_destino  int8        NOT NULL REFERENCES public.almacen_productos(id) ON DELETE CASCADE,
  porcentaje_costo     numeric     NOT NULL DEFAULT 0.00,
  porcentaje_corte     numeric     NOT NULL DEFAULT 0.00,
  
  -- Auditoría (Estándar Sercosys)
  timestamp_create     timestamptz NOT NULL,
  id_usuario_create    int8        REFERENCES public.usuarios(id),
  
  CONSTRAINT uq_producto_origen_destino UNIQUE (id_producto_origen, id_producto_destino),
  CONSTRAINT chk_porcentaje_costo CHECK (porcentaje_costo >= 0 AND porcentaje_costo <= 100)
);

-- Seguridad RLS
ALTER TABLE public.almacen_productos_derivados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acceso total a usuarios autenticados" 
ON public.almacen_productos_derivados 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
