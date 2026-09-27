# Crypto Forecast Lab v26.6.1 — Bronherstel Bitvavo en rustige markten

Controleer eerst in de app onder **Instellingen → API-sleutels** dat er een Bitvavo-sleutel met uitsluitend leesrechten is opgeslagen. Pak daarna de ZIP uit, zodat CLOUDFLARE-UPDATE.ps1 direct in de nieuwe map staat. Voer dan uit:

```powershell
Set-Location 'C:\Users\jmvdn\Trading Lab\Crypto-Forecast-Lab-v26.6.1-Bronherstel'
.\CLOUDFLARE-UPDATE.ps1 -ExistingProjectPath 'C:\Users\jmvdn\Trading Lab\Crypto-Forecast-Lab-v26.6.0-Marktovergangen'
```

De tweede map moet jouw vorige projectmap met de actieve wrangler.jsonc zijn. Staat die elders, gebruik dan die map. Het script neemt de configuratie over, controleert de code, maakt een databaseback-up, voert eventuele migraties uit en deployt naar dezelfde Worker en database. Deze versie heeft geen nieuwe migratie.

Na upload:

1. Controleer bovenaan **v26.6.1 · server bevestigd**, inclusief buildcode.
2. Controleer onder de versieknop: **Bitvavo-marktdata: ondertekend met je eigen read-only API-sleutel**. Staat daar "anoniem", koppel dan de Bitvavo-sleutel opnieuw onder Instellingen.
3. Laat automatische evaluatie ingeschakeld. De 6 achterstallige posities worden eerst bijgewerkt (1 à 2 uur). Daarna starten scans en proeven vanzelf.
4. Kijk na een paar uur of de kwartierrondes weer "geslaagd" of "deels" zijn in plaats van "uitgesteld".

Lees ANALYSE-CLAUDE-2026-09-27.md voor de volledige analyse, UPDATE-v26.6.1.md voor de wijzigingen en QA-v26.6.1.md voor de verificatie. Deze release stuurt geen echte orders en wijzigt geen proefregels.
