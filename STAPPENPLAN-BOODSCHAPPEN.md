# Boodschappenlijstje toevoegen — stappenplan

Deze update voegt `boodschappenlijst.html` toe: een gedeeld
boodschappenlijstje met afvinken, verwijderen en toevoegen. Wat jij
verandert, ziet je vriendin een paar seconden later ook (en
andersom) — zonder dat iemand hoeft in te loggen.

De lijst staat niet ergens lokaal in de browser (dan zou alleen jij
'm zien), maar in **Cloudflare KV** — een simpele, gratis
sleutel/waarde-opslag. Een kleine Worker (net als bij Ticketmaster en
de fotogalerij) leest en schrijft die opslag namens de site:

```
Browser (jij)         →  Worker "boodschappenlijst"  →  Cloudflare KV (de lijst)
Browser (je vriendin) →  Worker "boodschappenlijst"  →  Cloudflare KV (de lijst)
```

Dit is een **derde, aparte Worker**, los van de Ticketmaster-proxy en
de fotogalerij — ze hebben niets met elkaar te maken.

Geen wachtwoord nodig hier (in tegenstelling tot de foto's): een
boodschappenlijstje is niet gevoelig genoeg om die extra stap waard
te zijn. Wie de Worker-URL zou raden kan de lijst zien/aanpassen,
maar die URL staat nergens publiek en er valt weinig schade aan te
richten met iemand anders' lijstje afwasmiddel.

---

## 1. Cloudflare KV-namespace aanmaken

1. Log in op <https://dash.cloudflare.com>.
2. Ga naar **Workers & Pages** → **KV** (in het linkermenu) →
   **Create a namespace**.
3. Naam: bv. `boodschappenlijst` → **Add**.
4. Je hoeft er verder niets in te zetten — de Worker vult 'm zelf,
   de eerste keer dat de pagina geopend wordt, met het standaardlijstje.

## 2. De boodschappenlijst-Worker deployen

1. **Workers & Pages** → **Create** → **Create Worker**.
2. Naam: `boodschappenlijst` → **Deploy** (met de standaard
   "Hello World", je vervangt dit zo).
3. **Edit code** → plak de volledige inhoud van
   `cloudflare/cloudflare-worker-boodschappen/worker.js` (uit deze
   zip) erin → **Deploy**.
4. **Settings → Bindings** → **Add binding** → kies **KV Namespace**:
   - Variable name: `LIST_KV`
   - KV namespace: de namespace die je in stap 1 maakte
   → **Save and deploy**.
5. Noteer de Worker-URL, bv.
   `https://boodschappenlijst.<jouw-subdomain>.workers.dev`

   *(Wrangler-CLI alternatief: vul in
   `cloudflare/cloudflare-worker-boodschappen/wrangler.toml` het echte
   namespace-id in bij `id`, dan in die map: `wrangler deploy`.)*

### CORS instellen (belangrijk!)

Zelfde als bij de andere twee Workers: open
`cloudflare/cloudflare-worker-boodschappen/worker.js` en check
`ALLOWED_ORIGINS` bovenin. Staat al goed voor
`https://nelis0808.github.io` en de lokale dev-poorten. Gebruik je
een custom domain? Voeg die toe en deploy opnieuw.

## 3. `config.js` bijwerken met je Worker-URL

Open `assets/js/config.js` en vervang de placeholder:

```js
shoppingList: {
  workerUrl: 'https://boodschappenlijst.YOUR-SUBDOMAIN.workers.dev',
},
```

→ vul bij `workerUrl` de echte URL in die je in stap 2.5 noteerde.
Zolang dit nog de placeholder is, toont de pagina netjes een
waarschuwing in plaats van kapot te gaan.

## 4. Bestanden in je repo zetten

Kopieer uit deze zip naar de root van je `DateSite`-repo (structuur
is identiek, dus alles landt op de juiste plek):

```
boodschappenlijst.html                             (nieuw)
assets/css/pages/boodschappenlijst.css             (nieuw)
assets/css/utilities.css                           (aangepast — .emoji-icon toegevoegd)
assets/js/modules/boodschappenlijst.js             (nieuw)
assets/js/config.js                                (aangepast)
assets/js/main.js                                  (aangepast — 2 regels)
cloudflare/cloudflare-worker-boodschappen/worker.js       (nieuw, apart van de site)
cloudflare/cloudflare-worker-boodschappen/wrangler.toml   (nieuw, optioneel voor CLI)
```

Geen handmatige nav-aanpassingen nodig: "Boodschappenlijstje" staat
al in `config.js` → verschijnt automatisch als kaart op de homepage
en in het "Meer"-menu.

## 5. Committen, pushen, testen

```bash
git add boodschappenlijst.html assets/css/pages/boodschappenlijst.css \
        assets/css/utilities.css assets/js/modules/boodschappenlijst.js \
        assets/js/config.js assets/js/main.js \
        cloudflare/cloudflare-worker-boodschappen/
git commit -m "Gedeeld boodschappenlijstje toevoegen (sync via Cloudflare KV)"
git push
```

Ga naar `https://nelis0808.github.io/DateSite/boodschappenlijst.html`
— je zou het standaardlijstje (blikgroente, broodbeleg, ontbijtkoek,
...) moeten zien. Vink iets af of voeg iets toe, open de pagina op een
ander apparaat (of gewoon een tweede tabblad) en wacht een paar
seconden — de wijziging moet daar ook verschijnen.

---

## Hoe de sync precies werkt

- Elke wijziging (aanvinken/verwijderen/toevoegen) wordt **meteen**
  naar de Worker gestuurd en direct in beeld bijgewerkt (je hoeft niet
  te wachten tot het is opgeslagen om het te zien).
- Ondertussen vraagt de pagina **elke 5 seconden** de Worker om de
  actuele lijst, zodat wijzigingen van de ander vanzelf verschijnen.
  Dit stopt zodra het tabblad niet actief is (geen zin om onnodig te
  blijven verversen) en ververst meteen weer zodra je terugkomt.
- Er is geen "wie wint" botsingslogica nodig voor twee mensen die om
  de beurt af en toe iets aanvinken — de laatste opgeslagen versie
  wint gewoon (last-write-wins). Voor een boodschappenlijstje is dat
  ruim voldoende.

## Problemen oplossen

| Symptoom | Oorzaak | Oplossing |
|---|---|---|
| "⚠️ Nog geen Worker gekoppeld" | `workerUrl` in `config.js` staat nog op de placeholder | Stap 3 hierboven |
| Console: CORS-foutmelding | Je site-origin staat niet in `ALLOWED_ORIGINS` | Voeg 'm toe in `worker.js`, opnieuw deployen |
| "Server misconfigured: LIST_KV binding ontbreekt" | KV-binding vergeten of verkeerde variabelenaam | Stap 2.4 — moet exact `LIST_KV` heten |
| Wijziging van je vriendin verschijnt niet | Nog geen 5 seconden gewacht, of haar tabblad staat op de achtergrond | Even wachten / haar tabblad actief maken |
| Lijst lijkt "gereset" naar het standaardlijstje | Kwam voor vóór de eerste succesvolle keer opslaan — normaal gedrag bij een lege KV-namespace | Zodra er één keer iets is opgeslagen, gebeurt dit niet meer |
| `404`/`Not found` van de Worker | Verkeerde `workerUrl`, of typefout in het pad | Controleer of de URL exact eindigt op `.workers.dev` zonder extra pad |
