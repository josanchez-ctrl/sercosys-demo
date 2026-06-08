-- Propósito: Log de auditoría para cambios en tablas
-- Última modificación: 2026-05-04

CREATE OR REPLACE FUNCTION public.fn_auditoria_logs()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
  BEGIN
    IF TG_OP = 'INSERT' THEN
      INSERT INTO auditoria_logs (tabla_afectada, registro_id, accion,   datos_nuevos, id_usuario)
      VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', to_jsonb(NEW),
  NEW.id_usuario_create);
      RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
      INSERT INTO auditoria_logs (tabla_afectada, registro_id, accion,   datos_anteriores, datos_nuevos, id_usuario)
      VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', to_jsonb(OLD),
  to_jsonb(NEW), NEW.id_usuario_update);
      RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
      INSERT INTO auditoria_logs (tabla_afectada, registro_id, accion,   datos_anteriores, id_usuario)
      VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', to_jsonb(OLD),
  OLD.id_usuario_update);
      RETURN OLD;
    END IF;
  END;
  $function$
;
