-- =====================================================
-- Migration 16: Clean up mock/test data
-- Keeps: SOL-2026-0013 and its linked data, all users,
--        knowledge articles, form options, sessions
-- =====================================================

BEGIN;

-- 1. Get the solicitud ID to preserve
DO $$
DECLARE
  v_sol_id INTEGER;
  v_sol_solicitante_id INTEGER;
BEGIN
  SELECT id, solicitante_id INTO v_sol_id, v_sol_solicitante_id
  FROM solicitudes WHERE codigo = 'SOL-2026-0013';

  IF v_sol_id IS NULL THEN
    RAISE NOTICE 'SOL-2026-0013 not found, cleaning ALL data';
  ELSE
    RAISE NOTICE 'Preserving SOL-2026-0013 (id=%, solicitante_id=%)', v_sol_id, v_sol_solicitante_id;
  END IF;
END $$;

-- 2. Delete implementation tasks (FK → proyectos)
DELETE FROM implementacion_tareas;

-- 3. Delete project costs (FK → proyectos)
DELETE FROM proyecto_costos;

-- 4. Delete project pauses (FK → proyectos)
DELETE FROM proyecto_pausas;

-- 5. Delete project tasks (FK → proyectos)
DELETE FROM proyecto_tareas;

-- 6. Delete project members (FK → proyectos)
DELETE FROM proyecto_miembros;

-- 7. Delete project emergent changes (FK → proyectos)
DELETE FROM proyecto_cambios_emergentes;

-- 8. Delete reprogramaciones (FK → proyectos)
DELETE FROM reprogramaciones;

-- 9. Delete comments on all entities
DELETE FROM comentarios WHERE entidad_tipo IN ('solicitud', 'proyecto', 'ticket');

-- 10. Delete file attachments on all entities
DELETE FROM archivos WHERE entidad_tipo IN ('solicitud', 'proyecto', 'ticket');

-- 11. Delete aprobaciones (FK → solicitudes)
DELETE FROM aprobaciones;

-- 12. Delete reevaluation comments (FK → solicitudes, evaluaciones)
DELETE FROM comentarios_reevaluacion;

-- 13. Delete historial_cambios for all entities
DELETE FROM historial_cambios WHERE entidad_tipo IN ('solicitud', 'proyecto', 'ticket');

-- 14. Delete all notifications (they reference deleted entities)
DELETE FROM notificaciones;

-- 15. Delete evaluation assignments (FK → evaluaciones_nt)
DELETE FROM evaluacion_asignaciones;

-- 16. Delete cost estimates (FK → evaluaciones_nt)
DELETE FROM estimaciones_costo;

-- 17. Delete cronograma tasks (FK → cronogramas)
DELETE FROM cronograma_tareas;

-- 18. Delete cronogramas (FK → evaluaciones_nt)
DELETE FROM cronogramas;

-- 19. Delete decisiones_coordinador
DELETE FROM decisiones_coordinador;

-- 20. Delete transferencias
DELETE FROM transferencias;

-- 21. Delete proyectos (FK → solicitudes, evaluaciones_nt)
DELETE FROM proyectos;

-- 22. Delete evaluaciones_nt (FK → solicitudes)
DELETE FROM evaluaciones_nt;

-- 23. Clear ticket references on solicitudes before deleting tickets
UPDATE solicitudes SET transferido_a_ticket_id = NULL WHERE transferido_a_ticket_id IS NOT NULL;
UPDATE solicitudes SET origen_ticket_id = NULL WHERE origen_ticket_id IS NOT NULL;

-- 24. Clear solicitud references on tickets before deleting
UPDATE tickets SET transferido_a_solicitud_id = NULL WHERE transferido_a_solicitud_id IS NOT NULL;

-- 25. Delete tickets (FK → solicitantes)
DELETE FROM tickets;

-- 26. Delete solicitudes except SOL-2026-0013
DELETE FROM solicitudes WHERE codigo != 'SOL-2026-0013';

-- 25. Delete reportes_semanales (generated from now-deleted data)
DELETE FROM reportes_semanales;

-- 26. Delete solicitantes not linked to SOL-2026-0013
DELETE FROM solicitantes WHERE id NOT IN (
  SELECT DISTINCT solicitante_id FROM solicitudes WHERE solicitante_id IS NOT NULL
);

-- 27. Delete verification codes (transient data)
DELETE FROM codigos_verificacion;

-- 28. Delete solicitante sessions
DELETE FROM sesiones_solicitante;

-- 29. Reset sequences for tables with SERIAL ids
SELECT setval('solicitudes_id_seq', COALESCE((SELECT MAX(id) FROM solicitudes), 0) + 1, false);
SELECT setval('tickets_id_seq', 1, false);
SELECT setval('proyectos_id_seq', 1, false);
SELECT setval('proyecto_tareas_id_seq', 1, false);
SELECT setval('proyecto_miembros_id_seq', 1, false);
SELECT setval('proyecto_costos_id_seq', 1, false);
SELECT setval('proyecto_pausas_id_seq', 1, false);
SELECT setval('implementacion_tareas_id_seq', 1, false);
SELECT setval('comentarios_id_seq', 1, false);
SELECT setval('archivos_id_seq', 1, false);
SELECT setval('aprobaciones_id_seq', 1, false);
SELECT setval('historial_cambios_id_seq', 1, false);
SELECT setval('notificaciones_id_seq', 1, false);
SELECT setval('evaluaciones_nt_id_seq', 1, false);
SELECT setval('cronogramas_id_seq', 1, false);
SELECT setval('cronograma_tareas_id_seq', 1, false);
SELECT setval('reportes_semanales_id_seq', 1, false);
SELECT setval('transferencias_id_seq', 1, false);
SELECT setval('decisiones_coordinador_id_seq', 1, false);
SELECT setval('evaluacion_asignaciones_id_seq', 1, false);
SELECT setval('estimaciones_costo_id_seq', 1, false);
SELECT setval('reprogramaciones_id_seq', 1, false);
SELECT setval('comentarios_reevaluacion_id_seq', 1, false);
SELECT setval('proyecto_cambios_emergentes_id_seq', 1, false);
SELECT setval('solicitantes_id_seq', COALESCE((SELECT MAX(id) FROM solicitantes), 0) + 1, false);
SELECT setval('codigos_verificacion_id_seq', 1, false);
SELECT setval('sesiones_solicitante_id_seq', 1, false);

COMMIT;
