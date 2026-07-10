// =================================================================
// SPIDERETTE
// -----------------------------------------------------------------
// Single-deck (52 cards, no jokers) patience game, 7 tableau
// columns. This is specifically the RELAXED-PLACEMENT variant:
//   - You may place ANY card on ANY other card that is exactly one
//     rank higher, regardless of suit or colour (so a red 7 can sit
//     on a black 8, unlike "real" Spider which requires matching
//     colour/suit to place at all).
//   - That relaxed placement does NOT count for clearing a pile: a
//     run only gets swept away as "completed" once it is a full,
//     unbroken King-to-Ace run of the SAME COLOUR (red or black —
//     so e.g. hearts and diamonds can mix in one clearing run, same
//     for clubs and spades). Mixed-colour runs can be freely built
//     and rearranged, but they just sit there — they never auto-clear.
//
// DEAL: triangular deal across the 7 columns — column 1 gets 1 card,
// column 2 gets 2, ... column 7 gets 7 (1+2+3+4+5+6+7 = 28 cards
// dealt, top card of each pile face up). The remaining 24 cards form
// the stock, dealt out in 4 "waves" of 7, 7, 7, then 3 cards (the
// last wave only reaches the first 3 columns, since there are only
// 3 cards left) — every column must be non-empty before a wave can
// be dealt, same rule as classic Spider(ette).
//
// STOCK REMOVAL: as soon as the FIRST same-colour King-to-Ace run
// clears (regardless of how many stock cards/waves are left), the
// stock is removed from play entirely — no more waves can be dealt
// for the rest of the game.
//
// WINNING: the game ends, with a winning screen, once all 4
// same-colour King-to-Ace sequences have been cleared (the entire
// deck swept off the board).
//
// DOUBLE-CLICK: double-clicking a movable card/run auto-moves it to
// the best legal destination. It first looks for a destination pile
// whose top card matches by COLOUR (red/black) one rank higher; if
// none exists, it falls back to the first legal destination
// regardless of colour (matching the relaxed single-click rule). An
// empty column is used only if no non-empty destination is legal.
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
const COLUMN_COUNT = 7;
const STOCK_WAVE_SIZES = [7, 7, 7, 3]; // 4 waves, last one only reaches columns 0-2
const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const RED_SUITS = new Set(['hearts', 'diamonds']);
const RANKS = ['ace', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'jack', 'queen', 'king'];
const SPECIAL_RANKS = new Set(['ace', 'jack', 'queen', 'king', 'joker']);
const TOTAL_SEQUENCES = 4; // whole deck = 4 King-to-Ace runs

/** Ace-low rank index (ace=1 ... king=13) — sequences run King down to Ace. */
function rankIndex(rank) {
  return RANKS.indexOf(rank) + 1;
}

/** 'red' or 'black' for a suit. */
function cardColour(suit) {
  return RED_SUITS.has(suit) ? 'red' : 'black';
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
  const winOverlay = document.getElementById('spiWinOverlay');
  const winPlayAgainBtn = document.getElementById('spiWinPlayAgain');

  // ---- state ----
  let auth = null; // { token, who, exp } | null
  let stock = [];
  let stockWaveIndex = 0; // how many waves have been dealt so far
  let columns = []; // 7 arrays of { rank, suit, faceUp }
  let completedColours = []; // ['red' | 'black', ...] cleared this game
  let selection = null; // { col, index } | null
  let stockRemoved = false; // true once the stock is pulled from play
  let gameOver = false;

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
    // Triangular deal: column i (0-indexed) gets i+1 cards.
    for (let col = 0; col < COLUMN_COUNT; col++) {
      const count = col + 1;
      const pile = deck.splice(0, count);
      pile[pile.length - 1].faceUp = true;
      columns.push(pile);
    }
    stock = deck; // remaining 24 cards, dealt out in waves of 7/7/7/3
    stockWaveIndex = 0;
    completedColours = [];
    selection = null;
    stockRemoved = false;
    gameOver = false;
    hideWinOverlay();
    setStatus('Klik een kaart om te kiezen, klik een stapel om ‘m neer te leggen. Dubbelklik voor een automatische zet.');
    renderBoard();
    renderCompleted();
    renderStock();
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

  /** Same as canDrop, but also requires the destination top card to match the moving card's COLOUR. */
  function canDropSameColour(fromCol, fromIndex, toCol) {
    if (!canDrop(fromCol, fromIndex, toCol)) return false;
    const destPile = columns[toCol];
    if (destPile.length === 0) return false; // "same colour" needs an actual card to match against
    const movingCard = columns[fromCol][fromIndex];
    const destTop = destPile[destPile.length - 1];
    return cardColour(destTop.suit) === cardColour(movingCard.suit);
  }

  /** After any tableau change: sweep away a pile's top run if — and only if — it's a full, same-COLOUR King-to-Ace sequence. Mixed-colour runs (the relaxed-placement kind) are left exactly where they are. */
  function sweepCompletedSequences() {
    let sweptAny = false;
    for (let col = 0; col < COLUMN_COUNT; col++) {
      const pile = columns[col];
      if (pile.length < 13) continue;
      const top13 = pile.slice(pile.length - 13);
      const sameColour = top13.every((card) => cardColour(card.suit) === cardColour(top13[0].suit));
      const isFullRun = top13.every((card, i) => i === 0 || rankIndex(top13[i - 1].rank) === rankIndex(card.rank) + 1);
      const isKingHigh = rankIndex(top13[0].rank) === 13;
      if (sameColour && isFullRun && isKingHigh) {
        columns[col] = pile.slice(0, pile.length - 13);
        if (columns[col].length) columns[col][columns[col].length - 1].faceUp = true;
        completedColours.push(cardColour(top13[0].suit));
        sweptAny = true;
      }
    }
    if (sweptAny) {
      // Stock is removed from play the moment the first sequence clears,
      // no matter how many cards/waves are still left in it.
      if (!stockRemoved) {
        stockRemoved = true;
        stock = [];
      }
      renderCompleted();
      renderStock();
      if (completedColours.length >= TOTAL_SEQUENCES) {
        setStatus('Alle vier de reeksen compleet — gewonnen! 🎉');
        triggerWin();
      } else {
        setStatus(`Reeks compleet! De stok is nu weg. Nog ${TOTAL_SEQUENCES - completedColours.length} te gaan.`);
      }
    }
    return sweptAny;
  }

  // -----------------------------------------------------------------
  // WIN / GAME OVER
  // -----------------------------------------------------------------
  function triggerWin() {
    gameOver = true;
    selection = null;
    showWinOverlay();
  }

  function showWinOverlay() {
    if (winOverlay) winOverlay.classList.remove('hidden');
  }

  function hideWinOverlay() {
    if (winOverlay) winOverlay.classList.add('hidden');
  }

  // -----------------------------------------------------------------
  // INTERACTION (click-to-select, click-to-drop, double-click to
  // auto-move — no drag-and-drop, so it works the same on touch and
  // mouse)
  // -----------------------------------------------------------------
  function clearSelection() {
    selection = null;
    renderBoard();
  }

  function handleCardClick(col, index) {
    if (gameOver) return;
    const pile = columns[col];
    const card = pile[index];
    if (!card.faceUp) return; // face-down cards aren't interactive

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

  /** Double-click: auto-move the run to the best legal destination.
   *  Tries a same-COLOUR destination first (matching the request that
   *  double-click should prefer colour matches), then falls back to
   *  any legal destination (relaxed placement), preferring a
   *  non-empty pile over an empty column either way. */
  function handleCardDoubleClick(col, index) {
    if (gameOver) return;
    const card = columns[col][index];
    if (!card.faceUp || !isMovableRun(col, index)) return;

    selection = null;

    let target = findBestDestination(col, index, true); // same-colour pass
    if (target === null) target = findBestDestination(col, index, false); // any-colour pass

    if (target === null) {
      setStatus('Geen geldige zet gevonden voor deze kaart.');
      renderBoard();
      return;
    }

    attemptMove(col, index, target);
  }

  /** Finds a destination column for the run at (fromCol, fromIndex).
   *  requireSameColour=true only considers destinations whose top card
   *  matches the moving card's colour; non-empty destinations are
   *  preferred over empty columns in both passes. */
  function findBestDestination(fromCol, fromIndex, requireSameColour) {
    let emptyFallback = null;
    for (let toCol = 0; toCol < COLUMN_COUNT; toCol++) {
      if (toCol === fromCol) continue;
      const destPile = columns[toCol];
      if (destPile.length === 0) {
        if (!requireSameColour && emptyFallback === null && canDrop(fromCol, fromIndex, toCol)) {
          emptyFallback = toCol;
        }
        continue;
      }
      const isLegal = requireSameColour
        ? canDropSameColour(fromCol, fromIndex, toCol)
        : canDrop(fromCol, fromIndex, toCol);
      if (isLegal) return toCol;
    }
    return emptyFallback;
  }

  function handleColumnClick(col) {
    if (gameOver) return;
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
    if (!won && !gameOver) {
      setStatus('Klik een kaart om te kiezen, klik een stapel om ‘m neer te leggen. Dubbelklik voor een automatische zet.');
    }
    renderBoard();
  }

  function dealFromStock() {
    if (gameOver || stockRemoved || stock.length === 0) return;
    if (columns.some((pile) => pile.length === 0)) {
      setStatus('Vul eerst elke lege stapel voordat je nieuwe kaarten deelt.');
      return;
    }
    const waveSize = STOCK_WAVE_SIZES[stockWaveIndex] ?? stock.length;
    const dealCount = Math.min(stock.length, waveSize, COLUMN_COUNT);
    for (let col = 0; col < dealCount; col++) {
      const card = stock.shift();
      card.faceUp = true;
      columns[col].push(card);
    }
    stockWaveIndex += 1;
    selection = null;
    sweepCompletedSequences();
    renderBoard();
    renderStock();
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

    el.addEventListener('dblclick', (event) => {
      event.stopPropagation();
      handleCardDoubleClick(col, index);
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
  }

  function renderStock() {
    stockCountEl.textContent = String(stock.length);
    stockEl.classList.toggle('spi-stock-empty', stock.length === 0 || stockRemoved);
    // Once cleared, the stock/staple is removed from play entirely.
    stockEl.classList.toggle('spi-stock-removed', stockRemoved);
    stockEl.disabled = stockRemoved || stock.length === 0;
  }

  function renderCompleted() {
    completedEl.innerHTML = completedColours.map((colour) => {
      const card = { rank: 'king', suit: colour === 'red' ? 'hearts' : 'spades' };
      return `<img src="${cardImageUrl(card, isLoggedIn())}" alt="Complete reeks (${colour === 'red' ? 'rood' : 'zwart'})" class="spi-completed-img">`;
    }).join('');
  }

  // -----------------------------------------------------------------
  // WIRE UP
  // -----------------------------------------------------------------
  stockEl.addEventListener('click', dealFromStock);
  newGameBtn.addEventListener('click', dealNewGame);
  if (winPlayAgainBtn) winPlayAgainBtn.addEventListener('click', dealNewGame);

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
