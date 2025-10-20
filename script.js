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
        this.moveThrottle = 16; // ~60fps
        this.localPlayerPos = { x: 0, y: 0 }; // Local position for smooth movement
        
        // DOM elements
        this.roomSelectionScreen = document.getElementById('roomSelection');
        this.gameScreen = document.getElementById('gameScreen');
        this.gameArea = document.getElementById('gameArea');
        this.connectionStatus = document.getElementById('connectionStatus');
        this.connectionIndicator = document.getElementById('connectionIndicator');
        this.currentRoomElement = document.getElementById('currentRoom');
        this.playersListElement = document.getElementById('playersList');
        this.timerElement = document.getElementById('timer');
        this.tagCountElement = document.getElementById('tagCount');
        
        // Buttons
        this.joinRoomBtn = document.getElementById('joinRoomBtn');
        this.startBtn = document.getElementById('startBtn');
        this.restartBtn = document.getElementById('restartBtn');
        this.leaveRoomBtn = document.getElementById('leaveRoomBtn');
        
        // Input fields
        this.playerNameInput = document.getElementById('playerName');
        this.roomIdInput = document.getElementById('roomId');
        
        // Login system
        this.isLoggedIn = false;
        this.currentUser = null;
        this.loginAttempts = 0;
        this.maxLoginAttempts = 3;
        this.users = new Map([
            ['admin', { password: 'admin123', level: 'admin' }],
            ['user', { password: 'password', level: 'user' }],
            ['test', { password: 'test123', level: 'user' }]
        ]);
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.showStudioIntro();
        this.startParticleSystem();
    }
    selectOnlineMode() {
        // Check if user is logged in
        if (!this.isLoggedIn) {
            alert('Please log in first to access online multiplayer!');
            this.showLoginScreen();
            return;
        }
        
        document.querySelector('.game-mode-selection').style.display = 'none';
        document.getElementById('onlineForm').style.display = 'flex';
        this.connectionStatus.textContent = `Logged in as: ${this.currentUser.username}`;
        this.connectionStatus.className = 'connection-status connected';
        this.shouldConnect = true;
    }
    
    selectOfflineMode() {
        document.querySelector('.game-mode-selection').style.display = 'none';
        document.getElementById('offlineForm').style.display = 'flex';
        this.connectionStatus.textContent = 'Local offline mode selected';
        this.connectionStatus.className = 'connection-status connected';
    }
    
    showMainMenu() {
        this.hideAllScreens();
        document.getElementById('mainMenu').style.display = 'block';
        
        // Reset room selection state
        document.querySelector('.game-mode-selection').style.display = 'flex';
        document.getElementById('onlineForm').style.display = 'none';
        document.getElementById('offlineForm').style.display = 'none';
        
        // Reset connection state when returning to main menu
        this.shouldConnect = false;
        
        // Update user status display
        this.updateUserStatus();
        
        // Update online player count (if connected)
        if (this.socket && this.socket.connected) {
            // You could emit a request for player count here
            document.getElementById('playersOnline').textContent = '🔗';
        } else {
            document.getElementById('playersOnline').textContent = '0';
        }
    }
    
    updateUserStatus() {
        const statusText = document.getElementById('statusText');
        const statusBtn = document.getElementById('statusBtn');
        
        if (this.isLoggedIn) {
            statusText.textContent = `Welcome, ${this.currentUser.username}!`;
            statusBtn.textContent = 'LOGOUT';
            statusBtn.className = 'status-btn logout';
        } else {
            statusText.textContent = 'Not logged in';
            statusBtn.textContent = 'LOGIN';
            statusBtn.className = 'status-btn';
        }
    }
    
    handleStatusClick() {
        if (this.isLoggedIn) {
            this.logout();
        } else {
            this.showLoginScreen();
        }
    }
    
    showModeSelection() {
        this.hideAllScreens();
        document.getElementById('roomSelection').style.display = 'block';
        
        document.querySelector('.game-mode-selection').style.display = 'flex';
        document.getElementById('onlineForm').style.display = 'none';
        document.getElementById('offlineForm').style.display = 'none';
        
        // Reset connection state when returning to mode selection
        this.shouldConnect = false;
        
        this.connectionStatus.textContent = 'Choose a game mode to start';
        this.connectionStatus.className = 'connection-status';
    }
    
    showHowToPlay() {
        this.hideAllScreens();
        document.getElementById('howToPlay').style.display = 'block';
    }
    
    showSettings() {
        // Placeholder for settings - could add volume, graphics options, etc.
        alert('Settings coming soon! 🎮\n\nFuture features:\n• Volume controls\n• Graphics quality\n• Key bindings\n• Theme selection');
    }
    
    hideAllScreens() {
        document.getElementById('studioIntro').style.display = 'none';
        document.getElementById('mainMenu').style.display = 'none';
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('roomSelection').style.display = 'none';
        document.getElementById('howToPlay').style.display = 'none';
        // Game screen is handled separately
    }
    
    handlePlayClick() {
        if (this.isLoggedIn) {
            this.showModeSelection();
        } else {
            this.showLoginScreen();
        }
    }
    
    showLoginScreen() {
        this.hideAllScreens();
        document.getElementById('loginScreen').style.display = 'block';
        
        // Clear previous input
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
        document.getElementById('loginStatus').textContent = 'Please enter your credentials';
        document.getElementById('loginStatus').className = 'login-status';
        
        // Focus username field
        setTimeout(() => {
            document.getElementById('username').focus();
        }, 100);
    }
    
    handleLogin() {
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        const loginStatus = document.getElementById('loginStatus');
        const loginBtn = document.getElementById('loginBtn');
        
        if (!username || !password) {
            this.showLoginError('Please enter both username and password');
            return;
        }
        
        // Add loading state
        loginBtn.classList.add('loading');
        loginStatus.textContent = 'Authenticating...';
        loginStatus.className = 'login-status';
        
        // Simulate network delay
        setTimeout(() => {
            if (this.authenticateUser(username, password)) {
                this.loginSuccess(username);
            } else {
                this.loginFailure();
            }
            loginBtn.classList.remove('loading');
        }, 1000);
    }
    
    handleRegister() {
        // Simple registration (in real app, this would be more complex)
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        
        if (!username || !password) {
            this.showLoginError('Please enter both username and password');
            return;
        }
        
        if (username.length < 3) {
            this.showLoginError('Username must be at least 3 characters');
            return;
        }
        
        if (password.length < 6) {
            this.showLoginError('Password must be at least 6 characters');
            return;
        }
        
        if (this.users.has(username.toLowerCase())) {
            this.showLoginError('Username already exists');
            return;
        }
        
        // Add new user
        this.users.set(username.toLowerCase(), {
            password: password,
            level: 'user'
        });
        
        this.showLoginSuccess('Account created successfully! Logging you in...');
        
        setTimeout(() => {
            this.loginSuccess(username);
        }, 1500);
    }
    
    handleGuestLogin() {
        const guestName = 'Guest_' + Math.random().toString(36).substr(2, 5);
        this.loginSuccess(guestName, true);
    }
    
    authenticateUser(username, password) {
        const user = this.users.get(username.toLowerCase());
        return user && user.password === password;
    }
    
    loginSuccess(username, isGuest = false) {
        this.isLoggedIn = true;
        this.currentUser = {
            username: username,
            isGuest: isGuest,
            level: isGuest ? 'guest' : this.users.get(username.toLowerCase()).level
        };
        
        this.showLoginSuccess(`Welcome, ${username}!`);
        
        setTimeout(() => {
            this.showModeSelection();
        }, 1500);
    }
    
    loginFailure() {
        this.loginAttempts++;
        
        if (this.loginAttempts >= this.maxLoginAttempts) {
            this.showLoginError('Too many failed attempts. Try again later.');
            document.getElementById('loginBtn').disabled = true;
            
            setTimeout(() => {
                document.getElementById('loginBtn').disabled = false;
                this.loginAttempts = 0;
            }, 30000); // 30 second lockout
        } else {
            const remaining = this.maxLoginAttempts - this.loginAttempts;
            this.showLoginError(`Invalid credentials. ${remaining} attempt(s) remaining.`);
        }
        
        // Clear password field
        document.getElementById('password').value = '';
    }
    
    showLoginSuccess(message) {
        const loginStatus = document.getElementById('loginStatus');
        loginStatus.textContent = message;
        loginStatus.className = 'login-status success';
    }
    
    showLoginError(message) {
        const loginStatus = document.getElementById('loginStatus');
        loginStatus.textContent = message;
        loginStatus.className = 'login-status error';
    }
    
    logout() {
        this.isLoggedIn = false;
        this.currentUser = null;
        this.loginAttempts = 0;
        
        // Clear connection state
        this.shouldConnect = false;
        
        // Disconnect from server
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        
        // Reset game state
        this.playerId = null;
        this.currentRoom = null;
        this.gameState = null;
        this.players.clear();
        
        this.showMainMenu();
    }
    
    showStudioIntro() {
        this.hideAllScreens();
        document.getElementById('studioIntro').style.display = 'block';
        
        // Auto-advance to main menu after animation completes
        setTimeout(() => {
            if (document.getElementById('studioIntro').style.display !== 'none') {
                this.showMainMenu();
            }
        }, 5000); // 5 seconds total animation time
    }
    
    handleIntroSkip(e) {
        // Only skip if we're currently showing the studio intro
        if (document.getElementById('studioIntro').style.display !== 'none') {
            // Don't skip on game controls during actual gameplay
            if (this.gameState && this.gameState.isRunning && this.qteActive) {
                return;
            }
            
            e.preventDefault();
            this.showMainMenu();
        }
    }
    
    connectToServer() {
        // Don't create multiple connections or connect during intro
        if ((this.socket && this.socket.connected) || !this.shouldConnect) {
            return;
        }
        
        // Disconnect existing socket first
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        
        this.socket = io({
            timeout: 5000,
            forceNew: true,
            autoConnect: false  // Prevent automatic reconnection
        });
        
        // Manually connect
        this.socket.connect();
        
        this.socket.on('connect', () => {
            console.log('Connected to server');
        this.connectionStatus.textContent = 'Connected! Enter your details to join a room.';
        this.connectionStatus.className = 'connection-status connected';
        if (this.connectionIndicator) {
            this.connectionIndicator.className = 'connection-indicator connected';
        }
    });
    
    this.socket.on('disconnect', (reason) => {
            console.log('Disconnected from server:', reason);
            
            // Only show error if we're still supposed to be connected
            if (this.shouldConnect) {
                this.connectionStatus.textContent = 'Disconnected from server';
                this.connectionStatus.className = 'connection-status error';
                if (this.connectionIndicator) {
                    this.connectionIndicator.className = 'connection-indicator disconnected';
                }
            }
            
            // Clear socket reference to prevent stale connections
            if (!this.shouldConnect) {
                this.socket = null;
            }
        });
        
        this.socket.on('connect_error', (error) => {
            console.log('Connection error:', error);
            
            // Only show error if we're still trying to connect
            if (this.shouldConnect) {
                this.connectionStatus.textContent = 'Failed to connect to server';
                this.connectionStatus.className = 'connection-status error';
            }
        });
        
        this.socket.on('roomJoined', (data) => {
            this.playerId = data.playerId;
            this.currentRoom = data.player.roomId || this.roomIdInput.value;
            this.gameState = data.gameState;
            
            this.showGameScreen();
            this.updateGameState(data.gameState);
        });
        
        this.socket.on('playerJoined', (data) => {
            this.updateGameState(data.gameState);
            
            // Ensure all players are visible
            if (data.allPlayers) {
                data.allPlayers.forEach(player => {
                    if (!this.players.has(player.id)) {
                        // Create missing player element
                        this.createPlayerElement(player);
                    }
                });
            }
        });
        
        this.socket.on('playerLeft', (data) => {
            this.updateGameState(data.gameState);
        });
        
        this.socket.on('gameStarted', (gameState) => {
            this.gameState = gameState;
            this.updateGameState(gameState);
        });
        
        this.socket.on('gameUpdate', (gameState) => {
            this.gameState = gameState;
            this.updateTimer(gameState.timeLeft);
        });
        
        this.socket.on('playerMoved', (data) => {
            // Update all players' positions if allPlayers data is provided
            if (data.allPlayers) {
                data.allPlayers.forEach(player => {
                    const playerElement = this.players.get(player.id);
                    if (playerElement) {
                        // Don't override local player position prediction
                        if (player.id !== this.playerId) {
                            playerElement.style.left = (player.x - this.playerSize / 2) + 'px';
                            playerElement.style.top = (player.y - this.playerSize / 2) + 'px';
                        }
                        
                        // Update player status classes
                        playerElement.className = `player ${player.id === this.players.get(player.id)?.id ? 'player1' : 'player2'}`;
                        if (player.isIt) {
                            playerElement.classList.add('it');
                        }
                        if (player.slowed) {
                            playerElement.classList.add('slowed');
                        }
                    }
                });
            } else {
                // Fallback to old method for backward compatibility
                if (data.playerId !== this.playerId) {
                    const playerElement = this.players.get(data.playerId);
                    if (playerElement) {
                        playerElement.style.left = (data.position.x - this.playerSize / 2) + 'px';
                        playerElement.style.top = (data.position.y - this.playerSize / 2) + 'px';
                    }
                }
            }
        });
        
        this.socket.on('playerTagged', (data) => {
            this.tagCountElement.textContent = data.tagCount;
            this.updatePlayersList(data.players);
            this.showTagFeedback();
        });
        
        this.socket.on('gameEnd', (data) => {
            this.showGameOver(data.winner, data.tagCount);
        });
        
        this.socket.on('gameRestart', (gameState) => {
            this.gameState = gameState;
            this.updateGameState(gameState);
            this.hideGameOver();
        });
        
        this.socket.on('qteStart', (data) => {
            this.startQTE(data);
        });
        
        this.socket.on('qteProgress', (data) => {
            this.updateQTEProgress(data);
        });
        
        this.socket.on('qteEnd', (data) => {
            this.endQTE(data);
        });
        
        // Site-wide messaging
        this.socket.on('siteMessage', (data) => {
            this.showSiteMessage(data.message, data.messageType, data.sender || 'Server');
        });
        
        this.socket.on('motd', (data) => {
            // Show MOTD when joining server
            setTimeout(() => {
                this.showSiteMessage(data.message, data.messageType, 'Message of the Day');
            }, 2000); // Delay to let user see they joined
        });
    }
    
    setupEventListeners() {
        // Skip intro on any key press or click
        document.addEventListener('keydown', (e) => this.handleIntroSkip(e));
        document.addEventListener('click', (e) => this.handleIntroSkip(e));
        
        // Mode selection
        document.getElementById('onlineMode').addEventListener('click', () => this.selectOnlineMode());
        document.getElementById('offlineMode').addEventListener('click', () => this.selectOfflineMode());
        document.getElementById('backToModeBtn').addEventListener('click', () => this.showModeSelection());
        document.getElementById('backToModeBtn2').addEventListener('click', () => this.showModeSelection());
        
        // Online mode
        this.joinRoomBtn.addEventListener('click', () => this.joinRoom());
        
        // Offline mode
        document.getElementById('startOfflineBtn').addEventListener('click', () => this.startOfflineGame());
        
        // Main menu buttons
        document.getElementById('playBtn').addEventListener('click', () => this.handlePlayClick());
        document.getElementById('howToPlayBtn').addEventListener('click', () => this.showHowToPlay());
        document.getElementById('settingsBtn').addEventListener('click', () => this.showSettings());
        
        // Login buttons
        document.getElementById('loginBtn').addEventListener('click', () => this.handleLogin());
        document.getElementById('registerBtn').addEventListener('click', () => this.handleRegister());
        document.getElementById('guestLoginBtn').addEventListener('click', () => this.handleGuestLogin());
        document.getElementById('backToMainFromLogin').addEventListener('click', () => this.showMainMenu());
        
        // Enter key support for login
        document.getElementById('username').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleLogin();
        });
        document.getElementById('password').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleLogin();
        });
        
        // Status button
        document.getElementById('statusBtn').addEventListener('click', () => this.handleStatusClick());
        
        // Server option toggles
        document.getElementById('privateServer').addEventListener('change', () => this.toggleServerInputs());
        document.getElementById('groupServer').addEventListener('change', () => this.toggleServerInputs());
        
        // Admin panel
        document.getElementById('closeAdminPanel').addEventListener('click', () => this.hideAdminPanel());
        document.getElementById('banPlayerBtn').addEventListener('click', () => this.banPlayer());
        document.getElementById('viewPlayersBtn').addEventListener('click', () => this.viewAllPlayers());
        document.getElementById('kickAllBtn').addEventListener('click', () => this.kickAllPlayers());
        document.getElementById('debugModeBtn').addEventListener('click', () => this.toggleDebugMode());
        document.getElementById('showStatsBtn').addEventListener('click', () => this.showGameStats());
        document.getElementById('resetGameBtn').addEventListener('click', () => this.resetCurrentGame());
        document.getElementById('serverInfoBtn').addEventListener('click', () => this.showServerInfo());
        document.getElementById('broadcastBtn').addEventListener('click', () => this.broadcastMessage());
        document.getElementById('sendMotdBtn').addEventListener('click', () => this.setMessageOfDay());
        document.getElementById('executeBtn').addEventListener('click', () => this.executeConsoleCommand());
        document.getElementById('clearConsoleBtn').addEventListener('click', () => this.clearConsole());
        
        // Console and broadcast enter key support
        document.getElementById('consoleInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.executeConsoleCommand();
        });
        document.getElementById('broadcastInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.broadcastMessage();
        });
        
        // Navigation buttons
        document.getElementById('backToMainBtn').addEventListener('click', () => this.showMainMenu());
        document.getElementById('backToMainBtn2').addEventListener('click', () => this.showMainMenu());
        
        // Game controls
        this.startBtn.addEventListener('click', () => this.startGame());
        this.restartBtn.addEventListener('click', () => this.restartGame());
        this.leaveRoomBtn.addEventListener('click', () => this.leaveRoom());
        
        // Enter key support for room joining
        this.playerNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinRoom();
        });
        this.roomIdInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinRoom();
        });
        
        // Player movement
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));
        
        // QTE system
        this.qteActive = false;
        this.qteData = null;
        this.qteOverlay = null;
        
        // Offline mode
        this.isOfflineMode = false;
        this.offlineGameState = null;
        
        // Connection management
        this.shouldConnect = false;
        
        // Admin panel
        this.adminPanelOpen = false;
        this.debugMode = false;
        this.bannedPlayers = new Set();
        this.debugUpdateTimer = null;
        this.activeMessages = new Set();
        this.lastBroadcastTime = 0;
        
        this.init();
        this.startMovementLoop();
    }
    
    toggleServerInputs() {
        const privateInputs = document.getElementById('privateRoomInputs');
        const groupInputs = document.getElementById('groupServerInputs');
        const isGroupServer = document.getElementById('groupServer').checked;
        
        if (isGroupServer) {
            privateInputs.style.display = 'none';
            groupInputs.style.display = 'block';
        } else {
            privateInputs.style.display = 'block';
            groupInputs.style.display = 'none';
        }
    }
    
    joinRoom() {
        const isGroupServer = document.getElementById('groupServer').checked;
        let playerName, roomId;
        
        if (isGroupServer) {
            playerName = document.getElementById('groupPlayerName').value.trim();
            roomId = 'GROUP_SERVER'; // Special identifier for group server
        } else {
            playerName = this.playerNameInput.value.trim();
            roomId = this.roomIdInput.value.trim();
        }
        
        // Validation
        if (!playerName) {
            alert('Please enter your name');
            return;
        }
        
        if (!isGroupServer && !roomId) {
            alert('Please enter a room ID');
            return;
        }
        
        // Connect to server first, then join room
        if (!this.socket || !this.socket.connected) {
            this.connectionStatus.textContent = 'Connecting to server...';
            this.connectionStatus.className = 'connection-status';
            this.connectToServer();
            
            // Wait for connection before joining
            const checkConnection = () => {
                if (this.socket && this.socket.connected) {
                    // Use logged in username if not provided
                    const actualPlayerName = playerName || this.currentUser?.username || 'Anonymous';
                    this.socket.emit('joinRoom', { 
                        roomId, 
                        playerName: actualPlayerName,
                        userLevel: this.currentUser?.level || 'guest',
                        isGroupServer: isGroupServer
                    });
                } else {
                    setTimeout(checkConnection, 100);
                }
            };
            setTimeout(checkConnection, 100);
        } else {
            const actualPlayerName = playerName || this.currentUser?.username || 'Anonymous';
            this.socket.emit('joinRoom', { 
                roomId, 
                playerName: actualPlayerName,
                userLevel: this.currentUser?.level || 'guest',
                isGroupServer: isGroupServer
            });
        }
    }
    
    leaveRoom() {
        if (this.isOfflineMode) {
            this.leaveOfflineGame();
        } else {
            if (this.socket) {
                this.socket.disconnect();
                this.socket = null;
            }
            
            // Reset game state
            this.playerId = null;
            this.currentRoom = null;
            this.gameState = null;
            this.players.clear();
            
            // Clear game area
            this.gameArea.innerHTML = '';
            
            // Show main menu
            this.roomSelectionScreen.style.display = 'none';
            this.gameScreen.style.display = 'none';
            this.showMainMenu();
        }
    }
    
    startOfflineGame() {
        const player1Name = document.getElementById('player1Name').value.trim() || 'Player 1';
        const player2Name = document.getElementById('player2Name').value.trim() || 'Player 2';
        
        this.isOfflineMode = true;
        this.playerId = 'player1'; // Control player 1 by default
        
        // Initialize offline game state
        this.offlineGameState = {
            isRunning: false,
            timeLeft: 60,
            tagCount: 0,
            gameTimer: null,
            tagCooldown: false,
            qteActive: false,
            players: [
                {
                    id: 'player1',
                    name: player1Name,
                    x: this.gameWidth / 4,
                    y: this.gameHeight / 2,
                    isIt: false,
                    slowed: false,
                    color: '#3498db'
                },
                {
                    id: 'player2', 
                    name: player2Name,
                    x: (this.gameWidth * 3) / 4,
                    y: this.gameHeight / 2,
                    isIt: true,
                    slowed: false,
                    color: '#27ae60'
                }
            ]
        };
        
        this.gameState = this.offlineGameState;
        
        // Show game screen
        this.roomSelectionScreen.style.display = 'none';
        this.gameScreen.style.display = 'block';
        this.currentRoomElement.textContent = 'Offline Mode';
        
        // Update UI
        this.updateGameState(this.offlineGameState);
        
        // Update instructions
        document.getElementById('gameInstructions').innerHTML = `
            <p><strong>Player 1 (${player1Name}):</strong> Use WASD keys to move</p>
            <p><strong>Player 2 (${player2Name}):</strong> Use Arrow Keys to move</p>
            <p>The player who is "IT" must tag the other player! Try to avoid being "IT" when time runs out!</p>
        `;
        
        this.startMovementLoop();
    }
    
    leaveOfflineGame() {
        this.isOfflineMode = false;
        
        // Stop game timer
        if (this.offlineGameState && this.offlineGameState.gameTimer) {
            clearInterval(this.offlineGameState.gameTimer);
        }
        
        // Reset state
        this.playerId = null;
        this.gameState = null;
        this.offlineGameState = null;
        this.players.clear();
        
        // Clear game area
        this.gameArea.innerHTML = '';
        
        // Show main menu
        this.roomSelectionScreen.style.display = 'none';
        this.gameScreen.style.display = 'none';
        this.showMainMenu();
    }
    
    startParticleSystem() {
        const particlesContainer = document.getElementById('particlesContainer');
        if (!particlesContainer) return;
        
        const createParticle = () => {
            const particle = document.createElement('div');
            particle.className = 'particle';
            
            // Random starting position
            particle.style.left = Math.random() * 100 + '%';
            
            // Random size and opacity
            const size = Math.random() * 4 + 2;
            particle.style.width = size + 'px';
            particle.style.height = size + 'px';
            particle.style.opacity = Math.random() * 0.8 + 0.2;
            
            // Random animation duration
            const duration = Math.random() * 3 + 4;
            particle.style.animationDuration = duration + 's';
            
            // Random delay
            particle.style.animationDelay = Math.random() * 2 + 's';
            
            particlesContainer.appendChild(particle);
            
            // Remove particle after animation
            setTimeout(() => {
                if (particle.parentNode) {
                    particle.parentNode.removeChild(particle);
                }
            }, (duration + 2) * 1000);
        };
        
        // Create initial particles
        for (let i = 0; i < 20; i++) {
            setTimeout(createParticle, Math.random() * 2000);
        }
        
        // Continuously create particles
        setInterval(() => {
            if (document.getElementById('mainMenu').style.display !== 'none') {
                createParticle();
            }
        }, 300);
    }
    
    showGameScreen() {
        this.roomSelectionScreen.style.display = 'none';
        this.gameScreen.style.display = 'block';
        this.currentRoomElement.textContent = this.currentRoom;
    }
    
    startGame() {
        if (this.isOfflineMode) {
            this.startOfflineGameLoop();
        } else {
            this.socket.emit('startGame');
        }
    }
    
    restartGame() {
        if (this.isOfflineMode) {
            this.restartOfflineGame();
        } else {
            this.socket.emit('restartGame');
        }
    }
    
    startOfflineGameLoop() {
        this.offlineGameState.isRunning = true;
        this.offlineGameState.timeLeft = 60;
        this.offlineGameState.tagCount = 0;
        
        this.offlineGameState.gameTimer = setInterval(() => {
            this.offlineGameState.timeLeft--;
            this.timerElement.textContent = this.offlineGameState.timeLeft;
            
            if (this.offlineGameState.timeLeft <= 0) {
                this.endOfflineGame();
            }
        }, 1000);
        
        this.updateGameState(this.offlineGameState);
    }
    
    restartOfflineGame() {
        // Stop current game
        if (this.offlineGameState.gameTimer) {
            clearInterval(this.offlineGameState.gameTimer);
        }
        
        // Reset positions and state
        this.offlineGameState.isRunning = false;
        this.offlineGameState.timeLeft = 60;
        this.offlineGameState.tagCount = 0;
        this.offlineGameState.tagCooldown = false;
        
        this.offlineGameState.players[0].x = this.gameWidth / 4;
        this.offlineGameState.players[0].y = this.gameHeight / 2;
        this.offlineGameState.players[0].isIt = false;
        this.offlineGameState.players[0].slowed = false;
        
        this.offlineGameState.players[1].x = (this.gameWidth * 3) / 4;
        this.offlineGameState.players[1].y = this.gameHeight / 2;
        this.offlineGameState.players[1].isIt = true;
        this.offlineGameState.players[1].slowed = false;
        
        this.updateGameState(this.offlineGameState);
        this.hideGameOver();
    }
    
    endOfflineGame() {
        this.offlineGameState.isRunning = false;
        clearInterval(this.offlineGameState.gameTimer);
        
        // Determine winner
        const winner = this.offlineGameState.players.find(p => !p.isIt);
        this.showGameOver(winner ? winner.name : null, this.offlineGameState.tagCount);
    }
    
    handleKeyDown(e) {
        // Admin panel hotkey (Ctrl+D) - only for admin users
        if (e.ctrlKey && e.key.toLowerCase() === 'd' && this.isLoggedIn && this.currentUser.level === 'admin') {
            e.preventDefault();
            if (this.adminPanelOpen) {
                this.hideAdminPanel();
            } else {
                this.showAdminPanel();
            }
            return;
        }
        
        // Handle QTE input first
        if (this.qteActive && this.qteData) {
            const key = e.key.toUpperCase();
            this.handleQTEInput(key);
            e.preventDefault();
            return;
        }
        
        this.keys[e.key.toLowerCase()] = true;
        
        // Prevent arrow key scrolling
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            e.preventDefault();
        }
    }
    
    handleKeyUp(e) {
        this.keys[e.key.toLowerCase()] = false;
    }
    
    startMovementLoop() {
        const movePlayer = () => {
            if (this.gameState && this.gameState.isRunning) {
                if (this.isOfflineMode) {
                    this.handleOfflineMovement();
                } else if (this.playerId) {
                    // Online multiplayer movement
                    const currentPlayer = this.gameState.players.find(p => p.id === this.playerId);
                    if (currentPlayer) {
                        // Update local position every frame for smooth movement
                        const newPos = this.calculateNewPosition(this.localPlayerPos);
                        this.localPlayerPos = newPos;
                        
                        // Update visual position immediately
                        const playerElement = this.players.get(this.playerId);
                        if (playerElement) {
                            playerElement.style.left = (newPos.x - this.playerSize / 2) + 'px';
                            playerElement.style.top = (newPos.y - this.playerSize / 2) + 'px';
                        }
                        
                        // Send to server at throttled rate
                        const now = Date.now();
                        if (now - this.lastMoveTime >= this.moveThrottle) {
                            this.socket.emit('playerMove', newPos);
                            this.lastMoveTime = now;
                        }
                    }
                }
            }
            requestAnimationFrame(movePlayer);
        };
        movePlayer();
    }
    
    handleOfflineMovement() {
        const player1 = this.offlineGameState.players[0];
        const player2 = this.offlineGameState.players[1];
        
        // Player 1 movement (WASD)
        const p1Speed = player1.slowed ? this.moveSpeed * 0.3 : this.moveSpeed;
        if (this.keys['w']) {
            player1.y = Math.max(this.playerSize / 2, player1.y - p1Speed);
        }
        if (this.keys['s']) {
            player1.y = Math.min(this.gameHeight - this.playerSize / 2, player1.y + p1Speed);
        }
        if (this.keys['a']) {
            player1.x = Math.max(this.playerSize / 2, player1.x - p1Speed);
        }
        if (this.keys['d']) {
            player1.x = Math.min(this.gameWidth - this.playerSize / 2, player1.x + p1Speed);
        }
        
        // Player 2 movement (Arrow keys)
        const p2Speed = player2.slowed ? this.moveSpeed * 0.3 : this.moveSpeed;
        if (this.keys['arrowup']) {
            player2.y = Math.max(this.playerSize / 2, player2.y - p2Speed);
        }
        if (this.keys['arrowdown']) {
            player2.y = Math.min(this.gameHeight - this.playerSize / 2, player2.y + p2Speed);
        }
        if (this.keys['arrowleft']) {
            player2.x = Math.max(this.playerSize / 2, player2.x - p2Speed);
        }
        if (this.keys['arrowright']) {
            player2.x = Math.min(this.gameWidth - this.playerSize / 2, player2.x + p2Speed);
        }
        
        // Update visual positions
        const player1Element = this.players.get('player1');
        const player2Element = this.players.get('player2');
        
        if (player1Element) {
            player1Element.style.left = (player1.x - this.playerSize / 2) + 'px';
            player1Element.style.top = (player1.y - this.playerSize / 2) + 'px';
        }
        
        if (player2Element) {
            player2Element.style.left = (player2.x - this.playerSize / 2) + 'px';
            player2Element.style.top = (player2.y - this.playerSize / 2) + 'px';
        }
        
        // Check for offline tagging
        this.checkOfflineTagging();
    }
    
    checkOfflineTagging() {
        if (this.offlineGameState.tagCooldown || this.offlineGameState.qteActive) return;
        
        const player1 = this.offlineGameState.players[0];
        const player2 = this.offlineGameState.players[1];
        
        const distance = Math.sqrt(
            Math.pow(player1.x - player2.x, 2) + 
            Math.pow(player1.y - player2.y, 2)
        );
        
        if (distance < this.playerSize) {
            // 30% chance for QTE, otherwise normal tag
            if (Math.random() < 0.3) {
                this.startOfflineQTE();
            } else {
                this.handleOfflineTag();
            }
        }
    }
    
    handleOfflineTag() {
        // Switch who is "it"
        this.offlineGameState.players[0].isIt = !this.offlineGameState.players[0].isIt;
        this.offlineGameState.players[1].isIt = !this.offlineGameState.players[1].isIt;
        
        this.offlineGameState.tagCount++;
        this.tagCountElement.textContent = this.offlineGameState.tagCount;
        
        // Update visual feedback
        this.updatePlayersList(this.offlineGameState.players);
        this.showTagFeedback();
        
        // Set cooldown
        this.offlineGameState.tagCooldown = true;
        setTimeout(() => {
            this.offlineGameState.tagCooldown = false;
        }, 2000);
    }
    
    startOfflineQTE() {
        this.offlineGameState.qteActive = true;
        
        // Create QTE data similar to online version
        const qteKeys = ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'];
        const selectedKeys = [];
        
        // Select 5 random keys
        for (let i = 0; i < 5; i++) {
            const randomKey = qteKeys[Math.floor(Math.random() * qteKeys.length)];
            selectedKeys.push(randomKey);
        }
        
        const qteData = {
            keys: selectedKeys,
            duration: 3000,
            players: this.offlineGameState.players.map(p => ({ id: p.id, name: p.name }))
        };
        
        // Initialize local QTE tracking
        this.qtePlayerProgress = {
            player1: { keysPressed: 0, currentIndex: 0 },
            player2: { keysPressed: 0, currentIndex: 0 }
        };
        
        this.startQTE(qteData);
        
        // Auto-end after duration
        setTimeout(() => {
            if (this.qteActive && this.offlineGameState.qteActive) {
                this.endOfflineQTE();
            }
        }, 3000);
    }
    
    handleQTEInput(key) {
        if (this.isOfflineMode && this.offlineGameState.qteActive) {
            return this.handleOfflineQTEInput(key);
        }
        
        // Original online QTE input handling
        if (!this.qteActive || !this.qteData) return;
        
        const expectedKey = this.qteData.keys[this.qteData.currentKeyIndex];
        if (key === expectedKey) {
            // Mark current key as completed
            const keyElement = document.getElementById(`qte-key-${this.qteData.currentKeyIndex}`);
            if (keyElement) {
                keyElement.classList.remove('active');
                keyElement.classList.add('completed');
            }
            
            this.qteData.currentKeyIndex++;
            
            // Activate next key
            if (this.qteData.currentKeyIndex < this.qteData.keys.length) {
                const nextKeyElement = document.getElementById(`qte-key-${this.qteData.currentKeyIndex}`);
                if (nextKeyElement) {
                    nextKeyElement.classList.add('active');
                }
            }
            
            // Send input to server (online mode)
            if (this.socket) {
                this.socket.emit('qteInput', { key: key });
            }
        }
    }
    
    handleOfflineQTEInput(key) {
        if (!this.qteActive || !this.qteData) return;
        
        // Check which player pressed the correct key
        let playerWhoPressed = null;
        let progress = null;
        
        // Player 1 and 2 both compete for the same sequence
        const player1Progress = this.qtePlayerProgress.player1;
        const player2Progress = this.qtePlayerProgress.player2;
        
        // Check if this is the next expected key for either player
        const expectedKey = this.qteData.keys[Math.min(player1Progress.currentIndex, player2Progress.currentIndex)];
        
        if (key === expectedKey) {
            // Determine which player gets credit (first to press)
            if (player1Progress.currentIndex <= player2Progress.currentIndex) {
                player1Progress.keysPressed++;
                player1Progress.currentIndex++;
                playerWhoPressed = 'player1';
                progress = player1Progress;
            } else {
                player2Progress.keysPressed++;
                player2Progress.currentIndex++;
                playerWhoPressed = 'player2';
                progress = player2Progress;
            }
            
            // Update visual feedback
            const keyElement = document.getElementById(`qte-key-${progress.currentIndex - 1}`);
            if (keyElement) {
                keyElement.classList.remove('active');
                keyElement.classList.add('completed');
            }
            
            // Activate next key if available
            if (progress.currentIndex < this.qteData.keys.length) {
                const nextKeyElement = document.getElementById(`qte-key-${progress.currentIndex}`);
                if (nextKeyElement) {
                    nextKeyElement.classList.add('active');
                }
            }
            
            // Update progress display
            this.updateQTEProgress({
                playerId: playerWhoPressed,
                keysPressed: progress.keysPressed,
                totalKeys: this.qteData.keys.length
            });
            
            // Check if someone completed all keys
            if (progress.keysPressed >= this.qteData.keys.length) {
                this.endOfflineQTE();
            }
        }
    }
    
    endOfflineQTE() {
        this.offlineGameState.qteActive = false;
        
        // Calculate results
        const p1Progress = this.qtePlayerProgress.player1;
        const p2Progress = this.qtePlayerProgress.player2;
        
        let winner, loser, winnerKeys, loserKeys;
        
        if (p1Progress.keysPressed > p2Progress.keysPressed) {
            winner = this.offlineGameState.players[0];
            loser = this.offlineGameState.players[1];
            winnerKeys = p1Progress.keysPressed;
            loserKeys = p2Progress.keysPressed;
        } else {
            winner = this.offlineGameState.players[1];
            loser = this.offlineGameState.players[0];
            winnerKeys = p2Progress.keysPressed;
            loserKeys = p1Progress.keysPressed;
        }
        
        // Apply QTE results
        this.offlineGameState.players.forEach(player => {
            player.isIt = (player.id === loser.id);
        });
        
        // Apply pushback to loser
        const pushDistance = 80;
        const angle = Math.atan2(
            loser.y - winner.y,
            loser.x - winner.x
        );
        
        loser.x = Math.max(this.playerSize / 2,
                  Math.min(this.gameWidth - this.playerSize / 2,
                  loser.x + Math.cos(angle) * pushDistance));
        loser.y = Math.max(this.playerSize / 2,
                  Math.min(this.gameHeight - this.playerSize / 2,
                  loser.y + Math.sin(angle) * pushDistance));
        
        loser.slowed = true;
        
        // Remove slow effect after 3 seconds
        setTimeout(() => {
            loser.slowed = false;
        }, 3000);
        
        this.offlineGameState.tagCount++;
        
        // Show results
        const data = {
            winner: winner.name,
            loser: loser.name,
            winnerKeys: winnerKeys,
            loserKeys: loserKeys,
            players: this.offlineGameState.players,
            tagCount: this.offlineGameState.tagCount
        };
        
        this.endQTE(data);
        
        // Set normal tag cooldown
        this.offlineGameState.tagCooldown = true;
        setTimeout(() => {
            this.offlineGameState.tagCooldown = false;
        }, 2000);
    }
    
    calculateNewPosition(currentPos) {
        let newX = currentPos.x;
        let newY = currentPos.y;
        
        // Check if current player is slowed
        const currentPlayer = this.gameState ? this.gameState.players.find(p => p.id === this.playerId) : null;
        const isSlowed = currentPlayer ? currentPlayer.slowed : false;
        const actualMoveSpeed = isSlowed ? this.moveSpeed * 0.3 : this.moveSpeed; // 30% speed when slowed
        
        // Check for any movement keys and apply movement
        if (this.keys['w']) {
            newY = Math.max(this.playerSize / 2, newY - actualMoveSpeed);
        }
        if (this.keys['s']) {
            newY = Math.min(this.gameHeight - this.playerSize / 2, newY + actualMoveSpeed);
        }
        if (this.keys['a']) {
            newX = Math.max(this.playerSize / 2, newX - actualMoveSpeed);
        }
        if (this.keys['d']) {
            newX = Math.min(this.gameWidth - this.playerSize / 2, newX + actualMoveSpeed);
        }
        
        return { x: newX, y: newY };
    }
    
    updateGameState(gameState) {
        this.gameState = gameState;
        
        // Update players list
        this.updatePlayersList(gameState.players);
        
        // Update game info
        this.updateTimer(gameState.timeLeft);
        this.tagCountElement.textContent = gameState.tagCount;
        
        // Show/hide start button based on player count and game state
        if (gameState.players.length >= 2 && !gameState.isRunning) {
            this.startBtn.style.display = 'inline-block';
        } else {
            this.startBtn.style.display = 'none';
        }
        
        if (gameState.isRunning) {
            this.restartBtn.style.display = 'inline-block';
        } else {
            this.restartBtn.style.display = 'none';
        }
        
        // Update or create player elements
        this.updatePlayerElements(gameState.players);
    }
    
    updatePlayersList(players) {
        this.playersListElement.innerHTML = '';
        
        players.forEach((player, index) => {
            const playerInfo = document.createElement('div');
            playerInfo.className = `player-info ${index === 0 ? 'blue' : 'green'}`;
            if (player.isIt) {
                playerInfo.classList.add('it');
            }
            playerInfo.textContent = `${player.name}${player.isIt ? ' (IT!)' : ''}`;
            this.playersListElement.appendChild(playerInfo);
        });
    }
    
    createPlayerElement(player) {
        // Don't create duplicate elements
        if (this.players.has(player.id)) {
            return this.players.get(player.id);
        }
        
        const playerElement = document.createElement('div');
        const playerIndex = Array.from(this.players.keys()).length;
        playerElement.className = `player ${playerIndex === 0 ? 'player1' : 'player2'}`;
        playerElement.id = player.id;
        
        if (player.isIt) {
            playerElement.classList.add('it');
        }
        
        if (player.slowed) {
            playerElement.classList.add('slowed');
        }
        
        // Initialize local position for current player
        if (player.id === this.playerId) {
            this.localPlayerPos = { x: player.x, y: player.y };
        }
        
        playerElement.style.left = (player.x - this.playerSize / 2) + 'px';
        playerElement.style.top = (player.y - this.playerSize / 2) + 'px';
        
        this.gameArea.appendChild(playerElement);
        this.players.set(player.id, playerElement);
        
        return playerElement;
    }
    
    updatePlayerElements(players) {
        // Remove old player elements
        this.gameArea.innerHTML = '';
        this.players.clear();
        
        // Create new player elements
        players.forEach((player, index) => {
            const playerElement = document.createElement('div');
            playerElement.className = `player ${index === 0 ? 'player1' : 'player2'}`;
            playerElement.id = player.id;
            
            if (player.isIt) {
                playerElement.classList.add('it');
            }
            
            if (player.slowed) {
                playerElement.classList.add('slowed');
            }
            
            // Initialize local position for current player
            if (player.id === this.playerId) {
                this.localPlayerPos = { x: player.x, y: player.y };
            }
            
            playerElement.style.left = (player.x - this.playerSize / 2) + 'px';
            playerElement.style.top = (player.y - this.playerSize / 2) + 'px';
            
            this.gameArea.appendChild(playerElement);
            this.players.set(player.id, playerElement);
        });
    }
    
    updateTimer(timeLeft) {
        // Prevent negative timer values and overflow
        const safeTime = Math.max(0, Math.min(999, Math.floor(timeLeft || 0)));
        this.timerElement.textContent = safeTime;
    }
    
    showTagFeedback() {
        // Add flash animation to all players
        this.players.forEach(playerElement => {
            playerElement.classList.add('just-tagged');
        });
        
        // Add hit impact effect to players
        this.players.forEach(playerElement => {
            playerElement.classList.add('hit-impact');
        });
        
        // Trigger screen shake
        this.triggerScreenShake();
        
        // Create particle effects at player positions
        this.players.forEach((playerElement, playerId) => {
            const rect = playerElement.getBoundingClientRect();
            const gameAreaRect = this.gameArea.getBoundingClientRect();
            const x = rect.left - gameAreaRect.left + (rect.width / 2);
            const y = rect.top - gameAreaRect.top + (rect.height / 2);
            this.createHitParticles(x, y);
        });
        
        setTimeout(() => {
            this.players.forEach(playerElement => {
                playerElement.classList.remove('just-tagged');
                playerElement.classList.remove('hit-impact');
            });
        }, 600);
    }
    
    triggerScreenShake() {
        // Apply screen shake to the game container
        const gameContainer = document.querySelector('.game-container');
        gameContainer.classList.add('screen-shake');
        
        setTimeout(() => {
            gameContainer.classList.remove('screen-shake');
        }, 500);
    }
    
    createHitParticles(x, y) {
        const particleContainer = document.createElement('div');
        particleContainer.className = 'hit-particles';
        particleContainer.style.left = x + 'px';
        particleContainer.style.top = y + 'px';
        
        // Create 8 particles in different directions
        for (let i = 0; i < 8; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            
            // Calculate random direction and distance
            const angle = (i * 45) + (Math.random() * 30 - 15); // Spread particles evenly with some randomness
            const distance = 20 + Math.random() * 30;
            const radians = angle * Math.PI / 180;
            
            const endX = Math.cos(radians) * distance;
            const endY = Math.sin(radians) * distance;
            
            // Set initial position
            particle.style.left = '0px';
            particle.style.top = '0px';
            
            // Animate particle movement
            particle.style.setProperty('--end-x', endX + 'px');
            particle.style.setProperty('--end-y', endY + 'px');
            particle.style.animation = `particleBurst 0.8s ease-out forwards`;
            particle.style.transform = `translate(var(--end-x, 0), var(--end-y, 0))`;
            
            particleContainer.appendChild(particle);
        }
        
        this.gameArea.appendChild(particleContainer);
        
        // Remove particles after animation
        setTimeout(() => {
            if (particleContainer.parentNode) {
                particleContainer.parentNode.removeChild(particleContainer);
            }
        }, 800);
    }
    
    showGameOver(winner, tagCount) {
        const gameOverDiv = document.createElement('div');
        gameOverDiv.className = 'game-over';
        gameOverDiv.innerHTML = `
            <h2>Game Over!</h2>
            <h3>${winner ? `${winner} Wins!` : "It's a Tie!"}</h3>
            <p>Total Tags: ${tagCount}</p>
            <p>Winner avoided being "IT" at the end!</p>
            <button onclick="game.restartGame(); this.parentElement.remove();">Play Again</button>
        `;
        
        this.gameArea.appendChild(gameOverDiv);
    }
    
    hideGameOver() {
        const gameOverDiv = this.gameArea.querySelector('.game-over');
        if (gameOverDiv) {
            gameOverDiv.remove();
        }
    }
    
    startQTE(data) {
        this.qteActive = true;
        this.qteData = {
            keys: data.keys,
            players: data.players,
            currentKeyIndex: 0,
            playerProgress: new Map(),
            startTime: Date.now(),
            duration: data.duration
        };
        
        // Initialize player progress
        data.players.forEach(player => {
            this.qteData.playerProgress.set(player.id, 0);
        });
        
        this.showQTEOverlay();
        this.startQTETimer();
    }
    
    showQTEOverlay() {
        // Remove existing overlay if any
        if (this.qteOverlay) {
            this.qteOverlay.remove();
        }
        
        this.qteOverlay = document.createElement('div');
        this.qteOverlay.className = 'qte-overlay';
        
        const title = document.createElement('div');
        title.className = 'qte-title';
        title.textContent = 'FIGHT BACK!';
        
        const instructions = document.createElement('div');
        instructions.className = 'qte-instructions';
        instructions.textContent = 'Press the keys in order as fast as you can!';
        
        const keysContainer = document.createElement('div');
        keysContainer.className = 'qte-keys';
        
        // Create key elements
        this.qteData.keys.forEach((key, index) => {
            const keyElement = document.createElement('div');
            keyElement.className = 'qte-key';
            keyElement.textContent = key;
            keyElement.id = `qte-key-${index}`;
            
            if (index === 0) {
                keyElement.classList.add('active');
            }
            
            keysContainer.appendChild(keyElement);
        });
        
        const progressContainer = document.createElement('div');
        progressContainer.className = 'qte-progress';
        
        // Create player progress displays
        this.qteData.players.forEach(player => {
            const playerProgress = document.createElement('div');
            playerProgress.className = 'qte-player-progress';
            playerProgress.id = `qte-player-${player.id}`;
            
            const playerName = document.createElement('div');
            playerName.className = 'qte-player-name';
            playerName.textContent = player.name;
            
            const playerKeys = document.createElement('div');
            playerKeys.className = 'qte-player-keys';
            playerKeys.textContent = `0/${this.qteData.keys.length}`;
            
            playerProgress.appendChild(playerName);
            playerProgress.appendChild(playerKeys);
            progressContainer.appendChild(playerProgress);
        });
        
        const timer = document.createElement('div');
        timer.className = 'qte-timer';
        timer.id = 'qte-timer';
        timer.textContent = '3.0s';
        
        this.qteOverlay.appendChild(title);
        this.qteOverlay.appendChild(instructions);
        this.qteOverlay.appendChild(keysContainer);
        this.qteOverlay.appendChild(progressContainer);
        this.qteOverlay.appendChild(timer);
        
        this.gameArea.appendChild(this.qteOverlay);
    }
    
    startQTETimer() {
        const timerElement = document.getElementById('qte-timer');
        
        // Clear any existing timer
        if (this.qteTimerInterval) {
            clearInterval(this.qteTimerInterval);
        }
        
        this.qteTimerInterval = setInterval(() => {
            if (!this.qteActive || !timerElement) {
                clearInterval(this.qteTimerInterval);
                return;
            }
            
            const elapsed = Date.now() - this.qteData.startTime;
            const remaining = Math.max(0, this.qteData.duration - elapsed);
            const seconds = (remaining / 1000).toFixed(1);
            
            timerElement.textContent = `${seconds}s`;
            
            if (remaining < 1000) {
                timerElement.classList.add('urgent');
            }
            
            if (remaining <= 0) {
                clearInterval(this.qteTimerInterval);
            }
        }, 100); // Update every 100ms instead of every frame
    }
    
    handleQTEInput(key) {
        if (!this.qteActive || !this.qteData) return;
        
        const expectedKey = this.qteData.keys[this.qteData.currentKeyIndex];
        if (key === expectedKey) {
            // Mark current key as completed
            const keyElement = document.getElementById(`qte-key-${this.qteData.currentKeyIndex}`);
            if (keyElement) {
                keyElement.classList.remove('active');
                keyElement.classList.add('completed');
            }
            
            this.qteData.currentKeyIndex++;
            
            // Activate next key
            if (this.qteData.currentKeyIndex < this.qteData.keys.length) {
                const nextKeyElement = document.getElementById(`qte-key-${this.qteData.currentKeyIndex}`);
                if (nextKeyElement) {
                    nextKeyElement.classList.add('active');
                }
            }
            
            // Send input to server
            this.socket.emit('qteInput', { key: key });
        }
    }
    
    updateQTEProgress(data) {
        if (!this.qteActive || !this.qteData) return;
        
        // Update player progress display
        const playerElement = document.getElementById(`qte-player-${data.playerId}`);
        if (playerElement) {
            const keysElement = playerElement.querySelector('.qte-player-keys');
            if (keysElement) {
                keysElement.textContent = `${data.keysPressed}/${data.totalKeys}`;
            }
        }
        
        this.qteData.playerProgress.set(data.playerId, data.keysPressed);
    }
    
    endQTE(data) {
        this.qteActive = false;
        
        // Clear timer interval
        if (this.qteTimerInterval) {
            clearInterval(this.qteTimerInterval);
            this.qteTimerInterval = null;
        }
        
        // Remove QTE overlay
        if (this.qteOverlay) {
            this.qteOverlay.remove();
            this.qteOverlay = null;
        }
        
        // Show results briefly
        this.showQTEResults(data);
        
        // Update game state
        this.updateGameState({ 
            players: data.players, 
            tagCount: data.tagCount,
            isRunning: this.gameState ? this.gameState.isRunning : false,
            timeLeft: this.gameState ? this.gameState.timeLeft : 60
        });
        
        // Trigger enhanced hit effects
        this.showTagFeedback();
        
        this.qteData = null;
    }
    
    showQTEResults(data) {
        const resultsDiv = document.createElement('div');
        resultsDiv.className = 'qte-overlay';
        resultsDiv.style.background = 'rgba(0, 0, 0, 0.9)';
        
        const title = document.createElement('div');
        title.className = 'qte-title';
        title.style.color = data.winner ? '#27ae60' : '#e74c3c';
        title.textContent = data.winner ? `${data.winner} WINS!` : 'QTE COMPLETED!';
        
        const results = document.createElement('div');
        results.className = 'qte-instructions';
        results.innerHTML = `
            <p><strong>Winner:</strong> ${data.winner || 'None'} (${data.winnerKeys} keys)</p>
            <p><strong>Loser:</strong> ${data.loser || 'None'} (${data.loserKeys} keys)</p>
            <p>Loser is pushed back and slowed for 3 seconds!</p>
        `;
        
        resultsDiv.appendChild(title);
        resultsDiv.appendChild(results);
        
        this.gameArea.appendChild(resultsDiv);
        
        // Remove results after 2 seconds
        setTimeout(() => {
            if (resultsDiv.parentNode) {
                resultsDiv.parentNode.removeChild(resultsDiv);
            }
        }, 2000);
    }
    
    // Admin Panel Functions
    showAdminPanel() {
        if (!this.isLoggedIn || this.currentUser.level !== 'admin') {
            this.logToConsole('Access denied: Admin privileges required', 'error');
            return;
        }
        
        this.adminPanelOpen = true;
        document.getElementById('adminPanel').style.display = 'block';
        this.logToConsole('Admin panel opened', 'info');
    }
    
    hideAdminPanel() {
        this.adminPanelOpen = false;
        document.getElementById('adminPanel').style.display = 'none';
    }
    
    banPlayer() {
        const playerName = document.getElementById('banPlayerInput').value.trim();
        if (!playerName) {
            this.logToConsole('Please enter a player name to ban', 'error');
            return;
        }
        
        this.bannedPlayers.add(playerName.toLowerCase());
        this.logToConsole(`Player "${playerName}" has been banned`, 'warning');
        document.getElementById('banPlayerInput').value = '';
        
        // If connected to server, emit ban command
        if (this.socket && this.socket.connected) {
            this.socket.emit('adminCommand', { type: 'ban', target: playerName });
        }
    }
    
    viewAllPlayers() {
        this.logToConsole('=== CONNECTED PLAYERS ===', 'info');
        
        if (this.gameState && this.gameState.players) {
            this.gameState.players.forEach((player, index) => {
                const status = player.isIt ? '[IT]' : '';
                const slowed = player.slowed ? '[SLOWED]' : '';
                this.logToConsole(`${index + 1}. ${player.name} ${status} ${slowed}`, 'info');
            });
        } else {
            this.logToConsole('No players currently connected', 'info');
        }
        
        this.logToConsole(`Total banned players: ${this.bannedPlayers.size}`, 'warning');
    }
    
    kickAllPlayers() {
        if (confirm('Are you sure you want to kick all players? This will end the current game.')) {
            this.logToConsole('Kicking all players...', 'warning');
            
            if (this.socket && this.socket.connected) {
                this.socket.emit('adminCommand', { type: 'kickAll' });
            }
            
            // Reset local game state
            if (this.isOfflineMode) {
                this.leaveOfflineGame();
            }
        }
    }
    
    toggleDebugMode() {
        this.debugMode = !this.debugMode;
        const status = this.debugMode ? 'enabled' : 'disabled';
        this.logToConsole(`Debug mode ${status}`, 'info');
        
        // Add visual debug indicators
        if (this.debugMode) {
            document.body.classList.add('debug-mode');
            this.showDebugInfo();
        } else {
            document.body.classList.remove('debug-mode');
            this.hideDebugInfo();
        }
    }
    
    showGameStats() {
        this.logToConsole('=== GAME STATISTICS ===', 'info');
        
        if (this.gameState) {
            this.logToConsole(`Time remaining: ${this.gameState.timeLeft || 0} seconds`, 'info');
            this.logToConsole(`Total tags: ${this.gameState.tagCount || 0}`, 'info');
            this.logToConsole(`Game running: ${this.gameState.isRunning ? 'Yes' : 'No'}`, 'info');
            this.logToConsole(`Players: ${this.gameState.players ? this.gameState.players.length : 0}`, 'info');
        }
        
        this.logToConsole(`Local player ID: ${this.playerId || 'None'}`, 'info');
        this.logToConsole(`Current room: ${this.currentRoom || 'None'}`, 'info');
        this.logToConsole(`Connection status: ${this.socket && this.socket.connected ? 'Connected' : 'Disconnected'}`, 'info');
        this.logToConsole(`QTE active: ${this.qteActive ? 'Yes' : 'No'}`, 'info');
    }
    
    resetCurrentGame() {
        if (confirm('Are you sure you want to reset the current game?')) {
            this.logToConsole('Resetting game...', 'warning');
            
            if (this.socket && this.socket.connected) {
                this.socket.emit('adminCommand', { type: 'resetGame' });
            }
            
            if (this.isOfflineMode && this.offlineGameState) {
                this.startOfflineGame();
            }
        }
    }
    
    showServerInfo() {
        this.logToConsole('=== SERVER INFO ===', 'info');
        this.logToConsole(`Browser: ${navigator.userAgent}`, 'info');
        this.logToConsole(`Platform: ${navigator.platform}`, 'info');
        this.logToConsole(`Online: ${navigator.onLine ? 'Yes' : 'No'}`, 'info');
        this.logToConsole(`Socket connected: ${this.socket && this.socket.connected ? 'Yes' : 'No'}`, 'info');
        
        if (this.socket && this.socket.connected) {
            this.socket.emit('adminCommand', { type: 'serverInfo' });
        }
    }
    
    executeConsoleCommand() {
        const input = document.getElementById('consoleInput');
        const command = input.value.trim();
        
        if (!command) return;
        
        this.logToConsole(`> ${command}`, 'info');
        input.value = '';
        
        // Parse and execute command
        const parts = command.toLowerCase().split(' ');
        const cmd = parts[0];
        
        switch (cmd) {
            case 'help':
                this.logToConsole('Available commands:', 'info');
                this.logToConsole('help - Show this help', 'info');
                this.logToConsole('clear - Clear console', 'info');
                this.logToConsole('debug - Toggle debug mode', 'info');
                this.logToConsole('players - List all players', 'info');
                this.logToConsole('stats - Show game stats', 'info');
                this.logToConsole('kick [player] - Kick specific player', 'info');
                this.logToConsole('ban [player] - Ban specific player', 'info');
                break;
                
            case 'clear':
                this.clearConsole();
                break;
                
            case 'debug':
                this.toggleDebugMode();
                break;
                
            case 'players':
                this.viewAllPlayers();
                break;
                
            case 'stats':
                this.showGameStats();
                break;
                
            case 'kick':
                if (parts[1]) {
                    this.logToConsole(`Kicking player: ${parts[1]}`, 'warning');
                    if (this.socket && this.socket.connected) {
                        this.socket.emit('adminCommand', { type: 'kick', target: parts[1] });
                    }
                } else {
                    this.logToConsole('Usage: kick [player_name]', 'error');
                }
                break;
                
            case 'ban':
                if (parts[1]) {
                    this.bannedPlayers.add(parts[1].toLowerCase());
                    this.logToConsole(`Banned player: ${parts[1]}`, 'warning');
                } else {
                    this.logToConsole('Usage: ban [player_name]', 'error');
                }
                break;
                
            default:
                this.logToConsole(`Unknown command: ${cmd}. Type 'help' for available commands.`, 'error');
        }
    }
    
    clearConsole() {
        document.getElementById('adminConsole').innerHTML = '';
    }
    
    logToConsole(message, type = 'info') {
        const console = document.getElementById('adminConsole');
        const line = document.createElement('div');
        line.className = `console-line ${type}`;
        
        const timestamp = new Date().toLocaleTimeString();
        line.textContent = `[${timestamp}] ${message}`;
        
        console.appendChild(line);
        console.scrollTop = console.scrollHeight;
    }
    
    showDebugInfo() {
        // Create debug overlay if it doesn't exist
        if (!document.getElementById('debugInfo')) {
            const debugDiv = document.createElement('div');
            debugDiv.id = 'debugInfo';
            debugDiv.style.cssText = `
                position: fixed;
                top: 10px;
                right: 10px;
                background: rgba(0, 0, 0, 0.8);
                color: #00ff00;
                padding: 10px;
                font-family: monospace;
                font-size: 12px;
                z-index: 999;
                border-radius: 5px;
                min-width: 200px;
            `;
            document.body.appendChild(debugDiv);
        }
        
        this.updateDebugInfo();
    }
    
    hideDebugInfo() {
        // Clear debug timer
        if (this.debugUpdateTimer) {
            clearTimeout(this.debugUpdateTimer);
            this.debugUpdateTimer = null;
        }
        
        const debugDiv = document.getElementById('debugInfo');
        if (debugDiv) {
            debugDiv.remove();
        }
    }
    
    updateDebugInfo() {
        if (!this.debugMode) {
            if (this.debugUpdateTimer) {
                clearTimeout(this.debugUpdateTimer);
                this.debugUpdateTimer = null;
            }
            return;
        }
        
        const debugDiv = document.getElementById('debugInfo');
        if (!debugDiv) return;
        
        const info = [];
        info.push(`FPS: ${Math.round(1000 / 16)}`); // Approximate
        info.push(`Players: ${this.players.size}`);
        info.push(`Socket: ${this.socket && this.socket.connected ? 'Connected' : 'Disconnected'}`);
        info.push(`Room: ${this.currentRoom || 'None'}`);
        info.push(`QTE: ${this.qteActive ? 'Active' : 'Inactive'}`);
        
        if (this.gameState) {
            info.push(`Time: ${this.gameState.timeLeft || 0}s`);
            info.push(`Tags: ${this.gameState.tagCount || 0}`);
        }
        
        debugDiv.innerHTML = info.join('<br>');
        
        // Clear existing timer and set new one
        if (this.debugUpdateTimer) {
            clearTimeout(this.debugUpdateTimer);
        }
        
        if (this.debugMode) {
            this.debugUpdateTimer = setTimeout(() => this.updateDebugInfo(), 1000);
        }
    }
    
    broadcastMessage() {
        // Throttle broadcasts to prevent spam
        const now = Date.now();
        if (now - this.lastBroadcastTime < 2000) {
            this.logToConsole('Please wait 2 seconds between broadcasts', 'warning');
            return;
        }
        this.lastBroadcastTime = now;
        
        const message = document.getElementById('broadcastInput').value.trim();
        const messageType = document.getElementById('messageType').value;
        
        if (!message) {
            this.logToConsole('Please enter a message to broadcast', 'error');
            return;
        }
        
        if (message.length > 200) {
            this.logToConsole('Message too long (max 200 characters)', 'error');
            return;
        }
        
        this.logToConsole(`Broadcasting message: "${message}" (${messageType})`, 'info');
        
        // Send to server if connected
        if (this.socket && this.socket.connected) {
            this.socket.emit('adminCommand', { 
                type: 'broadcast', 
                message: message,
                messageType: messageType
            });
        }
        
        // Clear input
        document.getElementById('broadcastInput').value = '';
        
        // Show local notification for testing
        this.showSiteMessage(message, messageType, 'Admin');
    }
    
    setMessageOfDay() {
        const message = document.getElementById('broadcastInput').value.trim();
        const messageType = document.getElementById('messageType').value;
        
        if (!message) {
            this.logToConsole('Please enter a message to set as MOTD', 'error');
            return;
        }
        
        this.logToConsole(`Setting MOTD: "${message}" (${messageType})`, 'info');
        
        // Send to server if connected
        if (this.socket && this.socket.connected) {
            this.socket.emit('adminCommand', { 
                type: 'setMotd', 
                message: message,
                messageType: messageType
            });
        }
        
        // Clear input
        document.getElementById('broadcastInput').value = '';
    }
    
    showSiteMessage(message, type = 'info', sender = 'System') {
        // Prevent duplicate messages
        const messageKey = `${message}-${type}-${sender}`;
        if (this.activeMessages.has(messageKey)) {
            return;
        }
        this.activeMessages.add(messageKey);
        
        // Limit max messages (prevent crash)
        const existingMessages = document.querySelectorAll('.site-message');
        if (existingMessages.length >= 3) {
            // Remove oldest message
            existingMessages[0].remove();
        }
        
        // Create message overlay
        const messageOverlay = document.createElement('div');
        messageOverlay.className = `site-message ${type}`;
        messageOverlay.dataset.messageKey = messageKey;
        
        const messageContent = document.createElement('div');
        messageContent.className = 'site-message-content';
        
        const messageHeader = document.createElement('div');
        messageHeader.className = 'site-message-header';
        messageHeader.innerHTML = `
            <span class="message-icon">${this.getMessageIcon(type)}</span>
            <span class="message-sender">${sender}</span>
            <button class="message-close">×</button>
        `;
        
        const messageText = document.createElement('div');
        messageText.className = 'site-message-text';
        messageText.textContent = message;
        
        messageContent.appendChild(messageHeader);
        messageContent.appendChild(messageText);
        messageOverlay.appendChild(messageContent);
        
        // Cleanup function
        const cleanup = () => {
            if (messageOverlay.parentNode) {
                messageOverlay.remove();
            }
            this.activeMessages.delete(messageKey);
        };
        
        // Add to page
        document.body.appendChild(messageOverlay);
        
        // Close button functionality
        messageHeader.querySelector('.message-close').addEventListener('click', cleanup);
        
        // Auto-remove after 8 seconds
        setTimeout(cleanup, 8000);
        
        // Animate in
        setTimeout(() => {
            if (messageOverlay.parentNode) {
                messageOverlay.classList.add('show');
            }
        }, 100);
    }
    
    getMessageIcon(type) {
        switch (type) {
            case 'info': return '🔷';
            case 'warning': return '⚠️';
            case 'error': return '🚨';
            case 'success': return '📢';
            default: return '💬';
        }
    }
}
    
// Initialize game when page loads
let game;
document.addEventListener('DOMContentLoaded', () => {
    game = new MultiplayerTagGame();
});
