# Wijzigingen

## 0.9.3 — 22 oktober 2026

- **AI controleert de uitgelezen tekst met de foto.** In het controlescherm legt de AI de tekst naast de foto en noemt concrete verschillen (verkeerd nummer, ontbrekende regel, fout woord of getal). Per verschil kies je *Toepassen* of *Negeren*, of *Alles toepassen*. De AI past zelf niets aan. Opnieuw laten controleren kan na eigen verbeteringen. Telt als één AI-controle per bestand.
- **Tips voor een goede foto** bij het uploaden en in het controlescherm: de scanfunctie van de telefoon gebruiken, plat en recht van boven, goed licht, één bladzijde per foto.
- Scans als pdf worden scherper omgezet voor het lezen (2× zo veel pixels).
- Een gedraaide foto wordt na het lezen ook rechtop bewaard, zodat hij in het controlescherm en voor de AI-controle goed staat.

## 0.9.2 — 22 oktober 2026

- Foto’s worden standaard door de **AI** gelezen (beste kwaliteit, ook bij tabellen en formules; ± 0,2 cent per bladzijde). Lezen **op het apparaat** (gratis) is een keuze bij *Gezin & instellingen → Foto’s uitlezen*, en wordt altijd gebruikt zonder AI-toestemming of als de AI niet bereikbaar is.

## 0.9.1 — 22 oktober 2026

- **Gedraaide foto’s:** de draaiing die een telefoon apart opslaat, wordt nu toegepast voordat een foto wordt bewaard of gelezen. Blijft het resultaat slecht, dan probeert Leerstap de foto een kwartslag en een halve slag gedraaid en kiest de beste stand.
- **Ruis opruimen:** regels met alleen tekens van randen, schaduwen of de tafel (zoals `== —_—`) worden weggelaten.
- **Automatisch naar de AI** als de herkenning op het apparaat te onzeker is (en AI-toestemming gegeven is).
- **Opnieuw lezen** in het controlescherm, voor foto’s die eerder onzin-tekst kregen.
- Hersteld: het verkleinen van foto’s bij uploaden werkte online niet, omdat de beveiligingsregels van de site een tussenstap blokkeerden.

## 0.9.0 — 22 oktober 2026

Goedkoper, zonder in te leveren op "alleen uit het boek".

- **Tekst uitlezen op het apparaat zelf.** Foto’s van het boek worden in de browser gelezen (Tesseract, Nederlandse taalmodellen plus Frans, Engels, Duits of Spaans bij die vakken), zonder AI en zonder kosten. De foto gaat daarvoor nergens heen. De bestanden komen van de eigen site en worden alleen de eerste keer geladen.
- **De AI als reserve:** twijfelde de herkenning, of klopt het niet bij formules of een rommelige bladzijde, dan staat in het controlescherm *Laat de AI het uitlezen*.
- **Goedkoper model voor eenvoudige taken:** *Leg het uit* en woordjes uit tekst gebruiken `OPENAI_MODEL_LIGHT` (standaard `gpt-4.1-nano`). Nakijken, samenvattingen, papieren proefwerken en alles met een foto blijven op het hoofdmodel.
- Duidelijke foutmelding als OpenAI weigert: tegoed of budget op, sleutel geweigerd, model niet beschikbaar, of even te druk.
- Beveiligingsregels: `'wasm-unsafe-eval'` toegestaan, nodig voor de tekstherkenning in de browser.

## 0.8.2 — 22 oktober 2026

- Zelf een vak toevoegen bij het uploaden en verplaatsen (*+ Ander vak toevoegen…*). Meer vakken in de lijst, zoals Natuur & techniek, Science en Mens & maatschappij. Vakken die al in gebruik zijn, staan bovenaan.

## 0.8.1 — 22 oktober 2026

- **Hoofdstuk verwijderen** bij elke map: alle bladzijden en bestanden, de leerstof die ervan gemaakt is en desgewenst de resultaten, in één keer.
- **Alle leerstof verwijderen** bij *Gezin & instellingen* om schoon te beginnen (met VERWIJDER als bevestiging). Leerlingen, logins en woordenlijsten blijven bestaan. Alleen voor ouders.

## 0.8.0 — 22 oktober 2026

- **Foto’s van het boek worden tekst.** Bij een hoofdstuk met foto’s staat eerst *Tekst uitlezen en controleren*. De AI schrijft de tekst letterlijk over (met paragraafnummers, formules, tabellen; plaatjes als [Afbeelding: …], onleesbaar als [onleesbaar]). Je ziet foto en tekst naast elkaar, verbetert wat niet klopt en klikt *Tekst klopt*.
- **Alleen uit de gecontroleerde tekst.** Pas daarna kan de samenvatting worden gemaakt. De analyse krijgt dan alleen de tekst, zodat elk citaat letterlijk wordt gecontroleerd; ook woordjes, nakijken en *leg het uit* gebruiken die tekst.
- **Foto’s verwijderen:** na het controleren vraagt Leerstap: *Let op: de tekst is opgeslagen. Wil je de foto’s verwijderen?* Ja: de foto wordt overal gewist en vervangen door een tekstbestand (veel kleiner). Nee: de foto blijft, en verwijderen kan later met één klik bij het hoofdstuk.
- Elke bladzijde laat zien waar hij staat: *Foto · tekst nog uitlezen*, *Tekst nog controleren*, *Tekst gecontroleerd* of *Alleen tekst*.
- Uitlezen telt als één AI-controle per bestand.

## 0.7.1 — 22 oktober 2026

- **Uploaden in vaste stappen:** eerst vak en hoofdstuk kiezen (verplicht, niets vooraf ingevuld), dan bladzijden uploaden, dan laten analyseren. Zonder vak en hoofdstuk wordt er niets geüpload.
- **Een map per vak en hoofdstuk** onder *Mijn hoofdstukken*, gegroepeerd per vak. Per map: bladzijden bekijken, **bladzijden toevoegen** (ook later), samenvatting laten maken, en **vak of hoofdstuk wijzigen** om uploads naar de juiste plek te verplaatsen.
- **Opnieuw analyseren** als er bladzijden bij zijn gekomen: de bestaande leerstof wordt vervangen (zelfde naam en plek), eerdere resultaten blijven bewaard; een ouder geeft de nieuwe versie opnieuw vrij.
- Foto’s van een telefoon worden bij het uploaden verkleind (± 2000 pixels, JPEG): even goed leesbaar, een fractie van de opslag.

## 0.7.0 — 22 oktober 2026

- **Alles uit het eigen boek.** De analyse gebruikt uitsluitend de geüploade bronnen (geen eigen kennis, geen internet) en volgt de werkwijze, notatie en termen van het boek. Per paragraaf wordt de methode van het boek vastgelegd en getoond (*Zo pakt het boek het aan*).
- **Nakijken tegen het boek.** Foto nakijken en *Leg het uit* krijgen de geciteerde bladzijde zelf mee (tekst of scan) en de methode. Een goed antwoord met een andere methode krijgt de punten volgens het puntenmodel, met uitleg waarom het klopt en hoe het boek het doet; een toevallig goed antwoord met een onjuiste aanpak wordt ook uitgelegd. Na een automatisch goed antwoord kun je je aanpak laten checken. *Leg het uit* meldt wat niet in het boek staat.
- **Woordjes alleen uit de eigen bron.** De Franse voorbeeldlijst is weg. Woordjes haal je uit een geüploade bron of een foto van de bladzijde (die wordt dan bij je leerstof bewaard); elk paar moet letterlijk in de bron staan, anders wordt het weggelaten. Bij een foto vraagt Leerstap je te vergelijken met het boek. Zelf overtypen kan nog steeds. Een lijst laat zien uit welke bron hij komt.
- **Papieren proefwerk.** *Proefwerk printen* maakt een PDF met een code. Na het maken upload je foto’s of een scan; de AI kijkt elke vraag na met het puntenmodel en de methode uit het boek. Je krijgt een cijfer, een korte samenvatting van de nakijker, terugkoppeling per paragraaf en per soort vraag (bijvoorbeeld welke soort sommen goed gaan en welke meer oefening nodig hebben), met een knop om precies dat te oefenen. Twijfelgevallen staan klaar voor een ouder. Telt als één analyse.
- **Kiezen wat je leert.** Bij oefenen, drill en proefwerk zet je per paragraaf én per onderwerp aan of uit, en kun je overslaan wat je al beheerst.
- **Advies voor vandaag** op de startpagina: maximaal drie concrete tips met de reden erbij (toets in aantocht, zwakste onderwerp, herhaling, nieuwe leerstof, woordjes), elk met een knop om te beginnen.
- Migratie `0005_papier.sql` (tabel `items` zonder vaste lijst met soorten; de server controleert elk onderdeel).

## 0.6.0 — 22 oktober 2026

Een complete leerapp voor de leerling.

- **Drill:** alle vragen van de gekozen paragrafen tot alles beheerst is. Wat in één keer goed gaat, komt niet meer terug; wat fout ging, komt na een andere vraag terug tot het twee keer achter elkaar goed is. Ook "Drill de fouten" vanuit Voortgang.
- **Woordjes:** nieuwe pagina. Lijsten typen (`huis = maison`, alternatieven met `/`, haakjes optioneel) of uit een foto van het boek laten halen. Overhoren in beide richtingen, met uitleg bij bijna-goed (lidwoord, accent, kleine spelfout) en uitspraak via de browser. Elk gezin krijgt een Franse voorbeeldlijst.
- **Toets op maat:** paragrafen kiezen, een realistische toets (basis, toepassen en inzicht door elkaar, van makkelijk naar moeilijk, met richttijd) of één niveau. Na afloop terugkoppeling per paragraaf en leerdoel: wat zit goed, waar je meer op moet leren en waarom (bijvoorbeeld "3× rekenfout"), met knoppen naar de samenvatting en een drill van precies die paragraaf. De AI geeft nieuwe vragen nu een paragraaf mee; bij oudere leerstof wordt die afgeleid.
- **Toetsplanner:** toets met datum, leerstof en tijd per dag. Elke dag een korte taak; twee dagen ervoor een proefwerk, de dag ervoor alleen herhalen wat nog niet zit. Oefenen met die leerstof vinkt de dag af. De taak van vandaag staat op de startpagina; ouders zien de planning per kind.
- **AI-nakijken van een foto:** in oefenen en drill een foto van de uitwerking laten nakijken met het puntenmodel, met per stap wat klopt. Twijfel wordt als twijfel getoond; de foto wordt niet bewaard.
- **Zelf nakijken:** open vragen in oefenen en drill vergelijk je met het modelantwoord (goed, deels, nog niet).
- **Leg het uit:** bij elke paragraaf een begrip in eigen woorden uitleggen; de AI vergelijkt het met het boek en zegt wat klopt, wat mist en geeft een tip.
- **Rustige motivatie:** weekoverzicht (dagen geoefend, vragen beantwoord, wat stevig zit) en "klaar voor de toets"-percentages per leerstof, paragraaf, woordenlijst en planning.
- **Meldingen:** knop *Idee of vraag?* in elke pagina. Meldingen verschijnen in Beheer (met aantal in het menu); je antwoord ziet de gebruiker in de app.
- **Wachtwoord van een kind:** duidelijker te vinden bij *Gezin & instellingen* ("Wachtwoord vergeten? Nieuw wachtwoord instellen").
- AI-controles (foto, uitleg, woordjes uit foto) hebben een eigen maandlimiet per gezin (`AI_CHECK_LIMIT`, standaard 300) en tellen niet mee voor de analyses.
- Back-ups bevatten nu ook woordenlijsten en planningen. Privacyverklaring aangevuld.
- Migratie `0004_leren.sql` (tabel `items` opnieuw opgebouwd met twee nieuwe soorten, tabel `feedback`, kolom `usage.checks`). Bestaande gegevens blijven staan.

## 0.5.0 — 22 oktober 2026

- **Toegang aanvragen:** op de inlogpagina staat een tabblad *Toegang aanvragen* (naam, e-mail, optioneel bericht). Aanvragen verschijnen in Beheer, met het aantal in het menu (*Beheer · 2*). *Accepteren* maakt een uitnodiging die alleen voor dat e-mailadres werkt, met een knop *Mailen* die je mailprogramma opent met het bericht klaar. *Afwijzen* verwijdert de aanvraag.
- **Uitnodiging aan een e-mailadres koppelen:** optioneel bij *Gezin uitnodigen*. Komt de code ergens anders terecht, dan kan niemand anders hem gebruiken. Met een gekoppelde uitnodiging hoeft de ouder de code niet over te typen.
- Aanvragen zijn begrensd (5 per uur per netwerk, maximaal 500 open) en bots worden met een verborgen veld tegengehouden. Het antwoord verraadt niet of een e-mailadres al een account heeft.
- Privacyverklaring aangevuld met de gegevens van een aanvraag en hoe lang die bewaard blijven.
- Migratie `0003_aanvragen.sql`.

## 0.4.0 — 22 oktober 2026

Beheer voor de proefperiode.

- **Pagina Beheer** (alleen voor de e-mailadressen in `ADMIN_EMAILS`): persoonlijke uitnodigingen maken, met een code die één keer werkt, een link en een kant-en-klaar bericht om te kopiëren. Open uitnodigingen kun je intrekken.
- **Uitnodigingslink:** `leerstap.nl/?uitnodiging=CODE` opent "Account maken" met de code al ingevuld.
- **Gezinnen beheren:** overzicht met e-mailadres van de ouder, aantal leerlingen, leermodules, oefensessies, AI-gebruik deze maand, aanmelddatum, uitnodiging en laatst actief. Geen leerstof, antwoorden of namen van kinderen.
- **Pauzeren en hervatten:** een gepauzeerd gezin wordt overal afgemeld en kan niet inloggen; de gegevens blijven bewaard.
- **Nieuwe herstelcode** voor een ouder die de code kwijt is, en **gezin verwijderen** (met je eigen wachtwoord ter bevestiging), inclusief alle bestanden.
- `INVITE_ONLY = "true"` maakt een uitnodiging verplicht, ook zonder algemene `INVITE_CODE`.
- Database-migratie `0002_beheer.sql` (tabel `invites`, kolommen `blocked_at` en `last_seen`). Bestaande gegevens blijven staan.

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
