// Core dependencies for the Five-in-a-Row game server
const express = require("express");
const http = require("http");
const socketio = require("socket.io");
const path = require("path");

// Initialize Express app and HTTP server
const app = express();
const server = http.createServer(app);

// Configure Socket.IO with CORS for cross-origin requests
const io = socketio(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const port = 3000;

// Middleware for parsing JSON requests
app.use(express.json());

// Routes - serve the consolidated game file for all routes
// Both root and /local routes serve the same client.html file
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, 'client.html'));
});

app.get("/local", (req, res) => {
  res.sendFile(path.join(__dirname, 'client.html'));
});

// ==================== AI PLAYER CLASS ====================
/**
 * AI Player class for Five-in-a-Row game
 * Implements strategic gameplay with blocking and winning patterns
 */
class AIPlayer {
  constructor() {
    this.name = "AI Player";
    this.difficulty = "medium"; // easy, medium, hard
    this.thinkingTime = 1000; // milliseconds to simulate thinking
  }

  /**
   * Main AI decision function
   * Analyzes the board and returns the best move
   * @param {Array} board - 19x19 game board
   * @param {string} aiPlayer - AI's player color ('black' or 'white')
   * @param {string} humanPlayer - Human's player color
   * @returns {Object} Best move {row, col} or null if no moves available
   */
  getBestMove(board, aiPlayer, humanPlayer) {
    console.log(`AI ${aiPlayer} is thinking...`);
    
    // Get all empty positions
    const emptyPositions = this.getEmptyPositions(board);
    if (emptyPositions.length === 0) {
      return null;
    }

    // Priority 1: Check if AI can win in one move
    const winningMove = this.findWinningMove(board, aiPlayer, emptyPositions);
    if (winningMove) {
      console.log(`AI found winning move:`, winningMove);
      return winningMove;
    }

    // Priority 2: Check if human can win in one move (block them)
    const blockingMove = this.findWinningMove(board, humanPlayer, emptyPositions);
    if (blockingMove) {
      console.log(`AI blocking human win:`, blockingMove);
      return blockingMove;
    }

    // Priority 3: Check for 4-in-a-row threats (human)
    const threatMove = this.findThreatMove(board, humanPlayer, emptyPositions);
    if (threatMove) {
      console.log(`AI blocking 4-in-a-row threat:`, threatMove);
      return threatMove;
    }

    // Priority 4: Create own 4-in-a-row opportunities
    const opportunityMove = this.findThreatMove(board, aiPlayer, emptyPositions);
    if (opportunityMove) {
      console.log(`AI creating 4-in-a-row opportunity:`, opportunityMove);
      return opportunityMove;
    }

    // Priority 5: Strategic positioning
    const strategicMove = this.findStrategicMove(board, aiPlayer, humanPlayer, emptyPositions);
    if (strategicMove) {
      console.log(`AI strategic move:`, strategicMove);
      return strategicMove;
    }

    // Fallback: Random move from center area
    const randomMove = this.getRandomMove(emptyPositions);
    console.log(`AI random move:`, randomMove);
    return randomMove;
  }

  /**
   * Find all empty positions on the board
   * @param {Array} board - Game board
   * @returns {Array} Array of {row, col} positions
   */
  getEmptyPositions(board) {
    const emptyPositions = [];
    for (let row = 0; row < 19; row++) {
      for (let col = 0; col < 19; col++) {
        if (board[row][col] === null) {
          emptyPositions.push({ row, col });
        }
      }
    }
    return emptyPositions;
  }

  /**
   * Check if a player can win in one move
   * @param {Array} board - Game board
   * @param {string} player - Player color
   * @param {Array} emptyPositions - Available positions
   * @returns {Object|null} Winning move or null
   */
  findWinningMove(board, player, emptyPositions) {
    for (const pos of emptyPositions) {
      // Temporarily place the stone
      board[pos.row][pos.col] = player;
      
      // Check if this creates a win
      if (this.checkWinAtPosition(board, pos.row, pos.col, player)) {
        // Remove the temporary stone
        board[pos.row][pos.col] = null;
        return pos;
      }
      
      // Remove the temporary stone
      board[pos.row][pos.col] = null;
    }
    return null;
  }

  /**
   * Check for 4-in-a-row threats that need blocking
   * @param {Array} board - Game board
   * @param {string} player - Player color to check threats for
   * @param {Array} emptyPositions - Available positions
   * @returns {Object|null} Threat blocking move or null
   */
  findThreatMove(board, player, emptyPositions) {
    const directions = [
      [0, 1],   // horizontal
      [1, 0],   // vertical
      [1, 1],   // diagonal \
      [1, -1]   // diagonal /
    ];

    for (const pos of emptyPositions) {
      for (const [dx, dy] of directions) {
        // Check if placing a stone here would create a 4-in-a-row
        let count = 1;
        
        // Count in positive direction
        for (let i = 1; i < 4; i++) {
          const newRow = pos.row + i * dx;
          const newCol = pos.col + i * dy;
          if (newRow >= 0 && newRow < 19 && newCol >= 0 && newCol < 19 && 
              board[newRow][newCol] === player) {
            count++;
          } else {
            break;
          }
        }
        
        // Count in negative direction
        for (let i = 1; i < 4; i++) {
          const newRow = pos.row - i * dx;
          const newCol = pos.col - i * dy;
          if (newRow >= 0 && newRow < 19 && newCol >= 0 && newCol < 19 && 
              board[newRow][newCol] === player) {
            count++;
          } else {
            break;
          }
        }
        
        if (count >= 4) {
          return pos;
        }
      }
    }
    return null;
  }

  /**
   * Find strategic moves for better positioning
   * @param {Array} board - Game board
   * @param {string} aiPlayer - AI player color
   * @param {string} humanPlayer - Human player color
   * @param {Array} emptyPositions - Available positions
   * @returns {Object|null} Strategic move or null
   */
  findStrategicMove(board, aiPlayer, humanPlayer, emptyPositions) {
    // Look for positions near existing stones
    const scoredMoves = [];
    
    for (const pos of emptyPositions) {
      let score = 0;
      
      // Score based on proximity to existing stones
      for (let row = 0; row < 19; row++) {
        for (let col = 0; col < 19; col++) {
          if (board[row][col] !== null) {
            const distance = Math.abs(pos.row - row) + Math.abs(pos.col - col);
            if (distance <= 3) {
              // Prefer positions near existing stones
              score += (4 - distance) * (board[row][col] === aiPlayer ? 2 : 1);
            }
          }
        }
      }
      
      // Prefer center positions
      const centerDistance = Math.abs(pos.row - 9) + Math.abs(pos.col - 9);
      score += (18 - centerDistance) * 0.5;
      
      scoredMoves.push({ ...pos, score });
    }
    
    // Sort by score and return the best move
    scoredMoves.sort((a, b) => b.score - a.score);
    return scoredMoves.length > 0 ? { row: scoredMoves[0].row, col: scoredMoves[0].col } : null;
  }

  /**
   * Get a random move from available positions
   * @param {Array} emptyPositions - Available positions
   * @returns {Object} Random move
   */
  getRandomMove(emptyPositions) {
    const randomIndex = Math.floor(Math.random() * emptyPositions.length);
    return emptyPositions[randomIndex];
  }

  /**
   * Check if there's a win at a specific position
   * @param {Array} board - Game board
   * @param {number} row - Row position
   * @param {number} col - Column position
   * @param {string} player - Player color
   * @returns {boolean} True if win exists
   */
  checkWinAtPosition(board, row, col, player) {
    const directions = [
      [0, 1],   // horizontal
      [1, 0],   // vertical
      [1, 1],   // diagonal \
      [1, -1]   // diagonal /
    ];
    
    for (const [dx, dy] of directions) {
      let count = 1;
      
      // Check positive direction
      for (let i = 1; i < 5; i++) {
        const newRow = row + i * dx;
        const newCol = col + i * dy;
        if (newRow >= 0 && newRow < 19 && newCol >= 0 && newCol < 19 && 
            board[newRow][newCol] === player) {
          count++;
        } else {
          break;
        }
      }
      
      // Check negative direction
      for (let i = 1; i < 5; i++) {
        const newRow = row - i * dx;
        const newCol = col - i * dy;
        if (newRow >= 0 && newRow < 19 && newCol >= 0 && newCol < 19 && 
            board[newRow][newCol] === player) {
          count++;
        } else {
          break;
        }
      }
      
      if (count >= 5) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Simulate thinking time for more realistic gameplay
   * @returns {Promise} Promise that resolves after thinking time
   */
  async think() {
    return new Promise(resolve => {
      setTimeout(resolve, this.thinkingTime);
    });
  }
}

// ==================== GAME STATE MANAGEMENT ====================
// Core data structures for managing game state and player connections

// Active games storage: gameId -> Game instance
let games = new Map(); 

// Queue of players waiting for opponents
let waitingPlayers = [];

// Track start-over requests: gameId -> Set of socketIds who requested restart
let startOverRequests = new Map();

// Game history for replay functionality (currently unused but kept for future features)
let gameHistory = new Map();

// Player connection management
let connectedPlayers = new Map(); // socketId -> playerName
let playerNames = new Set(); // Track used names to prevent duplicates
let playerGameMap = new Map(); // playerName -> gameId (for reconnection)

// AI player instance
const aiPlayer = new AIPlayer();

/**
 * Clear connection-related state on server restart
 * Preserves active games and game history for persistence
 */
function clearAllGameState() {
  // Clear connection-related state
  waitingPlayers.length = 0;
  startOverRequests.clear();
  connectedPlayers.clear();
  playerNames.clear();
  // Keep playerGameMap for reconnection purposes
  console.log('🧹 Cleared connection state on server restart (games preserved)');
}

// ==================== GAME CLASS ====================
/**
 * Game class representing a Five-in-a-Row game instance
 * Handles game logic, move validation, and win detection
 */
class Game {
  constructor(player1, player2, player1Name, player2Name, isAIGame = false) {
    // Generate unique game ID using timestamp and random string
    this.id = Date.now().toString() + Math.random().toString(36).substring(2);
    
    // Player socket references and names
    this.player1 = player1;
    this.player2 = player2;
    this.player1Name = player1Name;
    this.player2Name = player2Name;
    this.isAIGame = isAIGame;
    
    // Game state
    this.board = this.initializeBoard();
    this.currentPlayer = 'black';
    this.winner = null;
    this.gameOver = false;
    this.moveCount = 0;
    this.moveHistory = [];
    
    // Timestamps for tracking
    this.createdAt = new Date();
    this.lastMoveAt = new Date();
  }
  
  /**
   * Initialize empty 19x19 game board
   * @returns {Array} 2D array representing the game board
   */
  initializeBoard() { 
    return Array.from({ length: 19 }, () => Array(19).fill(null));
  }
  
  /**
   * Server-side move validation to prevent cheating
   * @param {number} row - Row position (0-18)
   * @param {number} col - Column position (0-18)
   * @param {string} player - Player making the move ('black' or 'white')
   * @returns {Object} Validation result with success status and reason
   */
  isValidMove(row, col, player) {
    // Check bounds
    if (row < 0 || row >= 19 || col < 0 || col >= 19) {
      return { valid: false, reason: 'Move out of bounds' };
    }
    
    // Check if position is empty
    if (this.board[row][col] !== null) {
      return { valid: false, reason: 'Position already occupied' };
    }
    
    // Check if it's the player's turn
    if (this.currentPlayer !== player) {
      return { valid: false, reason: 'Not your turn' };
    }
    
    // Check if game is over
    if (this.gameOver) {
      return { valid: false, reason: 'Game is over' };
    }
    
    return { valid: true };
  }
  
  /**
   * Execute a move with server-side validation
   * @param {number} row - Row position (0-18)
   * @param {number} col - Column position (0-18)
   * @param {string} player - Player making the move ('black' or 'white')
   * @returns {Object} Move result with success status and game state
   */
  makeMove(row, col, player) {
    const validation = this.isValidMove(row, col, player);
    if (!validation.valid) {
      return { success: false, reason: validation.reason };
    }
    
    // Place the stone
    this.board[row][col] = player;
    this.moveCount++;
    this.lastMoveAt = new Date();
    
    // Record move in history
    this.moveHistory.push({
      row, col, player, timestamp: new Date(),
      moveNumber: this.moveCount
    });
    
    // Check for win
    const winResult = this.checkWin(row, col, player);
    if (winResult.won) {
      this.gameOver = true;
      this.winner = player;
      this.updatePlayerStats();
    } else if (this.moveCount >= 19 * 19) {
      // Board is full - draw
      this.gameOver = true;
      this.winner = 'draw';
    } else {
      // Switch players
      this.currentPlayer = this.currentPlayer === 'black' ? 'white' : 'black';
    }
    
    return { 
      success: true, 
      gameOver: this.gameOver, 
      winner: this.winner,
      currentPlayer: this.currentPlayer
    };
  }
  
  /**
   * Check if the last move resulted in a win (5 in a row)
   * @param {number} row - Row position of the last move
   * @param {number} col - Column position of the last move
   * @param {string} player - Player who made the move
   * @returns {Object} Win result with success status and winning stones
   */
  checkWin(row, col, player) {
    const directions = [
      [0, 1],   // horizontal
      [1, 0],   // vertical
      [1, 1],   // diagonal \
      [1, -1]   // diagonal /
    ];
    
    for (let [dx, dy] of directions) {
      let count = 1;
      const winningStones = [{row, col}];
      
      // Check positive direction
      for (let i = 1; i < 5; i++) {
        const newRow = row + i * dx;
        const newCol = col + i * dy;
        if (newRow >= 0 && newRow < 19 && newCol >= 0 && newCol < 19 && 
            this.board[newRow][newCol] === player) {
          count++;
          winningStones.push({row: newRow, col: newCol});
        } else {
          break;
        }
      }
      
      // Check negative direction
      for (let i = 1; i < 5; i++) {
        const newRow = row - i * dx;
        const newCol = col - i * dy;
        if (newRow >= 0 && newRow < 19 && newCol >= 0 && newCol < 19 && 
            this.board[newRow][newCol] === player) {
          count++;
          winningStones.unshift({row: newRow, col: newCol});
        } else {
          break;
        }
      }
      
      if (count >= 5) {
        return { won: true, winningStones };
      }
    }
    
    return { won: false };
  }
  
  /**
   * Update player statistics (placeholder for future database integration)
   * Currently just logs the game result
   */
  updatePlayerStats() {
    // Player statistics tracking removed in simplified version
    // In a production system, you would update a database here
    console.log(`Game ended: ${this.winner} wins! (${this.player1Name} vs ${this.player2Name})`);
  }
  
  /**
   * Get current game state for client synchronization
   * @returns {Object} Complete game state object
   */
  getGameState() {
    return {
      id: this.id,
      board: this.board,
      currentPlayer: this.currentPlayer,
      gameOver: this.gameOver,
      winner: this.winner,
      moveCount: this.moveCount,
      player1Name: this.player1Name,
      player2Name: this.player2Name,
      isAIGame: this.isAIGame,
      createdAt: this.createdAt,
      lastMoveAt: this.lastMoveAt
    };
  }
}

// ==================== AI GAME HANDLING ====================
/**
 * Handle AI move after human player makes a move
 * @param {string} gameId - Game ID
 */
async function handleAIMove(gameId) {
  console.log('handleAIMove called for gameId:', gameId);
  const game = games.get(gameId);
  if (!game) {
    console.log('Game not found for AI move:', gameId);
    return;
  }
  if (!game.isAIGame) {
    console.log('Game is not an AI game:', gameId);
    return;
  }
  if (game.gameOver) {
    console.log('Game is over, no AI move needed:', gameId);
    return;
  }

  console.log('AI move conditions met, proceeding...');
  console.log('Current player:', game.currentPlayer);
  console.log('Game state:', game.getGameState());

  // Determine AI and human players
  const aiPlayerColor = game.player2Name === 'AI Player' ? 'white' : 'black';
  const humanPlayerColor = aiPlayerColor === 'black' ? 'white' : 'black';
  
  console.log('AI player color:', aiPlayerColor, 'Human player color:', humanPlayerColor);

  // AI thinking time
  console.log('AI is thinking...');
  await aiPlayer.think();

  // Get AI's best move
  console.log('Getting AI best move...');
  const aiMove = aiPlayer.getBestMove(game.board, aiPlayerColor, humanPlayerColor);
  
  if (aiMove) {
    console.log(`AI making move:`, aiMove);
    
    // Make the AI move
    const moveResult = game.makeMove(aiMove.row, aiMove.col, aiPlayerColor);
    
    if (moveResult.success) {
      // Record move in game history
      if (gameHistory.has(gameId)) {
        gameHistory.get(gameId).moves.push({
          row: aiMove.row, 
          col: aiMove.col, 
          player: aiPlayerColor, 
          playerName: 'AI Player',
          timestamp: new Date(),
          moveNumber: game.moveCount
        });
      }
      
      logGameEvent('AI_MOVE_SUCCESS', { 
        gameId, 
        player: aiPlayerColor, 
        row: aiMove.row, 
        col: aiMove.col,
        gameOver: moveResult.gameOver,
        winner: moveResult.winner
      });
      
      // Send update to human player
      const gameState = game.getGameState();
      game.player1.emit('gameUpdate', gameState);
      
      // Send specific move confirmation
      game.player1.emit('moveConfirmed', {
        row: aiMove.row, 
        col: aiMove.col, 
        player: aiPlayerColor,
        gameState: gameState
      });
      
      // If game is over, send final results
      if (moveResult.gameOver) {
        const winnerName = moveResult.winner === 'black' ? game.player1Name : game.player2Name;
        const loserName = moveResult.winner === 'black' ? game.player2Name : game.player1Name;
        
        game.player1.emit('gameEnded', {
          winner: moveResult.winner,
          winnerName: winnerName,
          loserName: loserName,
          gameState: gameState
        });
        
        logGameEvent('AI_GAME_ENDED', { 
          gameId, 
          winner: moveResult.winner,
          winnerName: winnerName,
          loserName: loserName
        });
      }
    }
  }
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Log game events for debugging and monitoring
 * @param {string} event - Event name
 * @param {Object} data - Event data
 */
function logGameEvent(event, data) {
  console.log(`[GAME EVENT] ${event}:`, data);
}

/**
 * Broadcast message to all players in a specific game
 * @param {string} gameId - Game ID
 * @param {string} event - Event name
 * @param {Object} data - Event data
 */
function broadcastToGame(gameId, event, data) {
  io.to(gameId).emit(event, data);
}

// ==================== SOCKET.IO EVENT HANDLERS ====================

/**
 * Handle new socket connections
 * Sets up all event listeners for the connected client
 */
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  
  // Debug: Log all events received (can be removed in production)
  socket.onAny((eventName, ...args) => {
    console.log('Received event:', eventName, 'with data:', args);
  });

  /**
   * Handle username setting with validation and duplicate checking
   * Supports reconnection for existing players
   */
  socket.on("setUsername", (data) => {
    console.log('Received setUsername event:', data);
    try {
      const { username } = data;
      
      // Input validation
      if (!username || typeof username !== 'string') {
        console.log('Username validation failed: invalid format');
        socket.emit("usernameRejected", { 
          message: "Invalid username format" 
        });
        return;
      }
      
      // Check username length
      if (username.length < 2 || username.length > 20) {
        console.log('Username validation failed: length', username.length);
        socket.emit("usernameRejected", { 
          message: "Username must be 2-20 characters" 
        });
        return;
      }
      
      // Check if username is already taken (but allow reconnection)
      if (playerNames.has(username)) {
        // Check if this is a reconnection attempt
        const existingGameId = playerGameMap.get(username);
        if (existingGameId && games.has(existingGameId)) {
          console.log('Username already taken but has active game, allowing reconnection:', username);
          // Allow reconnection - don't reject the username
        } else {
          // Check if the existing player is still connected
          let existingPlayerConnected = false;
          for (let [socketId, playerName] of connectedPlayers) {
            if (playerName === username) {
              // Check if this socket is still connected
              const existingSocket = io.sockets.sockets.get(socketId);
              if (existingSocket && existingSocket.connected) {
                existingPlayerConnected = true;
                break;
              }
            }
          }
          
          if (existingPlayerConnected) {
            console.log('Username validation failed: already taken by connected player', username);
            socket.emit("usernameRejected", { 
              message: "Username already taken, please choose another" 
            });
            return;
          } else {
            console.log('Username was taken by disconnected player, allowing reuse:', username);
            // Remove the old disconnected player from playerNames
            playerNames.delete(username);
          }
        }
      }
      
      // Check for invalid characters
      if (!/^[a-zA-Z0-9_\s-]+$/.test(username)) {
        console.log('Username validation failed: invalid characters', username);
        socket.emit("usernameRejected", { 
          message: "Username can only contain letters, numbers, spaces, hyphens, and underscores" 
        });
        return;
      }
      
      // Store the username
      connectedPlayers.set(socket.id, username);
      playerNames.add(username);
      
      console.log('Username accepted:', username, 'for socket:', socket.id);
      logGameEvent('USERNAME_SET', { username, socketId: socket.id });
      
      // Check if player has an existing game
      const existingGameId = playerGameMap.get(username);
      if (existingGameId && games.has(existingGameId)) {
        console.log('Player has existing game, sending reconnection info:', username, existingGameId);
        socket.emit("usernameAccepted", { 
          message: "Username accepted - reconnecting to existing game",
          playerName: username,
          hasExistingGame: true,
          gameId: existingGameId
        });
      } else {
        socket.emit("usernameAccepted", { 
          message: "Username accepted",
          playerName: username,
          hasExistingGame: false
        });
      }
    } catch (error) {
      console.error('Username setting error:', error);
      socket.emit("usernameRejected", { 
        message: "Error setting username" 
      });
    }
  });

  /**
   * Handle join game requests
   * Matches waiting players or adds player to waiting queue
   */
  socket.on("joinGame", (data) => {
    try {
      // Check if player has set a username
      if (!connectedPlayers.has(socket.id)) {
        socket.emit("usernameRequired", { 
          message: "Please set your username first" 
        });
        return;
      }
      
      const playerName = connectedPlayers.get(socket.id);
      
      // Check if player is already in a game
      const existingGameId = playerGameMap.get(playerName);
      if (existingGameId && games.has(existingGameId)) {
        console.log('Player already in game, ignoring join request:', playerName);
        return;
      }
      
      logGameEvent('JOIN_GAME_REQUEST', { socketId: socket.id, playerName });
      
      if (waitingPlayers.length === 0) {
        waitingPlayers.push(socket);
        logGameEvent('PLAYER_WAITING', { socketId: socket.id, playerName });
        socket.emit("waitingForOpponent", { 
          message: "Waiting for another player to join...",
          playerCount: 1
        });
      } else {
        const player1 = waitingPlayers.shift();
        const player2 = socket;
        const player1Name = connectedPlayers.get(player1.id);
        const player2Name = connectedPlayers.get(player2.id);

        const game = new Game(player1, player2, player1Name, player2Name);
        games.set(game.id, game);
        
        // Store game history
        gameHistory.set(game.id, {
          gameId: game.id,
          players: [player1Name, player2Name],
          createdAt: game.createdAt,
          moves: []
        });
        
        logGameEvent('GAME_CREATED', { 
          gameId: game.id, 
          player1: player1Name, 
          player2: player2Name 
        });

        // Join players to the game room
        player1.join(game.id);
        player2.join(game.id);

        // Map players to their game for reconnection
        playerGameMap.set(player1Name, game.id);
        playerGameMap.set(player2Name, game.id);

        // Notify the players with enhanced game info
        const gameState = game.getGameState();
        player1.emit("gameStarted", { 
          gameId: game.id, 
          player: "black",
          playerName: player1Name,
          opponentName: player2Name,
          gameState: gameState
        });
        player2.emit("gameStarted", { 
          gameId: game.id, 
          player: "white",
          playerName: player2Name,
          opponentName: player1Name,
          gameState: gameState
        });
        
        logGameEvent('GAME_STARTED', { gameId: game.id });

        // Send initial board state
        broadcastToGame(game.id, "gameUpdate", gameState);
      }
    } catch (error) {
      console.error('Join game error:', error);
      socket.emit("joinGameError", { 
        message: "Error joining game" 
      });
    }
  });

  /**
   * Handle AI game requests
   * Creates a game between human player and AI
   */
  socket.on("joinAIGame", (data) => {
    console.log('Received joinAIGame request:', data);
    try {
      // Check if player has set a username
      if (!connectedPlayers.has(socket.id)) {
        console.log('AI join failed: No username set for socket', socket.id);
        socket.emit("usernameRequired", { 
          message: "Please set your username first" 
        });
        return;
      }
      
      const playerName = connectedPlayers.get(socket.id);
      console.log('AI join request from player:', playerName);
      
      // Check if player is already in a game
      const existingGameId = playerGameMap.get(playerName);
      if (existingGameId && games.has(existingGameId)) {
        console.log('Player already in game, ignoring AI join request:', playerName);
        return;
      }
      
      logGameEvent('AI_JOIN_GAME_REQUEST', { socketId: socket.id, playerName });
      
      // Create AI game
      const game = new Game(socket, null, playerName, "AI Player", true);
      games.set(game.id, game);
      
      // Store game history
      gameHistory.set(game.id, {
        gameId: game.id,
        players: [playerName, "AI Player"],
        createdAt: game.createdAt,
        moves: []
      });
      
      logGameEvent('AI_GAME_CREATED', { 
        gameId: game.id, 
        player: playerName
      });

      // Join player to the game room
      socket.join(game.id);

      // Map player to their game for reconnection
      playerGameMap.set(playerName, game.id);

      // Notify the player with game info
      const gameState = game.getGameState();
      console.log('Sending gameStarted event to player:', playerName);
      socket.emit("gameStarted", { 
        gameId: game.id, 
        player: "black",
        playerName: playerName,
        opponentName: "AI Player",
        gameState: gameState,
        isAIGame: true
      });
      
      logGameEvent('AI_GAME_STARTED', { gameId: game.id });

      // Send initial board state
      socket.emit("gameUpdate", gameState);
      console.log('AI game created successfully for player:', playerName);
    } catch (error) {
      console.error('AI join game error:', error);
      socket.emit("joinGameError", { 
        message: "Error joining AI game" 
      });
    }
  });

  /**
   * Handle move requests with server-side validation
   * Prevents cheating and ensures game integrity
   */
  socket.on('makeMove', (data) => {
    try {
      // Check if player has set a username
      if (!connectedPlayers.has(socket.id)) {
        socket.emit("usernameRequired", { 
          message: "Please set your username first" 
        });
        return;
      }
      
      const { gameId, row, col } = data;
      
      // Input validation
      if (!gameId || typeof row !== 'number' || typeof col !== 'number') {
        socket.emit("moveError", { 
          message: "Invalid move data" 
        });
        return;
      }
      
      // Validate coordinates
      if (row < 0 || row >= 19 || col < 0 || col >= 19) {
        socket.emit("moveError", { 
          message: "Move out of bounds" 
        });
        return;
      }
      
      const game = games.get(gameId);
      if (!game) {
        socket.emit("moveError", { 
          message: "Game not found" 
        });
        return;
      }
      
      // Determine which player is making the move
      const isPlayer1 = game.player1 === socket;
      const isPlayer2 = game.player2 === socket;
      
      if (!isPlayer1 && !isPlayer2) {
        socket.emit("moveError", { 
          message: "You are not part of this game" 
        });
        return;
      }
      
      const player = isPlayer1 ? 'black' : 'white';
      const playerName = connectedPlayers.get(socket.id);
      
      logGameEvent('MOVE_ATTEMPT', { 
        gameId, 
        player, 
        playerName, 
        row, 
        col 
      });
      
      // Use server-side validation and move execution
      console.log('Making move for player:', player, 'at position:', row, col);
      console.log('Game isAIGame:', game.isAIGame);
      const moveResult = game.makeMove(row, col, player);
      console.log('Move result:', moveResult);
      
      if (moveResult.success) {
        // Record move in game history
        if (gameHistory.has(gameId)) {
          gameHistory.get(gameId).moves.push({
            row, col, player, playerName,
            timestamp: new Date(),
            moveNumber: game.moveCount
          });
        }
        
        logGameEvent('MOVE_SUCCESS', { 
          gameId, 
          player, 
          playerName, 
          row, 
          col,
          gameOver: moveResult.gameOver,
          winner: moveResult.winner
        });
        
        // Send update to both players (or just human player in AI game)
        const gameState = game.getGameState();
        if (game.isAIGame) {
          // AI game - only send to human player
          socket.emit('gameUpdate', gameState);
        } else {
          // Regular game - send to both players
          broadcastToGame(gameId, 'gameUpdate', gameState);
        }
        
        // Send specific move confirmation to the player who made the move
        socket.emit('moveConfirmed', {
          row, col, player,
          gameState: gameState
        });
        
        // If game is over, send final results
        if (moveResult.gameOver) {
          const winnerName = moveResult.winner === 'black' ? game.player1Name : game.player2Name;
          const loserName = moveResult.winner === 'black' ? game.player2Name : game.player1Name;
          
          if (game.isAIGame) {
            // AI game - only send to human player
            socket.emit('gameEnded', {
              winner: moveResult.winner,
              winnerName: winnerName,
              loserName: loserName,
              gameState: gameState
            });
          } else {
            // Regular game - send to both players
            broadcastToGame(gameId, 'gameEnded', {
              winner: moveResult.winner,
              winnerName: winnerName,
              loserName: loserName,
              gameState: gameState
            });
          }
          
          logGameEvent('GAME_ENDED', { 
            gameId, 
            winner: moveResult.winner,
            winnerName: winnerName,
            loserName: loserName
          });
        } else if (game.isAIGame && !moveResult.gameOver) {
          // AI's turn - trigger AI move after a short delay
          console.log('Human move completed, triggering AI move. Current player:', game.currentPlayer);
          console.log('Game isAIGame:', game.isAIGame, 'GameOver:', moveResult.gameOver);
          setTimeout(() => {
            console.log('Timeout triggered, calling handleAIMove...');
            handleAIMove(gameId);
          }, 500);
        } else {
          console.log('AI move not triggered. isAIGame:', game.isAIGame, 'gameOver:', moveResult.gameOver);
        }
      } else {
        console.log('Move rejected:', moveResult.reason, 'for player', playerName, 'at', row, col);
        logGameEvent('MOVE_REJECTED', { 
          gameId, 
          player, 
          playerName, 
          row, 
          col, 
          reason: moveResult.reason 
        });
        
        socket.emit("moveError", { 
          message: moveResult.reason 
        });
      }
    } catch (error) {
      console.error('Move handling error:', error);
      socket.emit("moveError", { 
        message: "Error processing move" 
      });
    }
  });

  /**
   * Handle start over requests
   * Requires both players to agree before restarting the game
   */
  socket.on('requestStartOver', (data) => {
    try {
      // Check if player has set a username
      if (!connectedPlayers.has(socket.id)) {
        socket.emit("usernameRequired", { 
          message: "Please set your username first" 
        });
        return;
      }
      
      const { gameId } = data;
      if (!gameId) {
        socket.emit("startOverError", { 
          message: "Invalid game ID" 
        });
        return;
      }
      
      const game = games.get(gameId);
      if (!game) {
        socket.emit("startOverError", { 
          message: "Game not found" 
        });
        return;
      }
      
      // Check if this player is in the game
      const isPlayer1 = game.player1 === socket;
      const isPlayer2 = game.player2 === socket;
      
      if (!isPlayer1 && !isPlayer2) {
        socket.emit("startOverError", { 
          message: "You are not part of this game" 
        });
        return;
      }
      
      const playerName = connectedPlayers.get(socket.id);
      logGameEvent('START_OVER_REQUEST', { gameId, playerName });
      
      if (!startOverRequests.has(gameId)) {
        startOverRequests.set(gameId, new Set());
      }
      
      const requests = startOverRequests.get(gameId);
      requests.add(socket.id);
      
      // Notify the other player (only if it's not an AI game)
      if (!game.isAIGame) {
        const otherPlayer = isPlayer1 ? game.player2 : game.player1;
        otherPlayer.emit('startOverRequested', { 
          message: `${playerName} wants to start over. Click to confirm.` 
        });
      }
      
      // Check if both players want to start over (or if it's an AI game, start over immediately)
      if (requests.size === 2 || game.isAIGame) {
        // Reset the game
        game.board = game.initializeBoard();
        game.currentPlayer = 'black';
        game.winner = null;
        game.gameOver = false;
        game.moveCount = 0;
        game.moveHistory = [];
        game.lastMoveAt = new Date();
        
        // Clear start over requests
        startOverRequests.delete(gameId);
        
        logGameEvent('GAME_RESTARTED', { gameId });
        
        // Notify both players (or just human player in AI game)
        const gameState = game.getGameState();
        if (game.isAIGame) {
          // AI game - only send to human player
          game.player1.emit('gameRestarted', gameState);
        } else {
          // Regular game - send to both players
          broadcastToGame(gameId, 'gameRestarted', gameState);
        }
      }
    } catch (error) {
      console.error('Start over error:', error);
      socket.emit("startOverError", { 
        message: "Error processing start over request" 
      });
    }
  });

  /**
   * Handle new game requests during active games
   * Allows players to request a fresh start
   */
  socket.on('requestNewGame', (data) => {
    try {
      // Check if player has set a username
      if (!connectedPlayers.has(socket.id)) {
        socket.emit("usernameRequired", { 
          message: "Please set your username first" 
        });
        return;
      }
      
      const { gameId } = data;
      if (!gameId) {
        socket.emit("newGameError", { 
          message: "Invalid game ID" 
        });
        return;
      }
      
      const game = games.get(gameId);
      if (!game) {
        socket.emit("newGameError", { 
          message: "Game not found" 
        });
        return;
      }
      
      // Check if this player is in the game
      const isPlayer1 = game.player1 === socket;
      const isPlayer2 = game.player2 === socket;
      
      if (!isPlayer1 && !isPlayer2) {
        socket.emit("newGameError", { 
          message: "You are not part of this game" 
        });
        return;
      }
      
      const playerName = connectedPlayers.get(socket.id);
      logGameEvent('NEW_GAME_REQUEST', { gameId, playerName });
      
      // Notify the other player about the new game request
      const otherPlayer = isPlayer1 ? game.player2 : game.player1;
      otherPlayer.emit('newGameRequested', { 
        message: `${playerName} wants to start a new game. Do you want to start over?`,
        requestingPlayer: playerName
      });
      
      // Send confirmation to the requesting player
      socket.emit('newGameRequestSent', {
        message: `Request sent to ${isPlayer1 ? game.player2Name : game.player1Name}. Waiting for response...`
      });
      
    } catch (error) {
      console.error('New game request error:', error);
      socket.emit("newGameError", { 
        message: "Error processing new game request" 
      });
    }
  });

  /**
   * Handle responses to new game requests
   * Processes accept/reject responses from players
   */
  socket.on('respondToNewGame', (data) => {
    try {
      // Check if player has set a username
      if (!connectedPlayers.has(socket.id)) {
        socket.emit("usernameRequired", { 
          message: "Please set your username first" 
        });
        return;
      }
      
      const { gameId, accept } = data;
      if (!gameId) {
        socket.emit("newGameError", { 
          message: "Invalid game ID" 
        });
        return;
      }
      
      const game = games.get(gameId);
      if (!game) {
        socket.emit("newGameError", { 
          message: "Game not found" 
        });
        return;
      }
      
      // Check if this player is in the game
      const isPlayer1 = game.player1 === socket;
      const isPlayer2 = game.player2 === socket;
      
      if (!isPlayer1 && !isPlayer2) {
        socket.emit("newGameError", { 
          message: "You are not part of this game" 
        });
        return;
      }
      
      const playerName = connectedPlayers.get(socket.id);
      const otherPlayer = isPlayer1 ? game.player2 : game.player1;
      
      if (accept) {
        // Both players agree to start new game - reset the current game
        game.board = game.initializeBoard();
        game.currentPlayer = 'black';
        game.winner = null;
        game.gameOver = false;
        game.moveCount = 0;
        game.moveHistory = [];
        game.lastMoveAt = new Date();
        
        logGameEvent('NEW_GAME_ACCEPTED', { gameId, playerName });
        
        // Notify both players that new game has started
        const gameState = game.getGameState();
        broadcastToGame(gameId, 'newGameStarted', {
          message: 'New game started!',
          gameState: gameState
        });
      } else {
        // Player rejected the new game request
        logGameEvent('NEW_GAME_REJECTED', { gameId, playerName });
        
        // Notify the requesting player that the request was rejected
        otherPlayer.emit('newGameRejected', {
          message: `${playerName} declined to start a new game. The current game continues.`
        });
        
        // Notify the rejecting player
        socket.emit('newGameResponseSent', {
          message: 'You declined the new game request. The current game continues.'
        });
      }
      
    } catch (error) {
      console.error('New game response error:', error);
      socket.emit("newGameError", { 
        message: "Error processing new game response" 
      });
    }
  });

  /**
   * Handle AI game reset requests
   * Resets the server-side game state for AI games
   */
  socket.on('resetAIGame', (data) => {
    try {
      // Check if player has set a username
      if (!connectedPlayers.has(socket.id)) {
        socket.emit("usernameRequired", { 
          message: "Please set your username first" 
        });
        return;
      }
      
      const { gameId } = data;
      if (!gameId) {
        socket.emit("resetError", { 
          message: "Invalid game ID" 
        });
        return;
      }
      
      const game = games.get(gameId);
      if (!game) {
        socket.emit("resetError", { 
          message: "Game not found" 
        });
        return;
      }
      
      // Check if this is an AI game
      if (!game.isAIGame) {
        socket.emit("resetError", { 
          message: "Not an AI game" 
        });
        return;
      }
      
      // Check if this player is in the game
      const isPlayer1 = game.player1 === socket;
      if (!isPlayer1) {
        socket.emit("resetError", { 
          message: "You are not part of this game" 
        });
        return;
      }
      
      const playerName = connectedPlayers.get(socket.id);
      logGameEvent('AI_GAME_RESET_REQUEST', { gameId, playerName });
      
      // Reset the game state
      game.board = game.initializeBoard();
      game.currentPlayer = 'black';
      game.winner = null;
      game.gameOver = false;
      game.moveCount = 0;
      game.moveHistory = [];
      game.lastMoveAt = new Date();
      
      logGameEvent('AI_GAME_RESET', { gameId });
      
      // Send updated game state to the human player
      const gameState = game.getGameState();
      socket.emit('aiGameReset', gameState);
      
    } catch (error) {
      console.error('AI game reset error:', error);
      socket.emit("resetError", { 
        message: "Error resetting AI game" 
      });
    }
  });

  /**
   * Handle game state requests
   * Returns current game state for client synchronization
   */
  socket.on('getGameState', (data) => {
    try {
      if (!connectedPlayers.has(socket.id)) {
        socket.emit("usernameRequired", { 
          message: "Please set your username first" 
        });
        return;
      }
      
      const { gameId } = data;
      const game = games.get(gameId);
      
      if (!game) {
        socket.emit("gameStateError", { 
          message: "Game not found" 
        });
        return;
      }
      
      const gameState = game.getGameState();
      socket.emit('gameState', gameState);
    } catch (error) {
      console.error('Get game state error:', error);
      socket.emit("gameStateError", { 
        message: "Error getting game state" 
      });
    }
  });

  /**
   * Handle player count requests
   * Returns current number of connected players
   */
  socket.on('getPlayerCount', () => {
    try {
      const activePlayerCount = connectedPlayers.size;
      socket.emit('playerCount', { count: activePlayerCount });
      console.log('Player count requested, responding with:', activePlayerCount);
    } catch (error) {
      console.error('Get player count error:', error);
      socket.emit('playerCount', { count: 0 });
    }
  });

  /**
   * Handle leave game requests
   * Cleans up game state when player leaves
   */
  socket.on('leaveGame', (data) => {
    try {
      if (!connectedPlayers.has(socket.id)) {
        return;
      }
      
      const playerName = connectedPlayers.get(socket.id);
      const gameId = playerGameMap.get(playerName);
      
      if (gameId) {
        const game = games.get(gameId);
        if (game) {
          // Notify the other player that this player left
          const otherPlayer = game.player1 === socket ? game.player2 : game.player1;
          if (otherPlayer) {
            otherPlayer.emit('opponentLeft', { 
              message: `${playerName} has left the game to start a new one` 
            });
          }
          
          // Clean up the game
          playerGameMap.delete(game.player1Name);
          playerGameMap.delete(game.player2Name);
          games.delete(gameId);
          
          logGameEvent('PLAYER_LEFT_GAME', { gameId, playerName });
        }
      }
      
      // Remove from waiting list if present
      const index = waitingPlayers.indexOf(socket);
      if (index > -1) {
        waitingPlayers.splice(index, 1);
      }
      
    } catch (error) {
      console.error('Leave game error:', error);
    }
  });

  /**
   * Handle reconnection requests
   * Allows players to reconnect to their existing games
   */
  socket.on('reconnectToGame', (data) => {
    try {
      if (!connectedPlayers.has(socket.id)) {
        console.log('Reconnection failed: No username set for socket', socket.id);
        socket.emit("usernameRequired", { 
          message: "Please set your username first" 
        });
        return;
      }
      
      const playerName = connectedPlayers.get(socket.id);
      const gameId = playerGameMap.get(playerName);
      
      console.log('Reconnection attempt:', { 
        playerName, 
        gameId, 
        hasGame: !!games.get(gameId), 
        allGames: Array.from(games.keys()),
        playerGameMap: Object.fromEntries(playerGameMap)
      });
      
      if (!gameId) {
        console.log('Reconnection failed: No active game for player', playerName);
        // Clear the player's game mapping since there's no active game
        playerGameMap.delete(playerName);
        socket.emit("reconnectError", { 
          message: "No active game found for this player",
          clearSession: true  // Signal client to clear session data
        });
        return;
      }
      
      const game = games.get(gameId);
      if (!game) {
        // Clear the player's game mapping since the game no longer exists
        playerGameMap.delete(playerName);
        socket.emit("reconnectError", { 
          message: "Game no longer exists",
          clearSession: true  // Signal client to clear session data
        });
        return;
      }
      
      // Check if this player is already in the game
      const isPlayer1 = game.player1Name === playerName;
      const isPlayer2 = game.player2Name === playerName;
      
      if (!isPlayer1 && !isPlayer2) {
        socket.emit("reconnectError", { 
          message: "You are not part of this game" 
        });
        return;
      }
      
      // Rejoin the game room
      socket.join(gameId);
      
      // Update the player socket reference
      if (isPlayer1) {
        game.player1 = socket;
        console.log('Updated player1 socket reference for', playerName);
      } else {
        game.player2 = socket;
        console.log('Updated player2 socket reference for', playerName);
      }
      
      // Cancel the disconnect timeout since player reconnected
      if (game.disconnectTimeout) {
        clearTimeout(game.disconnectTimeout);
        game.disconnectTimeout = null;
      }
      
      const gameState = game.getGameState();
      const myPlayer = isPlayer1 ? 'black' : 'white';
      const opponentName = isPlayer1 ? game.player2Name : game.player1Name;
      
      logGameEvent('PLAYER_RECONNECTED', { 
        gameId, 
        playerName, 
        myPlayer 
      });
      
      // Send reconnection success with current game state
      const reconnectionData = {
        gameId: gameId,
        player: myPlayer,
        playerName: playerName,
        opponentName: opponentName,
        gameState: gameState
      };
      console.log('Sending reconnection data:', reconnectionData);
      socket.emit('reconnectedToGame', reconnectionData);
      
    } catch (error) {
      console.error('Reconnection error:', error);
      socket.emit("reconnectError", { 
        message: "Error reconnecting to game" 
      });
    }
  });

  /**
   * Handle explicit player disconnection (tab close)
   * Immediately ends the game when player explicitly disconnects
   */
  socket.on('playerDisconnect', (data) => {
    try {
      const { gameId, playerName, isDisconnect } = data;
      
      if (!gameId || !playerName) {
        console.log('Invalid playerDisconnect data:', data);
        return;
      }
      
      const game = games.get(gameId);
      if (!game) {
        console.log('Game not found for playerDisconnect:', gameId);
        return;
      }
      
      // Check if this player is actually in the game
      const isPlayer1 = game.player1Name === playerName;
      const isPlayer2 = game.player2Name === playerName;
      
      if (!isPlayer1 && !isPlayer2) {
        console.log('Player not found in game for disconnect:', playerName, gameId);
        return;
      }
      
      const otherPlayer = isPlayer1 ? game.player2 : game.player1;
      
      logGameEvent('PLAYER_EXPLICIT_DISCONNECT', { gameId, playerName, isDisconnect });
      
      // Immediately end the game and notify the other player
      if (otherPlayer && otherPlayer.connected) {
        otherPlayer.emit('opponentDisconnected', { 
          message: `${playerName} has left the game` 
        });
      }
      
      // Archive the game
      if (gameHistory.has(gameId)) {
        gameHistory.get(gameId).endedAt = new Date();
        gameHistory.get(gameId).reason = 'Player explicitly disconnected';
      }
      
      // Clean up player game mapping
      playerGameMap.delete(game.player1Name);
      playerGameMap.delete(game.player2Name);
      
      // Remove the game immediately
      games.delete(gameId);
      
      logGameEvent('GAME_ENDED_EXPLICIT_DISCONNECT', { gameId, playerName });
      
    } catch (error) {
      console.error('Error handling playerDisconnect:', error);
    }
  });

  /**
   * Handle socket disconnection with cleanup
   * Provides grace period for reconnection before ending games
   */
  socket.on('disconnect', () => {
    const playerName = connectedPlayers.get(socket.id) || 'Unknown';
    
    logGameEvent('PLAYER_DISCONNECTED', { socketId: socket.id, playerName });
    
    // Don't immediately clean up player data - wait for timeout to allow reconnection
    // The cleanup will happen in the disconnect timeout if player doesn't reconnect
    
    // Clean up start over requests
    for (let [gameId, requests] of startOverRequests) {
      requests.delete(socket.id);
      if (requests.size === 0) {
        startOverRequests.delete(gameId);
      }
    }
    
    // Handle player disconnection - give grace period for refresh
    for (let [gameId, game] of games) {
      if (game.player1 === socket || game.player2 === socket) {
        const otherPlayer = game.player1 === socket ? game.player2 : game.player1;
        
        // Cancel any existing disconnect timeout
        if (game.disconnectTimeout) {
          clearTimeout(game.disconnectTimeout);
          game.disconnectTimeout = null;
        }
        
        // Set a timeout to handle the disconnect (allow time for refresh)
        const disconnectTimeout = setTimeout(() => {
          // Clean up player data after timeout
          if (connectedPlayers.has(socket.id)) {
            const username = connectedPlayers.get(socket.id);
            connectedPlayers.delete(socket.id);
            // Only remove from playerNames if no other socket is using this username
            let usernameStillInUse = false;
            for (let [otherSocketId, otherUsername] of connectedPlayers) {
              if (otherUsername === username) {
                usernameStillInUse = true;
                break;
              }
            }
            if (!usernameStillInUse) {
              playerNames.delete(username);
              console.log('Removed username from playerNames:', username);
            }
          }
          
          if (otherPlayer && otherPlayer.connected) {
            // Mark the game as finished due to disconnect
            game.gameOver = true;
            game.winner = 'disconnect';
            
            // Notify the remaining player that opponent left
            otherPlayer.emit('opponentDisconnected', { 
              message: `${playerName} has left the game`,
              gameFinished: true,
              gameState: game.getGameState()
            });
          }
            
            // Archive the game before deleting
            if (gameHistory.has(gameId)) {
              gameHistory.get(gameId).endedAt = new Date();
              gameHistory.get(gameId).reason = 'Player disconnected (timeout)';
            }
            
            // Clean up player game mapping
            playerGameMap.delete(game.player1Name);
            playerGameMap.delete(game.player2Name);
            
            games.delete(gameId);
            logGameEvent('GAME_ENDED_DISCONNECT_TIMEOUT', { gameId, playerName });
          }, 10000); // 10 second grace period for refresh
        
        // Store timeout for potential cancellation on reconnection
        game.disconnectTimeout = disconnectTimeout;
        
        logGameEvent('PLAYER_DISCONNECTED_FROM_GAME', { gameId, playerName });
      }
    }
    
    // Remove from waiting list
    const index = waitingPlayers.indexOf(socket);
    if (index > -1) {
      waitingPlayers.splice(index, 1);
      logGameEvent('PLAYER_REMOVED_FROM_WAITING', { playerName });
    }
  });
});

// ==================== SERVER INITIALIZATION ====================

// Clear connection state on server startup
clearAllGameState();

/**
 * Start the server with comprehensive logging
 * Displays server information and available features
 */
server.listen(port, () => {
  console.log('='.repeat(50));
  console.log('🎮 Five-in-a-Row Game Server Started');
  console.log('='.repeat(50));
  console.log(`🌐 Server running on: http://localhost:${port}`);
  console.log(`🎯 Game (Local & Online): http://localhost:${port}`);
  console.log(`🏠 Local game: http://localhost:${port}/local`);
  console.log('='.repeat(50));
  console.log('📊 Features:');
  console.log('  ✅ Simple username-based system');
  console.log('  ✅ Server-side move validation (anti-cheat)');
  console.log('  ✅ Real-time WebSocket communication');
  console.log('  ✅ Game state management');
  console.log('  ✅ Game history logging');
  console.log('='.repeat(50));
  console.log('🎮 How to play:');
  console.log('  1. Open the game in your browser');
  console.log('  2. Click "Online Play"');
  console.log('  3. Enter your name');
  console.log('  4. Click "Join Game" to find an opponent');
  console.log('='.repeat(50));
});