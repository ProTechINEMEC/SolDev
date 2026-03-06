-- =====================================================
-- SolDev Admin Role Migration
-- Adds dedicated admin role for system configuration
-- =====================================================

-- =====================================================
-- 1. ADD ADMIN ROLE TO USER ENUM
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'admin' AND enumtypid = 'rol_usuario'::regtype) THEN
    ALTER TYPE rol_usuario ADD VALUE 'admin';
  END IF;
END$$;

-- =====================================================
-- 2. CONVERT admin@inemec.com TO ADMIN ROLE
-- =====================================================

UPDATE usuarios
SET rol = 'admin',
    password_hash = '$2a$12$3GP./W9aqebQ1Hc4BZYwo.J2pqIJUKAG6OEGnxje6rjsjgFWMERH6'
WHERE email = 'admin@inemec.com' OR email = 'admin';

-- Invalidate existing sessions for admin user
UPDATE sesiones SET activa = false
WHERE usuario_id = (SELECT id FROM usuarios WHERE email = 'admin' OR email = 'admin@inemec.com' LIMIT 1);

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
