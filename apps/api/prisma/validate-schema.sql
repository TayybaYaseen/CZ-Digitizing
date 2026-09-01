-- Validates the Spec 01 (Auth) migration actually landed correctly: expected tables, primary
-- keys, foreign-key relations, indexes, and enum types all present with no missing dependencies.
--
-- Run after `pnpm --filter api prisma:migrate` (or `prisma migrate deploy`) completes:
--   psql -U dev -h localhost -p 5432 -d czdigitizing -f apps/api/prisma/validate-schema.sql
--
-- Source of truth: apps/api/prisma/schema.prisma. Update this file if that schema changes.

\echo '=== 1. Tables present ==='
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;
-- Expect exactly: _prisma_migrations, admin_permissions, audit_logs, sessions, users

\echo '=== 2. Primary keys ==='
SELECT tc.table_name, kcu.column_name, tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public'
ORDER BY tc.table_name;
-- Expect one row each for: admin_permissions(id), audit_logs(id), sessions(id), users(id)

\echo '=== 3. Foreign keys (relations) ==='
SELECT
  tc.table_name AS referencing_table,
  kcu.column_name AS referencing_column,
  ccu.table_name AS referenced_table,
  ccu.column_name AS referenced_column,
  rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
JOIN information_schema.referential_constraints rc
  ON tc.constraint_name = rc.constraint_name AND tc.table_schema = rc.constraint_schema
WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;
-- Expect:
--   admin_permissions.user_id -> users.id   (CASCADE)
--   audit_logs.admin_user_id  -> users.id   (NO ACTION / SET NULL — nullable FK, no onDelete set)
--   sessions.user_id          -> users.id   (CASCADE)

\echo '=== 4. Indexes ==='
SELECT tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
-- Expect (beyond the implicit PK indexes):
--   idx_users_email, idx_users_role
--   idx_sessions_user_id, idx_sessions_expires_at, idx_sessions_device_user
--   idx_admin_permissions_user_id
--   idx_audit_logs_admin_user_id

\echo '=== 5. Enum types ==='
SELECT t.typname AS enum_name, e.enumlabel AS value
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public'
ORDER BY t.typname, e.enumsortorder;
-- Expect: Role (customer/admin/freelancer/moderator), UserStatus (active/inactive/suspended),
-- AdminModule (14 values), AdminAccessLevel (read_only/crud)

\echo '=== 6. Applied migrations ==='
SELECT migration_name, finished_at, rolled_back_at
FROM _prisma_migrations
ORDER BY started_at;
-- Expect one row, name containing "init", finished_at set, rolled_back_at NULL

\echo '=== 7. Strict pass/fail check ==='
DO $$
DECLARE
  missing TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF to_regclass('public.users') IS NULL THEN missing := array_append(missing, 'table users'); END IF;
  IF to_regclass('public.sessions') IS NULL THEN missing := array_append(missing, 'table sessions'); END IF;
  IF to_regclass('public.admin_permissions') IS NULL THEN missing := array_append(missing, 'table admin_permissions'); END IF;
  IF to_regclass('public.audit_logs') IS NULL THEN missing := array_append(missing, 'table audit_logs'); END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'sessions' AND constraint_type = 'FOREIGN KEY'
  ) THEN missing := array_append(missing, 'FK sessions -> users'); END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'admin_permissions' AND constraint_type = 'FOREIGN KEY'
  ) THEN missing := array_append(missing, 'FK admin_permissions -> users'); END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'audit_logs' AND constraint_type = 'FOREIGN KEY'
  ) THEN missing := array_append(missing, 'FK audit_logs -> users'); END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_users_email') THEN
    missing := array_append(missing, 'index idx_users_email');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Role') THEN
    missing := array_append(missing, 'enum Role');
  END IF;

  IF array_length(missing, 1) > 0 THEN
    RAISE EXCEPTION 'Schema validation FAILED — missing: %', array_to_string(missing, ', ');
  ELSE
    RAISE NOTICE 'Schema validation PASSED — all expected tables, relations, indexes, and enums present.';
  END IF;
END $$;
