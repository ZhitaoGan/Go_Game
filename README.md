# Five-in-a-Row Game

A web-based Five-in-a-Row (Gomoku) game with multiple play modes.

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the server:**
   ```bash
   node server.js
   ```

3. **Open the game:**
   - Go to `http://localhost:3000` in your browser

## How to Play

### Local Mode
- Click "Local Play" 
- Two players take turns on the same device
- First player to get 5 stones in a row wins
- **Note**: You can also open `client.html` directly in your browser to play local mode without starting the server

### Online Mode
- Click "Online Play"
- Enter your name
- Wait for another player to join
- Play against real opponents

### AI Mode
- Click "AI Play"
- Enter your name
- Play against the computer AI
- AI will make moves automatically after you play

## Game Rules
- 19x19 board
- Black plays first
- Get 5 stones in a row (horizontal, vertical, or diagonal) to win
- Click on empty intersections to place stones
