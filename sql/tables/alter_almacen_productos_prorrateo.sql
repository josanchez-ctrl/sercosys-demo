-- Propósito: Agregar propiedad costo_proporcional_peso en la tabla almacen_productos para definir el método de prorrateo
-- Última modificación: 2026-06-02

ALTER TABLE public.almacen_productos 
ADD COLUMN costo_proporcional_peso boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.almacen_productos.costo_proporcional_peso 
IS 'True si los costos unitarios de los derivados se calculan proporcionalmente al peso comercial neto obtenido (heredando el costo base del insumo), ideal para cortes/deshuese.';
