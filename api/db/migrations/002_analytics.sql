-- ══════════════════════════════════════════════════════════════════
--  Migration 002: Analytics Events & Dashboard Views
--  Run:  psql $DATABASE_URL -f api/db/migrations/002_analytics.sql
-- ══════════════════════════════════════════════════════════════════

INSERT INTO schema_migrations (version) VALUES ('1.1.0')
  ON CONFLICT DO NOTHING;

-- ════════════════════════════════════════════════════════════════
--  ANALYTICS EVENTS  (append-only event store)
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS analytics_events (
  id            UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_name    VARCHAR(50)  NOT NULL,
  session_id    VARCHAR(40)  NOT NULL,
  user_id       UUID         REFERENCES users(id) ON DELETE SET NULL,
  anonymous_id  VARCHAR(64),
  properties    JSONB        NOT NULL DEFAULT '{}',
  context       JSONB        NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ae_name_date  ON analytics_events (event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ae_session    ON analytics_events (session_id);
CREATE INDEX IF NOT EXISTS idx_ae_user       ON analytics_events (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ae_created    ON analytics_events (created_at DESC);

-- ════════════════════════════════════════════════════════════════
--  MATERIALIZED VIEW — Daily Metrics
-- ════════════════════════════════════════════════════════════════

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_metrics AS
SELECT
  DATE(created_at AT TIME ZONE 'Asia/Kolkata')                       AS day,
  COUNT(DISTINCT session_id)                                          AS total_sessions,
  COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL)          AS auth_users,
  COUNT(DISTINCT COALESCE(anonymous_id, session_id))                  AS unique_visitors,
  COUNT(*) FILTER (WHERE event_name = 'PAGE_VIEWED')                  AS page_views,
  COUNT(*) FILTER (WHERE event_name = 'GAME_STARTED')                 AS games_started,
  COUNT(*) FILTER (WHERE event_name = 'GAME_COMPLETED')               AS games_completed,
  COUNT(*) FILTER (WHERE event_name = 'ASSESSMENT_STARTED')           AS assessments_started,
  COUNT(*) FILTER (WHERE event_name = 'ASSESSMENT_COMPLETED')         AS assessments_completed,
  COUNT(*) FILTER (WHERE event_name = 'MOOD_LOGGED')                  AS moods_logged,
  COUNT(*) FILTER (WHERE event_name = 'JOURNAL_CREATED')              AS journals_created,
  COUNT(*) FILTER (WHERE event_name = 'BREATHING_COMPLETED')          AS breathing_sessions,
  COUNT(*) FILTER (WHERE event_name = 'AUTH_COMPLETED')               AS signups,
  COUNT(*) FILTER (WHERE event_name = 'CTA_CLICKED')                  AS cta_clicks,
  COUNT(*) FILTER (WHERE event_name = 'CRISIS_LINK_CLICKED')          AS crisis_clicks
FROM analytics_events
GROUP BY day
ORDER BY day DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_daily_day ON mv_daily_metrics (day);

-- ════════════════════════════════════════════════════════════════
--  MATERIALIZED VIEW — Game Metrics
-- ════════════════════════════════════════════════════════════════

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_game_metrics AS
SELECT
  properties->>'game_id'                                              AS game_id,
  DATE(created_at AT TIME ZONE 'Asia/Kolkata')                        AS day,
  COUNT(*) FILTER (WHERE event_name = 'GAME_STARTED')                 AS starts,
  COUNT(*) FILTER (WHERE event_name = 'GAME_COMPLETED')               AS completions,
  COUNT(*) FILTER (WHERE event_name = 'GAME_ABANDONED')               AS abandonments,
  AVG((properties->>'duration_ms')::int)
    FILTER (WHERE event_name = 'GAME_COMPLETED'
            AND properties->>'duration_ms' IS NOT NULL)               AS avg_duration_ms,
  AVG((properties->>'score')::int)
    FILTER (WHERE event_name = 'GAME_COMPLETED'
            AND properties->>'score' IS NOT NULL)                     AS avg_score
FROM analytics_events
WHERE event_name IN ('GAME_STARTED', 'GAME_COMPLETED', 'GAME_ABANDONED')
GROUP BY game_id, day
ORDER BY day DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_game_day ON mv_game_metrics (game_id, day);
