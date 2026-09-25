CREATE TABLE IF NOT EXISTS daily_usage (
  session_id TEXT NOT NULL,
  day TEXT NOT NULL,
  network_hash TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0),
  input_tokens INTEGER NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  output_tokens INTEGER NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  PRIMARY KEY (session_id, day),
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE TABLE IF NOT EXISTS daily_network_usage (
  network_hash TEXT NOT NULL,
  day TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0),
  PRIMARY KEY (network_hash, day)
);

CREATE INDEX IF NOT EXISTS daily_usage_network_idx ON daily_usage(network_hash, day);
