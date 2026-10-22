# Verificatie — 21 oktober 2026

## Geslaagd

- 13 geautomatiseerde tests: numerieke equivalentie; ongeldige/uitvoerbare notatie weigeren; deelpuntenreview; gewogen cijfer en voorlopige status; adaptieve selectie en profielisolatie; herhaalintervallen; broncitaatvalidatie; versleuteld back-upherstel; onjuist wachtwoord en gewijzigde ciphertext weigeren; HTML-escaping; machten/rekenvolgorde; geneste back-upvalidatie; API-herkomst/authenticatie/invoercontrole; AI-contract met gecontroleerde providerstub. Sommige tests combineren meerdere controles.
- Build en validatie van de Worker als zelfstandige ES-module.
- Pakketcontrole na updates: 0 bekende kwetsbaarheden gemeld door npm.
- Echte browser: voorbeeldmodus, dashboard, sessie van 5 vragen, `sqrt(81)` als gelijkwaardig antwoord, fout eindantwoord met tussenstap naar review, 8/10 en voorlopig 8,2, ouderreview met 1 deelpunt naar 9/10 en definitief 9,1.
- Echte browser: volgende adaptieve toets begint met de eerder fout beantwoorde vraag.
- Echte browser: PDF-download gemaakt; upload van een PDF met 3 pagina's en afzonderlijke pagina-extractie geslaagd. Geen consolefouten tijdens deze controles.
- Mobiele viewportcontrole op circa 390 px: uploadscherm stapelt onder elkaar, documentbreedte gelijk aan scrollbreedte (geen horizontale overloop). Geen fysiek Android-toestel gebruikt.
- PDF-export met ingebed Liberation Sans: 3 pagina's opgaven en 2 pagina's antwoorden met puntenmodel; alle pagina's gerenderd en visueel bekeken. Worteltekens en kwadraten aanwezig. Dezelfde exportfunctie wordt door app en voorbeeldbestanden gebruikt.

## Nog niet live geverifieerd

- Echte AI-provider, OCR-kwaliteit, analyses en vragen uit eigen lesboeken: geen API-sleutel beschikbaar. De contracttest gebruikt een stub en bewijst niet de pedagogische kwaliteit van modeluitvoer.
- DOCX- en fotoupload zijn geïmplementeerd; deze zijn nog niet afzonderlijk door de browserupload getest.
- Het aanmaken van een echte gezinskluis en browserherstel is niet via de UI geautomatiseerd. Versleuteling/ontsleuteling en het back-upformaat zijn wel geautomatiseerd getest. De gebruiker kiest zelf het gezinswachtwoord.
- Nieuwe vakselectie, archieffilters en prullenbak zijn gebouwd en door de build gecontroleerd; aanvullende browsercontrole staat bij oplevering vermeld indien uitgevoerd.
- Geen penetratietest, grootschalige belastingtest of validatie met leerlingen/docenten. De betrouwbaarheidlabels zijn geen statistische betrouwbaarheidsscores.

## Handmatige acceptatie vóór gebruik met echte leerstof

1. Maak een kluis, voeg een profiel toe, selecteer schooltype/leerjaar/vakken en heropen de browser.
2. Upload een klein leesbaar hoofdstuk en een scan. Bekijk extractie en waarschuwingen.
3. Configureer de provider, analyseer, vergelijk elk citaat en antwoord met het origineel en geef pas daarna vrij.
4. Verplaats de module naar een vak/schooljaar/periode, sluit en open opnieuw, filter en haal de samenvatting terug.
5. Maak een toets met een goed numeriek antwoord, een fout antwoord met correcte tussenstap en een open antwoord. Controleer punten en ouderreview.
6. Download opgaven en antwoorden, controleer printvoorbeeld en paginaverdeling.
7. Download back-up, herstel op een tweede apparaat, controleer documenten en voortgang. Test een fout wachtwoord: bestaande kluis moet intact blijven.
8. Verplaats een bron naar de prullenbak en herstel hem. Een bron die een module of toets gebruikt mag niet definitief worden verwijderd.
