-- Leerstap 0.5.0: toegang aanvragen vanaf de inlogpagina.

-- Openstaande aanvragen. Bij accepteren wordt de aanvraag een uitnodiging voor dat
-- e-mailadres; bij afwijzen wordt hij verwijderd. Er blijft dus niets langer staan dan nodig.
CREATE TABLE access_requests (
  email TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  created INTEGER NOT NULL
);

-- Een uitnodiging kan aan één e-mailadres gekoppeld zijn: alleen dat adres kan hem gebruiken,
-- ook zonder de code over te typen.
ALTER TABLE invites ADD COLUMN email TEXT;
CREATE INDEX invites_email ON invites(email);
