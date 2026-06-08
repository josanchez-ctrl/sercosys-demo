-- Propósito: Obtener fecha/hora actual en zona horaria de Caracas
-- Última modificación: 2026-05-04

CREATE OR REPLACE FUNCTION public.get_current_time_caracas()
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
AS $function$BEGIN
  RETURN NOW() AT TIME ZONE 'America/Caracas';
END;$function$
;
