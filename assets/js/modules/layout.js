// =================================================================
// LAYOUT LOADER
// -----------------------------------------------------------------
// The navbar (and the tiny "back to top" button) look identical on
// every page, so instead of pasting that HTML into every .html file,
// each page just has one empty placeholder:
//
//   <div data-include="header"></div>
//   ...
//   <div data-include="chrome-end"></div>
//
// This module fetches the matching partial from assets/partials/
// and swaps it in. It MUST finish before any other module that
// touches header elements (navbar, dropdowns, dark mode, etc.) runs
// — main.js awaits initLayout() first, before anything else.
//
// EXTENDING: adding a new shared block (e.g. a real footer later)?
// 1. Create assets/partials/your-block.html
// 2. Drop <div data-include="your-block"></div> where it belongs
// 3. Nothing else to wire up — the loop below picks it up automatically.
//
// NOTE: this relies on fetch(), which needs the page to be served
// over http(s) (GitHub Pages, `npm start`, VS Code Live Server, ...).
// Opening an .html file directly via file:// will NOT load the
// header — always run this through a local server while developing.
// =================================================================

import { siteConfig } from '../config.js';

export async function initLayout() {
  const placeholders = Array.from(document.querySelectorAll('[data-include]'));
  if (placeholders.length === 0) return; // page has no includes — nothing to do

  await Promise.all(
    placeholders.map(async (placeholder) => {
      const name = placeholder.getAttribute('data-include');
      try {
        const response = await fetch(`assets/partials/${name}.html`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        placeholder.outerHTML = await response.text();
      } catch (error) {
        console.error(`Kon partial "${name}" niet laden:`, error);
      }
    })
  );

  // Fill in the one bit of the header that comes from config rather
  // than being static markup: the site name next to the ❤️ logo.
  document.querySelectorAll('[data-site-name]').forEach((el) => {
    el.textContent = siteConfig.siteName;
  });
}
