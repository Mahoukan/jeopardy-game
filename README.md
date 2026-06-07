# Jeopardy Multiplayer

A multiplayer Jeopardy-style game built with Node.js, Express, and Socket.IO.

Players join from their phones using a game code, while the host controls the board, scoring, and gameplay from the admin panel.

---

## Features

### Multiplayer Gameplay

- Join games using a 4-digit game code
- Real-time updates via Socket.IO
- Unlimited players
- Buzz-in system
- Turn tracking
- Score tracking
- Manual score adjustment by host

### Question System

- Custom categories and questions
- Variable point values
- Question reveal system
- Used questions automatically disabled
- Skip questions
- Correct/Wrong scoring

### Buzzing

- 5-second buzz lockout when a question opens
- 15-second answer timer after a player buzzes
- Server-synchronised countdown timers
- Prevents timer desync between players

### Board Management

- Built-in board editor
- Save boards
- Delete boards
- Load saved boards
- Import JSON boards
- Supports J-Archive generated boards

### Reliability

- Player reconnect support
- Host reconnect support
- Automatic socket reconnection
- Heartbeat system to reduce idle disconnects
- Host-side game backup
- Manual game restore system
- Recovery after Render/server restarts

### Mobile Friendly

- Large mobile buzzer
- Responsive layout
- Compact game header
- Long category name protection
- Improved portrait mode layout

### PWA Support

- Installable on phones
- Home screen icon support
- Standalone app mode
- Service Worker support

---

## Installation

### Clone Repository

```bash
git clone <your-repository-url>
cd jeopardy-game
```

### Install Dependencies

```bash
npm install
```

### Create Environment File

Create a `.env` file:

```env
ADMIN_PASSWORD=yourpassword
PORT=3000
```

### Start Server

```bash
npm start
```

### Open Website

```text
http://localhost:3000
```

---

## Hosting

### Render

Current deployment target:

```text
Render Web Service
```

Recommended settings:

```text
Build Command:
npm install

Start Command:
node server.js
```

---

## Project Structure

```text
jeopardy-game/
│
├── data/
│   └── boards.json
│
├── public/
│   ├── index.html
│   ├── game.html
│   ├── host.html
│   ├── player.js
│   ├── host.js
│   ├── style.css
│   ├── manifest.json
│   ├── service-worker.js
│   ├── icon-192.png
│   └── icon-512.png
│
├── server.js
├── package.json
├── .env
└── README.md
```

---

## JSON Board Format

```json
{
  "name": "General Knowledge",
  "board": [
    {
      "category": "Science",
      "questions": [
        {
          "value": 100,
          "clue": "The closest planet to the Sun.",
          "answer": "Mercury"
        }
      ]
    }
  ]
}
```

---

## Host Controls

### Admin Features

- Create boards
- Edit boards
- Save boards
- Load boards
- Delete boards
- Import JSON boards

### Game Controls

- Create game
- Rejoin game
- Restore game
- Mark correct
- Mark wrong
- Skip question
- Edit player scores

---

## Reliability Features

### Automatic Reconnect

Players automatically reconnect using a persistent player token.

Hosts automatically reconnect to previously hosted games.

### Backup & Restore

Every game update is backed up locally.

If the server loses game state:

```text
Login
↓
Restore Last Game
↓
Continue Playing
```

### Heartbeat System

Clients periodically send heartbeat messages to help maintain active connections.

---

## Future Ideas

- Daily Double
- Final Jeopardy
- Double Jeopardy round support
- Searchable board library
- J-Archive episode importer
- Statistics tracking
- Tournament mode
- Team play

---

## Tech Stack

- Node.js
- Express
- Socket.IO
- HTML
- CSS
- JavaScript
- PWA

---

## License

Personal project for educational and entertainment use.
