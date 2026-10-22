-- Leerstap 0.6.0: woordenlijsten, toetsplanner, AI-controles en meldingen uit de app.

-- items krijgt twee nieuwe soorten (wordlist, plan). SQLite kan een CHECK niet wijzigen,
-- dus de tabel wordt opnieuw opgebouwd met dezelfde gegevens.
CREATE TABLE items_new (
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('module', 'document', 'attempt', 'draft', 'wordlist', 'plan')),
  id TEXT NOT NULL,
  owner TEXT,
  data TEXT NOT NULL,
  rev INTEGER NOT NULL DEFAULT 1,
  updated INTEGER NOT NULL,
  PRIMARY KEY (family_id, kind, id)
);
INSERT INTO items_new (family_id, kind, id, owner, data, rev, updated) SELECT family_id, kind, id, owner, data, rev, updated FROM items;
DROP TABLE items;
ALTER TABLE items_new RENAME TO items;
CREATE INDEX items_owner ON items(family_id, kind, owner);

-- Nakijken van een foto, "leg het uit" en woordjes uit een foto tellen apart van de analyses.
ALTER TABLE usage ADD COLUMN checks INTEGER NOT NULL DEFAULT 0;

-- Ideeën, vragen en problemen die gebruikers vanuit de app melden.
CREATE TABLE feedback (
  id TEXT PRIMARY KEY,
  family_id TEXT REFERENCES families(id) ON DELETE CASCADE,
  user_id TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('idee', 'vraag', 'probleem')),
  message TEXT NOT NULL,
  context TEXT NOT NULL DEFAULT '',
  created INTEGER NOT NULL,
  reply TEXT,
  replied_at INTEGER,
  done_at INTEGER
);
CREATE INDEX feedback_family ON feedback(family_id, created);
