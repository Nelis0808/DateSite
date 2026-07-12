# Wijzigingen — overzicht

Korte samenvatting van deze update, per genummerd verzoek. Zie de
individuele bestandscommentaren voor details.

1. **Wordle: rood randje bij Enter met ongeldig woord** —
   `assets/js/modules/wordle.js` / `assets/css/pages/wordle.css`.
   Bestond al gedeeltelijk (rode rand op de rij); nu ook een korte
   rode flits op de Enter-toets zelf (`flashEnterInvalid`).

2. **Spiderette: terugknop** — `games/spiderette.html` /
   `assets/js/modules/spiderette.js`. "Terug naar Games" is nu een
   knop (i.p.v. link) zodat eerst de eventuele afkoop-boete (zie #3)
   kan worden verwerkt vóór het navigeren.

3. **Spiderette: chips** — zelfde bestanden als #2. Win je een volledig
   spel: +1000 chips. Verlaat je een lopend spel via "Terug" voordat
   het gewonnen is: -100 chips. Hergebruikt BlackJack's Cloudflare
   Worker/KV-saldo (zelfde login, zelfde balans). Chips worden nooit
   negatief (`Math.max(0, ...)`).

4. **Galgje met eigen woord** — nieuwe pagina
   `games/hangman-custom.html` + `assets/js/modules/hangman-custom.js`.
   Speler 1 typt een woord/zin (spaties toegestaan) op een setup-scherm,
   Speler 2 raadt erna letter voor letter. Instelbaar aantal fouten
   (3-10, schuifbalk) bepaalt zowel het aantal foute beurten als hoe de
   galgje-tekening zich daarover verdeelt.

5. **BlackJack: smooth scroll naar tafel** —
   `assets/js/modules/blackjack.js`. Na "Deel kaarten" scrollt de
   pagina automatisch en smooth naar de (net zichtbaar geworden)
   speeltafel.

6. **BlackJack: chips-veiligheid** — zelfde bestand. Verdubbelen kan
   alleen als het saldo dat daadwerkelijk toelaat (`canAffordDouble`),
   en elke saldo-wijziging gaat door `clampChips()` zodat het saldo
   nooit onder 0 kan komen.

7. **Wallz** — nieuwe pagina `games/wallz.html` +
   `assets/js/modules/wallz.js` + `assets/css/pages/wallz.css`. Twee
   spelers laten een muur/trail achter zich (Tron-lightcycle-stijl,
   zoals wallz.gg); wie crasht verliest. Instelling "voorkom
   overspringen" (aan/uit, onthouden in localStorage) bepaalt of een
   gelijktijdige plaatswissel tussen de twee spelers als botsing telt.
   Gebruikt dezelfde blauw/roze SVG-iconen als Vier op een Rij.

8. **Cadeautjes bewerken** — `gifts.html` / `assets/js/modules/gifts.js`
   / `cloudflare/cloudflare-worker-gifts/worker.js`. Elk kaartje heeft
   nu een ✏️-knop die hetzelfde formulier vooringevuld opent; opslaan
   stuurt een `PATCH /gifts/:id` i.p.v. een nieuw item toe te voegen.

9. **Cadeautjes op de "Meer"-pagina** — al aanwezig: `gifts.html` stond
   al met `status: 'available'` in `assets/js/config.js`'s `pages`-array,
   dus die verschijnt automatisch in het "Meer"-dropdownmenu en als
   kaart op de homepage. Geen wijziging nodig geweest.

10. **Cadeautje-foto toevoegen** — zelfde bestanden als #8. Het
    toevoeg/bewerk-formulier heeft een optioneel bestandsveld; een
    gekozen foto wordt na het opslaan geüpload naar de nieuwe
    `POST /gifts/upload?id=...`-route en direct in R2 gezet — geen
    handmatige dashboard-upload meer nodig (mag nog steeds).

Zie ook: `STAPPENPLAN-GIFTS-ADDENDUM.md` voor de deploy-stappen van
#8/#10 (alleen de Worker hoeft opnieuw gedeployed te worden).
