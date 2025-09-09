const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');

// Game settings
const boardSize = 19; // 19x19 grid
const cellSize = 30; // Size of each cell in pixels

// Calculate margin to center the grid perfectly
const totalGridWidth = (boardSize - 1) * cellSize;
const margin = (canvas.width - totalGridWidth) / 2;

console.log(`Canvas width: ${canvas.width}`);
console.log(`Grid width: ${totalGridWidth}`);
console.log(`Margin: ${margin}`);

// Draw the board background
ctx.fillStyle = '#deb887'; // Wooden color
ctx.fillRect(0, 0, canvas.width, canvas.height);

// Draw grid lines
ctx.strokeStyle = '#8b4513'; // Brown color for lines
ctx.lineWidth = 1;

// Draw vertical lines
for (let col = 0; col < boardSize; col++) {
    const x = margin + col * cellSize;
    ctx.beginPath();
    ctx.moveTo(x, margin);
    ctx.lineTo(x, margin + (boardSize - 1) * cellSize);
    ctx.stroke();
}

// Draw horizontal lines
for (let row = 0; row < boardSize; row++) {
    const y = margin + row * cellSize;
    ctx.beginPath();
    ctx.moveTo(margin, y);
    ctx.lineTo(margin + (boardSize - 1) * cellSize, y);
    ctx.stroke();
}

// Draw star points (traditional Go board markers)
ctx.fillStyle = '#8b4513';
const starPoints = [
    [3, 3], [3, 9], [3, 15],
    [9, 3], [9, 9], [9, 15],
    [15, 3], [15, 9], [15, 15]
];

starPoints.forEach(([row, col]) => {
    const x = margin + col * cellSize;
    const y = margin + row * cellSize;
    
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, 2 * Math.PI);
    ctx.fill();
});
// Get the status element
const statusText = document.getElementById('statusText');

// Initialize the game variables
let board = [];
let currentPlayer = 'black';
let gameOver = false;
let winner = null;

// Initialize the board
function initializeBoard() {
    board = [];
    for (let row = 0; row < boardSize; row++) {
        board[row] = [];
        for (let col = 0; col < boardSize; col++) {
            board[row][col] = null;
        }
    }
}

// Check if the move is valid
function isValidMove(row, col) {
    // check if the move is within the board
    if (row < 0 || row >= boardSize || col < 0 || col >= boardSize) {
        return false;
    }
    // check if the position is empty
    if (board[row][col] !== null) {
        return false;
    }

    // check if the game is over
    if (gameOver) {
        return false;
    }

    return true;
}

// Check if the move is a win
function checkWin(row, col) {
    const directions = [
        [0, 1],   // horizontal (left-right)
        [1, 0],   // vertical (up-down)
        [1, 1],   // diagonal \ (top-left to bottom-right)
        [1, -1]   // diagonal / (top-right to bottom-left)
    ];
    
    for (let [dx, dy] of directions) {
        let count = 1; // Count the current stone
        
        // Check in positive direction
        for (let i = 1; i < 5; i++) {
            const newRow = row + i * dx;
            const newCol = col + i * dy;
            if (isValidPosition(newRow, newCol) && 
                board[newRow][newCol] === currentPlayer) {
                count++;
            } else {
                break;
            }
        }
        
        // Check in negative direction
        for (let i = 1; i < 5; i++) {
            const newRow = row - i * dx;
            const newCol = col - i * dy;
            if (isValidPosition(newRow, newCol) && 
                board[newRow][newCol] === currentPlayer) {
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

// Check if the position is within the board
function isValidPosition(row, col) {
    return row >= 0 && row < boardSize && col >= 0 && col < boardSize;
}

// Make a move
function makeMove(row, col) {
    // Validate the move
    if (!isValidMove(row, col)) {
        console.log("Invalid move!");
        return false;
    }
    
    // Place the stone
    board[row][col] = currentPlayer;
    
    // Check for win
    if (checkWin(row, col)) {
        gameOver = true;
        winner = currentPlayer;
        console.log(`${currentPlayer.toUpperCase()} WINS!`);
        return true;
    }
    
    // Switch players
    currentPlayer = currentPlayer === 'black' ? 'white' : 'black';
    
    return true;
}

initializeBoard();

canvas.addEventListener('click', handleCanvasClick);
// Handle the canvas click
function handleCanvasClick(event) {
    // Get mouse position relative to the canvas
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Convert mouse position to grid coordinates
    const boardPosition = getBoardPosition(x, y);

    if (boardPosition && isValidMove(boardPosition.row, boardPosition.col)) {
        makeMove(boardPosition.row, boardPosition.col);
        redrawBoard();
        updateStatus();

    } else {
        console.log("Invalid move!");
    }
    
}

function getBoardPosition(x, y) {
    // Calculate which cell the mouse is in
    const col = Math.round((x - margin) / cellSize);
    const row = Math.round((y - margin) / cellSize);
    
    // Check if the position is valid
    if (row >= 0 && row < boardSize && col >= 0 && col < boardSize) {
        return { row, col };
    }
    return null;
}

function drawStone(row, col, color) {
    const x = margin + col * cellSize;
    const y = margin + row * cellSize;
    
    // Draw stone shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.arc(x + 2, y + 2, 12, 0, 2 * Math.PI);
    ctx.fill();
    
    // Draw stone
    ctx.fillStyle = color === 'black' ? '#2c2c2c' : '#f5f5f5';
    ctx.beginPath();
    ctx.arc(x, y, 12, 0, 2 * Math.PI);
    ctx.fill();
    
    // Draw stone border
    ctx.strokeStyle = color === 'black' ? '#000000' : '#cccccc';
    ctx.lineWidth = 1;
    ctx.stroke();
}

function redrawBoard() {
    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw the board background
    ctx.fillStyle = '#deb887';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw the grid
    ctx.strokeStyle = '#8b4513';
    ctx.lineWidth = 1;
    
    // Draw vertical lines
    for (let col = 0; col < boardSize; col++) {
        const x = margin + col * cellSize;
        ctx.beginPath();
        ctx.moveTo(x, margin);
        ctx.lineTo(x, margin + (boardSize - 1) * cellSize);
        ctx.stroke();
    }

    // Draw horizontal lines
    for (let row = 0; row < boardSize; row++) {
        const y = margin + row * cellSize;
        ctx.beginPath();
        ctx.moveTo(margin, y);
        ctx.lineTo(margin + (boardSize - 1) * cellSize, y);
        ctx.stroke();
    }

    // Draw the star points
    ctx.fillStyle = '#8b4513';
    const starPoints = [
        [3, 3], [3, 9], [3, 15],
        [9, 3], [9, 9], [9, 15],
        [15, 3], [15, 9], [15, 15]
    ];

    starPoints.forEach(([row, col]) => {
        const x = margin + col * cellSize;
        const y = margin + row * cellSize;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, 2 * Math.PI);
        ctx.fill();
    });

    // Draw the stones
    for (let row = 0; row < boardSize; row++) {
        for (let col = 0; col < boardSize; col++) {
            if (board[row][col] !== null) {
                drawStone(row, col, board[row][col]);
            }
        }
    }
}

function updateStatus() {
    if (gameOver) {
        if (winner) {
            statusText.textContent = `${winner.toUpperCase()} WINS!`;
        } else {
            statusText.textContent = "It's a draw!";
        }
    } else {
        statusText.textContent = `${currentPlayer.toUpperCase()}'s turn`;
    }
}

function resetGame() {
    gameOver = false;
    winner = null;
    currentPlayer = 'black';
    initializeBoard();
    redrawBoard();
    updateStatus();
}

document.getElementById('resetButton').addEventListener('click', resetGame);

//connect to the server
const socket = io();

//listen for the event
socket.on("eventName", (data) => {
    console.log("Server says: ", data.message);
});

//send the event to the server
socket.emit("eventName", { myData: "Hello from client" });
