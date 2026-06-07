const socket = io();

const path = window.location.pathname;

const nameInput = document.getElementById("nameInput");
const codeInput = document.getElementById("codeInput");
const joinBtn = document.getElementById("joinBtn");
const message = document.getElementById("message");

const playerInfo = document.getElementById("playerInfo");
const turnText = document.getElementById("turnText");
const boardDiv = document.getElementById("board");
const playersDiv = document.getElementById("players");
const questionBox = document.getElementById("questionBox");
const buzzBtn = document.getElementById("buzzBtn");

let currentCode = localStorage.getItem("gameCode");
let playerName = localStorage.getItem("playerName");
let playerId = localStorage.getItem("playerId");

let playerToken = localStorage.getItem("playerToken");

if (!playerToken) {
  playerToken = crypto.randomUUID();
  localStorage.setItem("playerToken", playerToken);
}

if (joinBtn) {
  joinBtn.addEventListener("click", () => {
    const name = nameInput.value.trim();
    const code = codeInput.value.trim();

    socket.emit("joinGame", { code, name, playerToken });
  });
}

socket.on("joinedGame", ({ code, playerId }) => {
  const joiningName = nameInput ? nameInput.value.trim() : playerName;

  localStorage.setItem("gameCode", code);
  localStorage.setItem("playerName", joiningName);
  localStorage.setItem("playerId", playerId);

  if (!path.includes("game.html")) {
    window.location.href = "game.html";
  }
});

socket.on("joinError", (error) => {
  if (message) {
    message.textContent = error;
  }
});

if (path.includes("game.html")) {
  if (currentCode && playerName) {
    socket.emit("joinGame", {
      code: currentCode,
      name: playerName,
      playerToken,
    });
  } else {
    window.location.href = "index.html";
  }
}

socket.on("gameUpdate", (game) => {
  currentCode = game.code;

  const me = game.players.find((p) => p.name === playerName);
  if (me) {
    playerId = me.id;
    localStorage.setItem("playerId", playerId);
  }

  renderPlayerInfo(game);
  renderBoard(game.board);
  renderPlayers(game.players, game.scores, game.currentTurnIndex);
  renderQuestion(game);
});

function renderPlayerInfo(game) {
  if (!playerInfo) return;

  playerInfo.textContent = `${playerName} | Game Code: ${game.code}`;

  const currentPlayer = game.players[game.currentTurnIndex];

  if (turnText) {
    turnText.textContent = currentPlayer
      ? `Current Turn: ${currentPlayer.name}`
      : "Waiting for players...";
  }
}

function renderBoard(board) {
  if (!boardDiv) return;

  boardDiv.innerHTML = "";

  board.forEach((category) => {
    const column = document.createElement("div");
    column.className = "category-column";

    const heading = document.createElement("div");
    heading.className = "category-title";
    heading.textContent = category.category;
    column.appendChild(heading);

    category.questions.forEach((question) => {
      const cell = document.createElement("div");
      cell.className = "question-button player-view";

      if (question.used) {
        cell.textContent = "";
        cell.classList.add("used");
      } else {
        cell.textContent = question.value;
      }

      column.appendChild(cell);
    });

    boardDiv.appendChild(column);
  });
}

function renderPlayers(players, scores, currentTurnIndex) {
  if (!playersDiv) return;

  if (players.length === 0) {
    playersDiv.innerHTML = "<p>No players yet.</p>";
    return;
  }

  playersDiv.innerHTML = players
    .map((player, index) => {
      const turnLabel = index === currentTurnIndex ? " ← turn" : "";
      return `<p><strong>${player.name}</strong>: ${scores[player.id]} ${turnLabel}</p>`;
    })
    .join("");
}

function renderQuestion(game) {
  if (!questionBox) return;

  if (!game.currentQuestion) {
    questionBox.innerHTML = "Waiting for host...";
    if (buzzBtn) buzzBtn.disabled = true;
    return;
  }
  const answerTimeLeft = game.answerTimeLeft;
  const lockoutLeft = game.buzzLockoutLeft || 0;
  const buzzLocked = lockoutLeft > 0;
  const buzzedPlayer = game.players.find((p) => p.id === game.buzzedPlayerId);

  questionBox.innerHTML = `
  <p><strong>For ${game.currentQuestion.value} points</strong></p>
  <p>${game.currentQuestion.clue}</p>
  <p><strong>Answer timer:</strong> ${
    answerTimeLeft !== null ? `${answerTimeLeft}s` : "Not started"
  }</p>
  <p><strong>Buzz:</strong> ${buzzLocked ? `Locked for ${lockoutLeft}s` : "Open"}</p>
  <p><strong>Buzzed:</strong> ${buzzedPlayer ? buzzedPlayer.name : "No one yet"}</p>
`;

  if (buzzBtn) {
    buzzBtn.disabled = Boolean(game.buzzedPlayerId) || buzzLocked;
  }
}

if (buzzBtn) {
  buzzBtn.addEventListener("click", () => {
    socket.emit("buzz", { code: currentCode });
  });
}

socket.on("connect", () => {
  if (path.includes("game.html") && currentCode && playerName) {
    socket.emit("joinGame", {
      code: currentCode,
      name: playerName,
      playerToken
    });
  }
});

setInterval(() => {
  if (currentCode) {
    socket.emit("heartbeat");
  }
}, 30000);