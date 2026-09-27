# Verificatie v26.6.1

Gecontroleerd in de ontwikkelomgeving op 27 september 2026 met Node 22:

- `npm run check` (lint, typecheck, productiebuild en alle tests): **263 geslaagd, 0 mislukt, 0 overgeslagen**, inclusief 9 nieuwe tests in `tests/market-data.test.mjs` en de bestaande serverrender-test.
- `npm run test:core` (zoals CLOUDFLARE-UPDATE.ps1 draait): geslaagd.
- ESLint en TypeScript: geen meldingen.
- Productiebuild: geslaagd, 17 JavaScriptbestanden gecontroleerd. De bronexport bevat 368 bestanden.
- Cloudflare-preflight: D1-binding, minuutcron en secretdeclaratie aanwezig. Geen evidente hardcoded secrets.

## Nieuwe regressiedekking

- Stille minuten binnen een volledig ontvangen venster tellen als `continuous` met `quietMinutes`. Ongeldige of dubbele candles blijven `invalid`. `candleCoverage` zelf is ongewijzigd.
- Een schaars ontvangen Bitvavo-venster wordt vastgelegd met het aantal stille minuten.
- Een positie in een stille markt verloopt op de laatste handelskoers zodra het venster bevestigd is. Zonder bevestiging blijft het oude gedrag gelden.
- Een positie die al tot haar einde verwerkt is, verloopt via een leeg bevestigd venster.
- Marktdata wordt ondertekend met exact het Bitvavo-HMAC-formaat (timestamp + methode + pad + query). De sleutel komt niet in de cache.
- Een anonieme IP-pauze blokkeert ondertekende aanvragen niet. Een accountpauze wordt apart opgeslagen.
- Een geweigerde sleutel (HTTP 401 of errorCode 3xx) valt in dezelfde aanvraag terug op anoniem. Een HTML-blokpagina (403) schakelt de sleutel niet uit.
- Zonder sleutel blijven aanvragen ongetekend en gebruiken ze de oorspronkelijke pauze.
- Een verlopen v26-strategietest met een stille laatste periode sluit als `chronological_v3`, is leerbaar en haalt de achterstandsblokkade weg. Een oudere positie haalt de laatste handelskoers exact terug uit de opgeslagen fill.

## Bewust aangepaste bestaande test

`research-v26.test.mjs` legde vast dat één ontbrekende minuut in een ontvangen venster een pilotpositie uitsloot. Die test controleert nu het nieuwe beleid: de stille minuut is geen gat. Hij controleert ook dat een eerder opgeslagen `gaps_unresolved`-label behouden en uitgesloten blijft.

## Grenzen

Er is geen deployment naar jouw Cloudflare-account uitgevoerd, niets gewijzigd in je productiedatabase en geen Telegram-bericht of beursorder verstuurd. Bitvavo was vanuit deze omgeving niet bereikbaar. Het ondertekende verkeer is getest met gemockte antwoorden en gebruikt hetzelfde formaat als de bestaande, werkende portefeuillekoppeling. De PowerShell-updateflow is alleen statisch gecontroleerd, niet op Windows uitgevoerd. Er is geen interactieve browsercontrole gedaan. Deze controles bewijzen softwaregedrag in de geteste gevallen, geen winstverbetering.
