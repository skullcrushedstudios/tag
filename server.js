const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname)));

// Game state
const games = new Map();
const players = new Map();

class Game {
    constructor(roomId) {
        this.roomId = roomId;
        this.players = new Map();
        this.gameState = {
            isRunning: false,
            timeLeft: 60,
            tagCount: 0,
            gameWidth: 500,
            gameHeight: 400,
            playerSize: 30
        };
        this.gameTimer = null;
        this.tagCooldown = false;
        this.cooldownTime = 2000;
        this.qteActive = false;
        this.qteData = null;
        this.fightBackChance = 0.3; // 30% chance for QTE to trigger
    }

    addPlayer(socketId, playerData) {
        const playerCount = this.players.size;
        const player = {
            id: socketId,
            name: playerData.name || `Player ${playerCount + 1}`,
            x: playerCount === 0 ? this.gameState.gameWidth / 4 : (this.gameState.gameWidth * 3) / 4,
            y: this.gameState.gameHeight / 2,
            isIt: playerCount === 1, // Second player starts as "it"
            color: playerCount === 0 ? '#3498db' : '#27ae60',
            keys: {}
        };
        this.players.set(socketId, player);
        return player;
    }

    removePlayer(socketId) {
        this.players.delete(socketId);
        if (this.players.size === 0) {
            this.stopGame();
        }
    }

    startGame() {
        if (this.players.size < 2) return false;
        
        this.gameState.isRunning = true;
        this.gameState.timeLeft = 60;
        this.gameState.tagCount = 0;
        
        this.gameTimer = setInterval(() => {
            this.gameState.timeLeft--;
            if (this.gameState.timeLeft <= 0) {
                this.endGame();
            }
            io.to(this.roomId).emit('gameUpdate', this.getGameState());
        }, 1000);

        return true;
    }

    stopGame() {
        if (this.gameTimer) {
            clearInterval(this.gameTimer);
            this.gameTimer = null;
        }
        this.gameState.isRunning = false;
    }

    endGame() {
        this.stopGame();
        const winner = this.getWinner();
        io.to(this.roomId).emit('gameEnd', {
            winner: winner,
            tagCount: this.gameState.tagCount
        });
    }

    getWinner() {
        for (const [id, player] of this.players) {
            if (!player.isIt) {
                return player.name;
            }
        }
        return null;
    }

    updatePlayerPosition(socketId, position) {
        const player = this.players.get(socketId);
        if (player) {
            player.x = Math.max(this.gameState.playerSize / 2, 
                       Math.min(this.gameState.gameWidth - this.gameState.playerSize / 2, position.x));
            player.y = Math.max(this.gameState.playerSize / 2, 
                       Math.min(this.gameState.gameHeight - this.gameState.playerSize / 2, position.y));
            
            if (this.gameState.isRunning) {
                this.checkTagging();
            }
        }
    }

    checkTagging() {
        if (this.tagCooldown || this.players.size < 2 || this.qteActive) return;

        const playerArray = Array.from(this.players.values());
        const player1 = playerArray[0];
        const player2 = playerArray[1];

        const distance = Math.sqrt(
            Math.pow(player1.x - player2.x, 2) + 
            Math.pow(player1.y - player2.y, 2)
        );

        if (distance < this.gameState.playerSize) {
            // Check if QTE should trigger
            if (Math.random() < this.fightBackChance) {
                this.startQTE(playerArray);
            } else {
                this.handleTag();
            }
        }
    }

    handleTag() {
        // Switch who is "it"
        for (const [id, player] of this.players) {
            player.isIt = !player.isIt;
        }

        this.gameState.tagCount++;
        this.tagCooldown = true;

        setTimeout(() => {
            this.tagCooldown = false;
        }, this.cooldownTime);

        // Emit tag event
        io.to(this.roomId).emit('playerTagged', {
            tagCount: this.gameState.tagCount,
            players: Array.from(this.players.values())
        });
    }
    
    startQTE(playerArray) {
        this.qteActive = true;
        const qteKeys = ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'];
        const selectedKeys = [];
        
        // Select 5 random keys for the QTE
        for (let i = 0; i < 5; i++) {
            const randomKey = qteKeys[Math.floor(Math.random() * qteKeys.length)];
            selectedKeys.push(randomKey);
        }
        
        this.qteData = {
            keys: selectedKeys,
            playerInputs: new Map(),
            startTime: Date.now(),
            duration: 3000, // 3 seconds
            players: playerArray.map(p => ({ id: p.id, name: p.name }))
        };
        
        // Initialize player inputs
        playerArray.forEach(player => {
            this.qteData.playerInputs.set(player.id, {
                keysPressed: 0,
                completed: false
            });
        });
        
        // Emit QTE start to all players
        io.to(this.roomId).emit('qteStart', {
            keys: selectedKeys,
            duration: 3000,
            players: this.qteData.players
        });
        
        // Auto-end QTE after duration
        setTimeout(() => {
            if (this.qteActive) {
                this.endQTE();
            }
        }, 3000);
    }
    
    handleQTEInput(playerId, key) {
        if (!this.qteActive || !this.qteData) return;
        
        const playerInput = this.qteData.playerInputs.get(playerId);
        if (!playerInput || playerInput.completed) return;
        
        // Check if this is the correct next key
        const expectedKey = this.qteData.keys[playerInput.keysPressed];
        if (key === expectedKey) {
            playerInput.keysPressed++;
            
            // Emit progress update
            io.to(this.roomId).emit('qteProgress', {
                playerId: playerId,
                keysPressed: playerInput.keysPressed,
                totalKeys: this.qteData.keys.length
            });
            
            // Check if player completed all keys
            if (playerInput.keysPressed >= this.qteData.keys.length) {
                playerInput.completed = true;
                this.endQTE();
            }
        }
    }
    
    endQTE() {
        if (!this.qteActive || !this.qteData) return;
        
        this.qteActive = false;
        
        // Calculate results
        let winner = null;
        let loser = null;
        let maxKeys = -1;
        let minKeys = Infinity;
        
        for (const [playerId, input] of this.qteData.playerInputs) {
            if (input.keysPressed > maxKeys) {
                maxKeys = input.keysPressed;
                winner = playerId;
            }
            if (input.keysPressed < minKeys) {
                minKeys = input.keysPressed;
                loser = playerId;
            }
        }
        
        // Apply effects based on QTE results
        const playerArray = Array.from(this.players.values());
        const loserPlayer = this.players.get(loser);
        const winnerPlayer = this.players.get(winner);
        
        if (loserPlayer && winnerPlayer) {
            // The loser becomes "it" or stays "it"
            for (const [id, player] of this.players) {
                player.isIt = (id === loser);
            }
            
            // Apply pushback to loser
            const pushDistance = 80;
            const angle = Math.atan2(
                loserPlayer.y - winnerPlayer.y,
                loserPlayer.x - winnerPlayer.x
            );
            
            const newX = Math.max(this.gameState.playerSize / 2,
                        Math.min(this.gameState.gameWidth - this.gameState.playerSize / 2,
                        loserPlayer.x + Math.cos(angle) * pushDistance));
            const newY = Math.max(this.gameState.playerSize / 2,
                        Math.min(this.gameState.gameHeight - this.gameState.playerSize / 2,
                        loserPlayer.y + Math.sin(angle) * pushDistance));
            
            loserPlayer.x = newX;
            loserPlayer.y = newY;
            loserPlayer.slowed = true;
            
            // Remove slow effect after 3 seconds
            setTimeout(() => {
                if (loserPlayer) {
                    loserPlayer.slowed = false;
                }
            }, 3000);
            
            this.gameState.tagCount++;
        }
        
        // Emit QTE results
        io.to(this.roomId).emit('qteEnd', {
            winner: winnerPlayer ? winnerPlayer.name : null,
            loser: loserPlayer ? loserPlayer.name : null,
            winnerKeys: maxKeys,
            loserKeys: minKeys,
            players: Array.from(this.players.values()),
            tagCount: this.gameState.tagCount
        });
        
        // Set normal tag cooldown
        this.tagCooldown = true;
        setTimeout(() => {
            this.tagCooldown = false;
        }, this.cooldownTime);
        
        this.qteData = null;
    }

    getGameState() {
        return {
            ...this.gameState,
            players: Array.from(this.players.values())
        };
    }
}

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    socket.on('joinRoom', (data) => {
        const { roomId, playerName } = data;
        
        // Leave any existing rooms
        const rooms = Array.from(socket.rooms);
        rooms.forEach(room => {
            if (room !== socket.id) {
                socket.leave(room);
            }
        });

        // Join new room
        socket.join(roomId);
        players.set(socket.id, { roomId, name: playerName });

        // Create or get game
        if (!games.has(roomId)) {
            games.set(roomId, new Game(roomId));
        }

        const game = games.get(roomId);
        const player = game.addPlayer(socket.id, { name: playerName });

        // Emit room joined
        socket.emit('roomJoined', {
            playerId: socket.id,
            player: player,
            gameState: game.getGameState()
        });

        // Emit to all players in room with complete game state
        io.to(roomId).emit('playerJoined', {
            player: player,
            gameState: game.getGameState(),
            allPlayers: Array.from(game.players.values())
        });

        console.log(`Player ${playerName} joined room ${roomId}`);
    });

    socket.on('startGame', () => {
        const playerData = players.get(socket.id);
        if (playerData) {
            const game = games.get(playerData.roomId);
            if (game && game.startGame()) {
                io.to(playerData.roomId).emit('gameStarted', game.getGameState());
            }
        }
    });

    socket.on('playerMove', (position) => {
        const playerData = players.get(socket.id);
        if (playerData) {
            const game = games.get(playerData.roomId);
            if (game) {
                game.updatePlayerPosition(socket.id, position);
                
                // Broadcast updated positions to ALL players in room (including sender)
                io.to(playerData.roomId).emit('playerMoved', {
                    playerId: socket.id,
                    position: position,
                    allPlayers: Array.from(game.players.values())
                });
            }
        }
    });

    socket.on('restartGame', () => {
        const playerData = players.get(socket.id);
        if (playerData) {
            const game = games.get(playerData.roomId);
            if (game) {
                game.stopGame();
                // Reset player positions and states
                const playerArray = Array.from(game.players.values());
                playerArray.forEach((player, index) => {
                    player.x = index === 0 ? game.gameState.gameWidth / 4 : (game.gameState.gameWidth * 3) / 4;
                    player.y = game.gameState.gameHeight / 2;
                    player.isIt = index === 1;
                    player.slowed = false; // Reset slow effect
                });
                
                game.gameState.tagCount = 0;
                game.tagCooldown = false;
                game.qteActive = false; // Reset QTE state
                game.qteData = null;
                
                io.to(playerData.roomId).emit('gameRestart', game.getGameState());
            }
        }
    });
    
    socket.on('qteInput', (data) => {
        const playerData = players.get(socket.id);
        if (playerData) {
            const game = games.get(playerData.roomId);
            if (game) {
                game.handleQTEInput(socket.id, data.key);
            }
        }
    });

    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        
        const playerData = players.get(socket.id);
        if (playerData) {
            const game = games.get(playerData.roomId);
            if (game) {
                game.removePlayer(socket.id);
                
                // If no players left, clean up the game
                if (game.players.size === 0) {
                    games.delete(playerData.roomId);
                } else {
                    // Notify remaining players
                    io.to(playerData.roomId).emit('playerLeft', {
                        playerId: socket.id,
                        gameState: game.getGameState()
                    });
                }
            }
            players.delete(socket.id);
        }
    });
});

// Start server
server.listen(PORT, () => {
    console.log(`Multiplayer Tag Game server running on port ${PORT}`);
    console.log(`Visit http://localhost:${PORT} to play!`);
});