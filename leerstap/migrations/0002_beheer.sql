-- Leerstap 0.4.0: beheer tijdens de proef. Persoonlijke uitnodigingen en gezinnen pauzeren.

-- Eén code per uitnodiging, bruikbaar voor één gezin. family_id blijft staan als het
-- gezin later wordt verwijderd, zodat zichtbaar blijft dat de uitnodiging gebruikt is.
CREATE TABLE invites (
  code TEXT PRIMARY KEY,
  note TEXT NOT NULL DEFAULT '',
  created INTEGER NOT NULL,
  family_id TEXT,
  used_at INTEGER
);

-- Een gepauzeerd gezin kan niet inloggen; de gegevens blijven bewaard.
ALTER TABLE families ADD COLUMN blocked_at INTEGER;
ALTER TABLE families ADD COLUMN last_seen INTEGER;
