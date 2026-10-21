# Van gezinsprototype naar website met accounts

De huidige versie is één privéwebsite met lokale versleutelde opslag. De volgende productfase maakt dit een dienst voor meerdere gezinnen. Dit is een bouwplan, geen al aanwezige functionaliteit.

## Voorgestelde structuur

- Ouderaccount: beheert gezin, kinderen, toestemming, opslag en nakijkreview.
- Kindaccount: eigen login, vakken, leerstof en voortgang; toegang uitsluitend tot eigen gegevens en door de ouder gedeelde modules.
- Docent/reviewer pas later als aparte, expliciet uitgenodigde rol.
- Profiel: schooltype (vmbo-basis/kader/gl/tl, havo, vwo, gymnasium), leerjaar, optionele klas/methode en geselecteerde vakken.
- Leerstof: gezin → leerling of gedeeld → vak → schooljaar → periode → hoofdstuk. Bewaar origineel, extractie, analyseversie, broncitaten, vrijgave en vragenbank bij elkaar.
- Resultaten bewaren een momentopname van vraag, beoordelingsmodel en gegeven antwoord. Latere inhoudswijzigingen veranderen een eerder cijfer niet.

## Technisch noodzakelijke volgende bouwstappen

1. Een geschikte accountprovider kiezen met een aparte ouder/kind-flow en herstel. Geen gedeeld ouderwachtwoord gebruiken als echte rollenbeveiliging.
2. Centrale relationele database met verplichte gezins- en leerling-ID op iedere record. Toegang server-side afdwingen en testen: een leerling uit gezin A mag nooit gegevens uit gezin B lezen of wijzigen.
3. Privéobjectopslag voor bronnen en PDF's, met beperkte uploadlinks en downloadautorisatie. Quota, bestandscontrole en verwijderbeleid invoeren.
4. Achtergrondtaken voor extractie, OCR en analyse, met herstartbaarheid, status en limieten per gezin. Providerkosten meten en een bestedingsplafond instellen.
5. Gedocumenteerde back-ups, hersteltest, bewaartermijnen, accountverwijdering en een auditlog voor ouderreview.
6. Beveiligde migratie uit bestaande versleutelde back-ups. Eerst lokaal ontsleutelen met toestemming; behoud IDs en vraag-/resultaatversies. Importeer nooit stilzwijgend.

## Onderwijskundige uitbreiding

Vakkenlijst vooraf aanbieden, selectie per kind en vrij vak toelaten. Vragen komen uit de geüploade bronnen en expliciete leerdoelen. Moeilijkheid moet per vak/leerjaar worden beoordeeld, niet alleen door de woorden 'vmbo' of 'vwo' aan een prompt toe te voegen. Voor taalvakken, bewijsopgaven en grotere open antwoorden zijn eigen rubrics en getoetste beoordelingsstrategieën nodig. Latijn en Grieks zijn selecteerbaar voor gymnasium; de school bepaalt vanaf welk leerjaar.

## Productvalidatie

Start met één herkenbare toepassing, bijvoorbeeld wiskunde in de onderbouw. Test met enkele gezinnen of zij zelfstandig materiaal kunnen toevoegen, de feedback begrijpen, een week later terugkomen en tijd besparen. Meet fouten in analyses en beoordelingen naast gebruik. Pas na deze proef bepalen of een betaald gezinsabonnement zinvol is. Er is in dit project geen markt-, concurrentie- of betalingsbereidheidsonderzoek uitgevoerd.
