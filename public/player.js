const socket = io();

let lastQuestionKey = null;
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

  const currentPlayer = game.players[game.currentTurnIndex];

  playerInfo.textContent = `${playerName} • Game ${game.code} • Turn: ${currentPlayer?.name ?? "-"}`;

  if (turnText) {
    turnText.textContent = currentPlayer
      ? `Current Turn: ${currentPlayer.name}`
      : "Waiting for players...";
  }
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function getFinalStandings(game) {
  if (!game.finalMode || !game.players.length) return null;

  const allMarked = game.players.every(
    (player) => game.finalMarked?.[player.id],
  );

  if (!allMarked) return null;

  return [...game.players].sort(
    (a, b) => (game.scores[b.id] ?? 0) - (game.scores[a.id] ?? 0),
  );
}

function renderMedia(media) {
  if (!media || !media.type) return "";

  if (media.type === "image" && media.url) {
    return `
      <img
        class="question-media"
        src="${escapeHtml(media.url)}"
        alt="Question image"
      >
    `;
  }

  if (media.type === "youtube" && media.id) {
    const start = media.start ? `?start=${Number(media.start)}` : "";

    return `
      <iframe
        class="question-media youtube-media"
        src="https://www.youtube.com/embed/${escapeHtml(media.id)}${start}"
        title="YouTube video"
        allowfullscreen
      ></iframe>
    `;
  }

  return "";
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
      const turnLabel = index === currentTurnIndex ? " ← TURN" : "";

      return `
      <p class="${index === currentTurnIndex ? "current-turn" : ""}">
        <strong>${player.name}</strong>: ${scores[player.id] ?? 0}
        ${turnLabel}
      </p>
    `;
    })
    .join("");
}

function renderQuestion(game) {
  if (game.finalMode) {
    //if (boardDiv) boardDiv.classList.add("hidden");
    document.body.classList.add("player-question-active");

    const standings = getFinalStandings(game);

    if (standings) {
      questionBox.innerHTML = `
      <div class="winner-banner">
        <h1>🏆 FINAL STANDINGS 🏆</h1>
        ${standings
          .map(
            (player, index) => `
              <p>
                <strong>${index + 1}. ${escapeHtml(player.name)}</strong>
                — $${(game.scores[player.id] ?? 0).toLocaleString()}
              </p>
            `,
          )
          .join("")}
      </div>
    `;

      if (buzzBtn) buzzBtn.disabled = true;
      return;
    }

    const final = game.finalJeopardy;
    const alreadyWagered = game.finalWagers?.[playerId] !== undefined;
    const alreadyAnswered = game.finalAnswers?.[playerId] !== undefined;
    questionBox.innerHTML = `
    <h2>Final Jeopardy</h2>
    <p><strong>Category:</strong> ${final.category}</p>

    ${
      !game.finalRevealed
        ? alreadyWagered
          ? `<p><strong>Wager submitted.</strong></p>`
          : `
            <input
              id="finalWagerInput"
              type="number"
              min="0"
              max="${game.scores[playerId] ?? 0}"
              placeholder="Your wager"
            >
            <button id="submitFinalWagerBtn">Submit Wager</button>
          `
        : alreadyAnswered
          ? `
            <p><strong>Clue:</strong> ${final.clue}</p>
            <p><strong>Answer submitted.</strong></p>
          `
          : `
            <p><strong>Clue:</strong> ${final.clue}</p>
            <input id="finalAnswerInput" placeholder="Your answer">
            <button id="submitFinalAnswerBtn">Submit Answer</button>
          `
    }
  `;

    if (buzzBtn) buzzBtn.disabled = true;

    const wagerBtn = document.getElementById("submitFinalWagerBtn");
    if (wagerBtn) {
      wagerBtn.addEventListener("click", () => {
        const wagerInput = document.getElementById("finalWagerInput");
        const wager = Number(wagerInput.value);
        const maxWager = game.scores[playerId] ?? 0;

        if (!Number.isFinite(wager) || wager < 0 || wager > maxWager) {
          alert(`You can only wager between 0 and ${maxWager}.`);
          return;
        }

        socket.emit("submitFinalWager", {
          code: currentCode,
          wager,
        });

        wagerBtn.disabled = true;
        wagerBtn.textContent = "Wager Submitted";
      });
    }

    const answerBtn = document.getElementById("submitFinalAnswerBtn");
    if (answerBtn) {
      answerBtn.addEventListener("click", () => {
        const answer = document.getElementById("finalAnswerInput").value;
        socket.emit("submitFinalAnswer", {
          code: currentCode,
          answer,
        });
        answerBtn.disabled = true;
        answerBtn.textContent = "Answer Submitted";
      });
    }

    return;
  }
  if (!questionBox) return;

  if (!game.currentQuestion) {
    lastQuestionKey = null;

    //if (boardDiv) boardDiv.classList.remove("hidden");
    document.body.classList.remove("player-question-active");

    questionBox.innerHTML = "Waiting for host...";
    if (buzzBtn) buzzBtn.disabled = true;
    return;
  }
  if (boardDiv) boardDiv.classList.add("hidden");
  document.body.classList.add("player-question-active");

  const questionKey = JSON.stringify({
    clue: game.currentQuestion.clue,
    value: game.currentQuestion.value,
    media: game.currentQuestion.media,
    buzzedPlayerId: game.buzzedPlayerId,
    dailyDoubleMode: game.dailyDoubleMode,
    dailyDoubleWagerSet: game.dailyDoubleWagerSet,
  });

  if (questionKey === lastQuestionKey) {
    if (buzzBtn) {
      const lockoutLeft = game.buzzLockoutLeft || 0;
      const buzzLocked = lockoutLeft > 0;
      buzzBtn.disabled = Boolean(game.buzzedPlayerId) || buzzLocked;
    }
    const timerText = document.getElementById("answerTimerText");
    if (timerText) {
      timerText.textContent =
        game.answerTimeLeft !== null
          ? `${game.answerTimeLeft}s`
          : "Not started";
    }

    const buzzText = document.getElementById("buzzStatusText");
    if (buzzText) {
      buzzText.textContent =
        (game.buzzLockoutLeft || 0) > 0
          ? `Locked for ${game.buzzLockoutLeft}s`
          : "Open";
    }
    return;
  }

  lastQuestionKey = questionKey;
  if (game.dailyDoubleMode) {
    const ddPlayer = game.players.find(
      (p) => p.id === game.dailyDoublePlayerId,
    );
    const isMe = ddPlayer && ddPlayer.id === playerId;

    questionBox.innerHTML = `
    <h2>Daily Double!</h2>
    <p><strong>Player:</strong> ${ddPlayer ? ddPlayer.name : "No player selected"}</p>
    <p><strong>Wager:</strong> ${
      game.dailyDoubleWagerSet ? game.dailyDoubleWager : "Waiting for wager..."
    }</p>
    ${
      game.dailyDoubleWagerSet
        ? `${renderMedia(game.currentQuestion.media)}
          <p>${game.currentQuestion.clue}</p>`
        : `<p>Waiting for the host to set the wager...</p>`
    }
    <p>${isMe ? "You answer this question." : "Only the selected player answers."}</p>
  `;

    if (buzzBtn) {
      buzzBtn.disabled = true;
    }

    return;
  }
  const answerTimeLeft = game.answerTimeLeft;
  const lockoutLeft = game.buzzLockoutLeft || 0;
  const buzzLocked = lockoutLeft > 0;
  const buzzedPlayer = game.players.find((p) => p.id === game.buzzedPlayerId);

  questionBox.innerHTML = `
  <p><strong>For ${game.currentQuestion.value} points</strong></p>
  ${renderMedia(game.currentQuestion.media)}
<p>${game.currentQuestion.clue}</p>
  <p><strong>Answer timer:</strong> <span id="answerTimerText">${
    answerTimeLeft !== null ? `${answerTimeLeft}s` : "Not started"
  }</span></p>
  <p><strong>Buzz:</strong> <span id="buzzStatusText">${buzzLocked ? `Locked for ${lockoutLeft}s` : "Open"}</span></p>
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
      playerToken,
    });
  }
});

setInterval(() => {
  if (currentCode) {
    socket.emit("heartbeat");
  }
}, 30000);


let lastTouchEnd = 0;

document.addEventListener(
  "touchend",
  (event) => {
    const now = Date.now();

    if (now - lastTouchEnd <= 300) {
      event.preventDefault();
    }

    lastTouchEnd = now;
  },
  { passive: false },
);