-- =====================================================
-- SolDev Test Users Migration
-- Adds es_prueba column, renames test users to plain
-- usernames, sets uniform password, and disables by default
-- =====================================================

-- =====================================================
-- 1. ADD es_prueba COLUMN TO usuarios TABLE
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'usuarios' AND column_name = 'es_prueba') THEN
    ALTER TABLE usuarios ADD COLUMN es_prueba BOOLEAN DEFAULT false;
  END IF;
END$$;

-- =====================================================
-- 2. RENAME TEST USERS AND SET PROPERTIES
-- Password hash for 'Inemec2024' (bcrypt, 12 rounds)
-- =====================================================

-- admin: rename, set es_prueba=false, keep activo=true, set new password
UPDATE usuarios
SET email = 'admin',
    password_hash = '$2a$12$l1shpubG.1u1mZ9aHoV5rOyXl1yj72dVx3aLsFu.OvQ6OYKRVpaYC',
    es_prueba = false,
    activo = true
WHERE email = 'admin@inemec.com';

-- nt: rename, set es_prueba=true, activo=false, new password
UPDATE usuarios
SET email = 'nt',
    password_hash = '$2a$12$l1shpubG.1u1mZ9aHoV5rOyXl1yj72dVx3aLsFu.OvQ6OYKRVpaYC',
    es_prueba = true,
    activo = false
WHERE email = 'nt@inemec.com';

-- ti: rename, set es_prueba=true, activo=false, new password
UPDATE usuarios
SET email = 'ti',
    password_hash = '$2a$12$l1shpubG.1u1mZ9aHoV5rOyXl1yj72dVx3aLsFu.OvQ6OYKRVpaYC',
    es_prueba = true,
    activo = false
WHERE email = 'ti@inemec.com';

-- If ti user doesn't exist yet (0 rows affected above), insert it
INSERT INTO usuarios (email, nombre, password_hash, rol, activo, es_prueba)
SELECT 'ti', 'Usuario TI', '$2a$12$l1shpubG.1u1mZ9aHoV5rOyXl1yj72dVx3aLsFu.OvQ6OYKRVpaYC', 'ti', false, true
WHERE NOT EXISTS (SELECT 1 FROM usuarios WHERE email = 'ti');

-- gerencia: rename, set es_prueba=true, activo=false, new password
UPDATE usuarios
SET email = 'gerencia',
    password_hash = '$2a$12$l1shpubG.1u1mZ9aHoV5rOyXl1yj72dVx3aLsFu.OvQ6OYKRVpaYC',
    es_prueba = true,
    activo = false
WHERE email = 'gerencia@inemec.com';

-- coord.nt: rename, set es_prueba=true, activo=false, new password
UPDATE usuarios
SET email = 'coord.nt',
    password_hash = '$2a$12$l1shpubG.1u1mZ9aHoV5rOyXl1yj72dVx3aLsFu.OvQ6OYKRVpaYC',
    es_prueba = true,
    activo = false
WHERE email = 'coord.nt@inemec.com';

-- coord.ti: rename, set es_prueba=true, activo=false, new password
UPDATE usuarios
SET email = 'coord.ti',
    password_hash = '$2a$12$l1shpubG.1u1mZ9aHoV5rOyXl1yj72dVx3aLsFu.OvQ6OYKRVpaYC',
    es_prueba = true,
    activo = false
WHERE email = 'coord.ti@inemec.com';

-- =====================================================
-- 3. INVALIDATE SESSIONS FOR RENAMED USERS
-- =====================================================

UPDATE sesiones SET activa = false
WHERE usuario_id IN (
  SELECT id FROM usuarios WHERE email IN ('admin', 'nt', 'ti', 'gerencia', 'coord.nt', 'coord.ti')
);

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
