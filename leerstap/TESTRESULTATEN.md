# Testresultaten — 22 oktober 2026 (versie 0.3.0)

## Automatisch (`npm test`): 28 geslaagd, 0 mislukt

- **Rekenen en nakijken (13):** gelijkwaardige uitdrukkingen (`√81` = `sqrt(81)`), weigeren van code en ongeldige notatie, deelpunten via review, voorlopig cijfer, adaptieve volgorde, herhaalintervallen, foute antwoorden terug met uitleg en daarna twee zelfstandige controles, broncitaatcontrole, versleutelde back-up (fout wachtwoord en gewijzigde data worden geweigerd), HTML-escaping.
- **AI-contract (2):** zonder sleutel wordt geweigerd, ongeldige pagina’s worden geweigerd, en de providerreactie wordt gevalideerd met een nagebootste provider (`store:false`, strikt schema).
- **Server en accounts (10):**
  - account maken met herstelcode;
  - inloggen, uitloggen en blokkade na herhaalde foute pogingen;
  - weigeren van verzoeken van andere sites en van ongeldige sessies;
  - **volledige scheiding tussen gezinnen**: lezen, schrijven en verwijderen;
  - **een kind ziet alleen eigen resultaten** en kan niet namens een broer of zus opslaan;
  - alleen een ouder geeft vrij, beoordeelt en verwijdert definitief;
  - verouderde wijzigingen worden geweigerd (conflictdetectie);
  - opslag van bronnen, en bescherming van bronnen die nog geciteerd worden;
  - AI met toestemming, maandlimiet en meting van verbruik;
  - wachtwoordherstel met een herstelcode die maar één keer werkt;
  - besloten proef met uitnodigingscode;
  - export, import van een oude kluis, en volledig verwijderen van een gezin (inclusief bestanden).
- **Opslaan (2):** alleen gewijzigde onderdelen worden verstuurd. Bronnen gaan zonder pagina’s mee. Een afgeronde sessie verwijdert de conceptsessie.

## Browser (`npm run test:e2e`, Chromium): 11 stappen geslaagd, geen consolefouten

1. Ouder maakt een account. De herstelcode moet bevestigd worden.
2. Een tekstbestand uploaden. De nagebootste AI analyseert het; daarna controle en vrijgeven.
3. Het kind krijgt een eigen login.
4. PDF-opgaven en PDF-antwoorden worden gedownload (geldige PDF’s).
5. Uitloggen.
6. Het kind logt in op een telefoonscherm (390 px, zonder horizontaal scrollen). Een fout wachtwoord wordt geweigerd. Na een fout antwoord volgt uitleg, daarna een goed antwoord.
7. Na herladen staat de lopende sessie er nog; daarna afronden.
8. Het kind ziet één profiel en kan geen leerstof verwijderen (403).
9. De ouder ziet het resultaat van het kind op het andere apparaat.
10. Manifest en service worker zijn aanwezig (installeerbaar).
11. De voorbeeldles werkt zonder account.

## Cloudflare

`wrangler deploy --dry-run` slaagt: de worker is 46 KB, met koppelingen voor D1, R2 (EU) en de statische bestanden.

## Nog niet getest

- **Live OpenAI-sleutel met een echt lesboek:** de kwaliteit van samenvattingen en vragen, en het herkennen van foto’s en scans. Doe dit als eerste na de uitrol.
- **Echte uitrol op Cloudflare:** dat vereist jouw account. De proefbuild slaagt.
- **Fysieke Android-telefoon en iPhone:** getest is alleen een mobiel scherm in Chromium.
- **Upload van DOCX en foto’s via de browser:** de code is ongewijzigd ten opzichte van 0.2.0, maar niet opnieuw getest in de browser.
- Er is geen penetratietest en geen belastingtest gedaan.
