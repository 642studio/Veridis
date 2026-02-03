-- VERIDIS Core: Event store
-- Events are the single source of truth.

CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(128) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  source VARCHAR(128) NOT NULL DEFAULT 'core',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
