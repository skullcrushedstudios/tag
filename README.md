# Tag Game

A simple browser-based tag game where you control a blue player and try to catch as many red targets as possible within 60 seconds!

## How to Play

1. Open `index.html` in your web browser
2. Click "Start Game" to begin
3. Use **WASD** keys or **Arrow Keys** to move your blue player around the game area
4. Touch the red targets to score points
5. Try to catch as many targets as possible before time runs out!

## Game Features

- **Smooth Movement**: Responsive WASD/Arrow key controls
- **Collision Detection**: Precise collision detection between player and targets
- **Random Target Spawning**: Targets spawn at random locations (avoiding the player)
- **Score Tracking**: Keep track of how many targets you've caught
- **Timer**: 60-second countdown timer
- **Visual Feedback**: Targets briefly scale up when caught
- **Responsive Design**: Works on different screen sizes
- **Game Over Screen**: Shows final score with option to play again

## Technical Details

- **HTML5**: Clean semantic structure
- **CSS3**: Modern styling with gradients, shadows, and animations
- **Vanilla JavaScript**: Object-oriented game class with smooth game loop
- **No Dependencies**: Pure HTML/CSS/JS - no frameworks required

## File Structure

```
tag-game/
├── index.html      # Main HTML structure
├── style.css       # Game styling and animations
├── script.js       # Game logic and mechanics
└── README.md       # This file
```

## Controls

- **W** or **↑**: Move up
- **A** or **←**: Move left  
- **S** or **↓**: Move down
- **D** or **→**: Move right

## Game Mechanics

- Player starts in the center of the game area
- Targets spawn randomly but not too close to the player
- Each target caught increases your score by 1
- Game ends when timer reaches 0
- Player movement is bounded within the game area

## Future Enhancements

Potential features that could be added:
- Multiple difficulty levels
- Power-ups and special targets
- High score persistence
- Sound effects
- Mobile touch controls
- Multiplayer support

## Getting Started

Simply download the files and open `index.html` in any modern web browser. No server setup required!

Enjoy the game! 🎮