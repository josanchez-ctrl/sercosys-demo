-- Propósito: Resolver un código de barras para obtener producto y factor de conversión con soporte para peso variable
-- Última modificación: 2026-06-06 - Se agrega peso_variable al retorno jsonb

CREATE OR REPLACE FUNCTION public.fn_resolver_codigo_barras(p_id_empresa int8, p_codigo text)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_result jsonb;
END;
$$;

-- Nota: Recreación de la función limpia
DROP FUNCTION IF EXISTS public.fn_resolver_codigo_barras(int8, text);

CREATE OR REPLACE FUNCTION public.fn_resolver_codigo_barras(p_id_empresa int8, p_codigo text)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_result jsonb;
BEGIN
    -- 1. Intentar resolver por código de barras o código interno en la tabla de códigos logísticos
    SELECT jsonb_build_object(
        'id_producto', p.id,
        'rubro', r.nombre,
        'marca', m.nombre,
        'variedad', p.variedad,
        'id_presentacion_logistica', pc.id,
        'id_presentacion', pc.id_presentacion,
        'nombre_presentacion', ap.nombre,
        'factor', pc.factor,
        'id_unidad_medida', r.id_unidad_medida,
        'unidad', u.abreviatura,
        'maneja_lote', p.maneja_lote,
        'peso_variable', p.peso_variable,
        'codigo_barras', pc.codigo_barras,
        'codigo_interno', pc.codigo_interno
    ) INTO v_result
    FROM public.almacen_productos_codigos pc
    JOIN public.almacen_productos p ON pc.id_producto = p.id
    JOIN public.almacen_presentaciones ap ON pc.id_presentacion = ap.id
    JOIN public.almacen_rubros r ON p.id_rubro = r.id
    LEFT JOIN public.almacen_marcas m ON p.id_marca = m.id
    JOIN public.almacen_unidades_medida u ON r.id_unidad_medida = u.id
    WHERE pc.id_empresa = p_id_empresa
      AND (pc.codigo_barras = p_codigo OR pc.codigo_interno = p_codigo)
      AND pc.estatus = true
      AND p.estatus = true;

    -- 2. Si no se encuentra, buscar por tracking_id en inventario
    IF v_result IS NULL THEN
        SELECT jsonb_build_object(
            'id_producto', i.id_producto,
            'rubro', r.nombre,
            'marca', m.nombre,
            'variedad', p.variedad,
            'id_presentacion_logistica', COALESCE(i.id_presentacion_logistica, cd.id_presentacion_logistica),
            'id_presentacion', pc.id_presentacion,
            'nombre_presentacion', ap.nombre,
            'factor', pc.factor,
            'id_unidad_medida', r.id_unidad_medida,
            'unidad', u.abreviatura,
            'maneja_lote', p.maneja_lote,
            'peso_variable', p.peso_variable,
            'codigo_barras', pc.codigo_barras,
            'codigo_interno', pc.codigo_interno,
            'lote', i.lote,
            'tracking_id', i.tracking_id
        ) INTO v_result
        FROM public.almacen_inventario i
        JOIN public.almacen_productos p ON i.id_producto = p.id
        JOIN public.almacen_rubros r ON p.id_rubro = r.id
        LEFT JOIN public.almacen_marcas m ON p.id_marca = m.id
        JOIN public.almacen_unidades_medida u ON r.id_unidad_medida = u.id
        -- Obtener la presentación desde el inventario, cotejo original o presentación base del producto
        LEFT JOIN public.almacen_cotejo_detalle cd ON i.id_cotejo_detalle = cd.id
        LEFT JOIN public.almacen_productos_codigos pc ON pc.id = COALESCE(
            i.id_presentacion_logistica, 
            cd.id_presentacion_logistica,
            (SELECT id FROM public.almacen_productos_codigos WHERE id_producto = i.id_producto AND es_base = true LIMIT 1)
        )
        LEFT JOIN public.almacen_presentaciones ap ON pc.id_presentacion = ap.id
        WHERE i.id_empresa = p_id_empresa
          AND i.tracking_id = p_codigo
          AND i.cantidad_actual > 0;
    END IF;

    RETURN v_result;
END;
$$;
