// =================================================================
// SPIDERETTE
// -----------------------------------------------------------------
// Single-deck (52 cards, no jokers) patience game, 10 tableau
// columns. This is specifically the RELAXED-PLACEMENT variant:
//   - You may place ANY card on ANY other card that is exactly one
//     rank higher, regardless of suit or colour (so a red 7 can sit
//     on a black 8, unlike "real" Spider which requires matching
//     colour/suit to place at all).
//   - That relaxed placement does NOT count for clearing a pile: a
//     run only gets swept away as "completed" once it is a full,
//     unbroken King-to-Ace run of the SAME SUIT sitting together.
//     Mixed-suit runs can be freely built and rearranged, but they
//     just sit there — they never auto-clear.
// Classic Spiderette deal: columns 0-3 get 5 cards, columns 4-9 get
// 4 cards (44 dealt, top card face up), remaining 8 cards form a
// single stock that deals one face-up card onto the first 8 columns
// (there's no second stock round — that's what makes it Spiderette
// rather than full Spider).
//
// CARDS: same image set/quirks as blackjack.js (ace of spades and
// all face cards have a trailing "2" in their filename) — see
// cardImageFile() below, identical logic, duplicated on purpose so
// this module has no dependency on blackjack.js.
//
// LOGGED IN vs GUEST — same rule as BlackJack (see blackjack.js's
// file header): assets/icons/playing-cards/special-cards/ holds an
// alternate look for aces, jacks/queens/kings, and jokers (jokers
// aren't used here, but the folder is shared). Logged-in players get
// that variant for those ranks; everything else looks the same
// either way. This game has no score/balance to save, so login here
// only ever changes the card art — same passphrase system as
// BlackJack/the photo gallery, kept in its own localStorage key so
// the three logins stay independent sessions.
// =================================================================

import { siteRootUrl } from './utils.js';
import { siteConfig } from '../config.js';

const AUTH_STORAGE_KEY = 'spideretteAuth';
const COLUMN_COUNT = 10;
const FIVE_CARD_COLUMNS = 4; // columns 0-3 start with 5 cards, the rest with 4
const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS = ['ace', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'jack', 'queen', 'king'];
const SPECIAL_RANKS = new Set(['ace', 'jack', 'queen', 'king', 'joker']);

/** Ace-low rank index (ace=1 ... king=13) — sequences run King down to Ace. */
function rankIndex(rank) {
  return RANKS.indexOf(rank) + 1;
}

/** Resolves a card to its image filename — identical quirks to blackjack.js's cardImageFile(). */
function cardImageFile(card) {
  const { rank, suit } = card;
  if (rank === 'ace' && suit === 'spades') return 'ace_of_spades2.png';
  if (rank === 'jack' || rank === 'queen' || rank === 'king') return `${rank}_of_${suit}2.png`;
  return `${rank}_of_${suit}.png`;
}

/** Full URL for a card's face, choosing the special-cards variant when logged in and the rank qualifies. */
function cardImageUrl(card, isLoggedIn) {
  const file = cardImageFile(card);
  const folder = isLoggedIn && SPECIAL_RANKS.has(card.rank)
    ? 'assets/icons/playing-cards/special-cards'
    : 'assets/icons/playing-cards';
  return siteRootUrl(`${folder}/${file}`);
}

function buildShuffledDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) deck.push({ rank, suit, faceUp: false });
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function initSpiderette() {
  const app = document.getElementById('spiApp');
  if (!app) return; // not on the spiderette page

  const workerUrl = siteConfig.spiderette?.workerUrl || '';

  // ---- DOM refs ----
  const guestBadge = document.getElementById('spiGuestBadge');
  const loggedInBadge = document.getElementById('spiLoggedInBadge');
  const whoLabel = document.getElementById('spiWhoLabel');
  const showLoginBtn = document.getElementById('spiShowLogin');
  const cancelLoginBtn = document.getElementById('spiCancelLogin');
  const logoutBtn = document.getElementById('spiLogoutBtn');
  const loginForm = document.getElementById('spiLoginForm');
  const passphraseInput = document.getElementById('spiPassphrase');
  const loginError = document.getElementById('spiLoginError');

  const statusEl = document.getElementById('spiStatus');
  const stockEl = document.getElementById('spiStock');
  const stockCountEl = document.getElementById('spiStockCount');
  const completedEl = document.getElementById('spiCompleted');
  const boardEl = document.getElementById('spiBoard');
  const newGameBtn = document.getElementById('spiNewGame');

  // ---- state ----
  let auth = null; // { token, who, exp } | null
  let stock = [];
  let columns = []; // 10 arrays of { rank, suit, faceUp }
  let completedSuits = []; // suits fully cleared this game
  let selection = null; // { col, index } | null

  function isLoggedIn() {
    return Boolean(auth);
  }

  // -----------------------------------------------------------------
  // AUTH (same pattern as blackjack.js — see that file for details)
  // -----------------------------------------------------------------
  function loadStoredAuth() {
    try {
      const raw = localStorage.getItem(AUTH_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed?.token || !parsed?.exp || parsed.exp * 1000 < Date.now()) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function storeAuth(nextAuth) {
    auth = nextAuth;
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextAuth));
  }

  function clearAuth() {
    auth = null;
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }

  function updateAuthUI() {
    if (isLoggedIn()) {
      guestBadge.classList.add('hidden');
      loggedInBadge.classList.remove('hidden');
      loginForm.classList.add('hidden');
      const labels = siteConfig.spiderette?.personLabels || {};
      whoLabel.textContent = labels[auth.who] || auth.who;
    } else {
      guestBadge.classList.remove('hidden');
      loggedInBadge.classList.add('hidden');
    }
  }

  function showLoginForm() {
    guestBadge.classList.add('hidden');
    loginForm.classList.remove('hidden');
    loginError.textContent = '';
    passphraseInput.value = '';
    passphraseInput.focus();
  }

  function hideLoginForm() {
    loginForm.classList.add('hidden');
    loginError.textContent = '';
    updateAuthUI();
  }

  async function login(passphrase) {
    if (!workerUrl) {
      loginError.textContent = '⚠️ Nog geen Worker gekoppeld.';
      return;
    }
    loginError.textContent = '';
    try {
      const response = await fetch(`${workerUrl}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passphrase }),
      });
      const data = await response.json();
      if (!response.ok) {
        loginError.textContent = data.error || 'Inloggen mislukt.';
        return;
      }
      storeAuth({ token: data.token, who: data.who, exp: data.exp });
      passphraseInput.value = '';
      updateAuthUI();
      renderBoard(); // re-render with the special-cards art
    } catch {
      loginError.textContent = 'Geen verbinding, probeer het later opnieuw.';
    }
  }

  function logout() {
    clearAuth();
    updateAuthUI();
    renderBoard();
  }

  // -----------------------------------------------------------------
  // DEAL / GAME SETUP
  // -----------------------------------------------------------------
  function dealNewGame() {
    const deck = buildShuffledDeck();
    columns = [];
    for (let col = 0; col < COLUMN_COUNT; col++) {
      const count = col < FIVE_CARD_COLUMNS ? 5 : 4;
      const pile = deck.splice(0, count);
      pile[pile.length - 1].faceUp = true;
      columns.push(pile);
    }
    stock = deck; // whatever's left (8 cards in a single 52-card deck)
    completedSuits = [];
    selection = null;
    setStatus('Sleep geen kaarten — klik een kaart om te kiezen, klik een stapel om ’m neer te leggen, of dubbelklik een kaart voor een automatische zet.');
    renderBoard();
  }

  // -----------------------------------------------------------------
  // SEQUENCE HELPERS
  // -----------------------------------------------------------------
  /** True if columns[col][index..end] is a face-up, strictly-descending-rank run (any suit/colour — see file header). */
  function isMovableRun(col, index) {
    const pile = columns[col];
    if (index < 0 || index >= pile.length) return false;
    for (let i = index; i < pile.length; i++) {
      if (!pile[i].faceUp) return false;
      if (i > index && rankIndex(pile[i - 1].rank) !== rankIndex(pile[i].rank) + 1) return false;
    }
    return true;
  }

  /** Can the run starting at columns[fromCol][fromIndex] legally land on column toCol? Any suit/colour, just one rank down (or the pile is empty). */
  function canDrop(fromCol, fromIndex, toCol) {
    if (fromCol === toCol) return false;
    const movingCard = columns[fromCol][fromIndex];
    const destPile = columns[toCol];
    if (destPile.length === 0) return true;
    const destTop = destPile[destPile.length - 1];
    if (!destTop.faceUp) return false;
    return rankIndex(destTop.rank) === rankIndex(movingCard.rank) + 1;
  }

  /** After any tableau change: sweep away a pile's top run if — and only if — it's a full, same-suit King-to-Ace sequence. Mixed-suit runs (the relaxed-placement kind) are left exactly where they are. */
  function sweepCompletedSequences() {
    let sweptAny = false;
    for (let col = 0; col < COLUMN_COUNT; col++) {
      const pile = columns[col];
      if (pile.length < 13) continue;
      const top13 = pile.slice(pile.length - 13);
      const sameSuit = top13.every((card) => card.suit === top13[0].suit);
      const isFullRun = top13.every((card, i) => i === 0 || rankIndex(top13[i - 1].rank) === rankIndex(card.rank) + 1);
      const isKingHigh = rankIndex(top13[0].rank) === 13;
      if (sameSuit && isFullRun && isKingHigh) {
        columns[col] = pile.slice(0, pile.length - 13);
        if (columns[col].length) columns[col][columns[col].length - 1].faceUp = true;
        completedSuits.push(top13[0].suit);
        sweptAny = true;
      }
    }
    if (sweptAny) {
      renderCompleted();
      if (completedSuits.length >= 4) {
        setStatus('Alle vier de reeksen compleet — gewonnen! 🎉');
      } else {
        setStatus(`Reeks compleet! Nog ${4 - completedSuits.length} te gaan.`);
      }
    }
    return sweptAny;
  }

  /**
   * Picks the most logical destination column for the run starting at
   * columns[fromCol][fromIndex], for double-click auto-move. Considers
   * every other column that's a legal drop (canDrop) and ranks them:
   *   1. Same suit as the moving run's top card AND itself part of a
   *      same-suit descending run already — extends a "real" Spider
   *      sequence, the single most useful kind of move.
   *   2. Any other same-suit landing spot (keeps future clearing alive
   *      even if the destination pile isn't a pure run itself).
   *   3. Any other legal same-rank-down landing spot, regardless of suit.
   *   4. An empty column — always legal, but the least informative
   *      move, so only used when nothing better exists.
   * Within a tier, prefers the column that would flip a face-down card
   * (shortest pile with a hidden card on top gets uncovered), since
   * that's the single most useful side-effect a move can have.
   */
  function findBestDestination(fromCol, fromIndex) {
    const movingCard = columns[fromCol][fromIndex];
    const candidates = [];

    for (let toCol = 0; toCol < COLUMN_COUNT; toCol++) {
      if (!canDrop(fromCol, fromIndex, toCol)) continue;
      const destPile = columns[toCol];

      let tier;
      if (destPile.length === 0) {
        tier = 4; // empty column: legal, but last resort
      } else {
        const destTop = destPile[destPile.length - 1];
        const sameSuit = destTop.suit === movingCard.suit;
        if (sameSuit) {
          // Is the destination pile itself currently a same-suit
          // descending run all the way down? If so this move grows an
          // actual clearable sequence, not just a mixed-suit stack.
          let destIsRun = true;
          for (let i = 1; i < destPile.length; i++) {
            if (destPile[i].suit !== destPile[0].suit
              || rankIndex(destPile[i - 1].rank) !== rankIndex(destPile[i].rank) + 1) {
              destIsRun = false;
              break;
            }
          }
          tier = destIsRun ? 1 : 2;
        } else {
          tier = 3;
        }
      }

      // Secondary preference: does this move reveal a face-down card
      // in the source pile? (Always true here since fromIndex only
      // moves whole runs off the top, so this only varies by whether
      // the source pile becomes empty/has a hidden card underneath —
      // kept simple: prefer whichever destination pile is shortest,
      // which tends to keep columns balanced and open for stock deals.)
      candidates.push({ toCol, tier, destLength: destPile.length });
    }

    if (candidates.length === 0) return -1;

    candidates.sort((a, b) => a.tier - b.tier || a.destLength - b.destLength);
    return candidates[0].toCol;
  }

  /** Double-click / double-tap on a card: auto-move its run to the most logical column instead of requiring two clicks. */
  function handleCardDoubleClick(col, index) {
    const pile = columns[col];
    const card = pile[index];
    if (!card.faceUp) return;
    if (!isMovableRun(col, index)) return;

    const bestCol = findBestDestination(col, index);
    if (bestCol === -1) {
      setStatus('Geen geldige zet voor deze kaart.');
      return;
    }

    selection = null;
    attemptMove(col, index, bestCol);
  }

  // Manual double-click detection: renderBoard() rebuilds every card's
  // DOM node on each click (selection highlight, etc.), so the browser's
  // native dblclick — which requires both clicks to land on the same
  // still-attached element — can't be relied on. Track "same card,
  // within N ms" ourselves instead.
  const DOUBLE_CLICK_MS = 350;
  let lastClick = null; // { col, index, time } | null

  function isDoubleClick(col, index) {
    const now = Date.now();
    const isDouble = Boolean(
      lastClick
      && lastClick.col === col
      && lastClick.index === index
      && now - lastClick.time < DOUBLE_CLICK_MS,
    );
    lastClick = isDouble ? null : { col, index, time: now };
    return isDouble;
  }


  // -----------------------------------------------------------------
  // INTERACTION (click-to-select, click-to-drop — no drag-and-drop,
  // so it works the same on touch and mouse)
  // -----------------------------------------------------------------
  function clearSelection() {
    selection = null;
    renderBoard();
  }

  function handleCardClick(col, index) {
    const pile = columns[col];
    const card = pile[index];
    if (!card.faceUp) return; // face-down cards aren't interactive

    // Double-click always means "auto-move this card" — takes priority
    // even if a different card was already selected, so a double-click
    // never gets swallowed as "move the old selection here" instead.
    if (isDoubleClick(col, index)) {
      selection = null;
      handleCardDoubleClick(col, index);
      return;
    }

    if (selection && selection.col === col && selection.index === index) {
      clearSelection();
      return;
    }

    if (selection) {
      attemptMove(selection.col, selection.index, col);
      return;
    }

    if (isMovableRun(col, index)) {
      selection = { col, index };
      renderBoard();
    }
  }

  function handleColumnClick(col) {
    if (!selection) return;
    attemptMove(selection.col, selection.index, col);
  }

  function attemptMove(fromCol, fromIndex, toCol) {
    if (!canDrop(fromCol, fromIndex, toCol)) {
      setStatus('Ongeldige zet.');
      selection = null;
      renderBoard();
      return;
    }

    const run = columns[fromCol].splice(fromIndex);
    columns[toCol].push(...run);
    if (columns[fromCol].length) columns[fromCol][columns[fromCol].length - 1].faceUp = true;

    selection = null;
    const won = sweepCompletedSequences();
    if (!won) setStatus('Sleep geen kaarten — klik een kaart om te kiezen, klik een stapel om ’m neer te leggen, of dubbelklik een kaart voor een automatische zet.');
    renderBoard();
  }

  function dealFromStock() {
    if (stock.length === 0) return;
    if (columns.some((pile) => pile.length === 0)) {
      setStatus('Vul eerst elke lege stapel voordat je nieuwe kaarten deelt.');
      return;
    }
    const dealCount = Math.min(stock.length, COLUMN_COUNT);
    for (let col = 0; col < dealCount; col++) {
      const card = stock.shift();
      card.faceUp = true;
      columns[col].push(card);
    }
    selection = null;
    sweepCompletedSequences();
    renderBoard();
  }

  // -----------------------------------------------------------------
  // RENDERING
  // -----------------------------------------------------------------
  function setStatus(text) {
    statusEl.textContent = text;
  }

  function buildCardEl(card, col, index) {
    const el = document.createElement('div');
    el.className = 'spi-card';
    el.style.top = `${index * 24}px`;
    el.style.zIndex = String(index);

    if (!card.faceUp) {
      const img = document.createElement('img');
      img.src = siteRootUrl('assets/icons/playing-cards/card-back-blue.png');
      img.alt = 'Verborgen kaart';
      img.className = 'spi-card-img';
      el.appendChild(img);
      return el;
    }

    const img = document.createElement('img');
    img.src = cardImageUrl(card, isLoggedIn());
    img.alt = `${card.rank} of ${card.suit}`;
    img.className = 'spi-card-img';
    el.appendChild(img);

    if (selection && selection.col === col && index >= selection.index) {
      el.classList.add('spi-card-selected');
    }

    el.addEventListener('click', (event) => {
      event.stopPropagation();
      handleCardClick(col, index);
    });

    return el;
  }

  function renderBoard() {
    boardEl.innerHTML = '';
    columns.forEach((pile, col) => {
      const colEl = document.createElement('div');
      colEl.className = 'spi-column';
      colEl.addEventListener('click', () => handleColumnClick(col));

      pile.forEach((card, index) => {
        colEl.appendChild(buildCardEl(card, col, index));
      });

      boardEl.appendChild(colEl);
    });

    stockCountEl.textContent = String(stock.length);
    stockEl.classList.toggle('spi-stock-empty', stock.length === 0);
  }

  function renderCompleted() {
    completedEl.innerHTML = completedSuits.map((suit) => {
      const card = { rank: 'king', suit };
      return `<img src="${cardImageUrl(card, isLoggedIn())}" alt="Complete reeks ${suit}" class="spi-completed-img">`;
    }).join('');
  }

  // -----------------------------------------------------------------
  // WIRE UP
  // -----------------------------------------------------------------
  stockEl.addEventListener('click', dealFromStock);
  newGameBtn.addEventListener('click', dealNewGame);

  showLoginBtn.addEventListener('click', showLoginForm);
  cancelLoginBtn.addEventListener('click', hideLoginForm);
  logoutBtn.addEventListener('click', logout);
  loginForm.addEventListener('submit', (event) => {
    event.preventDefault();
    login(passphraseInput.value.trim());
  });

  const storedAuth = loadStoredAuth();
  if (storedAuth) {
    auth = storedAuth;
  }
  updateAuthUI();

  dealNewGame();
}
