-- SG Datalytics — Distribution Layer Tables
-- Run once against your Neon DB to enable the client API system.
-- psql $NEON_MARKET_PRICES -f create_distribution_tables.sql

-- ── api_clients ───────────────────────────────────────────────
-- One row per paying/trial client. api_key is stored as a SHA-256 hex hash.
-- Never store the raw key in the DB — only the hash.
CREATE TABLE IF NOT EXISTS api_clients (
    id                 SERIAL PRIMARY KEY,
    name               TEXT        NOT NULL,                   -- company / person name
    email              TEXT        NOT NULL UNIQUE,            -- contact email
    api_key_hash       TEXT        NOT NULL UNIQUE,            -- SHA-256 of raw key
    tier               TEXT        NOT NULL DEFAULT 'starter', -- trial | starter | pro | enterprise
    allowed_categories TEXT[]      NOT NULL DEFAULT '{}',      -- empty = all categories allowed
    row_limit_monthly  INTEGER     NOT NULL DEFAULT 1000,      -- max rows per calendar month
    is_active          BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes              TEXT
);

-- ── api_usage_log ─────────────────────────────────────────────
-- One row per API request. Used for quota enforcement and billing.
CREATE TABLE IF NOT EXISTS api_usage_log (
    id             BIGSERIAL   PRIMARY KEY,
    client_id      INTEGER     NOT NULL REFERENCES api_clients(id),
    endpoint       TEXT        NOT NULL,                       -- e.g. /data/prices
    filters        JSONB,                                      -- query params used
    rows_returned  INTEGER     NOT NULL DEFAULT 0,
    response_ms    INTEGER,                                    -- response time in ms
    queried_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast monthly quota lookups
CREATE INDEX IF NOT EXISTS idx_usage_client_month
    ON api_usage_log (client_id, queried_at);

-- Index for admin analytics
CREATE INDEX IF NOT EXISTS idx_usage_endpoint
    ON api_usage_log (endpoint, queried_at DESC);
