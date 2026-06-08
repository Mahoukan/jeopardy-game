require("dotenv").config();
const express = require("express");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { Server } = require("socket.io");
const crypto = require("crypto");
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

console.log("ADMIN_PASSWORD =", process.env.ADMIN_PASSWORD);

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
      dailyDouble: Boolean(question.dailyDouble),
      media: question.media || null,
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

function ensureScores(game) {
  if (!game.scores) {
    game.scores = {};
  }

  game.players.forEach((player) => {
    if (typeof game.scores[player.id] !== "number") {
      game.scores[player.id] = 0;
    }
  });
}

function sendGameUpdate(code) {
  const game = games[code];
  if (!game) return;
  ensureScores(game);

  io.to(code).emit("gameUpdate", {
    code,
    gameName: game.gameName,
    currentRound: game.currentRound,
    finalMode: game.finalMode,
    finalMarked: game.finalMarked,
    finalRevealed: game.finalRevealed,
    finalWagers: game.finalWagers,
    finalAnswers: game.finalAnswers,
    finalJeopardy: game.finalJeopardy,
    board: game.board,
    players: game.players,
    scores: game.scores,
    dailyDoubleMode: game.dailyDoubleMode,
    dailyDoublePlayerId: game.dailyDoublePlayerId,
    dailyDoubleWager: game.dailyDoubleWager,
    dailyDoubleWagerSet: game.dailyDoubleWagerSet,
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

  socket.on("createGame", ({ board }) => {
    if (!socket.data.isAdmin) {
      socket.emit("errorMessage", "Admin login required.");
      return;
    }
    const isFullGame = board.jeopardy && board.doubleJeopardy;

    if (
      (isFullGame && !isValidBoard(board.jeopardy.board)) ||
      (!isFullGame && !isValidBoard(board))
    ) {
      socket.emit("errorMessage", "Board is incomplete.");
      return;
    }

    const code = makeCode();

    games[code] = {
      hostId: socket.id,
      gameName: board.name || "Untitled Game",
      jeopardy: isFullGame ? board.jeopardy : null,
      doubleJeopardy: isFullGame ? board.doubleJeopardy : null,
      finalJeopardy: isFullGame ? board.finalJeopardy : null,
      currentRound: "jeopardy",
      finalMode: false,
      finalMarked: {},
      finalRevealed: false,
      finalWagers: {},
      finalAnswers: {},
      dailyDoubleMode: false,
      dailyDoublePlayerId: null,
      dailyDoubleWager: null,
      dailyDoubleWagerSet: false,

      board: isFullGame ? cleanBoard(board.jeopardy.board) : cleanBoard(board),
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
      dailyDouble: question.dailyDouble || false,
      media: question.media || null,
    };

    if (question.dailyDouble) {
      const currentPlayer = game.players[game.currentTurnIndex];

      game.dailyDoubleMode = true;
      game.dailyDoublePlayerId = currentPlayer ? currentPlayer.id : null;
      game.dailyDoubleWager = null;
      game.dailyDoubleWagerSet = false;

      game.buzzedPlayerId = game.dailyDoublePlayerId;
      game.buzzUnlocksAt = null;
      game.answerEndsAt = null;

      sendGameUpdate(code);
      return;
    }

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

    game.scores[game.buzzedPlayerId] =
      (game.scores[game.buzzedPlayerId] || 0) + game.currentQuestion.value;

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
    game.dailyDoubleMode = false;
    game.dailyDoublePlayerId = null;
    game.dailyDoubleWager = null;
    game.dailyDoubleWagerSet = false;

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

    game.scores[game.buzzedPlayerId] =
      (game.scores[game.buzzedPlayerId] || 0) - game.currentQuestion.value;
    game.buzzedPlayerId = null;
    game.answerEndsAt = null;
    game.dailyDoubleMode = false;
    game.dailyDoublePlayerId = null;
    game.dailyDoubleWager = null;
    game.dailyDoubleWagerSet = false;
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

    game.dailyDoubleMode = false;
    game.dailyDoublePlayerId = null;
    game.dailyDoubleWager = null;
    game.dailyDoubleWagerSet = false;

    sendGameUpdate(code);
  });

  socket.on("startDoubleJeopardy", ({ code }) => {
    if (!socket.data.isAdmin) {
      socket.emit("errorMessage", "Admin login required.");
      return;
    }

    const game = games[code];
    if (!game || !game.doubleJeopardy) {
      socket.emit("errorMessage", "No Double Jeopardy round found.");
      return;
    }

    game.currentRound = "doubleJeopardy";
    game.board = cleanBoard(game.doubleJeopardy.board);

    game.currentQuestion = null;
    game.buzzedPlayerId = null;
    game.buzzUnlocksAt = null;
    game.answerEndsAt = null;

    if (game.timerInterval) {
      clearInterval(game.timerInterval);
      game.timerInterval = null;
    }

    sendGameUpdate(code);
  });

  socket.on("startFinalJeopardy", ({ code }) => {
    if (!socket.data.isAdmin) return;

    const game = games[code];
    if (!game || !game.finalJeopardy) {
      socket.emit("errorMessage", "No Final Jeopardy found.");
      return;
    }

    game.finalMode = true;
    game.finalRevealed = false;
    game.currentQuestion = null;
    game.buzzedPlayerId = null;
    game.finalWagers = {};
    game.finalAnswers = {};
    game.finalMarked = {};
    sendGameUpdate(code);
  });

  socket.on("revealFinalClue", ({ code }) => {
    if (!socket.data.isAdmin) return;

    const game = games[code];
    if (!game || !game.finalMode) return;

    game.finalRevealed = true;
    sendGameUpdate(code);
  });

  socket.on("submitFinalWager", ({ code, wager }) => {
    const game = games[code];
    if (!game || !game.finalMode) return;

    const player = game.players.find(
      (p) => p.token === socket.data.playerToken || p.id === socket.id,
    );

    if (!player) return;

    const amount = Number(wager);
    const playerScore = game.scores[player.id] || 0;

    if (!Number.isFinite(amount) || amount < 0 || amount > playerScore) {
      socket.emit(
        "errorMessage",
        `Final Jeopardy wager must be between 0 and ${playerScore}.`,
      );
      return;
    }

    game.finalWagers[player.id] = amount;

    sendGameUpdate(code);
  });

  socket.on("submitFinalAnswer", ({ code, answer }) => {
    const game = games[code];
    if (!game || !game.finalMode) return;

    const player = game.players.find(
      (p) => p.token === socket.data.playerToken || p.id === socket.id,
    );

    if (!player) return;

    game.finalAnswers[player.id] = String(answer || "").trim();

    sendGameUpdate(code);
  });

  socket.on("markFinalCorrect", ({ code, playerId }) => {
    if (!socket.data.isAdmin) return;

    const game = games[code];
    if (!game || !game.finalMode) return;
    if (game.finalMarked[playerId]) return;
    game.finalMarked[playerId] = true;
    const wager = game.finalWagers[playerId] || 0;
    game.scores[playerId] = (game.scores[playerId] || 0) + wager;

    sendGameUpdate(code);
  });

  socket.on("markFinalWrong", ({ code, playerId }) => {
    if (!socket.data.isAdmin) return;

    const game = games[code];
    if (!game || !game.finalMode) return;
    if (game.finalMarked[playerId]) return;
    game.finalMarked[playerId] = true;
    const wager = game.finalWagers[playerId] || 0;
    game.scores[playerId] = (game.scores[playerId] || 0) - wager;

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

  socket.on("heartbeat", () => {
    socket.emit("heartbeatAck");
  });

  socket.on("restoreGame", ({ snapshot }) => {
    if (!socket.data.isAdmin) {
      socket.emit("errorMessage", "Admin login required.");
      return;
    }

    if (!snapshot || !snapshot.code) {
      socket.emit("errorMessage", "Invalid snapshot.");
      return;
    }

    games[snapshot.code] = {
      hostId: socket.id,
      board: snapshot.board,
      players: snapshot.players,
      scores: snapshot.scores,
      currentTurnIndex: snapshot.currentTurnIndex,
      currentQuestion: snapshot.currentQuestion,
      buzzedPlayerId: snapshot.buzzedPlayerId,
      buzzUnlocksAt: null,
      answerEndsAt: null,
      timerInterval: null,
      finalMode: snapshot.finalMode || false,
      finalRevealed: snapshot.finalRevealed || false,
      finalWagers: snapshot.finalWagers || {},
      finalAnswers: snapshot.finalAnswers || {},
      finalMarked: snapshot.finalMarked || {},
      finalJeopardy: snapshot.finalJeopardy || null,
      currentRound: snapshot.currentRound || "jeopardy",
      dailyDoubleMode: snapshot.dailyDoubleMode || false,
      dailyDoublePlayerId: snapshot.dailyDoublePlayerId || null,
      dailyDoubleWager: snapshot.dailyDoubleWager || null,
      dailyDoubleWagerSet: snapshot.dailyDoubleWagerSet || false,
    };

    socket.join(snapshot.code);

    sendGameUpdate(snapshot.code);

    socket.emit("successMessage", "Game restored.");
  });

  socket.on("setDailyDoubleWager", ({ code, wager }) => {
    if (!socket.data.isAdmin) {
      socket.emit("errorMessage", "Admin login required.");
      return;
    }

    const game = games[code];
    if (!game || !game.dailyDoubleMode || !game.currentQuestion) return;

    const numericWager = Number(wager);
    const playerScore = game.scores[game.dailyDoublePlayerId] || 0;

    const maxWager = Math.max(
      playerScore,
      game.currentRound === "doubleJeopardy" ? 2000 : 1000,
    );

    if (numericWager > maxWager) {
      socket.emit("errorMessage", `Maximum wager is ${maxWager}.`);
      return;
    }

    if (!Number.isFinite(numericWager) || numericWager < 0) {
      socket.emit("errorMessage", "Invalid wager.");
      return;
    }

    game.dailyDoubleWager = numericWager;
    game.dailyDoubleWagerSet = true;
    game.currentQuestion.value = numericWager;

    sendGameUpdate(code);
  });

  socket.on("importBoard", ({ board }) => {
    if (!socket.data.isAdmin) {
      socket.emit("errorMessage", "Admin login required.");
      return;
    }

    const boards = loadBoards();

    const importedBoard = {
      id: crypto.randomUUID(),
      ...board,
    };

    boards.push(importedBoard);

    saveBoards(boards);

    socket.emit("savedBoardsUpdated", boards);
    socket.emit("successMessage", "Board imported.");
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
