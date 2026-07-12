# Cadeautjes bewerken + eigen foto's — addendum bij STAPPENPLAN-GIFTS.md

Deze update breidt de bestaande `gifts`-Worker (zie `STAPPENPLAN-GIFTS.md`
voor de basis-installatie) uit met twee dingen op `gifts.html` zelf:

1. **Bewerken** — elk cadeau-kaartje heeft nu een ✏️-knop naast de
   ✕ (verwijderen). Die opent hetzelfde toevoeg-formulier, maar
   vooringevuld en met "Wijzigingen opslaan" als knoptekst. Onder
   water gaat dit via een nieuwe `PATCH /gifts/:id`-route.
2. **Eigen foto rechtstreeks uploaden** — het formulier heeft nu een
   optioneel bestandsveld ("📷 Eigen foto"). Kies je hier een foto,
   dan wordt die na het opslaan van het cadeau naar
   `POST /gifts/upload?id=...` gestuurd en direct in de R2-bucket
   gezet — je hoeft niet meer los in te loggen op het Cloudflare
   dashboard om een foto handmatig te uploaden (dat blijft ook gewoon
   werken, als alternatief).

## Wat je moet doen

**Alleen de Worker opnieuw deployen** — er zijn geen nieuwe
bindings/secrets nodig, dezelfde `GIFTS_KV` en `GIFTS_BUCKET` van
`STAPPENPLAN-GIFTS.md` blijven gewoon werken:

1. Cloudflare dashboard → Workers & Pages → jouw `gifts`-Worker →
   **Edit code**.
2. Vervang de inhoud door `cloudflare/cloudflare-worker-gifts/worker.js`
   uit deze update.
3. **Deploy**.

Kopieer daarnaast deze bestanden naar je repo (overschrijft de oude
versies):

```
gifts.html
assets/css/pages/gifts.css
assets/js/modules/gifts.js
cloudflare/cloudflare-worker-gifts/worker.js
```

```bash
git add gifts.html assets/css/pages/gifts.css assets/js/modules/gifts.js \
        cloudflare/cloudflare-worker-gifts/worker.js
git commit -m "Cadeautjes: bewerken + eigen foto uploaden vanaf de pagina"
git push
```

## Let op

- Maximale uploadgrootte is 8MB per foto (ruim genoeg voor een
  telefoonfoto, klein genoeg om binnen R2's gratis tier te blijven).
- Een nieuwe upload voor hetzelfde cadeau vervangt automatisch de
  oude foto (ook als het bestandstype verandert, bv. jpg → png).
- Een cadeau verwijderen (✕) ruimt ook automatisch de bijbehorende
  eigen foto op in R2 — geen verweesde bestanden.
- Er is nog steeds geen login nodig voor deze pagina, zelfde
  afweging als in `STAPPENPLAN-GIFTS.md` beschreven.
