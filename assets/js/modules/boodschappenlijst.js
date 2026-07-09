// =================================================================
// BOODSCHAPPENLIJSTJE (boodschappenlijst.html)
// -----------------------------------------------------------------
// Talks ONLY to the boodschappenlijst Cloudflare Worker (see
// /cloudflare/cloudflare-worker-boodschappen + STAPPENPLAN-BOODSCHAPPEN.md),
// which stores the shared list in Cloudflare KV. No login — see the
// worker's top comment for why that's fine here.
//
// SYNC MODEL: every local change (add/check/delete) is sent to the
// worker immediately (optimistic UI — the change shows instantly,
// and rolls back with an error message if the save fails). On top
// of that, the page polls the worker every few seconds so a change
// your girlfriend makes on her phone shows up here soon after too,
// without needing a refresh. Polling pauses while the tab is hidden
// (no point burning requests on a background tab) and resumes, with
// an immediate refresh, the moment it's visible again.
//
// Deliberately NOT real-time (no websockets) — for a two-person
// grocery list, "soon" (a few seconds) is plenty, and polling is a
// lot less to deploy/maintain than a persistent connection.
// =================================================================

import { siteConfig } from '../config.js';
import { qs, escapeHtml } from './utils.js';

const POLL_INTERVAL_MS = 5000;

export function initBoodschappenlijst() {
  const root = document.getElementById('shoppingListApp');
  if (!root) return; // not on this page

  const workerUrl = siteConfig.shoppingList?.workerUrl || '';

  const listEl      = qs('#slItems', root);
  const emptyStateEl = qs('#slEmptyState', root);
  const statusEl     = qs('#slStatus', root);
  const addForm      = qs('#slAddForm', root);
  const addInput      = qs('#slAddInput', root);
  const addError       = qs('#slAddError', root);
  const configWarning  = qs('#slConfigWarning', root);

  function workerConfigured() {
    return workerUrl && !workerUrl.includes('YOUR-SUBDOMAIN');
  }

  if (!workerConfigured()) {
    configWarning.classList.remove('hidden');
    root.classList.add('sl-disabled');
    return;
  }

  // Local copy of the list. `items` is the source of truth for
  // rendering; every mutation updates it optimistically, then syncs.
  let items = [];
  let pollTimer = null;
  let saveInFlight = false; // avoids overlapping PUTs stomping on each other

  function setStatus(text, isError = false) {
    statusEl.textContent = text;
    statusEl.classList.toggle('sl-status-error', isError);
  }

  function render() {
    const checkedCount = items.filter((item) => item.checked).length;

    if (items.length === 0) {
      listEl.innerHTML = '';
      emptyStateEl.classList.remove('hidden');
      setStatus('Lijstje is leeg.');
      return;
    }

    emptyStateEl.classList.add('hidden');
    setStatus(`${checkedCount} van ${items.length} afgevinkt`);

    listEl.innerHTML = items
      .map(
        (item) => `
          <li class="sl-item ${item.checked ? 'sl-item-checked' : ''}" data-id="${escapeHtml(item.id)}">
            <label class="sl-item-label">
              <input type="checkbox" class="sl-checkbox" ${item.checked ? 'checked' : ''} aria-label="${escapeHtml(item.text)} afvinken">
              <span class="sl-item-text">${escapeHtml(item.text)}</span>
            </label>
            <button type="button" class="sl-delete" aria-label="${escapeHtml(item.text)} verwijderen">✕</button>
          </li>
        `
      )
      .join('');
  }

  // ---- Networking ------------------------------------------------

  async function loadList({ silent = false } = {}) {
    if (!silent) setStatus('Laden…');
    try {
      const response = await fetch(`${workerUrl}/list`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      items = Array.isArray(data.items) ? data.items : [];
      render();
    } catch (error) {
      console.error('Kon boodschappenlijst niet laden:', error);
      if (!silent) setStatus('❌ Kon lijstje niet laden. Probeer het opnieuw.', true);
    }
  }

  // Pushes the current `items` to the worker. Optimistic — the
  // caller already updated `items`/the DOM before calling this; on
  // failure we reload the real state from the server so the UI
  // never stays out of sync with what's actually saved.
  async function saveList() {
    saveInFlight = true;
    try {
      const response = await fetch(`${workerUrl}/list`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      items = Array.isArray(data.items) ? data.items : items;
      render();
    } catch (error) {
      console.error('Kon wijziging niet opslaan:', error);
      setStatus('⚠️ Wijziging niet opgeslagen, lijstje wordt hersteld…', true);
      await loadList({ silent: true });
    } finally {
      saveInFlight = false;
    }
  }

  // ---- Mutations ---------------------------------------------------

  function addItem(text) {
    const trimmed = text.trim();
    if (!trimmed) return;
    items = [...items, { id: crypto.randomUUID(), text: trimmed, checked: false }];
    render();
    saveList();
  }

  function toggleItem(id) {
    items = items.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item));
    render();
    saveList();
  }

  function deleteItem(id) {
    items = items.filter((item) => item.id !== id);
    render();
    saveList();
  }

  // ---- Wiring ------------------------------------------------------

  addForm.addEventListener('submit', (event) => {
    event.preventDefault();
    addError.textContent = '';

    const value = addInput.value;
    if (!value.trim()) {
      addError.textContent = 'Vul eerst iets in.';
      return;
    }

    addItem(value);
    addInput.value = '';
    addInput.focus();
  });

  listEl.addEventListener('click', (event) => {
    const deleteBtn = event.target.closest('.sl-delete');
    if (deleteBtn) {
      const id = deleteBtn.closest('.sl-item')?.dataset.id;
      if (id) deleteItem(id);
    }
  });

  listEl.addEventListener('change', (event) => {
    if (event.target.classList.contains('sl-checkbox')) {
      const id = event.target.closest('.sl-item')?.dataset.id;
      if (id) toggleItem(id);
    }
  });

  // ---- Polling (picks up changes made on the other person's device) ----

  function startPolling() {
    stopPolling();
    pollTimer = setInterval(() => {
      // Skip a tick if a save is still in flight, so we never
      // overwrite `items` with stale server data right after a
      // change we just made ourselves.
      if (!saveInFlight) loadList({ silent: true });
    }, POLL_INTERVAL_MS);
  }

  function stopPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopPolling();
    } else {
      loadList({ silent: true });
      startPolling();
    }
  });

  // ---- Initial load --------------------------------------------------

  loadList();
  startPolling();
}
