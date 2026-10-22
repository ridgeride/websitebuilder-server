-- Leerstap 0.7.0: papieren proefwerken. De lijst met soorten staat voortaan in de servercode
-- (die controleert elk onderdeel al), zodat een nieuwe soort geen tabel-ombouw meer nodig heeft.
CREATE TABLE items_new (
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
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
