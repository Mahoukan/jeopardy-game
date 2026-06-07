require("dotenv").config();
const express = require("express");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { Server } = require("socket.io");

const ANSWER_TIME_MS = 15000;
const BUZZ_LOCKOUT_MS = 5000;

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static("public"));

const games = {};

const DATA_DIR = path.join(__dirname, "data");
const BOARDS_FILE = path.join(DATA_DIR, "boards.json");

function ensureBoardsFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
  if (!fs.existsSync(BOARDS_FILE)) fs.writeFileSync(BOARDS_FILE, "[]");
}

function loadBoards() {
  ensureBoardsFile();
  return JSON.parse(fs.readFileSync(BOARDS_FILE, "utf8"));
}

function saveBoards(boards) {
  ensureBoardsFile();
  fs.writeFileSync(BOARDS_FILE, JSON.stringify(boards, null, 2));
}

function makeCode() {
  let code;
  do {
    code = Math.floor(1000 + Math.random() * 9000).toString();
  } while (games[code]);
  return code;
}

function cleanBoard(board) {
  return board.map((category) => ({
    category: category.category.trim(),
    questions: category.questions.map((question) => ({
      value: Number(question.value),
      clue: question.clue.trim(),
      answer: question.answer.trim(),
      used: false,
    })),
  }));
}

function isValidBoard(board) {
  if (!Array.isArray(board) || board.length === 0) return false;

  return board.every(
    (category) =>
      category.category &&
      Array.isArray(category.questions) &&
      category.questions.length > 0 &&
      category.questions.every(
        (question) => question.value && question.clue && question.answer,
      ),
  );
}

function sendGameUpdate(code) {
  const game = games[code];
  if (!game) return;

  io.to(code).emit("gameUpdate", {
    code,
    board: game.board,
    players: game.players,
    scores: game.scores,
    currentTurnIndex: game.currentTurnIndex,
    currentQuestion: game.currentQuestion,
    buzzedPlayerId: game.buzzedPlayerId,
    buzzLockoutLeft: game.buzzUnlocksAt
      ? Math.max(0, Math.ceil((game.buzzUnlocksAt - Date.now()) / 1000))
      : 0,
    answerTimeLeft: game.answerEndsAt
      ? Math.max(0, Math.ceil((game.answerEndsAt - Date.now()) / 1000))
      : null,
  });
}

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);
  socket.on("adminLogin", ({ password }) => {
    if (password === process.env.ADMIN_PASSWORD) {
      socket.data.isAdmin = true;
      socket.emit("adminLoginSuccess");
    } else {
      socket.emit("adminLoginError", "Wrong password.");
    }
  });
  socket.on("hostRejoin", ({ code }) => {
    if (!socket.data.isAdmin) {
      socket.emit("errorMessage", "Admin login required.");
      return;
    }

    const game = games[code];

    if (!game) {
      socket.emit("errorMessage", "Game not found.");
      return;
    }

    game.hostId = socket.id;

    socket.join(code);
    socket.data.code = code;
    socket.data.isHost = true;

    sendGameUpdate(code);
  });
  socket.on("getSavedBoards", () => {
    if (!socket.data.isAdmin) {
      socket.emit("errorMessage", "Admin login required.");
      return;
    }
    socket.emit("savedBoardsUpdated", loadBoards());
  });

  socket.on("saveBoard", ({ name, board }) => {
    if (!socket.data.isAdmin) {
      socket.emit("errorMessage", "Admin login required.");
      return;
    }
    if (!name || name.trim() === "") {
      socket.emit("errorMessage", "Please enter a board name.");
      return;
    }

    if (!isValidBoard(board)) {
      socket.emit("errorMessage", "Board is incomplete.");
      return;
    }

    const boards = loadBoards();

    const savedBoard = {
      id: Date.now().toString(),
      name: name.trim(),
      board: cleanBoard(board),
    };

    boards.push(savedBoard);
    saveBoards(boards);

    socket.emit("savedBoardsUpdated", boards);
    socket.emit("successMessage", "Board saved.");
  });

  socket.on("deleteBoard", ({ id }) => {
    if (!socket.data.isAdmin) {
      socket.emit("errorMessage", "Admin login required.");
      return;
    }
    const boards = loadBoards().filter((board) => board.id !== id);
    saveBoards(boards);
    socket.emit("savedBoardsUpdated", boards);
  });

  socket.on("createGame", ({ board }) => {
    if (!socket.data.isAdmin) {
      socket.emit("errorMessage", "Admin login required.");
      return;
    }
    if (!isValidBoard(board)) {
      socket.emit("errorMessage", "Board is incomplete.");
      return;
    }

    const code = makeCode();

    games[code] = {
      hostId: socket.id,
      board: cleanBoard(board),
      players: [],
      scores: {},
      currentTurnIndex: 0,
      currentQuestion: null,
      buzzedPlayerId: null,
      buzzUnlocksAt: null,
      timerInterval: null,
      answerEndsAt: null,
    };

    socket.join(code);
    socket.data.code = code;
    socket.data.isHost = true;

    socket.emit("gameCreated", { code });
    sendGameUpdate(code);
  });

  socket.on("joinGame", ({ code, name, playerToken }) => {
    const game = games[code];

    if (!game) {
      socket.emit("joinError", "Game not found.");
      return;
    }

    if (!name || name.trim() === "") {
      socket.emit("joinError", "Please enter a name.");
      return;
    }

    let existingPlayer = game.players.find(
      (player) => player.token === playerToken,
    );

    if (existingPlayer) {
      const oldId = existingPlayer.id;
      existingPlayer.id = socket.id;
      existingPlayer.name = name.trim();
      existingPlayer.connected = true;

      game.scores[socket.id] = game.scores[oldId] ?? 0;
      delete game.scores[oldId];

      if (game.buzzedPlayerId === oldId) {
        game.buzzedPlayerId = socket.id;
      }
    } else {
      const player = {
        id: socket.id,
        token: playerToken,
        name: name.trim(),
        connected: true,
      };

      game.players.push(player);
      game.scores[socket.id] = 0;
    }

    socket.join(code);
    socket.data.code = code;
    socket.data.name = name.trim();
    socket.data.playerToken = playerToken;

    socket.emit("joinedGame", { code, playerId: socket.id });
    sendGameUpdate(code);
  });

  socket.on("selectQuestion", ({ code, categoryIndex, questionIndex }) => {
    if (!socket.data.isAdmin) {
      socket.emit("errorMessage", "Admin login required.");
      return;
    }
    const game = games[code];
    if (!game) return;

    const question = game.board[categoryIndex]?.questions[questionIndex];
    if (!question || question.used) return;

    question.used = true;

    game.currentQuestion = {
      clue: question.clue,
      answer: question.answer,
      value: question.value,
    };

    game.buzzUnlocksAt = Date.now() + BUZZ_LOCKOUT_MS;

    if (game.timerInterval) {
      clearInterval(game.timerInterval);
    }

    game.timerInterval = setInterval(() => {
      const stillExists = games[code];

      if (!stillExists || !stillExists.currentQuestion) {
        clearInterval(game.timerInterval);
        game.timerInterval = null;
        return;
      }

      if (stillExists.answerEndsAt && Date.now() >= stillExists.answerEndsAt) {
        stillExists.buzzedPlayerId = null;
        stillExists.answerEndsAt = null;
      }

      sendGameUpdate(code);
    }, 1000);

    game.buzzedPlayerId = null;
    sendGameUpdate(code);
  });

  socket.on("buzz", ({ code }) => {
    const game = games[code];
    if (!game || !game.currentQuestion) return;

    if (Date.now() < game.buzzUnlocksAt) return;

    if (!game.buzzedPlayerId) {
      game.buzzedPlayerId = socket.id;
      game.answerEndsAt = Date.now() + ANSWER_TIME_MS;
      sendGameUpdate(code);
    }
  });

  socket.on("markCorrect", ({ code }) => {
    if (!socket.data.isAdmin) {
      socket.emit("errorMessage", "Admin login required.");
      return;
    }
    const game = games[code];
    if (!game) return;
    if (!game.currentQuestion || !game.buzzedPlayerId) return;

    game.scores[game.buzzedPlayerId] += game.currentQuestion.value;

    const playerIndex = game.players.findIndex(
      (p) => p.id === game.buzzedPlayerId,
    );
    if (playerIndex !== -1) game.currentTurnIndex = playerIndex;

    game.currentQuestion = null;
    game.buzzedPlayerId = null;
    if (game.timerInterval) {
      clearInterval(game.timerInterval);
      game.timerInterval = null;
    }
    game.answerEndsAt = null;
    game.buzzUnlocksAt = null;

    sendGameUpdate(code);
  });

  socket.on("markWrong", ({ code }) => {
    if (!socket.data.isAdmin) {
      socket.emit("errorMessage", "Admin login required.");
      return;
    }
    const game = games[code];
    if (!game) return;
    if (!game.currentQuestion || !game.buzzedPlayerId) return;

    game.scores[game.buzzedPlayerId] -= game.currentQuestion.value;
    game.buzzedPlayerId = null;
    game.answerEndsAt = null;
    sendGameUpdate(code);
  });

  socket.on("setPlayerScore", ({ code, playerId, score }) => {
    if (!socket.data.isAdmin) {
      socket.emit("errorMessage", "Admin login required.");
      return;
    }

    const game = games[code];
    if (!game) return;

    if (!game.scores.hasOwnProperty(playerId)) return;

    game.scores[playerId] = Number(score) || 0;

    sendGameUpdate(code);
  });

  socket.on("skipQuestion", ({ code }) => {
    if (!socket.data.isAdmin) {
      socket.emit("errorMessage", "Admin login required.");
      return;
    }
    const game = games[code];
    if (!game) return;

    game.currentQuestion = null;
    game.buzzedPlayerId = null;
    if (game.timerInterval) {
      clearInterval(game.timerInterval);
      game.timerInterval = null;
    }

    game.buzzUnlocksAt = null;
    game.answerEndsAt = null;

    if (game.players.length > 0) {
      game.currentTurnIndex = (game.currentTurnIndex + 1) % game.players.length;
    }

    sendGameUpdate(code);
  });

  socket.on("disconnect", () => {
    const code = socket.data.code;
    const game = games[code];

    if (!game || socket.data.isHost) return;

    const player = game.players.find(
      (p) => p.token === socket.data.playerToken,
    );
    if (player) player.connected = false;

    sendGameUpdate(code);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
