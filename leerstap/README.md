# Leerstap 0.9.10

Een Nederlandstalige leerapp voor leerlingen (vmbo t/m gymnasium) en hun ouders. Upload je leerstof, laat AI er een samenvatting en oefenvragen van maken, en oefen tot je het snapt. Fouten komen terug, eerst met uitleg. Proefwerken kun je online maken of als PDF printen, met opgaven en antwoorden apart.

**Online zetten:** zie [UITROL.md](UITROL.md). **Wat er veranderd is:** zie [CHANGELOG.md](CHANGELOG.md).

## Hoe het werkt

1. Een ouder maakt een **gezinsaccount** (e-mail + wachtwoord) en krijgt eenmalig een **herstelcode**.
2. De ouder voegt kinderen toe (schooltype, leerjaar, vakken) en geeft ieder kind desgewenst een **eigen login** (gebruikersnaam + wachtwoord). Een kind ziet alleen de eigen voortgang.
3. **Mijn leerstof:** kies eerst het vak en het hoofdstuk, upload dan de bladzijden (PDF, DOCX, TXT/MD, JPG, PNG of WEBP, of geplakte tekst). Elk hoofdstuk is een map waar je later bladzijden aan toevoegt; opnieuw analyseren vervangt de leerstof in plaats van een tweede versie te maken. Maximaal 10 MB per bestand en 30 pagina’s per analyse. Bronnen worden centraal en privé opgeslagen.
4. Met **toestemming van een ouder** maakt de AI samenvattingen, leerdoelen, begrippen en 9–15 vragen op drie niveaus. Elke vraag verwijst naar een letterlijk citaat uit de bron; verzonnen citaten worden geblokkeerd. Het resultaat is een concept tot een ouder het vrijgeeft.
5. **Oefenen:** typ antwoorden zoals `√81`, `sqrt(81)`, `2*sqrt(3)` of `1/2`, met tussenstappen. Rekenantwoorden worden doorgerekend, niet letterlijk vergeleken. Fout = uitleg, daarna twee keer zelfstandig goed. Herhaling na 1 dag, oplopend tot 30 dagen.
6. **Proefwerk:** zonder hints. Daarna punten, uitwerkingen en foutfocus. PDF-opgaven en PDF-antwoorden met puntenmodel apart.
7. **Voortgang:** open antwoorden en twijfelgevallen beoordeelt de ouder met (halve) deelpunten. Het cijfer (`1 + 9 × punten/totaal`) blijft voorlopig tot alles beoordeeld is.

Daarnaast:

- **Drill:** alle vragen van de gekozen paragrafen, tot alles beheerst is. Goed in één keer: klaar. Fout: terug tot twee keer achter elkaar goed.
- **Alles uit het eigen boek:** samenvattingen, vragen en uitwerkingen komen alleen uit de geüploade bronnen, volgens de werkwijze van het boek. Nakijken en "leg het uit" worden vergeleken met de bladzijde zelf; een goed antwoord met een andere methode wordt uitgelegd.
- **Foto’s worden tekst:** Leerstap leest de tekst van foto’s uit op het apparaat zelf (gratis; bij twijfel kan de AI het overnemen), de familie controleert en verbetert hem, en daarna wordt alles uit die gecontroleerde tekst gemaakt (citaten worden er letterlijk tegen gecontroleerd). De foto’s kunnen daarna worden verwijderd; dan blijft alleen de tekst bewaard.
- **Papieren proefwerk:** printen met een code, op papier maken, foto’s uploaden; nakijken met cijfer, punten en terugkoppeling per paragraaf en per soort vraag of som.
- **Kiezen wat je leert:** per paragraaf en onderwerp aan- of uitzetten, en overslaan wat je al beheerst. **Advies** op de startpagina: wat je vandaag het best kunt doen, en waarom.
- **Woordjes:** alleen uit de eigen bron (verzonnen woorden worden geweigerd) of zelf overgetypt, overhoren in beide richtingen, hulp bij bijna-goed (lidwoord, accent, kleine spelfout) en uitspraak.
- **Toets op maat:** paragrafen kiezen, een realistische toets met alle niveaus, en daarna terugkoppeling per paragraaf: wat zit goed, waar moet je meer op leren en waarom, met een knop om precies dat te drillen.
- **Toetsplanner:** toets met datum en leerstof, een korte taak per dag, twee dagen ervoor een proefwerk, de dag ervoor herhaling. De taak van vandaag staat op de startpagina.
- **AI-hulp voor de leerling** (met toestemming van de ouder): een foto van de uitwerking laten nakijken met deelpunten, en feedback op een eigen uitleg van een begrip. Open vragen kun je ook zelf nakijken met het modelantwoord.
- **Rustige motivatie:** weekoverzicht en "klaar voor de toets"-percentage per leerstof, zonder punten of ranglijsten.
- **Meldingen:** vanuit de app een idee, vraag of probleem sturen; het antwoord verschijnt in de app.

Tijdens de proef beheert de beheerder op de pagina **Beheer** wie mee mag doen: persoonlijke uitnodigingen (link + eenmalige code, eventueel gekoppeld aan één e-mailadres), toegangsaanvragen accepteren of afwijzen, gezinnen pauzeren of verwijderen, en een nieuwe herstelcode voor een ouder die de code kwijt is.

Alles wordt automatisch opgeslagen in het account. Je kunt verder op een ander apparaat. Leerstap is te installeren op het beginscherm (PWA). Zonder account kun je de voorbeeldles proberen; die wordt niet bewaard.

## Ontwikkelen

Vereist Node.js 22.13 of nieuwer.

```text
npm ci
npm test            # 44 tests: rekenen, nakijken, herhalen, accounts, isolatie tussen gezinnen, beheer, AI-contract
npm run build       # bouwt dist/public
npm start           # http://127.0.0.1:4173, gegevens in ./data
npm run test:e2e    # volledige route in een echte browser (ouder én kind), met een nep-AI
npm run check       # tests + build + Cloudflare-proefbuild
```

AI lokaal: kopieer `.env.example` naar `.env` en vul `OPENAI_API_KEY` in. Zonder sleutel werkt alles behalve de analyse van eigen leerstof; de app toont dat duidelijk en maakt geen nep-analyse.

## Architectuur

| Onderdeel | Bestand(en) |
|---|---|
| Browser-app (schermen, oefenen, PDF-export, bestanden inlezen) | `src/app.js`, `src/files.js`, `src/pdf.js` |
| Rekenparser, nakijken, herhaling, validatie (gedeeld door browser en server) | `src/core.js` |
| Opslaan: alleen gewijzigde onderdelen naar de server | `src/sync.js` |
| API: accounts, sessies, rechten, opslag, export/import | `worker/server.js`, `worker/auth.js` |
| AI-analyse (OpenAI Responses API, strikt JSON-schema, `store:false`) | `worker/analyse.js` |
| Cloudflare-ingang, dagelijkse opschoning | `worker/index.js`, `wrangler.toml` |
| Databaseschema (genummerde migraties) | `migrations/` |
| Lokale vervangers voor D1 en R2 (SQLite + map) | `scripts/local-env.mjs`, `scripts/serve.mjs` |
| PWA, iconen, privacy en voorwaarden | `public/` |

**Hosting:** Cloudflare Workers met statische assets, D1 (SQLite) voor accounts en leerstof, en R2 voor geüploade bestanden. Database en bestanden staan in de EU-jurisdictie.

## Beveiliging en privacy

- Wachtwoorden en herstelcodes: PBKDF2-SHA256 (100 000 iteraties, het maximum op Cloudflare), unieke salt. De vergelijking kost altijd evenveel tijd, zodat de responstijd niet verraadt welke accounts bestaan.
- Sessies: willekeurig token in een `HttpOnly`/`Secure`/`SameSite=Lax`-cookie. De database bewaart alleen een hash van het token. Een sessie verloopt na 30 dagen zonder gebruik.
- Elk verzoek wordt op de server gecontroleerd op gezin en rol. Kinderen zien en wijzigen alleen hun eigen resultaten. Vrijgeven, beoordelen, definitief verwijderen, export en kindbeheer kan alleen een ouder. De servertests controleren dit expliciet, ook tussen gezinnen.
- Aanvallen van andere sites worden geweigerd (Origin-controle). Strikte Content-Security-Policy. Geen externe scripts, trackers of advertenties.
- Na 10 foute inlogpogingen per account (of 50 per netwerk) volgt een blokkade van 15 minuten. Ook nieuwe accounts en herstelpogingen zijn begrensd.
- AI krijgt alleen de gekozen bronpagina’s met vak en niveau: geen namen, antwoorden of voortgang. Per gezin geldt een maandlimiet, en het tokenverbruik wordt gemeten.
- Een auditlog bewaart vrijgaven, beoordelingen, verwijderingen en toestemming.

## Gegevens bewaren bij updates

- Databasewijzigingen gaan alleen via nieuwe, genummerde bestanden in `migrations/`. `npm run deploy` voert ze uit; bestaande rijen blijven staan.
- Gelijktijdige wijzigingen worden niet stilzwijgend overschreven: elk onderdeel heeft een versienummer. Bij een conflict laadt de app de nieuwste versie.
- Herstelpunten: Cloudflare D1 Time Travel (30 dagen). Daarnaast kunnen ouders een versleutelde back-up downloaden (AES-256-GCM, formaat `leerstap-v1`) en die weer importeren.
- **Overstappen van versie 0.1/0.2** (kluis op één apparaat): log in, ga naar *Gezin & instellingen → Back-up* en importeer de oude back-up. Staat de oude kluis nog in dezelfde browser, dan biedt de app zelf aan om hem over te zetten. De oude kluis blijft ongewijzigd staan.

## Bekende beperkingen

- De echte AI-koppeling is getest met een nagebootste provider, niet met een live sleutel. Test met een echt hoofdstuk vóór de proef met gezinnen.
- Er wordt geen e-mail verstuurd (geen e-mailverificatie, geen herstel per mail). Wachtwoordherstel voor ouders gaat met de herstelcode, voor kinderen via de ouder.
- Automatisch nakijken werkt alleen voor numerieke eindantwoorden. Open antwoorden en algebra beoordeelt een ouder.
- Geen pushmeldingen. Geen offline oefenen: de app opent zonder verbinding, maar opslaan wacht op internet en wordt automatisch opnieuw geprobeerd.
- De app-bundel is ruim 1,5 MB (PDF-lezer en lettertype). Bij de eerste keer laden duurt het even; daarna staat hij in de cache.

## Volgende stappen (na de proef)

E-mail (verificatie en herstel), betaalabonnement via Mollie/iDEAL, een "toets over X dagen"-planner, betere ondersteuning voor taalvakken (eigen beoordelingsmodellen), en daarna eventueel een appstore-versie via Capacitor.
