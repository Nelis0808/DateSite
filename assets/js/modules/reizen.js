// =================================================================
// ONZE REIZEN — WORLD MAP (reizen.html)
// -----------------------------------------------------------------
// Renders one pin per entry in assets/data/travel-countries.json on
// top of a stylized SVG world backdrop (assets/icons/reizen/world-map.svg).
// Pins are positioned with plain percentage left/top — see that
// data file's own comment for how x/y are chosen.
//
// INTERACTION: single click/tap selects a pin (shows a small card
// with a "Bekijk land" button); double-click (or Enter/Space while
// focused, or the button) navigates to reizen/land.html?iso=XX,
// which zooms into that country's cities.
//
// This module has ZERO dependency on the photo gallery/Worker —
// it only needs the static JSON file, so the world map itself
// always works even before any Cloudflare Worker is deployed. Only
// the country-level city view (reizen-land.js) talks to a Worker.
// =================================================================

import { qs, escapeHtml, siteRootUrl } from './utils.js';

const DATA_URL = new URL('../../data/travel-countries.json', import.meta.url);

export function initReizen() {
  const root = document.getElementById('reizenApp');
  if (!root) return; // not on this page

  const mapFrame = qs('#reizenMapFrame', root);
  const statusEl = qs('#reizenStatus', root);
  const selectedCard = qs('#reizenSelectedCard', root);
  const selectedName = qs('#reizenSelectedName', root);
  const selectedMeta = qs('#reizenSelectedMeta', root);
  const viewBtn = qs('#reizenViewCountry', root);

  let countries = [];
  let selectedIso = null;

  function goToCountry(iso) {
    window.location.href = siteRootUrl(`reizen/land.html?iso=${encodeURIComponent(iso)}`);
  }

  function selectPin(country, pinEl) {
    selectedIso = country.iso;
    qs('.rz-pin-selected', mapFrame)?.classList.remove('rz-pin-selected');
    pinEl.classList.add('rz-pin-selected');

    selectedName.textContent = country.name;
    selectedMeta.textContent = country.status === 'visited'
      ? 'Hier zijn we al geweest ✅'
      : 'Nog op het verlanglijstje ✨';
    selectedCard.classList.remove('hidden');
  }

  function renderPins() {
    countries.forEach((country) => {
      const pin = document.createElement('button');
      pin.type = 'button';
      pin.className = `rz-pin rz-pin-${country.status === 'visited' ? 'visited' : 'wishlist'}`;
      pin.style.left = `${country.x}%`;
      pin.style.top = `${country.y}%`;
      pin.setAttribute('aria-label', `${country.name} — dubbelklik om in te zoomen`);

      pin.innerHTML = `
        <span class="rz-pin-dot" aria-hidden="true"></span>
        <span class="rz-pin-label">${escapeHtml(country.name)}</span>
      `;

      pin.addEventListener('click', () => selectPin(country, pin));
      pin.addEventListener('dblclick', () => goToCountry(country.iso));
      pin.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          if (selectedIso === country.iso) goToCountry(country.iso);
          else selectPin(country, pin);
        }
      });

      mapFrame.appendChild(pin);
    });
  }

  viewBtn.addEventListener('click', () => {
    if (selectedIso) goToCountry(selectedIso);
  });

  fetch(DATA_URL)
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then((data) => {
      countries = Array.isArray(data.countries) ? data.countries : [];
      if (countries.length === 0) {
        statusEl.textContent = 'Nog geen landen toegevoegd aan assets/data/travel-countries.json.';
        return;
      }
      statusEl.textContent = `${countries.length} landen op de kaart — klik om te selecteren, dubbelklik om in te zoomen.`;
      renderPins();
    })
    .catch((error) => {
      console.error('Kon reisdata niet laden:', error);
      statusEl.textContent = '❌ Kon de landenlijst niet laden.';
    });
}
