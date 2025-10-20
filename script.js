class TagGame {
    constructor() {
        this.gameArea = document.getElementById('gameArea');
        this.player = document.getElementById('player');
        this.target = document.getElementById('target');
        this.scoreElement = document.getElementById('score');
        this.timerElement = document.getElementById('timer');
        this.startBtn = document.getElementById('startBtn');
        this.restartBtn = document.getElementById('restartBtn');
        
        this.gameWidth = 500;
        this.gameHeight = 400;
        this.playerSize = 30;
        this.targetSize = 25;
        this.moveSpeed = 5;
        
        this.score = 0;
        this.timeLeft = 60;
        this.gameRunning = false;
        this.gameTimer = null;
        
        this.playerPos = {
            x: this.gameWidth / 2,
            y: this.gameHeight / 2
        };
        
        this.targetPos = {
            x: 0,
            y: 0
        };
        
        this.keys = {};
        
        this.init();
    }
    
    init() {
        this.startBtn.addEventListener('click', () => this.startGame());
        this.restartBtn.addEventListener('click', () => this.restartGame());
        
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));
        
        this.spawnTarget();
        this.updateDisplay();
    }
    
    startGame() {
        this.gameRunning = true;
        this.startBtn.style.display = 'none';
        this.restartBtn.style.display = 'inline-block';
        
        this.gameTimer = setInterval(() => {
            this.timeLeft--;
            this.timerElement.textContent = this.timeLeft;
            
            if (this.timeLeft <= 0) {
                this.endGame();
            }
        }, 1000);
        
        this.gameLoop();
    }
    
    gameLoop() {
        if (!this.gameRunning) return;
        
        this.handleMovement();
        this.checkCollision();
        this.updateDisplay();
        
        requestAnimationFrame(() => this.gameLoop());
    }
    
    handleKeyDown(e) {
        this.keys[e.key.toLowerCase()] = true;
        
        // Prevent arrow key scrolling
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            e.preventDefault();
        }
    }
    
    handleKeyUp(e) {
        this.keys[e.key.toLowerCase()] = false;
    }
    
    handleMovement() {
        let newX = this.playerPos.x;
        let newY = this.playerPos.y;
        
        // WASD or Arrow keys
        if (this.keys['w'] || this.keys['arrowup']) {
            newY = Math.max(this.playerSize / 2, newY - this.moveSpeed);
        }
        if (this.keys['s'] || this.keys['arrowdown']) {
            newY = Math.min(this.gameHeight - this.playerSize / 2, newY + this.moveSpeed);
        }
        if (this.keys['a'] || this.keys['arrowleft']) {
            newX = Math.max(this.playerSize / 2, newX - this.moveSpeed);
        }
        if (this.keys['d'] || this.keys['arrowright']) {
            newX = Math.min(this.gameWidth - this.playerSize / 2, newX + this.moveSpeed);
        }
        
        this.playerPos.x = newX;
        this.playerPos.y = newY;
    }
    
    checkCollision() {
        const playerCenterX = this.playerPos.x;
        const playerCenterY = this.playerPos.y;
        const targetCenterX = this.targetPos.x + this.targetSize / 2;
        const targetCenterY = this.targetPos.y + this.targetSize / 2;
        
        const distance = Math.sqrt(
            Math.pow(playerCenterX - targetCenterX, 2) + 
            Math.pow(playerCenterY - targetCenterY, 2)
        );
        
        const collisionDistance = (this.playerSize + this.targetSize) / 2;
        
        if (distance < collisionDistance) {
            this.score++;
            this.scoreElement.textContent = this.score;
            this.spawnTarget();
            
            // Add some visual feedback
            this.target.style.transform = 'scale(1.2)';
            setTimeout(() => {
                this.target.style.transform = 'scale(1)';
            }, 150);
        }
    }
    
    spawnTarget() {
        const margin = this.targetSize / 2;
        this.targetPos.x = Math.random() * (this.gameWidth - this.targetSize);
        this.targetPos.y = Math.random() * (this.gameHeight - this.targetSize);
        
        // Ensure target doesn't spawn too close to player
        const minDistance = 100;
        const distance = Math.sqrt(
            Math.pow(this.playerPos.x - (this.targetPos.x + this.targetSize / 2), 2) + 
            Math.pow(this.playerPos.y - (this.targetPos.y + this.targetSize / 2), 2)
        );
        
        if (distance < minDistance) {
            this.spawnTarget(); // Try again
            return;
        }
    }
    
    updateDisplay() {
        this.player.style.left = (this.playerPos.x - this.playerSize / 2) + 'px';
        this.player.style.top = (this.playerPos.y - this.playerSize / 2) + 'px';
        
        this.target.style.left = this.targetPos.x + 'px';
        this.target.style.top = this.targetPos.y + 'px';
    }
    
    endGame() {
        this.gameRunning = false;
        clearInterval(this.gameTimer);
        
        // Create game over overlay
        const gameOverDiv = document.createElement('div');
        gameOverDiv.className = 'game-over';
        gameOverDiv.innerHTML = `
            <h2>Game Over!</h2>
            <p>Final Score: ${this.score}</p>
            <p>Targets Caught: ${this.score}</p>
            <button onclick="game.restartGame(); this.parentElement.remove();">Play Again</button>
        `;
        
        this.gameArea.appendChild(gameOverDiv);
    }
    
    restartGame() {
        // Remove any existing game over overlay
        const gameOverDiv = this.gameArea.querySelector('.game-over');
        if (gameOverDiv) {
            gameOverDiv.remove();
        }
        
        this.gameRunning = false;
        clearInterval(this.gameTimer);
        
        // Reset game state
        this.score = 0;
        this.timeLeft = 60;
        this.playerPos = {
            x: this.gameWidth / 2,
            y: this.gameHeight / 2
        };
        
        // Reset display
        this.scoreElement.textContent = this.score;
        this.timerElement.textContent = this.timeLeft;
        this.startBtn.style.display = 'inline-block';
        this.restartBtn.style.display = 'none';
        
        this.spawnTarget();
        this.updateDisplay();
    }
}

// Initialize game when page loads
let game;
document.addEventListener('DOMContentLoaded', () => {
    game = new TagGame();
});