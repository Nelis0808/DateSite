// =================================================================
// TIC-TAC-TOE (Boter, Kaas & Eieren)
// -----------------------------------------------------------------
// Local two-player, same-device game. Keeps a running score across
// rounds (stored only in memory, resets on page reload) so two
// people can play "best of X" back-to-back without re-navigating.
// =================================================================

const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
  [0, 4, 8], [2, 4, 6],            // diagonals
];

export function initTicTacToe() {
  const board = document.getElementById('tttBoard');
  if (!board) return; // not on the tic-tac-toe page

  const cells = Array.from(board.querySelectorAll('.ttt-cell'));
  const statusEl = document.getElementById('tttStatus');
  const scoreXEl = document.getElementById('scoreX');
  const scoreOEl = document.getElementById('scoreO');
  const scoreDrawEl = document.getElementById('scoreDraw');
  const newRoundBtn = document.getElementById('tttNewRound');
  const resetScoreBtn = document.getElementById('tttResetScore');

  let cellValues = Array(9).fill(null);
  let currentPlayer = 'X';
  let roundOver = false;
  const score = { X: 0, O: 0, draw: 0 };

  function playerLabel(player) {
    return player === 'X' ? '❌' : '⭕';
  }

  function updateStatus(text) {
    statusEl.textContent = text;
  }

  function updateScoreboard() {
    scoreXEl.textContent = String(score.X);
    scoreOEl.textContent = String(score.O);
    scoreDrawEl.textContent = String(score.draw);
  }

  function findWinningLine() {
    return WIN_LINES.find(([a, b, c]) =>
      cellValues[a] && cellValues[a] === cellValues[b] && cellValues[a] === cellValues[c]
    );
  }

  function highlightWin(line) {
    line.forEach((index) => cells[index].classList.add('ttt-cell-win'));
  }

  function endRound({ winner, line }) {
    roundOver = true;
    cells.forEach((cell) => cell.setAttribute('aria-disabled', 'true'));

    if (winner) {
      score[winner] += 1;
      updateStatus(`${playerLabel(winner)} wint deze ronde! 🎉`);
      highlightWin(line);
    } else {
      score.draw += 1;
      updateStatus('Gelijkspel! Niemand wint deze ronde.');
    }

    updateScoreboard();
  }

  function handleCellClick(event) {
    if (roundOver) return;

    const cell = event.currentTarget;
    const index = Number(cell.dataset.index);
    if (cellValues[index]) return; // already taken

    cellValues[index] = currentPlayer;
    cell.textContent = playerLabel(currentPlayer);
    cell.classList.add(currentPlayer === 'X' ? 'ttt-cell-x' : 'ttt-cell-o');
    cell.setAttribute('aria-disabled', 'true');

    const winningLine = findWinningLine();
    if (winningLine) {
      endRound({ winner: currentPlayer, line: winningLine });
      return;
    }

    if (cellValues.every(Boolean)) {
      endRound({ winner: null, line: null });
      return;
    }

    currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
    updateStatus(`Speler ${playerLabel(currentPlayer)} is aan de beurt`);
  }

  function startNewRound() {
    cellValues = Array(9).fill(null);
    currentPlayer = 'X';
    roundOver = false;

    cells.forEach((cell) => {
      cell.textContent = '';
      cell.className = 'ttt-cell';
      cell.removeAttribute('aria-disabled');
    });

    updateStatus(`Speler ${playerLabel(currentPlayer)} is aan de beurt`);
  }

  function resetScore() {
    score.X = 0;
    score.O = 0;
    score.draw = 0;
    updateScoreboard();
    startNewRound();
  }

  cells.forEach((cell) => cell.addEventListener('click', handleCellClick));
  newRoundBtn.addEventListener('click', startNewRound);
  resetScoreBtn.addEventListener('click', resetScore);

  // Ready to play — board starts empty, score starts at 0-0-0.
  updateStatus(`Speler ${playerLabel(currentPlayer)} is aan de beurt`);
  updateScoreboard();
}
