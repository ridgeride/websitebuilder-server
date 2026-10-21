# Leerstap 0.1.0

Een Nederlandstalige gezinsleerapp voor 2 havo/vwo, uitbreidbaar naar andere vakken en niveaus. Dit is een werkende eerste versie, geen volledig leerlingvolgsysteem of beveiligde examenomgeving.

## Snel gebruiken

1. Open de privéwebsite op desktop of Android in een recente Chrome/Edge-browser. De hosting gebruikt de toegang van de eigenaar; geef kinderen niet je ChatGPT-inloggegevens. Afzonderlijke kinderaccounts zijn nog geen onderdeel van deze versie. Gebruik samen de gezinsomgeving.
2. Kies **Bekijk de voorbeeldles zonder opslag** om direct de wortelmodule te proberen. Deze modus bewaart niets.
3. Voor bewaren: sluit de voorbeeldmodus, kies een gezinswachtwoord van minstens 10 tekens en bewaar dit zelf. Er is geen herstelservice. Gebruik geen incognitomodus.
4. Voeg via **Gezin & instellingen** leerlingprofielen toe. Kies schooltype, leerjaar en vakken, of voeg een eigen vak toe. Gebruik bijnamen. Profielen delen leerstof; antwoorden en voortgang zijn apart.
5. **Mijn leerstof**: upload PDF, DOCX, TXT/MD, JPG, PNG of WEBP, eventueel meerdere bestanden. Of plak tekst. Maximaal 10 MB per bestand, 30 pagina's per analyse en 30.000 tekens per tekstdeel. DOCX wordt een tekstdeel zonder betrouwbare fysieke paginanummers; formules als objecten en afbeeldingen worden niet uit DOCX gehaald. Bekijk de extractie voordat je analyseert.
6. Selecteer bronnen, vak, niveau, schooljaar, periode en hoofdstuk; de lesmethode is optioneel. AI-analyse werkt alleen met de serverconfiguratie hieronder. Geef als ouder toestemming voor verzending. Resultaten zijn concepten totdat een ouder alle samenvattingen, broncitaten, vragen, antwoorden en punten heeft gecontroleerd en vrijgegeven.
7. **Oefenen**: kies niveau en aantal. Je kunt `√81`, `sqrt(81)`, `2*sqrt(3)`, `1/2` of decimalen invoeren. Tussenstappen kunnen op aparte regels. Hints en uitleg verschijnen tijdens oefenen.
8. **Proefwerk**: geen hints of nakijkfeedback tijdens de sessie. Na inleveren zie je punten, foutfocus en uitwerkingen. PDF-opgaven en PDF-antwoorden zijn aparte bestanden met dezelfde geselecteerde vragen. Je kunt deze printen. Maak beide exports voordat je nieuwe sessies afrondt, want de adaptieve selectie kan daarna veranderen.
9. Open **Voortgang** en oudermodus om twijfelgevallen te beoordelen. Ken halve of hele deelpunten toe met een toelichting. Het cijfer blijft voorlopig zolang er onzekere antwoorden zijn.
10. Download regelmatig een **versleutelde back-up**. Die bevat ook de bronbestanden. Herstel op een ander apparaat met hetzelfde back-upwachtwoord. Dit vervangt de kluis op dat apparaat; er is geen samenvoeging of automatische synchronisatie.

## Installeren op een eigen computer

Het meegeleverde ZIP-pakket bevat al de build. Op Windows kun je met geïnstalleerde Node.js direct `Start-Leerstap.cmd` openen en daarna naar `http://127.0.0.1:4173` gaan. De onderstaande installatie is nodig als je broncode wilt wijzigen of opnieuw bouwen.

Vereist: Node.js 22 of 24 en npm. Open een terminal in deze projectmap:

```text
npm ci
npm test
npm run build
npm start
```

Open `http://127.0.0.1:4173`. De lokale server luistert alleen op deze computer. Hij is bewust niet beschikbaar vanaf andere apparaten via het thuisnetwerk. Gebruik voor Android de HTTPS-privéwebsite, of richt zelf een goed beveiligde HTTPS-hosting in. Op Android kun je via het browsermenu een snelkoppeling aan het startscherm toevoegen. Dit is geen offline PWA; er is geen service worker.

## AI aansluiten

Er is geen API-sleutel meegeleverd, opgeslagen of gebruikt. De echte providerroute is nog niet live geverifieerd. Het codepad is getest met een gecontroleerd providerantwoord.

- Provider: OpenAI Responses API, tekst- en afbeeldingsinvoer, strikt JSON-schema.
- Verplicht servergeheim: `OPENAI_API_KEY`.
- Optioneel: `OPENAI_MODEL`, standaard `gpt-4.1-mini`. Het gekozen model moet afbeeldingen en structured outputs ondersteunen; beschikbaarheid en kosten hangen van je provideraccount af.
- Lokaal: kopieer `.env.example` naar `.env`, vul de sleutel lokaal in en start met `node --env-file=.env scripts/serve.mjs`. `.env` staat in `.gitignore` en hoort nooit in een back-up of bronarchief.
- Gehost: configureer de sleutel als Sites-runtime-secret en publiceer daarna opnieuw. Schakel voor hulp bij veilige sleutelconfiguratie de OpenAI Developers-plugin in. Plak geen sleutel in deze chat of in leerlingvelden.
- De browser toont alleen of de provider is gekoppeld, nooit de sleutel. AI krijgt de geselecteerde pagina's plus vak/niveau; geen profielnamen, voortgang of antwoorden.
- `store:false` is ingesteld. Dit is geen belofte dat de provider niets tijdelijk verwerkt of bewaart; de voorwaarden en instellingen van het provideraccount blijven gelden. Stel zelf een providerbudget/limiet in. Er is nog geen duurzame quota- of wachtrijvoorziening per gezin.

Officiële bronnen voor de koppeling: https://developers.openai.com/api/docs/guides/images-vision en https://developers.openai.com/api/docs/guides/structured-outputs.

## Architectuur en controle

Het **leerarchief** bewaart modules met samenvattingen, begrippen, vragen en bronverwijzingen. Filter op vak, schooljaar en periode. In een module kun je naam en opslaglocatie wijzigen zonder antwoorden of eerdere resultaten te wijzigen. Verwijderde modules en documenten staan in de prullenbak en kunnen worden hersteld. Definitief verwijderen vraagt oudermodus en bevestiging. Een bron die nog bij een module of toets hoort wordt beschermd tegen definitieve verwijdering. De voorbeeldmodule blijft beschikbaar. Verwijderen uit de kluis verwijdert geen al gedownloade back-ups.

- Browser: lokaal gebundelde JavaScript-app, responsive CSS, PDF.js voor PDF-tekst/scans, JSZip + XML-tekstextractie voor DOCX, jsPDF met ingebed Liberation Sans voor PDF-export. Geen externe CDN's, advertenties of tracking.
- Opslag: IndexedDB met één AES-256-GCM-versleutelde gezinskluis. PBKDF2-SHA256 met 310.000 iteraties, willekeurig salt en een nieuwe IV per opslag. Wachtwoord en sleutel worden niet in de browseropslag bewaard. Sluit de kluis wanneer je wegloopt; de app vergrendelt niet automatisch bij inactiviteit. Een ontgrendeld apparaat/browsergeheugen is geen afgeschermde omgeving.
- Server: Cloudflare Worker-compatible `fetch`-handler; de lokale Node-server gebruikt dezelfde handler. Gehost vereist de AI-route Sites-identiteit. De route controleert herkomst, formaat en invoergrootte. Geen documentdatabase of objectopslag op de server: uploads blijven in de lokale kluis.
- Analyse: broncitaten en paginaverwijzingen worden gevalideerd. Tekstcitaten moeten letterlijk in de bron staan; scancitaten vragen visuele oudercontrole. Dit controleert herleidbaarheid, niet automatisch feitelijke juistheid. Vrijgave door een ouder is altijd nodig.
- Beoordeling: eigen beperkte rekenparser, zonder `eval`. Alleen numerieke eindwaarden worden automatisch vergeleken met tolerantie. Geen algemene CAS voor algebra, eenheden, bewijs of complexe formules. Andere antwoorden krijgen ouderreview. Een fout numeriek antwoord met tussenstappen blijft open voor deelpunten. De betrouwbaarheid is een proceslabel, geen gekalibreerde kans.
- Adaptief: eerdere fouten eerst, daarna vervallen herhalingen, dan nieuwe vragen. Dit is prioritering uit de aanwezige vragenbank, geen automatische onbeperkte vraaggeneratie of psychometrische niveauschatting.
- Herhaling: 1 dag, verdubbeling na een goed antwoord tot 30 dagen, terug naar 1 dag bij fouten. Geen pushmeldingen.
- Cijfer: `1 + 9 × punten/totaal`, één decimaal. Niet bedoeld als officiële schoolnormering. Ouderreview overschrijft het voorstel en bewaart een toelichting.
- Er is maximaal één actieve sessie in de gezinskluis. Starten van een nieuwe sessie vraagt bevestiging als een andere nog loopt.

## Updates zonder dataverlies

- Applicatieversie `0.1.0`, opslagformaat `version:1`, back-upformaat `leerstap-v1`.
- De app initialiseert alleen een lege kluis als er nog geen kluis is. Een update schrijft niet automatisch voorbeelddata over bestaande data.
- Bewaar hetzelfde HTTPS-webadres en gebruik dezelfde browser/opslag. Een ander domein of poort heeft een andere kluis; zet dan een back-up terug.
- Maak vóór updates een back-up. Herstel valideert formaat en wachtwoord voordat de bestaande kluis wordt vervangen. Vreemde versies worden geweigerd, niet gereset.
- Houd toekomstige formaatwijzigingen als expliciete migratie met tests en herstelmogelijkheid. Versie 1 heeft nog geen eerdere versie om van te migreren.
- Bewaar broncode in Git; `package-lock.json` legt afhankelijkheden vast. `.env`, gebruikersdata, `node_modules` en buildoutput horen niet in Git. Een terugrol van code herstelt geen browserdata; gebruik daarvoor de versleutelde back-up.

## Beperkingen van de MVP

Geen afzonderlijke ouder/kind-login, centrale gezinsdatabase, automatische cloudsynchronisatie, serverback-ups, semantische AI-beoordeling van open antwoorden, volwaardige formule-editor, algemene algebra-equivalentie of automatische leerstofcorrectie. De privéhosting beschermt de toegang van de eigenaar, maar browserprofielen zijn geen beveiligingsrollen. Voor gebruik door meerdere gezinnen zijn echte accountisolatie, serveropslag, quota, auditlog en herstelprocedures volgende bouwstappen.

PDF’s hebben paginanummers, antwoordruimte en aparte puntmodellen. DOCX-paginanummers zijn tekstdeelverwijzingen. Bij onduidelijke scans verschijnt een waarschuwing; de ouder bepaalt of het materiaal bruikbaar is. De meegeleverde wortelmodule is nieuw opgesteld en is geen reconstructie van de eerdere chatfoto's.

## Controle uitvoeren

```text
npm test
npm run build
npm run validate
```

Zie `TESTRESULTATEN.md` voor wat daadwerkelijk is gecontroleerd en wat nog een live sleutel of een echt Android-toestel vereist.
