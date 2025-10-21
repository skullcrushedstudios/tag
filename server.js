```javascript
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");

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
      playerSize: 30,
      taggerz: new Map(),
    };
    this.gameTimer = null;
    this.tagCooldown = false;
    this.cooldownTime = 2000;
    this.qteActive = false;
    this.qteData = null;
    this.fightBackChance = 0.3;
    this.powerUps = [];
    this.powerUpSpawnInterval = null;
    this.powerUpTypes = ['speed', 'freeze', 'shield'];
    this.powerUpDuration = 5000;
    this.powerUpSpawnRate = 10000;
    this.maxPowerUps = 2;
  }

  addPlayer(socketId, playerData) {
    const playerCount = this.players.size;
    const player = {
      taggerz: this.gameState.taggerz.get(socketId) || 0,
      id: socketId,
      name: playerData.name || `Player ${playerCount + 1}`,
      x: playerCount === 0 ? this.gameState.gameWidth / 4 : (this.gameState.gameWidth * 3) / 4,
      y: this.gameState.gameHeight / 2,
      isIt: playerCount === 1,
      color: playerCount === 0 ? "#3498db" : "#27ae60",
      keys: {},
      speedBoost: false,
      shielded: false,
      frozen: false,
      purchased: [],
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
    this.startPowerUpSpawner();

    this.gameTimer = setInterval(() => {
      this.gameState.timeLeft--;
      if (this.gameState.timeLeft <= 0) {
        this.endGame();
      }
      io.to(this.roomId).emit("gameUpdate", this.getGameState());
    }, 1000);

    return true;
  }

  stopGame() {
    if (this.gameTimer) {
      clearInterval(this.gameTimer);
      this.gameTimer = null;
      this.stopPowerUpSpawner();
    }
    this.gameState.isRunning = false;
  }

  endGame() {
    this.stopGame();
    const winner = this.getWinner();
    io.to(this.roomId).emit("gameEnd", {
      winner: winner,
      taggerz: Array.from(this.players).map(([id, player]) => ({
        id, name: player.name, taggerz: player.taggerz, purchased: player.purchased,
      })),
      tagCount: this.gameState.tagCount,
    });
  }

  getWinner() {
    for (const [id, player] of this.players) {
      if (!player.isIt) {
        player.taggerz += 10;
        this.gameState.taggerz.set(id, (this.gameState.taggerz.get(id) || 0) + 10);
        io.to(this.roomId).emit("taggerzUpdate", {
          playerId: id, taggerz: player.taggerz });
        return player.name;
      }
    }
    return null;
  }

  updatePlayerPosition(socketId, position) {
    const player = this.players.get(socketId);
    if (player && !player.frozen) {
      player.x = Math.max(
        this.gameState.playerSize / 2,
        Math.min(
          this.gameState.gameWidth - this.gameState.playerSize / 2,
          position.x
        )
      );
      player.y = Math.max(
        this.gameState.playerSize / 2,
        Math.min(
          this.gameState.gameHeight - this.gameState.playerSize / 2,
          position.y
        )
      );

      if (this.gameState.isRunning) {
        this.checkPowerUpCollection(socketId);
        this.checkTagging();
      }
    }
  }

  checkTagging() {
    if (this.tagCooldown || this.players.size < 2 || this.qteActive) return;

    const playerArray = Array.from(this.players.values());
    const player1 = playerArray[0];
    const player2 = playerArray[1];

    const hitboxSize = this.gameState.playerSize * 0.9;
    const tolerance = 5;

    const halfSize = hitboxSize / 2;
    const p1Left = player1.x - halfSize;
    const p1Right = player1.x + halfSize;
    const p1Top = player1.y - halfSize;
    const p1Bottom = player1.y + halfSize;

    const p2Left = player2.x - halfSize;
    const p2Right = player2.x + halfSize;
    const p2Top = player2.y - halfSize;
    const p2Bottom = player2.y + halfSize;

    const colliding =
      p1Left - tolerance <= p2Right + tolerance &&
      p1Right + tolerance >= p2Left - tolerance &&
      p1Top - tolerance <= p2Bottom + tolerance &&
      p1Bottom + tolerance >= p2Top - tolerance;

    if (colliding) {
      if (Math.random() < this.fightBackChance) {
        this.startQTE(playerArray);
      } else {
        this.handleTag();
      }
    }
  }

  handleTag() {
    const playerArray = Array.from(this.players.values());
    const tagger = playerArray.find(p => p.isIt);
    const target = playerArray.find(p => !p.isIt);

    if (target.shielded) {
      io.to(this.roomId).emit('tagBlocked', { playerId: target.id });
      return;
    }

    for (const [id, player] of this.players) {
      player.isIt = !player.isIt;
    }

    this.gameState.tagCount++;
    this.tagCooldown = true;

    setTimeout(() => {
      this.tagCooldown = false;
    }, this.cooldownTime);

    io.to(this.roomId).emit("playerTagged", {
      tagCount: this.gameState.tagCount,
    });
  }

  spawnPowerUp() {
    if (this.powerUps.length >= this.maxPowerUps || !this.gameState.isRunning) return;

    const type = this.powerUpTypes[Math.floor(Math.random() * this.powerUpTypes.length)];
    const powerUp = {
      id: Date.now() + Math.random(),
      type,
      x: Math.random() * (this.gameState.gameWidth - 40) + 20,
      y: Math.random() * (this.gameState.gameHeight - 40) + 20,
      size: 20,
      collected: false,
    };

    let tooClose = true;
    while (tooClose) {
      tooClose = false;
      for (const player of this.players.values()) {
        const dx = powerUp.x - player.x;
        const dy = powerUp.y - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 100) {
          powerUp.x = Math.random() * (this.gameState.gameWidth - 40) + 20;
          powerUp.y = Math.random() * (this.gameState.gameHeight - 40) + 20;
          tooClose = true;
          break;
        }
      }
    }

    this.powerUps.push(powerUp);

    setTimeout(() => {
      const index = this.powerUps.findIndex(p => p.id === powerUp.id);
      if (index !== -1 && !this.powerUps[index].collected) {
        this.powerUps.splice(index, 1);
        io.to(this.roomId).emit('powerUpRemoved', powerUp.id);
      }
    }, 10000);

    io.to(this.roomId).emit('powerUpSpawned', powerUp);
  }

  startPowerUpSpawner() {
    this.powerUpSpawnInterval = setInterval(() => this.spawnPowerUp(), this.powerUpSpawnRate);
  }

  stopPowerUpSpawner() {
    if (this.powerUpSpawnInterval) {
      clearInterval(this.powerUpSpawnInterval);
      this.powerUpSpawnInterval = null;
    }
    this.powerUps = [];
  }

  checkPowerUpCollection(socketId) {
    const player = this.players.get(socketId);
    if (!player) return;

    for (let i = this.powerUps.length - 1; i >= 0; i--) {
      const powerUp = this.powerUps[i];
      if (powerUp.collected) continue;

      const halfPlayer = this.gameState.playerSize / 2;
      const halfPowerUp = powerUp.size / 2;
      const tolerance = 5;

      if (
        player.x - halfPlayer - tolerance < powerUp.x + halfPowerUp + tolerance &&
        player.x + halfPlayer + tolerance > powerUp.x - halfPowerUp - tolerance &&
        player.y - halfPlayer - tolerance < powerUp.y + halfPowerUp + tolerance &&
        player.y + halfPlayer + tolerance > powerUp.y - halfPowerUp - tolerance
      ) {
        powerUp.collected = true;
        this.powerUps.splice(i, 1);
        this.applyPowerUp(player, powerUp.type);
        io.to(this.roomId).emit('powerUpCollected', { id: powerUp.id, playerId: socketId, type: powerUp.type });
      }
    }
  }

  applyPowerUp(player, type) {
    const boost = player.purchased?.includes('powerup-boost') ? 2000 : 0;
    switch (type) {
      case 'speed':
        player.speedBoost = true;
        setTimeout(() => { player.speedBoost = false; }, this.powerUpDuration + boost);
        break;
      case 'freeze':
        const opponent = Array.from(this.players.values()).find(p => p.id !== player.id);
        if (opponent) {
          opponent.frozen = true;
          setTimeout(() => { opponent.frozen = false; }, 3000 + boost);
        }
        break;
      case 'shield':
        player.shielded = true;
        setTimeout(() => { player.shielded = false; }, this.powerUpDuration + boost);
        break;
    }
  }

  startQTE(playerArray) {
    // ... (existing QTE logic) ...
  }

  handleQTEInput(socketId, key) {
    // ... (existing QTE logic) ...
  }

  getGameState() {
    return {
      ...this.gameState,
      players: Array.from(this.players.values()),
      powerUps: this.powerUps,
    };
  }
}

function getItemCost(item) {
  switch (item) {
    case "color-purple":
    case "color-gold":
      return 50;
    case "powerup-boost":
      return 100;
    default:
      return Infinity;
  }
}

io.on("connection", (socket) => {
  console.log(`Player connected: ${socket.id}`);

  socket.on("joinRoom", (data) => {
    const { roomId, playerName } = data;

    const rooms = Array.from(socket.rooms);
    rooms.forEach((room) => {
      if (room !== socket.id) {
        socket.leave(room);
      }
    });

    socket.join(roomId);
    players.set(socket.id, { roomId, name: playerName });

    if (!games.has(roomId)) {
      games.set(roomId, new Game(roomId));
    }

    const game = games.get(roomId);
    const player = game.addPlayer(socket.id, { name: playerName });

    socket.emit("roomJoined", {
      playerId: socket.id,
      player: player,
      gameState: game.getGameState(),
    });

    io.to(roomId).emit("playerJoined", {
      player: player,
      gameState: game.getGameState(),
    });

    console.log(`Player ${playerName} joined room ${roomId}`);
  });

  socket.on("startGame", () => {
    const playerData = players.get(socket.id);
    if (playerData) {
      const game = games.get(playerData.roomId);
      if (game && game.startGame()) {
        io.to(playerData.roomId).emit("taggerzUpdate", {
          playerId: socket.id, taggerz: game.players.get(socket.id).taggerz
        });
        io.to(playerData.roomId).emit("gameStarted", game.getGameState());
      }
    }
  });

  socket.on("playerMove", (position) => {
    const playerData = players.get(socket.id);
    if (playerData) {
      const game = games.get(playerData.roomId);
      if (game) {
        game.updatePlayerPosition(socket.id, position);
        socket.to(playerData.roomId).emit("playerMoved", {
          playerId: socket.id,
          position: position,
        });
      }
    }
  });

  socket.on("restartGame", () => {
    const playerData = players.get(socket.id);
    if (playerData) {
      const game = games.get(playerData.roomId);
      if (game) {
        game.stopGame();
        const playerArray = Array.from(game.players.values());
        playerArray.forEach((player, index) => {
          player.purchased = player.purchased || [];
          player.x =
            index === 0
              ? game.gameState.gameWidth / 4
              : (game.gameState.gameWidth * 3) / 4;
          player.y = game.gameState.gameHeight / 2;
          player.isIt = index === 1;
          player.slowed = false;
        });
        game.gameState.taggerz.clear();
        game.gameState.tagCount = 0;
        game.tagCooldown = false;
        game.qteActive = false;
        game.qteData = null;

        io.to(playerData.roomId).emit("gameRestart", game.getGameState());
      }
    }
  });

  socket.on("qteInput", (data) => {
    const playerData = players.get(socket.id);
    if (playerData) {
      const game = games.get(playerData.roomId);
      if (game) {
        game.handleQTEInput(socket.id, data.key);
      }
    }
  });

  socket.on("purchaseItem", ({ item }) => {
    const playerData = players.get(socket.id);
    if (!playerData) return;

    const game = games.get(playerData.roomId);
    if (!game) return;

    const player = game.players.get(socket.id);
    if (!player) return;

    const cost = getItemCost(item);
    if (player.taggerz < cost) {
      socket.emit("purchaseResult", { success: false, item, error: "Not enough Taggerz" });
      return;
    }

    if (player.purchased.includes(item)) {
      socket.emit("purchaseResult", { success: false, item, error: "Item already purchased" });
      return;
    }

    player.taggerz -= cost;
    player.purchased.push(item);
    game.gameState.taggerz.set(socket.id, player.taggerz);

    socket.emit("purchaseResult", { success: true, item, taggerz: player.taggerz });
    io.to(playerData.roomId).emit("playerUpdate", {
      playerId: socket.id,
      taggerz: player.taggerz,
      purchased: player.purchased,
    });
  });

  socket.on("disconnect", () => {
    console.log(`Player disconnected: ${socket.id}`);

    const playerData = players.get(socket.id);
    if (playerData) {
      const game = games.get(playerData.roomId);
      if (game) {
        game.removePlayer(socket.id);

        if (game.players.size === 0) {
          games.delete(playerData.roomId);
        } else {
          io.to(playerData.roomId).emit("playerLeft", {
            playerId: socket.id,
            gameState: game.getGameState(),
          });
        }
      }
      players.delete(socket.id);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Multiplayer Tag Game server running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT} to play!`);
});
```
