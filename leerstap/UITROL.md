# Leerstap online zetten

Stap voor stap van code naar `https://leerstap.nl`, met echte gezinsaccounts. Reken op een middag. Je hebt geen servers te beheren: alles draait bij Cloudflare, met gegevens in de EU.

## Wat het kost

| Onderdeel | Waarvoor | Kosten (indicatie) |
|---|---|---|
| Domeinnaam `leerstap.nl` | Het webadres | ca. €5–15 per jaar |
| Cloudflare Workers Paid | Website, database (D1) en bestandsopslag (R2), met automatische herstelpunten | $5 per maand, ruim genoeg voor de proef |
| OpenAI API | AI-analyse van leerstof | Betalen per gebruik; stel zelf een maximum in (bijv. €20 per maand) |

Waarom het betaalde Cloudflare-plan? Wachtwoorden worden met een bewust zware berekening beveiligd. Het gratis plan geeft per verzoek te weinig rekentijd daarvoor. Met het betaalde plan kun je de database bovendien tot 30 dagen terugzetten.

## 1. Domeinnaam registreren

1. Controleer eerst of de naam vrij is als merk: zoek op "Leerstap" in het [BOIP-merkenregister](https://www.boip.int) en bij [EUIPO](https://euipo.europa.eu).
2. Registreer **`leerstap.nl`** bij een Nederlandse registrar (bijvoorbeeld TransIP, Versio of Hostnet). Optioneel ook `toetsklaar.nl` en `leerstap.com`, om ze later door te sturen.
3. Neem géén hostingpakket of e-mailpakket af; alleen de domeinnaam.

## 2. Cloudflare-account en domein koppelen

1. Maak een account op [dash.cloudflare.com](https://dash.cloudflare.com).
2. Kies **Add a domain** → `leerstap.nl` → het **Free**-plan (dat is alleen voor DNS).
3. Cloudflare toont twee *nameservers*. Vul die bij je registrar in bij de domeininstellingen ("nameservers wijzigen"). Het kan een paar uur duren voordat Cloudflare "Active" toont.
4. Ga naar **Workers & Pages → Plans** en kies **Workers Paid**.

## 3. Computer klaarmaken (eenmalig)

1. Installeer [Node.js 22 LTS](https://nodejs.org).
2. Download deze code (de map `leerstap`) en open er een terminal in.
3. Voer uit:

```text
npm ci
npx wrangler login
```

`wrangler login` opent je browser: sta de toegang toe.

## 4. Database en bestandsopslag aanmaken (in de EU)

```text
npx wrangler d1 create leerstap --jurisdiction eu
npx wrangler r2 bucket create leerstap-bestanden --jurisdiction eu
```

Het eerste commando toont een `database_id`. Zet die in `wrangler.toml` op de plek van `VUL-IN-NA-AANMAKEN`.

## 5. AI-sleutel instellen

1. Maak een account op [platform.openai.com](https://platform.openai.com). Voeg tegoed toe en stel bij **Limits** een maandbudget in.
2. Maak een API-sleutel aan (**API keys → Create new secret key**). Gebruik een apart project "Leerstap".
3. Zet de sleutel als geheim bij Cloudflare. Plak hem alleen in de terminal, nergens anders:

```text
npx wrangler secret put OPENAI_API_KEY
```

4. Aanbevolen voor de proefperiode: alleen gezinnen met een uitnodigingscode kunnen een account maken.

```text
npx wrangler secret put INVITE_CODE
```

Typ een code die je zelf kiest, bijvoorbeeld `PROEF-NAJAAR`, en geef die aan de proefgezinnen. Haal de code later weg met `npx wrangler secret delete INVITE_CODE`.

De maandlimiet voor AI-analyses per gezin staat in `wrangler.toml` (`AI_MONTHLY_LIMIT`, standaard 30).

## 6. Privacyverklaring en voorwaarden invullen

Open `public/privacy.html` en `public/voorwaarden.html`. Vul alle plekken met `[VUL IN: …]` in: je (bedrijfs)naam, KvK-nummer, plaats en e-mailadres. Een publicatie wordt geweigerd zolang er nog een `[VUL IN` in staat. Laat beide teksten vóór een openbare lancering juridisch controleren.

## 7. Publiceren

```text
npm run deploy
```

Dit draait alle tests, bouwt de site, maakt de databasetabellen aan en publiceert. Je krijgt een adres zoals `https://leerstap.<jouw-naam>.workers.dev`. Test daar:

- een account maken, en de herstelcode bewaren;
- een hoofdstuk uploaden, laten analyseren en vrijgeven;
- je kind een login geven en op een telefoon inloggen.

## 8. Je eigen domein koppelen

Cloudflare-dashboard → **Workers & Pages → leerstap → Settings → Domains & Routes → Add → Custom domain**. Voeg `leerstap.nl` toe, en daarna `www.leerstap.nl`. Cloudflare regelt het HTTPS-certificaat zelf.

## 9. Automatisch publiceren via GitHub (optioneel)

Na elke wijziging in `main` publiceert GitHub dan zelf, maar alleen als alle tests slagen.

1. Cloudflare → **My Profile → API Tokens → Create Token** → sjabloon **Edit Cloudflare Workers**. Voeg ook D1 (Edit) toe.
2. GitHub → repository → **Settings → Secrets and variables → Actions**:
   - secret `CLOUDFLARE_API_TOKEN` = het token;
   - secret `CLOUDFLARE_ACCOUNT_ID` = je account-ID (rechts in het Cloudflare-dashboard);
   - onder het tabblad *Variables*: variabele `LEERSTAP_DEPLOY` = `true`.

## Beheer tijdens de proef

Log in met het ouderaccount waarvan het e-mailadres in `wrangler.toml` bij `ADMIN_EMAILS` staat. In het menu verschijnt dan **Beheer**:

- **Gezin uitnodigen:** vul in voor wie de uitnodiging is en klik op *Uitnodiging maken*. Kopieer de link of het bericht en stuur het via WhatsApp of mail. Elke code werkt één keer. Een uitnodiging die nog niet gebruikt is, kun je intrekken.
- **Gezinnen:** je ziet per gezin het e-mailadres van de ouder, aantallen en het AI-gebruik, nooit leerstof of antwoorden. *Pauzeren* meldt het gezin overal af en blokkeert inloggen; *Hervatten* zet het weer aan. *Nieuwe herstelcode* helpt een ouder die de code kwijt is: geef de nieuwe code persoonlijk door. *Gezin verwijderen* wist alles van dat gezin definitief.

Met `INVITE_ONLY = "true"` kan niemand zonder uitnodiging een account maken. Staat er ook een algemene `INVITE_CODE`, dan werkt die naast de persoonlijke uitnodigingen. Wil je alleen nog persoonlijke uitnodigingen, verwijder die dan: `npx wrangler secret delete INVITE_CODE`. Na de proef zet je `INVITE_ONLY` op `"false"` om iedereen toe te laten.

## Back-ups en herstel

- **Database:** Cloudflare D1 maakt automatisch herstelpunten. Je kunt tot 30 dagen terug naar elke minuut:

  ```text
  npx wrangler d1 time-travel info leerstap
  npx wrangler d1 time-travel restore leerstap --timestamp=2026-11-01T20:00:00Z
  ```

  Doe één keer een herstelproef op een kopie, zodat je weet hoe het werkt vóórdat het nodig is.
- **Geüploade bestanden (R2):** worden redundant opgeslagen, maar een verwijderd bestand is weg. Ouders kunnen zelf een versleutelde back-up downloaden met alles erin (*Gezin & instellingen → Back-up*).
- **Updates:** nieuwe versies wijzigen de database alleen via genummerde bestanden in `migrations/`. Bestaande gegevens blijven staan. Voeg nooit een migratie toe die gegevens weggooit zonder plan voor terugzetten.

## Kosten en gebruik in de gaten houden

AI-gebruik per maand (aantal analyses en tokens):

```text
npx wrangler d1 execute leerstap --remote --command "SELECT month, count(*) AS gezinnen, sum(analyses) AS analyses, sum(input_tokens) AS invoer, sum(output_tokens) AS uitvoer FROM usage GROUP BY month"
```

Vergelijk dit met de kosten in het OpenAI-dashboard (**Usage**). Zo weet je na de proef wat een gezin werkelijk kost, voordat je een prijs kiest.

## Lokaal draaien (zonder Cloudflare)

Voor ontwikkelen, of voor gebruik op één computer: `npm ci`, `npm run build` en `npm start`. Open daarna `http://127.0.0.1:4173`. Gegevens komen in de map `data/`. Op Windows doet `Start-Leerstap.cmd` hetzelfde. Voor AI lokaal: kopieer `.env.example` naar `.env` en vul `OPENAI_API_KEY` in.
