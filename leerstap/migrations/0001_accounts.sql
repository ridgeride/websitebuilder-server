-- Leerstap 0.3.0: gezinsaccounts en centrale opslag.
-- Elke rij met leerlinggegevens draagt family_id; de server filtert daar altijd op.

CREATE TABLE families (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  ai_consent_at INTEGER,
  created INTEGER NOT NULL
);

-- Ouders loggen in met e-mail, kinderen met een gebruikersnaam. Een kindprofiel
-- zonder eigen login (login IS NULL) wordt alleen door de ouder gebruikt.
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('parent', 'child')),
  login TEXT UNIQUE,
  name TEXT NOT NULL,
  pw_hash TEXT,
  recovery_hash TEXT,
  profile TEXT NOT NULL DEFAULT '{}',
  created INTEGER NOT NULL
);
CREATE INDEX users_family ON users(family_id);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires INTEGER NOT NULL,
  created INTEGER NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);

CREATE TABLE throttle (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  first INTEGER NOT NULL
);

-- Leerstof, bronnen (alleen metadata; inhoud staat in objectopslag), resultaten en
-- lopende sessies. owner is de leerling bij attempts en drafts.
CREATE TABLE items (
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('module', 'document', 'attempt', 'draft')),
  id TEXT NOT NULL,
  owner TEXT,
  data TEXT NOT NULL,
  rev INTEGER NOT NULL DEFAULT 1,
  updated INTEGER NOT NULL,
  PRIMARY KEY (family_id, kind, id)
);
CREATE INDEX items_owner ON items(family_id, kind, owner);

CREATE TABLE usage (
  family_id TEXT NOT NULL,
  month TEXT NOT NULL,
  analyses INTEGER NOT NULL DEFAULT 0,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (family_id, month)
);

CREATE TABLE audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id TEXT,
  user_id TEXT,
  action TEXT NOT NULL,
  detail TEXT,
  at INTEGER NOT NULL
);
CREATE INDEX audit_family ON audit(family_id, at);
