# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

This is a real-time multiplayer tag game built with Node.js, Express, Socket.IO, and vanilla client-side JavaScript. Players can join rooms and play tag with each other over the internet in real-time.

## Development Commands

**Install dependencies:**
```bash
npm install
```

**Start the multiplayer server:**
```bash
npm start
# Server runs on http://localhost:3000
```

**Development with auto-restart:**
```bash
npm run dev
# Uses nodemon for automatic server restart on file changes
```

**Testing:**
- Open multiple browser windows/tabs to http://localhost:3000
- Enter different player names and the same room ID
- Test multiplayer functionality with 2+ players

## Architecture

### File Structure
- **server.js** - Node.js server with Express and Socket.IO for multiplayer functionality
- **package.json** - Node.js project configuration and dependencies
- **index.html** - Client-side HTML with room selection and game UI
- **script.js** - Client-side JavaScript with WebSocket communication and game rendering
- **style.css** - All styling including multiplayer UI elements and game animations
- **README.md** - User-facing documentation and game instructions
- **WARP.md** - This file with development guidance

### Code Architecture

**Server-Side (`server.js`):**
- **Game Class**: Manages individual game rooms with player state and game logic
- **Socket.IO Events**: Handles real-time communication between clients
- **Room Management**: Creates/destroys game rooms as players join/leave
- **Collision Detection**: Server-side validation of player interactions
- **Game State Synchronization**: Broadcasts game updates to all players in a room

**Client-Side (`script.js`):**
- **MultiplayerTagGame Class**: Handles WebSocket communication and game rendering
- **Real-time Movement**: Throttled movement updates sent to server (~60fps)
- **State Synchronization**: Receives and renders other players' positions
- **UI Management**: Room joining, player lists, connection status
- **Local Prediction**: Immediate local movement for responsiveness

**Key Multiplayer Systems:**
1. **Room System**: Players can create/join named rooms for isolated game sessions
2. **Real-time Communication**: WebSocket connections for instant player synchronization
3. **Movement System**: Client-side prediction with server-side validation
4. **Tag System**: Server-side collision detection and "IT" status management
5. **Game State Management**: Centralized game state with client synchronization
6. **Connection Handling**: Graceful handling of player disconnections

### CSS Architecture
- **Responsive Design**: Mobile-friendly with media queries
- **Component-based Styling**: Separate classes for game elements (`.player`, `.target`, `.game-area`)
- **Visual Effects**: CSS transitions, transforms, gradients, and box shadows
- **Layout System**: Flexbox for centering and responsive score board

## Key Multiplayer Mechanics

**Room System:**
- Players enter name and room ID to join games
- Each room supports 2+ players (game starts with 2 minimum)
- Rooms are automatically created and destroyed as needed

**Real-time Tag Gameplay:**
- One player starts as "IT" (second player to join)
- Players tag each other by touching (collision detection)
- "IT" status switches when tagged, with 2-second cooldown
- Goal: Avoid being "IT" when 60-second timer expires

**Network Architecture:**
- Client sends movement input to server
- Server validates movement and handles collisions
- Server broadcasts game state changes to all clients
- Local prediction for smooth movement feel

## Development Guidelines

**Server-Side Development:**
- Use ES6 class syntax for game rooms and logic
- Handle player disconnections gracefully
- Validate all client input on server side
- Use Map data structures for efficient player/room lookups
- Log important events for debugging

**Client-Side Development:**
- Minimize network traffic with movement throttling
- Implement local prediction for responsive feel
- Handle connection errors and reconnection
- Use clear visual feedback for network states

**Testing Multiplayer Features:**
- Test with multiple browser windows/tabs
- Verify player synchronization across clients
- Test disconnection/reconnection scenarios
- Check game state consistency between players
- Test room creation/joining with various inputs

## Debugging

**Server-Side Issues:**
- **Port conflicts**: Ensure port 3000 is not in use by other applications
- **Socket connections**: Check server console for connection/disconnection logs
- **Game state sync**: Verify server game state matches client expectations
- **Memory leaks**: Monitor server memory usage with multiple rooms/players

**Client-Side Issues:**
- **Connection problems**: Check browser console for Socket.IO errors
- **Movement lag**: Verify movement throttling and network latency
- **Player desync**: Check if server state differs from client state
- **UI state issues**: Debug room selection and game screen transitions

**Network Debugging:**
- Use browser dev tools Network tab to monitor WebSocket traffic
- Check Socket.IO connection status in console
- Test on localhost first, then test across network
- Monitor server logs for detailed event flow
