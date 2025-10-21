```javascript
class MultiplayerTagGame {
  constructor() {
    this.socket = null;
    this.playerId = null;
    this.currentRoom = null;
    this.gameState = null;
    this.players = new Map();

    // Game settings
    this.gameWidth = 500;
    this.gameHeight = 400;
    this.playerSize = 30;
    this.moveSpeed = 5;

    // Player movement
    this.keys = {};
    this.lastMoveTime = 0;
    this.moveThrottle = 33; // ~30fps - reduced for less network traffic
    this.localPlayerPos = { x: 0, y: 0 }; // Local position for smooth movement
    this.lastSentPos = { x: 0, y: 0 }; // Track last sent position for delta compression
    this.remotePlayers = new Map(); // Store remote player positions for interpolation

    // DOM elements
    this.roomSelectionScreen = document.getElementById("roomSelection");
    this.gameScreen = document.getElementById("gameScreen");
    this.gameArea = document.getElementById("gameArea");
    this.connectionStatus = document.getElementById("connectionStatus");
    this.connectionIndicator = document.getElementById("connectionIndicator");
    this.currentRoomElement = document.getElementById("currentRoom");
    this.playersListElement = document.getElementById("playersList");
    this.timerElement = document.getElementById("timer");
    this.shopTaggerzElement = document.getElementById("shopTaggerz");
    this.taggerzElement = document.getElementById("taggerzCount");
    this.tagCountElement = document.getElementById("tagCount");

    // Buttons
    this.joinRoomBtn = document.getElementById("joinRoomBtn");
    this.startBtn = document.getElementById("startBtn");
    this.restartBtn = document.getElementById("restartBtn");
    this.leaveRoomBtn = document.getElementById("leaveRoomBtn");

    // Input fields
    this.playerNameInput = document.getElementById("playerName");
    this.roomIdInput = document.getElementById("roomId");

    // Login system
    this.isLoggedIn = false;
    this.currentUser = null;
    this.loginAttempts = 0;
    this.maxLoginAttempts = 3;
    this.users = new Map([
      ["admin", { password: "admin123", level: "admin" }],
      ["user", { password: "password", level: "user" }],
      ["test", { password: "test123", level: "user" }],
    ]);

    // Power-ups
    this.powerUps = new Map(); // Client-side map of power-ups by ID

    this.init();
  }

  init() {
    this.setupEventListeners();
    this.showStudioIntro();
    this.startParticleSystem();
    // Shop button
    document.getElementById("shopBtn")?.addEventListener("click", () => {
      if (!this.isLoggedIn) {
        alert("Please log in to access the shop!");
        this.showLoginScreen();
        return;
      }
      this.showShopScreen();
    });
    // Shop purchase buttons
    document.querySelectorAll(".shop-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        this.socket.emit("purchaseItem", { item: btn.dataset.item });
      });
    });
    // Back button
    document.querySelector(".back-btn")?.addEventListener("click", () => this.showMainMenu());
  }

  showShopScreen() {
    this.hideAllScreens();
    document.getElementById("shopScreen").style.display = "block";
    this.shopTaggerzElement.textContent = this.currentUser?.taggerz || 0;
    this.updateShopButtons();
  }

  updateShopButtons() {
    const buttons = document.querySelectorAll(".shop-btn");
    buttons.forEach(btn => {
      const item = btn.dataset.item;
      const cost = this.getItemCost(item);
      const purchased = this.currentUser?.purchased?.includes(item);
      btn.disabled = purchased || (this.currentUser?.taggerz || 0) < cost;
      btn.textContent = purchased ? "Owned" : "Buy";
    });
  }

  getItemCost(item) {
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

  selectOnlineMode() {
    if (!this.isLoggedIn) {
      alert("Please log in first to access online multiplayer!");
      this.showLoginScreen();
      return;
    }

    document.querySelector(".game-mode-selection").style.display = "none";
    document.getElementById("onlineForm").style.display = "flex";
    this.connectionStatus.textContent = `Logged in as: ${this.currentUser.username}`;
    this.connectionStatus.className = "connection-status connected";
    this.shouldConnect = true;
  }

  selectOfflineMode() {
    document.querySelector(".game-mode-selection").style.display = "none";
    document.getElementById("offlineForm").style.display = "flex";
    this.connectionStatus.textContent = "Local offline mode selected";
    this.connectionStatus.className = "connection-status connected";
  }

  showMainMenu() {
    this.hideAllScreens();
    document.getElementById("mainMenu").style.display = "block";

    document.querySelector(".game-mode-selection").style.display = "flex";
    document.getElementById("onlineForm").style.display = "none";
    document.getElementById("offlineForm").style.display = "none";

    this.shouldConnect = false;

    this.updateUserStatus();

    if (this.isLoggedIn && this.currentUser) {
      this.shopTaggerzElement.textContent = this.currentUser.taggerz || 0;
      this.updateTaggerzDisplay(this.currentUser.taggerz || 0);
    }

    if (this.socket && this.socket.connected) {
      document.getElementById("playersOnline").textContent = "🔗";
    } else {
      document.getElementById("playersOnline").textContent = "0";
    }
  }

  updateUserStatus() {
    const statusText = document.getElementById("statusText");
    const statusBtn = document.getElementById("statusBtn");

    if (this.isLoggedIn) {
      statusText.textContent = `Welcome, ${this.currentUser.username}!`;
      statusBtn.textContent = "LOGOUT";
      statusBtn.className = "status-btn logout";
    } else {
      statusText.textContent = "Not logged in";
      statusBtn.textContent = "LOGIN";
      statusBtn.className = "status-btn";
    }
  }

  updateTaggerzDisplay(taggerz) {
    if (this.taggerzElement) {
      this.taggerzElement.textContent = taggerz;
    }
  }

  renderPowerUps() {
    document.querySelectorAll('.power-up').forEach(el => el.remove());

    for (const powerUp of this.powerUps.values()) {
      const powerUpElement = document.createElement('div');
      powerUpElement.className = `power-up ${powerUp.type}`;
      powerUpElement.style.left = `${powerUp.x - powerUp.size / 2}px`;
      powerUpElement.style.top = `${powerUp.y - powerUp.size / 2}px`;
      powerUpElement.style.width = `${powerUp.size}px`;
      powerUpElement.style.height = `${powerUp.size}px`;
      powerUpElement.innerHTML = this.getPowerUpIcon(powerUp.type);
      this.gameArea.appendChild(powerUpElement);
    }
  }

  getPowerUpIcon(type) {
    switch (type) {
      case 'speed': return '⚡';
      case 'freeze': return '❄️';
      case 'shield': return '🛡️';
      default: return '?';
    }
  }

  handleMovement() {
    if (!this.localPlayer || !this.gameState) return;

    let dx = 0, dy = 0;
    if (this.keys['ArrowUp'] || this.keys['w']) dy -= this.moveSpeed;
    if (this.keys['ArrowDown'] || this.keys['s']) dy += this.moveSpeed;
    if (this.keys['ArrowLeft'] || this.keys['a']) dx -= this.moveSpeed;
    if (this.keys['ArrowRight'] || this.keys['d']) dx += this.moveSpeed;

    const speed = this.keys['Shift'] ? this.moveSpeed * 1.5 : this.moveSpeed;
    if (this.localPlayer.speedBoost) {
      dx *= 1.5;
      dy *= 1.5;
    }

    if (this.localPlayer.frozen) {
      dx = 0;
      dy = 0;
    }

    if (dx !== 0 || dy !== 0) {
      const now = Date.now();
      if (now - this.lastMoveTime < this.moveThrottle) return;

      this.lastMoveTime = now;
      this.localPlayerPos.x = Math.max(this.playerSize / 2, Math.min(this.gameWidth - this.playerSize / 2, this.localPlayerPos.x + dx));
      this.localPlayerPos.y = Math.max(this.playerSize / 2, Math.min(this.gameHeight - this.playerSize / 2, this.localPlayerPos.y + dy));

      if (Math.abs(this.localPlayerPos.x - this.lastSentPos.x) > 1 || Math.abs(this.localPlayerPos.y - this.lastSentPos.y) > 1) {
        this.socket.emit("playerMove", this.localPlayerPos);
        this.lastSentPos = { ...this.localPlayerPos };
      }

      const playerEl = document.getElementById(this.playerId);
      if (playerEl) {
        playerEl.style.left = `${this.localPlayerPos.x - this.playerSize / 2}px`;
        playerEl.style.top = `${this.localPlayerPos.y - this.playerSize / 2}px`;
      }
    }
  }

  updateGameState(state) {
    this.gameState = state;
    this.timerElement.textContent = state.timeLeft;
    this.tagCountElement.textContent = state.tagCount;
    this.shopTaggerzElement.textContent = this.currentUser?.taggerz || 0;

    const localPlayer = state.players.find(p => p.id === this.playerId);
    if (localPlayer) {
      this.updateTaggerzDisplay(localPlayer.taggerz);
    }

    this.players.clear();
    state.players.forEach(player => {
      let playerEl = document.getElementById(player.id);
      if (!playerEl) {
        playerEl = document.createElement("div");
        playerEl.id = player.id;
        playerEl.className = "player";
        playerEl.style.width = `${this.playerSize}px`;
        playerEl.style.height = `${this.playerSize}px`;
        playerEl.style.background = player.color;
        this.gameArea.appendChild(playerEl);
      }
      playerEl.style.left = `${player.x - this.playerSize / 2}px`;
      playerEl.style.top = `${player.y - this.playerSize / 2}px`;
      playerEl.classList.toggle("it", player.isIt);
      playerEl.classList.remove('color-purple', 'color-gold');
      if (player.purchased?.includes('color-purple')) playerEl.classList.add('color-purple');
      else if (player.purchased?.includes('color-gold')) playerEl.classList.add('color-gold');
      playerEl.classList.toggle('speed-boost', player.speedBoost);
      playerEl.classList.toggle('shielded', player.shielded);
      playerEl.classList.toggle('frozen', player.frozen);
      this.players.set(player.id, player);
    });

    this.powerUps.clear();
    state.powerUps.forEach(pu => this.powerUps.set(pu.id, pu));
    this.renderPowerUps();
  }

  setupEventListeners() {
    // ... (existing event listeners for joinRoomBtn, startBtn, etc.) ...
    this.socket = io();
    this.socket.on('connect', () => {
      this.connectionIndicator.style.color = 'green';
    });
    this.socket.on('disconnect', () => {
      this.connectionIndicator.style.color = 'red';
    });
    this.socket.on('roomJoined', ({ playerId, player, gameState }) => {
      this.playerId = playerId;
      this.currentUser.taggerz = player.taggerz;
      this.currentUser.purchased = player.purchased || [];
      this.updateTaggerzDisplay(player.taggerz);
      this.currentRoom = gameState.roomId;
      this.currentRoomElement.textContent = this.currentRoom;
      this.hideAllScreens();
      this.gameScreen.style.display = "block";
      this.localPlayer = player;
      this.localPlayerPos = { x: player.x, y: player.y };
      this.updateGameState(gameState);
    });
    this.socket.on('playerJoined', ({ player, gameState }) => {
      this.updateGameState(gameState);
      this.playersListElement.innerHTML = gameState.players.map(p => `<span style="color: ${p.color}">${p.name}${p.isIt ? ' (IT)' : ''}</span>`).join(', ');
    });
    this.socket.on('playerLeft', ({ playerId, gameState }) => {
      const playerEl = document.getElementById(playerId);
      if (playerEl) playerEl.remove();
      this.players.delete(playerId);
      this.updateGameState(gameState);
      this.playersListElement.innerHTML = gameState.players.map(p => `<span style="color: ${p.color}">${p.name}${p.isIt ? ' (IT)' : ''}</span>`).join(', ');
    });
    this.socket.on('gameStarted', (gameState) => {
      this.updateGameState(gameState);
      this.startBtn.style.display = "none";
      this.restartBtn.style.display = "block";
      document.getElementById("gameInstructions").style.display = "none";
    });
    this.socket.on('playerMoved', ({ playerId, position }) => {
      const player = this.players.get(playerId);
      if (player) {
        player.x = position.x;
        player.y = position.y;
        const playerEl = document.getElementById(playerId);
        if (playerEl) {
          playerEl.style.left = `${position.x - this.playerSize / 2}px`;
          playerEl.style.top = `${position.y - this.playerSize / 2}px`;
        }
      }
    });
    this.socket.on('playerTagged', ({ tagCount }) => {
      this.tagCountElement.textContent = tagCount;
    });
    this.socket.on('gameEnd', ({ winner, taggerz, tagCount }) => {
      this.updateGameState({ ...this.gameState, timeLeft: 0, tagCount });
      alert(`Game Over! Winner: ${winner}\nTags: ${tagCount}\nTaggerz: ${taggerz.find(p => p.id === this.playerId)?.taggerz || 0}`);
      this.startBtn.style.display = "none";
      this.restartBtn.style.display = "block";
    });
    this.socket.on('powerUpSpawned', (powerUp) => {
      this.powerUps.set(powerUp.id, powerUp);
      this.renderPowerUps();
    });
    this.socket.on('powerUpCollected', ({ id, playerId, type }) => {
      this.powerUps.delete(id);
      this.renderPowerUps();
      if (playerId === this.playerId) {
        alert(`You collected ${type}!`);
      }
    });
    this.socket.on('powerUpRemoved', (id) => {
      this.powerUps.delete(id);
      this.renderPowerUps();
    });
    this.socket.on('tagBlocked', ({ playerId }) => {
      if (playerId === this.playerId) {
        alert('Shield blocked the tag!');
      }
    });
    this.socket.on('taggerzUpdate', ({ playerId, taggerz }) => {
      if (playerId === this.playerId) {
        this.currentUser.taggerz = taggerz;
        this.updateTaggerzDisplay(taggerz);
        this.shopTaggerzElement.textContent = taggerz;
        this.updateShopButtons();
      }
    });
    this.socket.on('purchaseResult', ({ success, item, taggerz, error }) => {
      if (success) {
        this.currentUser.taggerz = taggerz;
        if (!this.currentUser.purchased) this.currentUser.purchased = [];
        this.currentUser.purchased.push(item);
        this.updateTaggerzDisplay(taggerz);
        this.shopTaggerzElement.textContent = taggerz;
        this.updateShopButtons();
        alert(`Purchased ${item}!`);
      } else {
        alert(`Purchase failed: ${error}`);
      }
    });
    this.socket.on('playerUpdate', ({ playerId, taggerz, purchased }) => {
      const player = this.players.get(playerId);
      if (player) {
        player.taggerz = taggerz;
        player.purchased = purchased;
        this.updateGameState(this.gameState);
      }
    });
    // ... (additional event listeners for QTE, admin panel, etc.) ...
  }

  hideAllScreens() {
    document.querySelectorAll('.screen').forEach(screen => screen.style.display = 'none');
  }

  showLoginScreen() {
    this.hideAllScreens();
    document.getElementById("loginScreen").style.display = "block";
  }

  // ... (rest of the methods like showStudioIntro, startParticleSystem, handleQTEInput, etc.) ...
}

// Initialize game when page loads
let game;
document.addEventListener("DOMContentLoaded", () => {
  game = new MultiplayerTagGame();
});
```
