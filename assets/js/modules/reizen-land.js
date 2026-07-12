// =================================================================
// ONZE REIZEN — COUNTRY VIEW (reizen/land.html)
// -----------------------------------------------------------------
// Reads ?iso=XX from the URL (see reizen.js — the world map links
// here on double-click), looks up that country in
// assets/data/travel-countries.json for its display name, then asks
// the photo-gallery Cloudflare Worker's PUBLIC "/travel" endpoint
// for every distinct city that appears in captions.json for that
// country (3rd/4th caption fields — see the worker's own comment
// and STAPPENPLAN-REIZEN.md).
//
// WHY A SEPARATE PUBLIC ENDPOINT: photos.html gates the actual photo
// bytes behind a passphrase (see photo-gallery.js) — that's still
// true here, thumbnails only load once logged in. But which CITIES
// you've captioned photos in isn't remotely as sensitive as the
// photos themselves, and showing that map-pin overview to anyone
// (a "look what we've done" teaser) is the whole point of this
// page. So /travel deliberately returns only city names + counts +
// "visited" flags, never filenames or image bytes, and needs no
// passphrase — see the worker's isPublicTravelPayload-style comment.
//
// LOGIN REUSES photo-gallery.js's exact session (same localStorage
// key, same Worker) — if you're already logged in on photos.html,
// you're automatically "logged in" here too, and the selected
// city's real thumbnails load. If not, city pins/names still show,
// with a note pointing at photos.html to unlock thumbnails.
//
// CITY PIN POSITIONS: captions.json can't reasonably carry x/y map
// coordinates per city (that's a lot of manual work for something
// that's "nice to have" at best), so this view arranges city pins
// on a simple deterministic radial layout instead of a real map —
// see layoutCities() below. It's not geography, just a pleasant,
// consistent scatter so pins don't overlap.
// =================================================================

import { siteConfig } from '../config.js';
import { qs, escapeHtml, siteRootUrl } from './utils.js';

const COUNTRIES_URL = new URL('../../data/travel-countries.json', import.meta.url);
const AUTH_STORAGE_KEY = 'photoGalleryAuth'; // same key photo-gallery.js uses — shared session

export function initReizenLand() {
  const root = document.getElementById('reizenLandApp');
  if (!root) return; // not on this page

  const workerUrl = siteConfig.photos?.workerUrl || '';

  const headingEl = qs('#reizenLandHeading', root);
  const subEl = qs('#reizenLandSub', root);
  const statusEl = qs('#reizenLandStatus', root);
  const mapFrame = qs('#reizenLandMapFrame', root);
  const cityPanel = qs('#reizenCityPanel', root);
  const cityPanelTitle = qs('#reizenCityPanelTitle', root);
  const cityPhotosEl = qs('#reizenCityPhotos', root);
  const lockedNote = qs('#reizenLockedNote', root);

  const params = new URLSearchParams(window.location.search);
  const iso = (params.get('iso') || '').toUpperCase();

  if (!iso) {
    statusEl.textContent = 'Geen land gekozen — ga terug naar de kaart.';
    return;
  }

  function getStoredAuth() {
    try {
      const raw = localStorage.getItem(AUTH_STORAGE_KEY);
      if (!raw) return null;
      const auth = JSON.parse(raw);
      if (!auth?.token || !auth?.exp || auth.exp * 1000 < Date.now()) return null;
      return auth;
    } catch {
      return null;
    }
  }

  /** Deterministic pseudo-scatter so the same city always lands in the same spot (no real coordinates available — see file header). */
  function layoutCities(cities) {
    const count = cities.length;
    return cities.map((city, index) => {
      const angle = (index / Math.max(count, 1)) * Math.PI * 2 + 0.4;
      const radius = 28 + ((index * 37) % 18); // slight radius jitter, still deterministic
      const x = 50 + Math.cos(angle) * radius;
      const y = 50 + Math.sin(angle) * radius * 0.55; // flatten vertically to fit the wide frame
      return { ...city, x: Math.min(94, Math.max(6, x)), y: Math.min(90, Math.max(10, y)) };
    });
  }

  function renderCityPins(cities) {
    mapFrame.querySelectorAll('.rz-pin').forEach((el) => el.remove());

    layoutCities(cities).forEach((city) => {
      const pin = document.createElement('button');
      pin.type = 'button';
      pin.className = `rz-pin ${city.visited ? 'rz-pin-visited' : ''}`;
      pin.style.left = `${city.x}%`;
      pin.style.top = `${city.y}%`;
      pin.setAttribute('aria-label', `${city.name} (${city.count} foto${city.count === 1 ? '' : "'s"})`);

      pin.innerHTML = `
        <span class="rz-pin-dot" aria-hidden="true"></span>
        <span class="rz-pin-label">${escapeHtml(city.name)}</span>
      `;

      pin.addEventListener('click', () => selectCity(city, pin));
      mapFrame.appendChild(pin);
    });
  }

  async function selectCity(city, pinEl) {
    mapFrame.querySelector('.rz-pin-selected')?.classList.remove('rz-pin-selected');
    pinEl.classList.add('rz-pin-selected');

    cityPanel.classList.remove('hidden');
    cityPanelTitle.textContent = `📍 ${city.name}`;
    cityPhotosEl.innerHTML = '';
    lockedNote.classList.add('hidden');

    const auth = getStoredAuth();
    if (!auth) {
      lockedNote.innerHTML = `Log in via <a href="${siteRootUrl('photos.html')}">Onze Foto's</a> om de echte foto's van ${escapeHtml(city.name)} hier te zien.`;
      lockedNote.classList.remove('hidden');
      return;
    }

    if (!workerUrl) return;

    try {
      const response = await fetch(`${workerUrl}/photos`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      const cityNameLower = city.name.trim().toLowerCase();
      const matches = (data.photos || []).filter((photo) => {
        const photoCountryLower = (photo.country || '').trim().toLowerCase();
        const photoPlaceLower = (photo.place || '').trim().toLowerCase();
        const countryMatches = photoCountryLower === iso.toLowerCase() || photoCountryLower === countryNameLower;
        return countryMatches && photoPlaceLower === cityNameLower;
      });

      if (matches.length === 0) {
        cityPhotosEl.innerHTML = `<p class="rz-city-panel-empty">Geen foto's gevonden voor ${escapeHtml(city.name)}.</p>`;
        return;
      }

      const cards = await Promise.all(matches.map(async (photo) => {
        const imgResponse = await fetch(`${workerUrl}/photos/object?key=${encodeURIComponent(photo.key)}`, {
          headers: { Authorization: `Bearer ${auth.token}` },
        });
        if (!imgResponse.ok) return '';
        const blob = await imgResponse.blob();
        const objectUrl = URL.createObjectURL(blob);
        return `
          <figure class="rz-city-photo">
            <img src="${objectUrl}" alt="${escapeHtml(photo.caption || city.name)}">
            ${photo.caption ? `<figcaption>${escapeHtml(photo.caption)}</figcaption>` : ''}
          </figure>
        `;
      }));

      cityPhotosEl.innerHTML = `<div class="rz-city-photos">${cards.join('')}</div>`;
    } catch (error) {
      console.error('Kon foto\u2019s voor deze stad niet laden:', error);
      cityPhotosEl.innerHTML = `<p class="rz-city-panel-empty">❌ Kon foto's niet laden.</p>`;
    }
  }

  let countryNameLower = iso.toLowerCase();

  // ---- Load country display name (static, always available) ----
  // IMPORTANT: this also decides what we ask the Worker for. The
  // Worker's /travel endpoint only ever compares against whatever
  // string is literally typed in captions.json's 3rd field (see
  // STAPPENPLAN-REIZEN.md — that's usually a full name like
  // "Portugal", not the two-letter "PT" used in the URL/config), so
  // we query by the resolved display NAME here, falling back to the
  // raw ?iso= value only if the country isn't in the config file.
  fetch(COUNTRIES_URL)
    .then((response) => response.json())
    .then((data) => {
      const country = (data.countries || []).find((c) => c.iso.toUpperCase() === iso);
      const displayName = country?.name || iso;
      countryNameLower = displayName.toLowerCase();
      headingEl.textContent = `🌍 ${displayName}`;
      document.title = `${displayName} — Onze Reizen`;
      loadCities(displayName);
    })
    .catch(() => {
      headingEl.textContent = `🌍 ${iso}`;
      loadCities(iso);
    });

  // ---- Load cities for this country from the public travel endpoint ----
  function loadCities(countryQuery) {
    if (!workerUrl || workerUrl.includes('YOUR-SUBDOMAIN')) {
      statusEl.textContent = '⚠️ Nog geen Worker gekoppeld. Zie STAPPENPLAN-REIZEN.md.';
      subEl.textContent = '';
      return;
    }

    statusEl.textContent = 'Steden laden…';

    fetch(`${workerUrl}/travel?country=${encodeURIComponent(countryQuery)}`)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((data) => {
        const cities = Array.isArray(data.cities) ? data.cities : [];
        if (cities.length === 0) {
          statusEl.textContent = 'Nog geen steden gecatalogiseerd voor dit land. Voeg "Land"/"Plaats" toe aan foto-bijschriften in captions.json.';
          subEl.textContent = '';
          return;
        }
        const visitedCount = cities.filter((c) => c.visited).length;
        statusEl.textContent = `${cities.length} plek${cities.length === 1 ? '' : 'ken'} gevonden — klik op een pin voor de foto's.`;
        subEl.textContent = `${visitedCount} van ${cities.length} al bezocht.`;
        renderCityPins(cities);
      })
      .catch((error) => {
        console.error('Kon steden niet laden:', error);
        statusEl.textContent = '❌ Kon steden niet laden van de Worker.';
        subEl.textContent = '';
      });
  }
}
