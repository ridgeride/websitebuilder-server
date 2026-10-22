# Wijzigingen

## 0.3.0 — 22 oktober 2026

Van een app op één apparaat naar een website met gezinsaccounts.

- **Accounts:** gezinsaccount voor de ouder (e-mail + wachtwoord + eenmalige herstelcode), eigen login per kind, wachtwoord wijzigen, kind toevoegen of verwijderen, gezinsaccount verwijderen.
- **Centrale opslag:** leerstof, bronnen, resultaten en lopende sessies staan op de server en zijn op elk apparaat beschikbaar. Er worden alleen gewijzigde onderdelen verstuurd. Conflicten tussen apparaten worden gedetecteerd in plaats van overschreven. Een opslagstatus is altijd zichtbaar, en mislukt opslaan wordt automatisch opnieuw geprobeerd.
- **Rechten op de server:** kinderen zien alleen hun eigen resultaten. Vrijgeven, beoordelen en definitief verwijderen kan alleen een ouder. Gezinnen zijn volledig van elkaar gescheiden.
- **AI:** toestemming wordt één keer per gezin gegeven (en kan worden ingetrokken), waarna ook kinderen kunnen laten analyseren. De server haalt de bronpagina’s zelf uit de opslag en controleert citaten daartegen. Maandlimiet per gezin en meting van tokenverbruik.
- **Installeerbaar (PWA):** manifest, iconen en service worker. Opent ook zonder verbinding.
- **Hosting:** Cloudflare Workers + D1 + R2 (EU). Lokaal draait dezelfde code met SQLite en een map. Dagelijkse opschoning van verlopen sessies.
- **Privacy en voorwaarden:** conceptpagina’s. Publiceren wordt geblokkeerd tot ze zijn ingevuld.
- **Overstappen:** import van back-ups uit 0.1/0.2, en automatische herkenning van de oude kluis in dezelfde browser.
- **Tests:** 28 unit- en servertests, waaronder isolatie tussen gezinnen en kinderen. Een browsertest van de volledige route voor ouder en kind. Een GitHub-workflow draait alles bij elke wijziging.
- Opgeruimd: een lege `@import` in de stylesheet die de beveiligingsregels blokkeerden, de verouderde OpenAI Sites-koppeling en het oude pakketscript.

## 0.2.0

Foute antwoorden komen tijdens het oefenen terug na maximaal twee andere vragen: eerst met uitleg, daarna tot twee zelfstandige antwoorden achter elkaar goed zijn. Fouten en geholpen antwoorden staan na tien minuten weer klaar. Zelfstandig goede antwoorden krijgen oplopende intervallen tot dertig dagen. Proefwerken en onzekere beoordelingen krijgen geen automatische herhaling. Je kunt stoppen en de beantwoorde vragen bewaren.

## 0.1.0 — 21 oktober 2026

Eerste versie: Nederlandse leerroute, lokale versleutelde kluis, profielen, upload en bronextractie, AI-analyse via de server, verplichte vrijgave door een ouder, voorbeeldmodule wortels, rekencontrole, review met deelpunten, adaptieve vraagselectie, herhaalplanning, cijfers, voortgang en aparte PDF-exports. Daarbij: schooltype en leerjaar, vakkeuze, een archief per vak/schooljaar/periode/hoofdstuk, en een prullenbak.
