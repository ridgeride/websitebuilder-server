# Analyse Crypto Forecast Lab — 27 september 2026

Onderzocht: broncode v26.6.0 (363 bestanden) en de analyse-export van 27-09-2026 07:19 UTC (43.259 logregels uit 60 tabellen, volledig gepagineerd, geen atomaire momentopname). Alle tijden zijn UTC.

## 1. Kort antwoord

1. **Er is sinds 21 september 18:00 geen enkele papertrade meer geopend.** Dat klopt met je gevoel. Het zijn ongeveer zes dagen, geen weken. Daarvóór liep het aantal nieuwe trades al hard terug (15 sept: 41, 16 sept: 8, 17 sept: 5, 19–21 sept: 1 tot 4 per dag).
2. **De hoofdoorzaak is een vastgelopen keten.** Bitvavo geeft vanuit Cloudflare vrijwel continu *HTTP 429* (te veel aanvragen). Daardoor kunnen 6 open posities niet worden bijgewerkt. Een veiligheidsregel zegt: "zolang bestaande posities achterlopen, geen nieuw onderzoek". Die regel blokkeert daardoor sinds 22 september **álle** scans, analyses, de nieuwe Marktovergangen-proef, nabeschouwingen en historisch onderzoek.
3. **De 429's komen niet van jouw app.** De app pauzeert zelf 16 → 32 → 64 → 128 → 240 minuten, en stuurt in die tijd niets. Toch krijgt telkens de allereerste aanvraag na zo'n pauze wéér een 429, zelfs na 4 uur stilte. Bitvavo telt anonieme aanvragen per IP-adres, en alle Cloudflare Workers delen uitgaande adressen. Andere gebruikers van hetzelfde adres gebruiken jouw limiet op. Dit was in v26.3 nog een vermoeden; de logs van 22–27 september bewijzen het nu praktisch.
4. **De app leert op dit moment niet en past geen trades aan.** Dat heeft drie oorzaken:
   - Er sluiten geen trades meer, dus er komt geen nieuw leermateriaal binnen.
   - Alle 13 trades uit de nieuwe, strengere leerperiode (v26) zijn afgekeurd als "koerspad met gaten". Die gaten zijn echter minuten waarin op Bitvavo **niet gehandeld** werd. Bitvavo maakt voor zo'n minuut geen candle aan. Bij SOL ging het om 2 van de 1.440 minuten, bij NPC om 692 van de 1.440. Resultaat: **0 bruikbare leervoorbeelden**.
   - Sinds v26.3 opent de brede scan (42 strategieën) bewust geen trades meer, alleen nog observaties. De gerichte proeven hebben vaste regels en passen zich bewust niet automatisch aan.
5. **Tot en met 21 september verloor de papierportefeuille licht.** Er waren 179 gesloten trades met 27,4% winnaars, samen −€187 op inzetten van ongeveer €100. Om quitte te spelen was ongeveer 30,8% winnaars nodig geweest.

Ik heb een herstelversie **v26.6.1** gemaakt die de keten doorbreekt (zie hoofdstuk 6), met tests (260/260 geslaagd), typecheck, lint en een productiebuild.

## 2. Waarom er geen trades meer worden geopend

### Tijdlijn

| Periode | Wat de logs laten zien |
|---|---|
| 8–13 sept | Normaal draaien: 16–38 trades per dag. Wel al tientallen 429's per dag op losse munten (die munt werd dan overgeslagen). |
| 14–17 sept | Strategie-evaluatie meldt steeds vaker "controles overgeslagen" en "koerspaden met onverklaarde gaten". De laatste geslaagde strategie-evaluatie is op 17 sept 16:30. Sindsdien is dat taakje 422 keer op rij mislukt of uitgesteld. |
| 17–21 sept | Er zijn 40 → 505 429-fouten per dag. De oude pilotscan faalt bijna elke ronde. De laatste 3 trades worden geopend op 21 sept 18:00 (NPC ×2, DOGE). |
| 22 sept 08:15 | v26.3 wordt uitgerold. De brede scan opent vanaf nu bewust geen trades meer (`BROAD_SCAN_POLICY.openPositions=false`). De nieuwe achterstandsblokkade (`guardNewResearch`) wordt actief. |
| 22–27 sept | 96 van de 96 kwartierrondes per dag zijn "uitgesteld". De melding is steeds "Bitvavo: 6 bestaande posities lopen achter; eerst evaluaties bijwerken". De pauzes lopen op tot 4 uur; de melding op 27 sept is "8 opeenvolgende blokkades". |
| 25 sept 12:15 | v26.6.0 wordt uitgerold. De Marktovergangen-scan heeft sindsdien nog nooit kunnen draaien (173 keer uitgesteld). |

### De keten

```
Bitvavo 429 (gedeeld Cloudflare-IP)
  → app zet een bronpauze (tot 4 uur)
  → 6 open posities niet bijgewerkt (laatst: 23/24 sept 03:00)
  → achterstandsregel: "geen nieuw onderzoek zolang posities > 20 min achterlopen"
  → geen scans, geen instappen, geen Marktovergangen, geen nabeschouwing, geen historisch onderzoek
  → posities blijven achterlopen …
```

De 6 posities die alles tegenhouden:

| Trade | Munt | Richting | Verloopt | Laatst bijgewerkt |
|---|---|---|---|---|
| #95 | ETHFI 4u | short | 26 sept 16:00 (verlopen) | 24 sept 03:00 |
| #178, #179 | AVAX 4u | long | 3 okt | 24 sept 03:00 |
| #183, #184 | NPC 1u | short | 24 sept 18:00 (verlopen) | 24 sept 03:00 |
| #185 | DOGE 1u | long | 24 sept 18:00 (verlopen) | 23 sept 03:00 |

Vier van de zes zijn al verlopen. Ze kunnen alleen niet worden afgesloten zonder de koersminuten tot aan het verloopmoment.

### Bewijs dat de blokkade van buiten komt

- De app gebruikt maximaal 60 aanvragen per minuut. Bitvavo staat 1.000 gewichtspunten per minuut toe, en een blokkade voor anonieme aanvragen duurt 15 minuten.
- Na elke pauze (16 minuten tot 4 uur, waarin de app niets naar Bitvavo stuurt) krijgt de eerste aanvraag direct weer een 429. Voorbeelden: 23 sept 08:01 → pauze tot 12:01 → 12:16 weer 429 → pauze tot 16:16 → 16:30 weer 429, enzovoort.
- Eén keer (24 sept rond 18:00) lukte het kort. Direct daarna gaf Bitvavo aan dat er bijna geen budget meer over was, en volgde weer een 429. Dat is het patroon van een budget dat je met anderen deelt.

## 3. Leert de app nog, en past hij trades aan?

**Nee, op dit moment niet.** Dit is wat er in de export staat:

| Leeronderdeel | Laatste update | Invloed op trades |
|---|---|---|
| Strategieprestaties (60 varianten) | 17 sept | 59 van 60 staan op "testing" met gewicht 1,0 (neutraal). Eén "candidate": Ichimoku/RSI 1u short, 12 voorbeelden, gewicht 1,23. Sinds v26.3 gebruikt de brede scan dit niet meer om te openen. |
| Nieuwe leerperiode v26 (`verified26`) | — | 13 trades, **alle 13 uitgesloten** vanwege "gaten" (SOL 2/1.440 min, DOGE 20/90, ONDO 81/869, AVAX 385/1.440, SYRUP 503/1.440, NPC 692/1.440). Er zijn 0 geldige voorbeelden. |
| Signaalgewichten (1.521 stuks) | 23 sept | 1.394 staan nog op 0,5 (geen informatie). |
| Voorspellingen (24 uur) | 23 sept | 167 beoordeeld, 53 goed (31,7%). De Brier-score is 0,347, terwijl altijd "⅓-⅓-⅓" zeggen 0,333 geeft. De voorspellingen zijn dus nog iets slechter dan gokken. De app voorspelde 151 keer "base" als meest waarschijnlijk en nooit "bear", terwijl "bear" 61 keer de werkelijke uitkomst was. |
| Gerichte proef focused26_3 | sinds 22 sept | 0 trades. 2 ideeën afgewezen door het regimefilter (munt 1u, munt 4u én BTC 4u moeten alle drie dezelfde kant op wijzen). |
| Portefeuilleproeven (v26.5) en Marktovergangen (v26.6) | — | 0 trades. Ze konden sinds de uitrol nooit een marktronde draaien. |
| Oude pilot26 | 21 sept | 9 posities (3 ideeën × 3 exitvarianten), alle 9 uitgesloten wegens "gaten". Uitkomst: −€75 / −€75 / −€56. |

Samengevat: het ontwerp sinds v26.3 laat de app bewust **niet** zelf zijn trades aanpassen. Er is geen automatische promotie, en het beleid ligt vast totdat er genoeg onafhankelijke episodes zijn (minimaal 50 episodes en 8 weken). Daarnaast is de invoer voor het leren door de twee bugs hierboven helemaal opgedroogd.

## 4. Resultaten van de papertrades tot nu toe (8–21 sept)

| | Aantal | Winnaars | Som resultaat | Gemiddeld per trade |
|---|---|---|---|---|
| Alle gesloten | 179 | 27,4% | −€187,47 | −0,88% |
| Doel geraakt | 39 | — | +€384,11 | +10,54% |
| Stop geraakt | 125 | — | −€586,09 | −4,70% |
| Verlopen | 15 | — | +€14,51 | +1,18% |
| Long | 73 | 24,7% | −€42,66 | |
| Short | 106 | 29,2% | −€144,81 | |

- **Beste strategieën (klein aantal!):** Ichimoku/RSI (19 trades, +€29,89), RSI failure swing (5, +€18,62). **Slechtste:** Prijsactie met ATR-risico (6, −€28,46), Donchian/ADX (14, −€21,20), Parabolic SAR/ADX (11, −€19,41). Met 1 tot 19 trades per strategie is geen enkel verschil statistisch betrouwbaar.
- **Munten:** NPC 48 trades (−€49,97), DOGE 36 (−€17,97), IOST 17 (+€91,73, de enige duidelijke uitschieter).
- **Slechtste dag:** 15 sept, 41 trades, −€129,73. Van de 35 shorts werden er 27 gestopt; het was vermoedelijk een opleving.
- **Dubbele posities:** 120 van de 185 trades (65%) werden per twee geopend, op dezelfde munt, in dezelfde richting en in dezelfde minuut, door verschillende strategieën. Dat verdubbelt het risico en telt eigenlijk hetzelfde idee twee keer.
- **Scheve stops:** AVAX #178 heeft een stop 26% onder de instap en een doel 57% erboven, op een 4u-trade. De positiegrootte wordt dan klein (€18,54 voor €5 risico). Zulke trades zeggen weinig over de strategie.

## 5. Losse eindjes

Ernst: 🔴 blokkerend · 🟠 belangrijk · 🟡 opruimen/verbeteren

| # | Ernst | Bevinding | Status in v26.6.1 |
|---|---|---|---|
| 1 | 🔴 | Anonieme Bitvavo-aanvragen via het gedeelde Cloudflare-IP krijgen structureel 429. | **Opgelost:** marktdata-aanvragen worden ondertekend met je eigen read-only Bitvavo-sleutel, zodat Bitvavo per account telt. Er is een aparte pauze per modus. Weigert Bitvavo de sleutel, dan valt de app automatisch terug op anoniem. |
| 2 | 🔴 | Minuten zonder handel worden als "onverklaarde gaten" gezien. Daardoor wordt al het nieuwe bewijs uitgesloten, en ook instappen (41× "Instapvenster heeft onverklaarde ontbrekende candles"). | **Opgelost:** binnen een volledig ontvangen Bitvavo-venster telt een ontbrekende minuut als "geen handel". Ongeldige of dubbele candles blijven afgekeurd. Het beleid heeft een eigen versie (`coverage26_6_1-v1`). Oude labels worden niet herschreven. |
| 3 | 🔴 | In een rustige markt (NPC) zou een positie **nooit** kunnen verlopen als er in de laatste 5 minuten vóór het einde niet gehandeld werd. Hij bleef dan eeuwig "achterlopen" en blokkeerde alle nieuwe instappen. Dit was nog niet gebeurd, maar zou na herstel van de bron direct opduiken (NPC is een van de zes proefmarkten). | **Opgelost:** een bevestigde handelsstilte telt als actuele koers. De positie verloopt op de laatste werkelijke handelskoers, en de achterstandsregel ziet haar niet meer als verouderd. |
| 4 | 🔴 | Lege maar volledig opgehaalde koersvensters werden als fout behandeld. De positie schoof niet op, waardoor de achterstandsregel alles tegenhield. | **Opgelost** in strategie-evaluatie, pilot/gerichte proef, portefeuilleproeven en shadow-posities. |
| 5 | 🟠 | Sinds v26.3 opent de brede 42-strategieënscan geen papertrades meer. De enige bron van nieuwe trades is nu de strenge gerichte proef (6 munten, 3 signalen, drievoudige trendbevestiging). Ook met een werkende bron zullen er dus weinig trades komen. | **Bewust niet veranderd**, dit is jouw keuze (zie 7B). |
| 6 | 🟠 | 30% van de radar-/analyserondes (77 van 257) stopte op "Too many subrequests by single Worker invocation". 247 van 257 radarrapporten gebruikten daardoor het regelmodel in plaats van de AI-analyse. | Niet aangepast. Zie aanbeveling 7C. |
| 7 | 🟠 | De voorspellingen hebben geen voorspellende waarde (zie 3) en kiezen bijna altijd "base". | Niet aangepast. Een nieuwe drempel moet als nieuwe vooraf vastgelegde proef worden getest. |
| 8 | 🟠 | 60 dubbele trade-paren (zelfde munt, richting en minuut). | Niet relevant zolang de brede scan niet opent. Pas aan vóórdat je die weer aanzet. |
| 9 | 🟡 | Wachtrijen die door de blokkade stilstaan: 188 nabeschouwingen "processing", 103 schokmetingen, 851 historische jobs. | Lopen vanzelf weer zodra de bron werkt. De achterstand is groot; het inhalen duurt dagen. |
| 10 | 🟡 | De setupmotor (`trade_setups`) heeft in 19 dagen **nooit** een setup gemaakt. 224× was de reden "Geen liquide EUR-markt of onvoldoende chartbevestiging". | Controleer of je deze functie nog wilt, of maak de eisen minder streng. |
| 11 | 🟡 | De watchlist heeft 84 actieve items, waaronder niet-crypto of niet-Bitvavo tickers vanuit de wereldradar (GOOGL, HOOD, RBLX, GLD, SNDKB, OPENAI, ANTHROPIC …). Die kosten analysetijd en aanvragen. | Opschonen aanbevolen. |
| 12 | 🟡 | Telegram: 8.987 afleverregistraties in 19 dagen. Er zijn 3.571 meldingen, waarvan 623 ongelezen en 1.703 whale-meldingen. | Overweeg whale-meldingen alleen in het 4-uursoverzicht te zetten. |
| 13 | 🟡 | Bybit EU gaf 23–25 sept herhaald HTTP 403 of "partial". eToro gaf fouten op 14 sept. Het Bitvavo-portefeuilleoverzicht is sinds 13 sept niet ververst (alleen bij openen van dat scherm). | Informatief. Controleer de Bybit-regio en sleutelrechten. |
| 14 | 🟡 | `strategy_lab_cycle` staat in de gezondheidstabel nog op "error ×19" (laatst 22 sept). Deze taak bestaat sinds v26.3 niet meer. | Cosmetisch: oude status blijft zichtbaar. |
| 15 | 🟡 | 2× "Failed query: insert into automation_settings" op 18 sept. | Eenmalige D1-fout, daarna niet meer gezien. |

## 6. Wat v26.6.1 verandert

**Nieuw bestand:** `lib/bitvavo-market-auth.ts`
- Leest de Bitvavo read-only sleutel van de eigenaar uit de versleutelde kluis (of uit Cloudflare-secrets `BITVAVO_API_KEY`/`BITVAVO_API_SECRET`).
- Ondertekent uitsluitend publieke GET-aanvragen voor marktdata (candles/markten), op dezelfde manier als de bestaande portefeuillekoppeling.
- De sleutel wordt nooit opgeslagen in de cache, logs of browser.
- Bij HTTP 401/403 volgt een automatische terugval naar anoniem voor 30 minuten, met een zichtbare reden.
- Uitschakelen kan met de omgevingsvariabele `BITVAVO_MARKET_DATA_AUTH=off`.

**Aangepast:**
- `bitvavo-traffic.ts`, `public-market-cache.ts`: aparte pauze en blokkadereeks voor account en anoniem. Een oude IP-pauze blokkeert ondertekende aanvragen niet meer.
- `integrations.ts`: ondertekenen en terugvallen. Budget, cache en wachtrij blijven zoals ze waren.
- `research-policy.ts`, `chart-engine.ts`: `COVERAGE_POLICY coverage26_6_1-v1`. Minuten zonder handel worden als zodanig geteld (`quietMinutes`) en vastgelegd in het bewijs.
- `adaptive-exits.ts`: `priceConfirmedAt` en expiry na bevestigde stilte, tegen de laatste werkelijke handelskoers.
- `strategy-engine.ts`, `pilot-engine.ts`, `risk-engine.ts`, `research-shadows.ts`, `adaptive-engine.ts`: lege maar bevestigde vensters schuiven de positie op en kunnen haar laten verlopen. `lastClose` wordt bewaard.
- `focused-engine.ts`, `portfolio-risk.ts`, `research-equity.ts`, `research-report.ts`, `adaptive-report.ts`, `transition-engine.ts`, `post-trade-store.ts`: gebruiken de bevestigde dekking en het bevestigde prijstijdstip.
- `version-status.tsx`: onder de versieknop staat nu of Bitvavo-marktdata "ondertekend (accountlimiet)" of "anoniem (gedeeld IP)" loopt.

**Niet veranderd:** alle proefregels (`focused26_3-v1`, `portfolio26_5-v1`, `transition26_6-v1`), exitregels, risicobudgetten, `BROAD_SCAN_POLICY`, bestaande resultaten en labels. Er is geen databasemigratie nodig.

## 7. Wat jij moet doen en welke keuzes er zijn

### A. Uitrollen

1. Controleer in de app onder **Instellingen → API-sleutels** dat er een Bitvavo-sleutel staat met **alleen leesrechten** (geen handel, geen opname). In de export staan Bitvavo-saldi van 13 sept, dus waarschijnlijk is die er al.
2. Pak de ZIP uit en voer de PowerShell-opdracht uit `START-HIER-UPDATE.md` uit.
3. Controleer na de uitrol onder de versieknop:
   - dat er **v26.6.1** staat;
   - dat er "**ondertekend met je eigen read-only API-sleutel**" staat.
4. De eerstvolgende kwartierrondes werken eerst de 6 achterstallige posities bij. Reken op 1 à 2 uur: er staan nog herpogingstijden van maximaal een uur, en elke ronde haalt per positie maximaal 24 uur aan minuutdata op. Vier posities zijn al over hun einddatum. Die sluiten dan als "verlopen", of eerder als stop of doel in het gemiste stuk alsnog geraakt is. Daarna starten de scans vanzelf weer. Een oude anonieme pauze blokkeert de ondertekende aanvragen niet.
5. Het inhalen van de historische wachtrijen (851 jobs, 188 nabeschouwingen) kan enkele dagen duren. Dat is normaal.

### B. Keuze: wil je weer méér papertrades?

De brede scan staat sinds v26.3 bewust op "alleen observeren". Wil je weer veel papertrades en dat de 42 strategieën leren? Dan moet `BROAD_SCAN_POLICY.openPositions` op `true`. Doe dat bij voorkeur samen met:
- maximaal één positie per munt per richting (tegen de 65% dubbele trades);
- een maximale stopafstand (bijvoorbeeld 15%, zoals in de gerichte proef);
- een nieuwe leerperiode (`STRATEGY_EPOCH`), zodat oude en nieuwe resultaten gescheiden blijven.

Laat je hem uit, verwacht dan weinig trades. Die komen alleen wanneer munt 1u, munt 4u en BTC 4u gelijk wijzen op BTC, ETH, SOL, XRP, DOGE of NPC.

### C. Overige aanbevelingen

1. **Cloudflare-plan en subrequests:** controleer in het Cloudflare-dashboard of je Workers Free of Paid gebruikt. De foutmelding "Too many subrequests" betekent dat één aanroep te veel externe aanvragen doet. Op Paid is die limiet veel hoger. Dit raakt de AI-analyse en radar, niet de papertrades.
2. **Voorspellingen:** behandel de 24-uursvoorspelling voorlopig als informatie, niet als signaal. Ze scoort niet beter dan ⅓-⅓-⅓.
3. **Watchlist opschonen:** laat alleen munten staan die op Bitvavo in EUR verhandeld worden.
4. **Telegram:** whale-meldingen alleen in het overzicht.
5. **Pas de proefregels niet aan op basis van deze paar trades.** Er zijn te weinig voorbeelden per strategie om conclusies te trekken. Het grootste probleem was meten, niet de strategie.

## 8. Verantwoording en grenzen

- Controle in een ontwikkelomgeving: 260 van 260 tests geslaagd, waarvan 7 nieuw voor v26.6.1. Eén bestaande test is bewust aangepast omdat die precies het oude "gat"-gedrag vastlegde. Typecheck, lint en productiebuild zijn geslaagd.
- Er is **niets** gedeployed naar je Cloudflare-account en niets gewijzigd in je database. Er zijn geen orders verstuurd.
- Bitvavo was vanuit deze omgeving niet bereikbaar. Dat ondertekende aanvragen de gedeelde-IP-limiet omzeilen, volgt uit Bitvavo's eigen documentatie over rate limits: per account bij authenticatie, per IP zonder. Het ondertekeningsformaat is hetzelfde als dat van je werkende portefeuillekoppeling. Bevestig het na de uitrol aan de melding onder de versieknop en aan het verdwijnen van de "uitgesteld"-rondes.
- Kort na een minuutgrens kan een net gesloten minuut soms nog niet gepubliceerd zijn. Dat risico bestond al voor minuten aan het eind van een venster. v26.6.1 behandelt lege vensters op dezelfde manier en maakt het niet groter.
- De export is geen atomaire momentopname. Cijfers kunnen enkele regels afwijken van een momentopname op één tijdstip.
