# Onze Reizen toevoegen — stappenplan

Deze update voegt `reizen.html` toe: een interactieve wereldkaart met
een pin per land. Klik een land om te selecteren, dubbelklik (of klik
op "Bekijk land") om in te zoomen naar `reizen/land.html`, waar je een
overzicht ziet van alle **steden** die je in de bijschriften van je
foto's hebt gezet — inclusief een klein fotostrookje per stad.

```
reizen.html            → alleen assets/data/travel-countries.json (géén Worker nodig)
reizen/land.html        → Worker "photo-gallery" (NIEUW endpoint: /travel, publiek)
                              → daarna, alleen als je al bent ingelogd via photos.html:
                                dezelfde Worker voor de echte foto's per stad
```

**Geen nieuwe Worker nodig** — dit hergebruikt de bestaande
`photo-gallery`-Worker uit `STAPPENPLAN-FOTOS.md`. Er is alleen één
nieuwe, publieke route aan die Worker toegevoegd (`/travel`).

## Hoe het samenhangt met bijschriften

Tot nu toe zag een bijschrift in `captions.json` er zo uit:

```json
{
  "lissabon-uitzicht.jpg": ["Uitzicht over Lissabon", "Onze eerste avond in Lissabon, mei 2026."]
}
```

Vanaf nu mag je er **optioneel** een land en een specifieke plaats aan
toevoegen (3e en 4e element):

```json
{
  "lissabon-uitzicht.jpg": ["Uitzicht over Lissabon", "Onze eerste avond in Lissabon, mei 2026.", "Portugal", "Lissabon"]
}
```

- Niet elke foto hoeft dit te hebben — een foto met alleen de eerste
  twee (of maar één) velden werkt precies zoals eerst, en verschijnt
  gewoon niet op de reiskaart.
- Het **land** (3e veld) moet overeenkomen met de `name` of `iso` van
  een land in `assets/data/travel-countries.json` (hoofdletter-
  ongevoelig) — zo niet, dan matcht de foto simpelweg niet en zie je
  'm niet op de kaart.
- De **plaats** (4e veld) wordt letterlijk gebruikt als naam van de
  stads-pin op `reizen/land.html` — gebruik dus consistente spelling
  tussen foto's van dezelfde stad (bv. altijd "Lissabon", niet soms
  "Lisbon").

## 1. `worker.js` opnieuw deployen (nieuwe /travel-route)

Je hebt de `photo-gallery`-Worker al staan (zie `STAPPENPLAN-FOTOS.md`).
Werk 'm nu bij met de nieuwe versie uit deze update:

1. **Cloudflare dashboard** → **Workers & Pages** → jouw `photo-gallery`
   Worker → **Edit code**.
2. Vervang de volledige inhoud door
   `cloudflare/cloudflare-worker-photos/worker.js` uit deze update.
3. **Deploy**.

Er zijn geen nieuwe secrets of bindings nodig — dezelfde
`PHOTOS_BUCKET`-binding en drie secrets werken gewoon door. De nieuwe
`/travel`-route leest alleen `captions.json` (die je al had) en heeft
verder niets nodig.

## 2. Landen instellen

Open `assets/data/travel-countries.json` en pas de lijst aan naar
jullie eigen landen. Elk land heeft:

```json
{ "iso": "PT", "name": "Portugal", "x": 46.3, "y": 30.2, "status": "visited" }
```

- `iso` — moet overeenkomen met wat je in `captions.json` gebruikt
  (mag ook de volledige naam zijn, zie hierboven).
- `name` — weergavenaam op de pin/kaart.
- `x`/`y` — positie op de kaart in procenten (0-100). Trial-and-error
  werkt prima: sla op, ververs de pagina, en schuif het getal een
  beetje tot de pin ongeveer op de juiste plek staat.
- `status` — `"visited"` (roze/accentkleur pin) of `"wishlist"`
  (grijze pin).

## 3. Bestanden in je repo zetten

```
reizen.html                                            (nieuw)
reizen/land.html                                       (nieuw)
assets/css/pages/reizen.css                             (nieuw)
assets/js/modules/reizen.js                             (nieuw)
assets/js/modules/reizen-land.js                         (nieuw)
assets/data/travel-countries.json                        (nieuw)
assets/icons/reizen/world-map.svg                         (nieuw)
assets/js/config.js                                     (aangepast — nieuwe pagina-kaart)
assets/js/main.js                                        (aangepast — 2 regels)
cloudflare/cloudflare-worker-photos/worker.js              (aangepast — nieuwe /travel-route)
```

Geen handmatige nav-aanpassingen nodig: "Onze Reizen" staat al in
`config.js` → verschijnt automatisch als kaart op de homepage en in
het "Meer"-menu.

## 4. Committen, pushen, testen

```bash
git add reizen.html reizen/land.html assets/css/pages/reizen.css \
        assets/js/modules/reizen.js assets/js/modules/reizen-land.js \
        assets/data/travel-countries.json assets/icons/reizen/ \
        assets/js/config.js assets/js/main.js \
        cloudflare/cloudflare-worker-photos/worker.js
git commit -m "Onze Reizen toevoegen (wereldkaart + steden-overzicht per land)"
git push
```

Ga naar `https://nelis0808.github.io/KaliNiels/reizen.html` — je zou
de landen-pins moeten zien. Dubbelklik een land waarvan je foto's met
"Land"/"Plaats" hebt gecatalogiseerd → je zou de steden-pins moeten
zien op `reizen/land.html`. Klik een stad: zonder inloggen zie je een
linkje naar `photos.html`; ingelogd zie je de echte foto's van die
stad.

---

## Wat dit wel en niet doet

- ✅ De wereldkaart zelf (`reizen.html`) heeft **geen Worker nodig** —
  hij werkt puur uit een statisch JSON-bestand, dus hij blijft altijd
  werken, zelfs als de Worker een keer plat ligt.
- ✅ `/travel` is bewust **publiek** (geen wachtwoord) — het toont
  alleen steden + aantallen, nooit bestandsnamen of foto's zelf, dus
  er lekt niets gevoeligs.
- ✅ Echte foto's per stad blijven achter dezelfde login als
  `photos.html` — als je daar al bent ingelogd, werkt dat hier
  automatisch mee (zelfde sessie in `localStorage`).
- ⚠️ De wereldkaart-achtergrond is een **gestileerde illustratie**,
  geen exacte landsgrenzen — dit project heeft geen ingebouwde
  GeoJSON-dataset, en de pins (met hun eigen x/y-positie) zijn wat
  er echt toe doet en aanklikbaar is.
- ⚠️ Stad-pins op `reizen/land.html` hebben geen echte coördinaten
  (dat zou per stad handmatig werk zijn) — ze staan in een nette,
  vaste "waaier"-indeling, niet op hun echte geografische plek binnen
  het land.

## Problemen oplossen

| Symptoom | Oorzaak | Oplossing |
|---|---|---|
| Land verschijnt niet op de kaart | Niet toegevoegd aan `assets/data/travel-countries.json` | Stap 2 hierboven |
| "⚠️ Nog geen Worker gekoppeld" op de land-pagina | `workerUrl` in `config.js` (bij `photos`) staat nog op de placeholder | Zie `STAPPENPLAN-FOTOS.md` stap 4 |
| Geen steden te zien bij een land | Geen foto's met "Land" dat matcht, of het land-veld spelt anders dan `iso`/`name` | Check `captions.json`, en dat land/iso exact overeenkomt (hoofdletter-ongevoelig) |
| Stad-pin klikbaar maar geen foto's | Je bent niet ingelogd, of de "Plaats" in de foto wijkt net iets af van de pin-naam | Log in via `photos.html`; check spelling-consistentie tussen foto's van dezelfde stad |
| `404`/CORS-foutmelding van `/travel` | Oude versie van `worker.js` nog actief | Stap 1 hierboven — opnieuw deployen |
