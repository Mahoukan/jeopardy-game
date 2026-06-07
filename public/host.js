const socket = io();

const rejoinCodeInput = document.getElementById("rejoinCodeInput");
const rejoinGameBtn = document.getElementById("rejoinGameBtn");

const importJsonBtn = document.getElementById("importJsonBtn");
const jsonImportInput = document.getElementById("jsonImportInput");

const boardNameInput = document.getElementById("boardNameInput");
const saveBoardBtn = document.getElementById("saveBoardBtn");
const createGameBtn = document.getElementById("createGameBtn");
const addCategoryBtn = document.getElementById("addCategoryBtn");

const savedBoardsDiv = document.getElementById("savedBoards");
const gameCodeText = document.getElementById("gameCodeText");
const boardEditor = document.getElementById("boardEditor");
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

let editorBoard = [
  {
    category: "Category 1",
    questions: [
      { value: 100, clue: "", answer: "" },
      { value: 200, clue: "", answer: "" },
      { value: 300, clue: "", answer: "" },
    ],
  },
];

renderEditor();

saveBoardBtn.addEventListener("click", () => {
  updateBoardFromEditor();

  socket.emit("saveBoard", {
    name: boardNameInput.value,
    board: editorBoard,
  });
});

addCategoryBtn.addEventListener("click", () => {
  updateBoardFromEditor();

  editorBoard.push({
    category: `Category ${editorBoard.length + 1}`,
    questions: [
      { value: 100, clue: "", answer: "" },
      { value: 200, clue: "", answer: "" },
      { value: 300, clue: "", answer: "" },
    ],
  });

  renderEditor();
});

createGameBtn.addEventListener("click", () => {
  updateBoardFromEditor();

  socket.emit("createGame", {
    board: editorBoard,
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
  localStorage.setItem("hostCode", code);
  gameCodeText.textContent = `Game Code: ${code}`;
});

socket.on("gameUpdate", (game) => {
  currentCode = game.code;

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
      editorBoard = JSON.parse(JSON.stringify(savedBoard.board));

      renderEditor();
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

function renderEditor() {
  boardEditor.innerHTML = "";

  editorBoard.forEach((category, categoryIndex) => {
    const categoryBox = document.createElement("div");
    categoryBox.className = "category-editor";

    categoryBox.innerHTML = `
      <div class="editor-row">
        <label>Category</label>
        <input 
          class="category-name-input" 
          data-category-index="${categoryIndex}" 
          value="${escapeHtml(category.category)}"
        >
        <button class="remove-category-btn" data-category-index="${categoryIndex}">
          Remove Category
        </button>
      </div>

      <div class="question-editor-list">
        ${category.questions
          .map(
            (question, questionIndex) => `
          <div class="question-editor">
            <input 
              class="value-input" 
              data-category-index="${categoryIndex}" 
              data-question-index="${questionIndex}" 
              value="${question.value}" 
              type="number"
              placeholder="Points"
            >

            <input 
              class="clue-input" 
              data-category-index="${categoryIndex}" 
              data-question-index="${questionIndex}" 
              value="${escapeHtml(question.clue)}" 
              placeholder="Question / clue"
            >

            <input 
              class="answer-input" 
              data-category-index="${categoryIndex}" 
              data-question-index="${questionIndex}" 
              value="${escapeHtml(question.answer)}" 
              placeholder="Answer"
            >

            <button 
              class="remove-question-btn" 
              data-category-index="${categoryIndex}" 
              data-question-index="${questionIndex}"
            >
              Remove
            </button>
          </div>
        `,
          )
          .join("")}
      </div>

      <button class="add-question-btn" data-category-index="${categoryIndex}">
        Add Question
      </button>
    `;

    boardEditor.appendChild(categoryBox);
  });

  document.querySelectorAll(".add-question-btn").forEach((button) => {
    button.addEventListener("click", () => {
      updateBoardFromEditor();

      const categoryIndex = Number(button.dataset.categoryIndex);
      const questions = editorBoard[categoryIndex].questions;
      const nextValue =
        questions.length > 0
          ? Number(questions[questions.length - 1].value) + 100
          : 100;

      questions.push({
        value: nextValue,
        clue: "",
        answer: "",
      });

      renderEditor();
    });
  });

  document.querySelectorAll(".remove-category-btn").forEach((button) => {
    button.addEventListener("click", () => {
      updateBoardFromEditor();

      const categoryIndex = Number(button.dataset.categoryIndex);
      editorBoard.splice(categoryIndex, 1);

      renderEditor();
    });
  });

  document.querySelectorAll(".remove-question-btn").forEach((button) => {
    button.addEventListener("click", () => {
      updateBoardFromEditor();

      const categoryIndex = Number(button.dataset.categoryIndex);
      const questionIndex = Number(button.dataset.questionIndex);

      editorBoard[categoryIndex].questions.splice(questionIndex, 1);

      renderEditor();
    });
  });
}

function updateBoardFromEditor() {
  document.querySelectorAll(".category-name-input").forEach((input) => {
    const categoryIndex = Number(input.dataset.categoryIndex);
    editorBoard[categoryIndex].category = input.value;
  });

  document.querySelectorAll(".value-input").forEach((input) => {
    const categoryIndex = Number(input.dataset.categoryIndex);
    const questionIndex = Number(input.dataset.questionIndex);
    editorBoard[categoryIndex].questions[questionIndex].value = Number(
      input.value,
    );
  });

  document.querySelectorAll(".clue-input").forEach((input) => {
    const categoryIndex = Number(input.dataset.categoryIndex);
    const questionIndex = Number(input.dataset.questionIndex);
    editorBoard[categoryIndex].questions[questionIndex].clue = input.value;
  });

  document.querySelectorAll(".answer-input").forEach((input) => {
    const categoryIndex = Number(input.dataset.categoryIndex);
    const questionIndex = Number(input.dataset.questionIndex);
    editorBoard[categoryIndex].questions[questionIndex].answer = input.value;
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
          value="${scores[player.id]}"
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
  if (!game.currentQuestion) {
    questionBox.innerHTML = "No question selected.";
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

importJsonBtn.addEventListener("click", () => {
  jsonImportInput.click();
});

jsonImportInput.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);

      if (Array.isArray(imported)) {
        editorBoard = imported;
      } else if (imported.board && Array.isArray(imported.board)) {
        editorBoard = imported.board;
        if (imported.name) {
          boardNameInput.value = imported.name;
        }
      } else {
        alert("Invalid JSON format.");
        return;
      }

      editorBoard = editorBoard.map((category) => ({
        category: category.category || "Untitled Category",
        questions: category.questions.map((question) => ({
          value: Number(question.value) || 100,
          clue: question.clue || "",
          answer: question.answer || "",
        })),
      }));

      renderEditor();
      alert("Board imported.");
    } catch (error) {
      alert("Could not read JSON file.");
    }
  };

  reader.readAsText(file);
  jsonImportInput.value = "";
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
