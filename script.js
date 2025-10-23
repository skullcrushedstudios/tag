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
    // Login button
    document.getElementById("loginBtn")?.addEventListener("click", () => {
      const username = document.getElementById("username").value.trim();
      const password = document.getElementById("password").value;
      if (this.users.has(username) && this.users.get(username).password === password) {
        this.isLoggedIn = true;
        this.currentUser = { 
          username, 
          level: this.users.get(username).level 
        };
        // Load saved data from localStorage
        const savedData = localStorage.getItem(`playerData_${username}`);
        if (savedData) {
          const { taggerz, purchased } = JSON.parse(savedData);
          this.currentUser.taggerz = taggerz || 0;
          this.currentUser.purchased = purchased || [];
        } else {
          this.currentUser.taggerz = 0;
          this.currentUser.purchased = [];
        }
        this.showMainMenu();
      } else {
        this.loginAttempts++;
        alert(`Invalid credentials! ${this.maxLoginAttempts - this.loginAttempts} attempts left.`);
        if (this.loginAttempts >= this.maxLoginAttempts) {
          alert("Max login attempts reached!");
          document.getElementById("loginBtn").disabled = true;
        }
      }
    });
  }

  savePlayerData() {
    if (this.currentUser) {
      const data = {
        taggerz: this.currentUser.taggerz,
        purchased: this.currentUser.purchased || []
      };
      localStorage.setItem(`playerData_${this.currentUser.username}`, JSON.stringify(data));
    }
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
  }

  showLoginScreen() {
    this.hideAllScreens();
    document.getElementById("loginScreen").style.display = "block";
  }

  updateTaggerzDisplay(taggerz) {
    this.taggerzElement.textContent = taggerz;
    if (this.shopTaggerzElement) {
      this.shopTaggerzElement.textContent = taggerz;
    }
  }

  setupEventListeners() {
    // Socket.IO connection
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
      this.savePlayerData(); // Save on room join
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
        this.savePlayerData(); // Save on taggerz update
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
        this.savePlayerData(); // Save on purchase
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
  }

  hideAllScreens() {
    document.querySelectorAll('.screen').forEach(screen => screen.style.display = 'none');
  }

  showLoginScreen() {
    this.hideAllScreens();
    document.getElementById("loginScreen").style.display = "block";
  }

  updateGameState(gameState) {
    this.gameState = gameState;
    this.players.clear();
    gameState.players.forEach(p => this.players.set(p.id, p));
    this.timerElement.textContent = gameState.timeLeft;
    this.tagCountElement.textContent = gameState.tagCount;
  }

  renderPowerUps() {
    // Placeholder for rendering power-ups (implementation not shown in original)
  }

  showStudioIntro() {
    // Placeholder for studio intro animation
  }

  startParticleSystem() {
    // Placeholder for particle system
  }
}

// Initialize game when page loads
let game;
document.addEventListener("DOMContentLoaded", () => {
  game = new MultiplayerTagGame();
});
