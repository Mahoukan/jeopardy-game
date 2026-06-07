const socket = io();
window.socket = socket;
let selectedGame = null;

const dailyDoubleWagerInput = document.getElementById("dailyDoubleWagerInput");
const setDailyDoubleWagerBtn = document.getElementById(
  "setDailyDoubleWagerBtn",
);

const startFinalBtn = document.getElementById("startFinalBtn");
const revealFinalBtn = document.getElementById("revealFinalBtn");

const startDoubleBtn = document.getElementById("startDoubleBtn");

const rejoinCodeInput = document.getElementById("rejoinCodeInput");
const rejoinGameBtn = document.getElementById("rejoinGameBtn");
const restoreGameBtn = document.getElementById("restoreGameBtn");

const boardNameInput = document.getElementById("boardNameInput");
const createGameBtn = document.getElementById("createGameBtn");

const savedBoardsDiv = document.getElementById("savedBoards");
const gameCodeText = document.getElementById("gameCodeText");
const boardDiv = document.getElementById("board");
const playersDiv = document.getElementById("players");
const questionBox = document.getElementById("questionBox");

const correctBtn = document.getElementById("correctBtn");
const wrongBtn = document.getElementById("wrongBtn");
const skipBtn = document.getElementById("skipBtn");

const loginSection = document.getElementById("loginSection");
const adminPanel = document.getElementById("adminPanel");
const adminPasswordInput = document.getElementById("adminPasswordInput");
const adminLoginBtn = document.getElementById("adminLoginBtn");
const adminLoginMessage = document.getElementById("adminLoginMessage");

let currentCode = null;
let savedBoards = [];

createGameBtn.addEventListener("click", () => {
  if (!selectedGame) {
    alert("Load a game first.");
    return;
  }

  socket.emit("createGame", {
    board: selectedGame,
  });
});

socket.on("savedBoardsUpdated", (boards) => {
  savedBoards = boards;
  renderSavedBoards();
});

socket.on("successMessage", (message) => {
  alert(message);
});

socket.on("errorMessage", (message) => {
  alert(message);
});

socket.on("gameCreated", ({ code }) => {
  currentCode = code;
  window.currentCode = currentCode;
  localStorage.setItem("hostCode", code);
  gameCodeText.textContent = `Game Code: ${code}`;
});

socket.on("gameUpdate", (game) => {
  currentCode = game.code;
  window.currentCode = currentCode;
  localStorage.setItem("jeopardyBackup", JSON.stringify(game));
  gameCodeText.textContent = `Game Code: ${game.code}`;

  renderBoard(game.board);
  renderPlayers(game.players, game.scores, game.currentTurnIndex);
  renderQuestion(game);
});

function renderSavedBoards() {
  if (savedBoards.length === 0) {
    savedBoardsDiv.innerHTML = "<p>No saved boards yet.</p>";
    return;
  }

  savedBoardsDiv.innerHTML = savedBoards
    .map(
      (board) => `
    <div class="saved-board">
      <strong>${escapeHtml(board.name)}</strong>
      <button class="load-board-btn" data-id="${board.id}">Load</button>
      <button class="delete-board-btn" data-id="${board.id}">Delete</button>
    </div>
  `,
    )
    .join("");

  document.querySelectorAll(".load-board-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const savedBoard = savedBoards.find(
        (board) => board.id === button.dataset.id,
      );
      if (!savedBoard) return;

      boardNameInput.value = savedBoard.name;

      if (savedBoard.jeopardy && savedBoard.doubleJeopardy) {
        currentCode = null;
        localStorage.removeItem("hostCode");
        gameCodeText.textContent = "No game created yet";

        selectedGame = JSON.parse(JSON.stringify(savedBoard));
        boardNameInput.value = savedBoard.name;

        alert("Game loaded. Click Start Selected Game.");
        return;
      }

      selectedGame = JSON.parse(JSON.stringify(savedBoard));
      boardNameInput.value = savedBoard.name;
      alert("Game loaded. Click Start Selected Game.");
    });
  });

  document.querySelectorAll(".delete-board-btn").forEach((button) => {
    button.addEventListener("click", () => {
      socket.emit("deleteBoard", {
        id: button.dataset.id,
      });
    });
  });
}

function renderBoard(board) {
  boardDiv.innerHTML = "";

  board.forEach((category, categoryIndex) => {
    const column = document.createElement("div");
    column.className = "category-column";

    const heading = document.createElement("div");
    heading.className = "category-title";
    heading.textContent = category.category;
    column.appendChild(heading);

    category.questions.forEach((question, questionIndex) => {
      const button = document.createElement("button");
      button.className = "question-button";

      if (question.used) {
        button.textContent = "";
        button.disabled = true;
        button.classList.add("used");
      } else {
        button.textContent = question.value;
      }

      button.addEventListener("click", () => {
        socket.emit("selectQuestion", {
          code: currentCode,
          categoryIndex,
          questionIndex,
        });
      });

      column.appendChild(button);
    });

    boardDiv.appendChild(column);
  });
}

function renderPlayers(players, scores, currentTurnIndex) {
  if (players.length === 0) {
    playersDiv.innerHTML = "<p>No players yet.</p>";
    return;
  }

  playersDiv.innerHTML = players
    .map((player, index) => {
      const turnLabel = index === currentTurnIndex ? " ← turn" : "";
      const connectionLabel = player.connected ? "" : " (disconnected)";

      return `
      <div class="player-score-row">
        <strong>${escapeHtml(player.name)}</strong>
        <input 
          class="score-input"
          type="number"
          value="${scores[player.id] ?? 0}"
          data-player-id="${player.id}"
        >
        <span>${turnLabel}${connectionLabel}</span>
      </div>
    `;
    })
    .join("");

  document.querySelectorAll(".score-input").forEach((input) => {
    input.addEventListener("change", () => {
      socket.emit("setPlayerScore", {
        code: currentCode,
        playerId: input.dataset.playerId,
        score: input.value,
      });
    });
  });
}

function renderQuestion(game) {
  if (game.finalMode) {
    const final = game.finalJeopardy;

    questionBox.innerHTML = `
    <h2>Final Jeopardy</h2>
    <p><strong>Category:</strong> ${escapeHtml(final.category)}</p>
    ${
      game.finalRevealed
        ? `<p><strong>Clue:</strong> ${escapeHtml(final.clue)}</p>
           <hr>
           <p><strong>Answer:</strong> ${escapeHtml(final.answer)}</p>`
        : `<p>Waiting to reveal clue...</p>`
    }
    <hr>
    ${game.players
      .map((player) => {
        const wager = game.finalWagers?.[player.id] ?? "No wager";
        const answer = game.finalAnswers?.[player.id] ?? "No answer";

        return `
          <div class="player-score-row">
            <strong>${escapeHtml(player.name)}</strong>
            <span>Wager: ${escapeHtml(wager)}</span>
            <span>Answer: ${escapeHtml(answer)}</span>
            <button onclick="socket.emit('markFinalCorrect', { code: currentCode, playerId: '${player.id}' })">Correct</button>
            <button onclick="socket.emit('markFinalWrong', { code: currentCode, playerId: '${player.id}' })">Wrong</button>
          </div>
        `;
      })
      .join("")}
  `;

    return;
  }
  if (!game.currentQuestion) {
    questionBox.innerHTML = "No question selected.";
    return;
  }
  if (game.dailyDoubleMode) {
    const ddPlayer = game.players.find(
      (p) => p.id === game.dailyDoublePlayerId,
    );

    questionBox.innerHTML = `
    <h2>Daily Double!</h2>
    <p><strong>Player:</strong> ${
      ddPlayer ? escapeHtml(ddPlayer.name) : "No player selected"
    }</p>
    <p><strong>Original value:</strong> ${game.currentQuestion.value}</p>
    <p><strong>Wager:</strong> ${
      game.dailyDoubleWagerSet ? game.dailyDoubleWager : "Not set"
    }</p>
    ${
      game.dailyDoubleWagerSet
        ? `
          <hr>
          <p><strong>Clue:</strong> ${escapeHtml(game.currentQuestion.clue)}</p>
          <p><strong>Answer:</strong> ${escapeHtml(game.currentQuestion.answer)}</p>
        `
        : `<p>Enter a wager, then click Set Daily Double Wager.</p>`
    }
  `;
    return;
  }

  const answerTimeLeft = game.answerTimeLeft;
  const lockoutLeft = game.buzzLockoutLeft || 0;
  const buzzLocked = lockoutLeft > 0;

  const buzzedPlayer = game.players.find((p) => p.id === game.buzzedPlayerId);

  questionBox.innerHTML = `
  <p><strong>For ${game.currentQuestion.value} points</strong></p>
  <p>${escapeHtml(game.currentQuestion.clue)}</p>
  <p><strong>Answer timer:</strong> ${
    answerTimeLeft !== null ? `${answerTimeLeft}s` : "Not started"
  }</p>
  <p><strong>Buzz:</strong> ${buzzLocked ? `Locked for ${lockoutLeft}s` : "Open"}</p>
  <hr>
  <p><strong>Answer:</strong> ${escapeHtml(game.currentQuestion.answer)}</p>
  <p><strong>Buzzed:</strong> ${buzzedPlayer ? escapeHtml(buzzedPlayer.name) : "No one yet"}</p>
`;
}

correctBtn.addEventListener("click", () => {
  socket.emit("markCorrect", { code: currentCode });
});

wrongBtn.addEventListener("click", () => {
  socket.emit("markWrong", { code: currentCode });
});

skipBtn.addEventListener("click", () => {
  socket.emit("skipQuestion", { code: currentCode });
});

startDoubleBtn.addEventListener("click", () => {
  if (!currentCode) {
    alert("Create or rejoin a game first.");
    return;
  }

  if (
    !confirm(
      "Start Double Jeopardy? This will replace the current board but keep scores.",
    )
  ) {
    return;
  }

  socket.emit("startDoubleJeopardy", {
    code: currentCode,
  });
});

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

adminLoginBtn.addEventListener("click", () => {
  socket.emit("adminLogin", {
    password: adminPasswordInput.value,
  });
});

socket.on("adminLoginSuccess", () => {
  loginSection.classList.add("hidden");
  adminPanel.classList.remove("hidden");

  socket.emit("getSavedBoards");

  const lastCode = localStorage.getItem("hostCode");

  if (lastCode) {
    socket.emit("hostRejoin", { code: lastCode });
  }
});

socket.on("adminLoginError", (message) => {
  adminLoginMessage.textContent = message;
});

rejoinGameBtn.addEventListener("click", () => {
  const code = rejoinCodeInput.value.trim();

  if (!code) {
    alert("Enter a game code first.");
    return;
  }

  localStorage.setItem("hostCode", code);
  socket.emit("hostRejoin", { code });
});

socket.on("connect", () => {
  const lastCode = localStorage.getItem("hostCode");

  if (lastCode && adminPanel && !adminPanel.classList.contains("hidden")) {
    socket.emit("hostRejoin", { code: lastCode });
  }
});

setInterval(() => {
  if (currentCode) {
    socket.emit("heartbeat");
  }
}, 30000);

restoreGameBtn.addEventListener("click", () => {
  const backup = localStorage.getItem("jeopardyBackup");

  if (!backup) {
    alert("No backup found.");
    return;
  }

  socket.emit("restoreGame", {
    snapshot: JSON.parse(backup),
  });
});

startFinalBtn.addEventListener("click", () => {
  if (!currentCode) {
    alert("Create or rejoin a game first.");
    return;
  }

  socket.emit("startFinalJeopardy", { code: currentCode });
});

revealFinalBtn.addEventListener("click", () => {
  socket.emit("revealFinalClue", { code: currentCode });
});

setDailyDoubleWagerBtn.addEventListener("click", () => {
  if (!currentCode) {
    alert("Create or rejoin a game first.");
    return;
  }

  socket.emit("setDailyDoubleWager", {
    code: currentCode,
    wager: dailyDoubleWagerInput.value,
  });
});
