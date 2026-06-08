-- Propósito: Registrar relaciones de derivación iniciales del Pollo Entero Congelado (Insumo ID: 54)
-- Hacia sus cortes derivados resultantes (Alas, Carcasa, Muslo, Pechuga, Piel, Pigostilo, Menudo)
-- Última modificación: 2026-05-27

INSERT INTO public.almacen_productos_derivados (id_producto_origen, id_producto_destino, porcentaje_costo, timestamp_create, id_usuario_create)
VALUES 
  (54, 55, 9.00, now(), 1),  -- Alas (9%)
  (54, 56, 2.00, now(), 1),  -- Carcasa (2%)
  (54, 57, 35.00, now(), 1), -- Muslo (35%)
  (54, 58, 52.00, now(), 1), -- Pechuga S/H (52%)
  (54, 59, 0.00, now(), 1),  -- Piel (0%)
  (54, 60, 0.00, now(), 1),  -- Pigostilo (0%)
  (54, 61, 2.00, now(), 1)   -- Menudo (2%)
ON CONFLICT (id_producto_origen, id_producto_destino) 
DO UPDATE SET porcentaje_costo = EXCLUDED.porcentaje_costo;
