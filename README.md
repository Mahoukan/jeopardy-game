# Jeopardy Multiplayer

A multiplayer Jeopardy-style game built with Node.js, Express, and Socket.IO.

Players join from their phones using a game code, while the host controls the board, scoring, and gameplay from the admin panel.

---

## Features

### Multiplayer Gameplay

* Join games using a 4-digit game code
* Real-time updates via Socket.IO
* Unlimited players
* Buzz-in system
* Turn tracking
* Score tracking
* Manual score adjustment by host

### Full Jeopardy Game Flow

* Jeopardy Round
* Double Jeopardy Round
* Daily Doubles
* Final Jeopardy
* Wager submission
* Final answer submission
* End-game scoring

### Question System

* Custom categories and questions
* Variable point values
* Question reveal system
* Used questions automatically disabled
* Skip questions
* Correct/Wrong scoring
* Daily Double support
* Final Jeopardy support
* Image questions
* YouTube video questions
* Embedded media support

### Buzzing

* 5-second buzz lockout when a question opens
* 15-second answer timer after a player buzzes
* Server-synchronised countdown timers
* Prevents timer desync between players

### Board Management

* Load saved boards
* Delete saved boards
* Import JSON boards
* Supports J-Archive generated boards
* Multiple saved game boards
* No browser-based board editor required

### Reliability

* Player reconnect support
* Host reconnect support
* Automatic socket reconnection
* Heartbeat system to reduce idle disconnects
* Host-side game backup
* Manual game restore system
* Recovery after server restarts
* Media-safe question rendering
* Stable YouTube playback during timer updates

### Mobile Friendly

* Large mobile buzzer
* Responsive layout
* Compact game header
* Long category name protection
* Improved portrait mode layout

### PWA Support

* Installable on phones
* Home screen icon support
* Standalone app mode
* Service Worker support

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

### Railway

Recommended deployment platform.

Required environment variables:

```env
ADMIN_PASSWORD=yourpassword
```

Build command:

```text
npm install
```

Start command:

```text
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

## JSON Game Format

```json
{
  "id": "GAME-001",
  "name": "Pop Culture Jeopardy",
  "jeopardy": {
    "board": []
  },
  "doubleJeopardy": {
    "board": []
  },
  "finalJeopardy": {
    "category": "VIDEO GAMES",
    "clue": "This game's final boss is named Ganon.",
    "answer": "The Legend of Zelda"
  }
}
```

### Daily Doubles

Mark any clue as a Daily Double:

```json
{
  "value": 800,
  "clue": "Question text",
  "answer": "Answer text",
  "dailyDouble": true
}
```

### Media Questions

#### Images

```json
{
  "value": 600,
  "clue": "Name this weapon.",
  "answer": "The Master Sword",
  "media": {
    "type": "image",
    "url": "https://example.com/image.jpg"
  }
}
```

#### YouTube Videos

```json
{
  "value": 800,
  "clue": "Name this game.",
  "answer": "The Legend of Zelda: Tears of the Kingdom",
  "media": {
    "type": "youtube",
    "id": "iaoydCd7Fv8",
    "start": 45
  }
}
```

### Example Question

```json
{
  "value": 1000,
  "clue": "Who's that Pokémon?",
  "answer": "Rayquaza",
  "media": {
    "type": "image",
    "url": "https://example.com/rayquaza.webp"
  }
}
```

---

## Host Controls

### Admin Features

* Load boards
* Delete boards
* Import JSON boards

### Game Controls

* Create game
* Rejoin game
* Restore game
* Mark correct
* Mark wrong
* Skip question
* Edit player scores
* Set Daily Double wagers
* Advance to Double Jeopardy
* Start Final Jeopardy
* Reveal Final Jeopardy clue
* Resolve Final Jeopardy answers

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

## Importing Boards

Boards can be imported directly from JSON files.

Supported formats include:

* Custom boards
* J-Archive generated boards
* Full Jeopardy + Double Jeopardy + Final Jeopardy game files
* Image-based questions
* YouTube video questions

Imported boards are stored in `data/boards.json` and become available in the Saved Boards list.

---

## Tech Stack

* Node.js
* Express
* Socket.IO
* HTML
* CSS
* JavaScript
* Progressive Web App (PWA)

---

## License

Personal project for educational and entertainment use.
