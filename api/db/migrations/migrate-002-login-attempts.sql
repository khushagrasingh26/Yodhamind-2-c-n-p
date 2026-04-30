-- ══════════════════════════════════════════════════════════════════
--  Migration 002 — Login Attempts Tracking
--  ─────────────────────────────────────────────────────────────────
--  Run:  psql $DATABASE_URL -f api/db/migrations/migrate-002-login-attempts.sql
--
--  Creates login_attempts table for brute-force protection.
--  Failed attempts are counted per email within a rolling window.
--  After N failures, the account is temporarily locked.
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS login_attempts (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         VARCHAR(255) NOT NULL,
  ip_address    VARCHAR(45)  NOT NULL,
  success       BOOLEAN      NOT NULL DEFAULT FALSE,
  attempted_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Index for fast lookups by email + time (used by lockout check)
CREATE INDEX IF NOT EXISTS idx_login_attempts_email
  ON login_attempts (email, attempted_at DESC);

-- Index for security audits — find attacks from specific IPs
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip
  ON login_attempts (ip_address, attempted_at DESC);

-- Record migration
INSERT INTO schema_migrations (version) VALUES ('1.2.0')
  ON CONFLICT DO NOTHING;
