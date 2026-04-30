-- ══════════════════════════════════════════════════════════════════
--  Migration 001 — Device Tracking on Refresh Tokens
--  ─────────────────────────────────────────────────────────────────
--  Run:  psql $DATABASE_URL -f api/db/migrations/migrate-001-device-tracking.sql
--
--  Adds device_info and ip_address columns to refresh_tokens table
--  for tracking which devices have active sessions.
-- ══════════════════════════════════════════════════════════════════

ALTER TABLE refresh_tokens
  ADD COLUMN IF NOT EXISTS device_info VARCHAR(500),
  ADD COLUMN IF NOT EXISTS ip_address  VARCHAR(45);

-- Index for looking up tokens by IP (useful for security audits)
CREATE INDEX IF NOT EXISTS idx_refresh_ip
  ON refresh_tokens (ip_address);

-- Record migration
INSERT INTO schema_migrations (version) VALUES ('1.1.0')
  ON CONFLICT DO NOTHING;
