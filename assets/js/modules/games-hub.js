// =================================================================
// GAMES HUB
// -----------------------------------------------------------------
// Renders the grid of game-cards on games-hub.html. Same
// pattern as home-cards.js: one array here is the single source of
// truth, add a new game by adding an entry to `games` below.
//   - status: 'available'   -> renders as a clickable link
//   - status: 'coming-soon' -> renders disabled, "Binnenkort" badge
// =================================================================

import { escapeHtml, siteRootUrl } from './utils.js';

// Every icon below is a flat, border-free custom SVG (assets/icons/games-hub/)
// instead of a raw emoji character. Emoji glyphs render with a black outline
// in several system emoji fonts (Windows/Segoe UI Emoji in particular) —
// swapping them all for our own flat-colour SVGs (same style as the pink
// circle already used here) keeps every card icon border-free and consistent.
const games = [
  {
    title: 'Boter, Kaas & Eieren',
    description: 'Het klassieke tic-tac-toe. Speel zo vaak als je wilt, terug-en-weer.',
    href: 'games/tictactoe.html',
    emoji: `<img src="${siteRootUrl('assets/icons/games-hub/hub-tictactoe-x.svg')}" alt="" class="emoji-icon"><img src="${siteRootUrl('assets/icons/games-hub/hub-tictactoe-o.svg')}" alt="" class="emoji-icon">`,
    status: 'available',
  },
  {
    title: 'Vier op een Rij',
    description: 'Wie krijgt er als eerste vier schijven op een rij?',
    href: 'games/connect4.html',
    emoji: `<img src="${siteRootUrl('assets/icons/games-hub/hub-connect4-blue.svg')}" alt="" class="emoji-icon"><img src="${siteRootUrl('assets/icons/player-pink.svg')}" alt="" class="emoji-icon">`,
    status: 'available',
  },
  {
    title: 'Wordle',
    description: 'Raad het Engelse woord. Kies zelf hoeveel letters (4 t/m 10).',
    href: 'games/wordle.html',
    emoji: `<img src="${siteRootUrl('assets/icons/games-hub/hub-wordle.svg')}" alt="" class="emoji-icon">`,
    status: 'available',
  },
  {
    title: 'Galgje',
    description: 'Raad het woord voordat het poppetje af is.',
    href: 'games/hangman.html',
    emoji: `<img src="${siteRootUrl('assets/icons/games-hub/hub-hangman.svg')}" alt="" class="emoji-icon">`,
    status: 'available',
  },
  {
    title: 'BlackJack',
    description: 'Kom zo dicht mogelijk bij 21. Speel gratis als gast, of log in voor een opgeslagen chipsaldo.',
    href: 'games/blackjack.html',
    emoji: `<img src="${siteRootUrl('assets/icons/games-hub/hub-blackjack.svg')}" alt="" class="emoji-icon">`,
    status: 'available',
  },
  {
    title: 'Spiderette',
    description: 'Los alle vier de reeksen op. Kaarten mogen op elke kleur, maar alleen een complete reeks van dezelfde kleur telt.',
    href: 'games/spiderette.html',
    emoji: `<img src="${siteRootUrl('assets/icons/games-hub/hub-spiderette.svg')}" alt="" class="emoji-icon">`,
    status: 'available',
  },
  {
    title: 'Geheugenspel',
    description: 'Draai de kaartjes om en vind alle paren.',
    emoji: `<img src="${siteRootUrl('assets/icons/games-hub/hub-memory.svg')}" alt="" class="emoji-icon">`,
    status: 'coming-soon',
  },
  {
    title: 'Quiz',
    description: 'Test elkaar met leuke weetjes en vragen.',
    emoji: `<img src="${siteRootUrl('assets/icons/games-hub/hub-quiz.svg')}" alt="" class="emoji-icon">`,
    status: 'coming-soon',
  },
];

function renderCard(game) {
  const isAvailable = game.status === 'available' && game.href;

  const inner = `
    <div class="card-icon" aria-hidden="true">${game.emoji}</div>
    <div>
      <h4>${escapeHtml(game.title)}</h4>
      <p>${escapeHtml(game.description)}</p>
      ${!isAvailable ? '<span class="badge">Binnenkort</span>' : ''}
    </div>
  `;

  if (isAvailable) {
    return `<a href="${game.href}" class="card">${inner}</a>`;
  }

  return `<div class="card card-disabled" aria-disabled="true">${inner}</div>`;
}

export function initGamesHub() {
  const grid = document.getElementById('gamesGrid');
  if (!grid) return; // not on the games hub page

  grid.innerHTML = games.map(renderCard).join('');
}
