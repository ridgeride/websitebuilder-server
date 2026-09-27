# v26.6.1 — Bronherstel Bitvavo en rustige markten

Herstelrelease na de analyse van 27 september 2026 (zie ANALYSE-CLAUDE-2026-09-27.md). Sinds 21 september werden geen papertrades meer geopend en sinds 22 september werd vrijwel iedere marktronde uitgesteld. Deze release lost de oorzaken op zonder proefregels te wijzigen.

## Wat was er mis?

1. **Gedeeld IP bij Bitvavo.** Anonieme aanvragen worden door Bitvavo per IP-adres geteld. Cloudflare Workers delen uitgaande adressen. Na elke eigen pauze (tot 4 uur zonder één aanvraag) gaf de eerste aanvraag direct weer HTTP 429. Zes open posities konden daardoor niet worden bijgewerkt, en de achterstandsregel hield vervolgens alle nieuwe scans, proeven en nabeschouwingen tegen.
2. **Geen handel ≠ ontbrekende data.** Bitvavo maakt geen 1m-candle voor een minuut zonder transacties. De app zag zulke minuten als "onverklaarde gaten". Alle 13 trades van de nieuwe leerperiode en alle 9 pilotposities werden daardoor uitgesloten van bewijs (bijvoorbeeld SOL: 2 van 1.440 minuten zonder handel).
3. **Rustige markt kon niet verlopen.** Een positie verliep alleen als de laatste handelskoers binnen 5 minuten vóór het einde lag. In een rustige markt bleef de positie dus open en "verouderd", en blokkeerde ze nieuwe instappen.

## Wat verandert er?

- **Ondertekende marktdata.** Publieke candle- en marktaanvragen worden ondertekend met je eigen Bitvavo read-only sleutel uit de versleutelde kluis (of uit de Cloudflare-secrets `BITVAVO_API_KEY`/`BITVAVO_API_SECRET`). Bitvavo telt de limiet dan per account in plaats van per gedeeld IP. Budget, cache, wachtrij en pauzes blijven gelden, maar de pauzes zijn nu gescheiden per modus (`bitvavo:cooldown:account` of `bitvavo:cooldown`). Weigert Bitvavo de sleutel (401/403), dan valt de app 30 minuten terug op anoniem en toont de reden. Uitschakelen kan met `BITVAVO_MARKET_DATA_AUTH=off`.
- **Dekkingsbeleid `coverage26_6_1-v1`.** Binnen een volledig ontvangen Bitvavo-venster telt een minuut zonder candle als minuut zonder handel (`quietMinutes`). Ongeldige of dubbele candles blijven een weigering. Het beleid en het aantal stille minuten staan in het bewijs van iedere controle.
- **Bevestigde stilte.** Een leeg, volledig ontvangen venster schuift een positie op in plaats van een fout te geven. Na het einde van de looptijd sluit de positie op de laatste werkelijke handelskoers, met de reden "daarna bevestigd geen handel op Bitvavo". Veroudering wordt gemeten vanaf het laatste bevestigde moment (`priceConfirmedAt`). Dit geldt voor strategietests, pilot/gerichte proef, portefeuille- en overgangsrekeningen, adaptieve posities en shadows.
- **Zichtbaarheid.** Onder de versieknop staat of Bitvavo-marktdata ondertekend (accountlimiet) of anoniem (gedeeld IP) loopt.

## Wat verandert er niet?

- `focused26_3-v1`, `portfolio26_5-v1`, `transition26_6-v1`, `pilot26-v1` en `execution26-v1` blijven ongewijzigd.
- Exitregels, risicobudgetten, `BROAD_SCAN_POLICY` (brede scan opent geen posities) en `STRATEGY_EPOCH` blijven ongewijzigd.
- Opgeslagen resultaten en kwaliteitslabels worden niet herschreven. Oude "gaps_unresolved"-labels blijven staan en blijven uitgesloten.
- Er is geen databasemigratie. De Bitvavo-sleutel wordt alleen gelezen en nooit in cache, logboek of browser gezet.

## Na de update

Achterstallige posities worden eerst bijgewerkt. Reken op 1 à 2 uur door bestaande herpogingstijden en maximaal 24 uur minuutdata per positie per ronde. Daarna lopen de scans en proeven weer. Historische wachtrijen en nabeschouwingen halen hun achterstand in de dagen daarna geleidelijk in.
