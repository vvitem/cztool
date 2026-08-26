-- Run against the same D1 database used by EdgeKey (edgekey-db).
-- Dashboard: D1 → edgekey-db → Console, or: wrangler d1 execute edgekey-db --remote --file=./migrations/001_cztool_unlock.sql

CREATE TABLE IF NOT EXISTS cztool_unlock_binding (
  code TEXT PRIMARY KEY,
  card_id INTEGER NOT NULL,
  device_id TEXT NOT NULL,
  token TEXT NOT NULL,
  bound_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cztool_binding_device ON cztool_unlock_binding(device_id);
