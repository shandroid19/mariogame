import React, { useEffect, useRef, useState } from "react";
import "./MarioGame.css";

interface GameObject {
  x: number;
  y: number;
  width: number;
  height: number;
  velocityX: number;
  velocityY: number;
  onGround: boolean;
}

interface Platform {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Brick {
  x: number;
  y: number;
  width: number;
  height: number;
  broken: boolean;
  hasPowerUp: boolean;
  powerUpType: "coin" | "speed" | "jump" | "shield" | null;
}

interface Coin {
  x: number;
  y: number;
  width: number;
  height: number;
  collected: boolean;
}

interface PowerUp {
  x: number;
  y: number;
  width: number;
  height: number;
  type: "speed" | "jump" | "shield";
  collected: boolean;
  velocityY: number;
}

interface MarioGameProps {
  onDarkModeChange: (darkMode: boolean) => void;
}

const MarioGame: React.FC<MarioGameProps> = ({ onDarkModeChange }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<
    "playing" | "paused" | "gameOver" | "won"
  >("playing");
  const [score, setScore] = useState(0);
  const [darkMode, setDarkMode] = useState(false);
  const [cameraX, setCameraX] = useState(0);
  const [gameSpeed, setGameSpeed] = useState(2);
  const [powerUpActive, setPowerUpActive] = useState<{
    speed: boolean;
    jump: boolean;
    shield: boolean;
  }>({ speed: false, jump: false, shield: false });

  // Game objects
  const playerRef = useRef<GameObject>({
    x: 100,
    y: 300,
    width: 30,
    height: 30,
    velocityX: 0,
    velocityY: 0,
    onGround: false,
  });

  const platformsRef = useRef<Platform[]>([
    // Starting ground
    { x: 0, y: 400, width: 200, height: 40 },
  ]);

  const bricksRef = useRef<Brick[]>([]);
  const enemiesRef = useRef<GameObject[]>([]);
  const coinsRef = useRef<Coin[]>([]);
  const powerUpsRef = useRef<PowerUp[]>([]);

  const keysRef = useRef<Set<string>>(new Set());
  const animationFrameRef = useRef<number | undefined>(undefined);

  // Game constants
  const GRAVITY = 0.8;
  const JUMP_FORCE = -15;
  const MOVE_SPEED = 5;
  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 450;
  const FINISH_LINE = 10000; // 10,000px to the right

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "p" || e.key === "P") {
        setGameState((prev) => (prev === "playing" ? "paused" : "playing"));
        return;
      }
      keysRef.current.add(e.key);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  useEffect(() => {
    const gameLoop = () => {
      if (gameState === "playing") {
        updateGame();
        renderGame();
      }
      animationFrameRef.current = requestAnimationFrame(gameLoop);
    };

    gameLoop();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [gameState]); // Removed darkMode dependency

  const spawnObstacles = () => {
    const lastPlatform = platformsRef.current[platformsRef.current.length - 1];
    const spawnX =
      lastPlatform.x + lastPlatform.width + Math.random() * 200 + 100;

    // Spawn platform
    const platformHeight = Math.random() * 60 + 20;
    const platformY = 400 - platformHeight;
    platformsRef.current.push({
      x: spawnX,
      y: platformY,
      width: Math.random() * 100 + 80,
      height: 20,
    });

    // Spawn bricks above the platform
    const brickCount = Math.floor(Math.random() * 3) + 1;
    for (let i = 0; i < brickCount; i++) {
      const brickX = spawnX + i * 30 + Math.random() * 20;
      const brickY = platformY - 30 - i * 30;
      const hasPowerUp = Math.random() > 0.7; // 30% chance for power-up
      let powerUpType: "coin" | "speed" | "jump" | "shield" | null = null;

      if (hasPowerUp) {
        const powerUpChance = Math.random();
        if (powerUpChance < 0.4) powerUpType = "coin";
        else if (powerUpChance < 0.6) powerUpType = "speed";
        else if (powerUpChance < 0.8) powerUpType = "jump";
        else powerUpType = "shield";
      }

      bricksRef.current.push({
        x: brickX,
        y: brickY,
        width: 25,
        height: 25,
        broken: false,
        hasPowerUp,
        powerUpType,
      });
    }

    // Spawn enemy on the platform
    if (Math.random() > 0.3) {
      // 70% chance to spawn enemy
      enemiesRef.current.push({
        x: spawnX + 20,
        y: platformY - 25,
        width: 25,
        height: 25,
        velocityX: Math.random() > 0.5 ? 1.5 : -1.5,
        velocityY: 0,
        onGround: true,
      });
    }

    // Spawn coin
    if (Math.random() > 0.2) {
      // 80% chance to spawn coin
      coinsRef.current.push({
        x: spawnX + Math.random() * 60 + 10,
        y: platformY - 40,
        width: 20,
        height: 20,
        collected: false,
      });
    }

    // Remove old platforms and objects that are far behind
    const cleanupDistance = cameraX - 200;
    platformsRef.current = platformsRef.current.filter(
      (p) => p.x + p.width > cleanupDistance
    );
    bricksRef.current = bricksRef.current.filter((b) => b.x > cleanupDistance);
    enemiesRef.current = enemiesRef.current.filter(
      (e) => e.x > cleanupDistance
    );
    coinsRef.current = coinsRef.current.filter((c) => c.x > cleanupDistance);
    powerUpsRef.current = powerUpsRef.current.filter(
      (p) => p.x > cleanupDistance
    );
  };

  const activatePowerUp = (type: "speed" | "jump" | "shield") => {
    setPowerUpActive((prev) => ({ ...prev, [type]: true }));

    // Deactivate power-up after some time
    setTimeout(() => {
      setPowerUpActive((prev) => ({ ...prev, [type]: false }));
    }, 10000); // 10 seconds
  };

  const updateGame = () => {
    const player = playerRef.current;
    const platforms = platformsRef.current;
    const enemies = enemiesRef.current;
    const bricks = bricksRef.current;
    const powerUps = powerUpsRef.current;

    // Handle input with power-up modifications
    let currentMoveSpeed = MOVE_SPEED;
    let currentJumpForce = JUMP_FORCE;

    if (powerUpActive.speed) currentMoveSpeed *= 1.5;
    if (powerUpActive.jump) currentJumpForce *= 1.3;

    if (keysRef.current.has("ArrowLeft") || keysRef.current.has("a")) {
      player.velocityX = -currentMoveSpeed;
    } else if (keysRef.current.has("ArrowRight") || keysRef.current.has("d")) {
      player.velocityX = currentMoveSpeed;
    } else {
      player.velocityX *= 0.8; // Friction
    }

    if (
      (keysRef.current.has("ArrowUp") ||
        keysRef.current.has("w") ||
        keysRef.current.has(" ")) &&
      player.onGround
    ) {
      player.velocityY = currentJumpForce;
      player.onGround = false;
    }

    // Update player physics
    player.velocityY += GRAVITY;
    player.x += player.velocityX;
    player.y += player.velocityY;

    // Check if we need to spawn new obstacles
    const lastPlatform = platformsRef.current[platformsRef.current.length - 1];
    if (lastPlatform && player.x > lastPlatform.x - 200) {
      spawnObstacles();
    }

    // Update camera to follow player smoothly
    const targetCameraX = player.x - CANVAS_WIDTH / 2;
    const clampedCameraX = Math.max(
      0,
      Math.min(targetCameraX, FINISH_LINE - CANVAS_WIDTH)
    );

    // Smooth camera movement with different speeds for different directions
    let cameraSpeed = 0.3; // Increased default speed for better responsiveness

    // If player is moving right, make camera follow more quickly
    if (player.velocityX > 0) {
      cameraSpeed = 0.4;
    }
    // If player is moving left, make camera follow more slowly
    else if (player.velocityX < 0) {
      cameraSpeed = 0.2;
    }

    setCameraX((prev) => prev + (clampedCameraX - prev) * cameraSpeed);

    // Check platform collisions
    player.onGround = false;
    for (const platform of platforms) {
      if (
        player.x < platform.x + platform.width &&
        player.x + player.width > platform.x &&
        player.y < platform.y + platform.height &&
        player.y + player.height > platform.y
      ) {
        // Landing on top of platform
        if (player.velocityY > 0 && player.y < platform.y) {
          player.y = platform.y - player.height;
          player.velocityY = 0;
          player.onGround = true;
        }
        // Hitting platform from below
        else if (player.velocityY < 0 && player.y > platform.y) {
          player.y = platform.y + platform.height;
          player.velocityY = 0;
        }
        // Hitting platform from left
        else if (player.velocityX > 0 && player.x < platform.x) {
          player.x = platform.x - player.width;
          player.velocityX = 0;
        }
        // Hitting platform from right
        else if (player.velocityX < 0 && player.x > platform.x) {
          player.x = platform.x + platform.width;
          player.velocityX = 0;
        }
      }
    }

    // Check brick collisions (head hitting from below)
    for (const brick of bricks) {
      if (
        !brick.broken &&
        player.x < brick.x + brick.width &&
        player.x + player.width > brick.x &&
        player.y < brick.y + brick.height &&
        player.y + player.height > brick.y
      ) {
        // Player hit brick from below with head
        if (player.velocityY < 0 && player.y > brick.y) {
          brick.broken = true;

          if (brick.hasPowerUp && brick.powerUpType) {
            if (brick.powerUpType === "coin") {
              setScore((prev) => prev + 100);
            } else {
              // Spawn power-up
              powerUpsRef.current.push({
                x: brick.x,
                y: brick.y + brick.height,
                width: 20,
                height: 20,
                type: brick.powerUpType,
                collected: false,
                velocityY: 0,
              });
            }
          }

          // Bounce player down slightly
          player.velocityY = 2;
        }
      }
    }

    // Update power-ups physics
    for (const powerUp of powerUps) {
      if (!powerUp.collected) {
        powerUp.velocityY += GRAVITY * 0.5; // Slower fall
        powerUp.y += powerUp.velocityY;

        // Check if power-up landed on a platform
        for (const platform of platforms) {
          if (
            powerUp.x < platform.x + platform.width &&
            powerUp.x + powerUp.width > platform.x &&
            powerUp.y < platform.y + platform.height &&
            powerUp.y + powerUp.height > platform.y
          ) {
            if (powerUp.velocityY > 0 && powerUp.y < platform.y) {
              powerUp.y = platform.y - powerUp.height;
              powerUp.velocityY = 0;
            }
          }
        }

        // Check collision with player
        if (
          player.x < powerUp.x + powerUp.width &&
          player.x + player.width > powerUp.x &&
          player.y < powerUp.y + powerUp.height &&
          player.y + player.height > powerUp.y
        ) {
          powerUp.collected = true;
          activatePowerUp(powerUp.type);
          setScore((prev) => prev + 50);
        }
      }
    }

    // Update enemies with improved AI
    for (const enemy of enemies) {
      enemy.x += enemy.velocityX;

      // Check if enemy is about to fall off platform
      let onPlatform = false;
      let platformLeft = 0;
      let platformRight = 0;

      for (const platform of platforms) {
        if (
          enemy.x < platform.x + platform.width &&
          enemy.x + enemy.width > platform.x &&
          enemy.y < platform.y + platform.height &&
          enemy.y + enemy.height > platform.y
        ) {
          onPlatform = true;
          platformLeft = platform.x;
          platformRight = platform.x + platform.width;
          break;
        }
      }

      // Reverse direction when reaching platform edges
      if (
        !onPlatform ||
        enemy.x <= platformLeft ||
        enemy.x + enemy.width >= platformRight
      ) {
        enemy.velocityX *= -1;
        // Adjust position to prevent getting stuck
        if (enemy.x <= platformLeft) {
          enemy.x = platformLeft;
        } else if (enemy.x + enemy.width >= platformRight) {
          enemy.x = platformRight - enemy.width;
        }
      }

      // Check collision with player
      if (
        player.x < enemy.x + enemy.width &&
        player.x + player.width > enemy.x &&
        player.y < enemy.y + enemy.height &&
        player.y + player.height > enemy.y
      ) {
        // Player hit enemy from above
        if (player.velocityY > 0 && player.y < enemy.y) {
          // Remove enemy
          const index = enemies.indexOf(enemy);
          if (index > -1) {
            enemies.splice(index, 1);
            setScore((prev) => prev + 100);
          }
          player.velocityY = JUMP_FORCE / 2; // Bounce
        } else {
          // Player gets hit (unless shield is active)
          if (!powerUpActive.shield) {
            setGameState("gameOver");
          }
        }
      }
    }

    // Check coin collection
    for (const coin of coinsRef.current) {
      if (
        !coin.collected &&
        player.x < coin.x + coin.width &&
        player.x + player.width > coin.x &&
        player.y < coin.y + coin.height &&
        player.y + player.height > coin.y
      ) {
        coin.collected = true;
        setScore((prev) => prev + 50);
      }
    }

    // Check win condition - reached finish line
    if (player.x >= FINISH_LINE) {
      setGameState("won");
    }

    // Keep player in bounds (no falling off screen)
    if (player.x < 0) player.x = 0;
    if (player.y > 400) {
      // Keep player above ground level
      player.y = 400;
      player.velocityY = 0;
      player.onGround = true;
    }

    // Increase game speed over time
    setGameSpeed(2 + Math.floor(player.x / 1000));
  };

  const renderGame = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas with theme-based background
    const bgColor = darkMode ? "#1a1a2e" : "#87CEEB";
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Save context for camera transformation
    ctx.save();
    ctx.translate(-cameraX, 0);

    // Draw finish line
    ctx.fillStyle = darkMode ? "#00ff00" : "#00ff00";
    ctx.fillRect(FINISH_LINE, 0, 10, CANVAS_HEIGHT);
    ctx.fillStyle = darkMode ? "#ffffff" : "#000000";
    ctx.font = "24px 'Segoe UI', Arial, sans-serif";
    ctx.fillText("FINISH", FINISH_LINE + 20, 50);

    // Draw platforms with theme-based colors
    const platformColor = darkMode ? "#4a4a4a" : "#8B4513";
    ctx.fillStyle = platformColor;
    for (const platform of platformsRef.current) {
      ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
    }

    // Draw bricks
    const brickColor = darkMode ? "#8B4513" : "#CD853F";
    ctx.fillStyle = brickColor;
    for (const brick of bricksRef.current) {
      if (!brick.broken) {
        ctx.fillRect(brick.x, brick.y, brick.width, brick.height);

        // Draw power-up indicator
        if (brick.hasPowerUp && brick.powerUpType) {
          ctx.fillStyle = darkMode ? "#FFD700" : "#FF0000";
          ctx.fillRect(brick.x + 5, brick.y + 5, 15, 15);
          ctx.fillStyle = brickColor;
        }
      }
    }

    // Draw player with theme-based color and power-up effects
    let playerColor = darkMode ? "#ff6b6b" : "#FF0000";
    if (powerUpActive.shield) {
      playerColor = darkMode ? "#00ffff" : "#00FFFF"; // Cyan when shield is active
    }
    ctx.fillStyle = playerColor;
    const player = playerRef.current;
    ctx.fillRect(player.x, player.y, player.width, player.height);

    // Draw enemies with theme-based color
    const enemyColor = darkMode ? "#a855f7" : "#800080";
    ctx.fillStyle = enemyColor;
    for (const enemy of enemiesRef.current) {
      ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
    }

    // Draw coins with theme-based color
    const coinColor = darkMode ? "#fbbf24" : "#FFD700";
    ctx.fillStyle = coinColor;
    for (const coin of coinsRef.current) {
      if (!coin.collected) {
        ctx.beginPath();
        ctx.arc(
          coin.x + coin.width / 2,
          coin.y + coin.height / 2,
          coin.width / 2,
          0,
          2 * Math.PI
        );
        ctx.fill();
      }
    }

    // Draw power-ups
    for (const powerUp of powerUpsRef.current) {
      if (!powerUp.collected) {
        let powerUpColor = "#FF0000";
        switch (powerUp.type) {
          case "speed":
            powerUpColor = darkMode ? "#00ff00" : "#00FF00";
            break;
          case "jump":
            powerUpColor = darkMode ? "#ff00ff" : "#FF00FF";
            break;
          case "shield":
            powerUpColor = darkMode ? "#00ffff" : "#00FFFF";
            break;
        }
        ctx.fillStyle = powerUpColor;
        ctx.fillRect(powerUp.x, powerUp.y, powerUp.width, powerUp.height);
      }
    }

    // Restore context for UI elements
    ctx.restore();

    // Draw score with theme-based color
    const textColor = darkMode ? "#ffffff" : "#000000";
    ctx.fillStyle = textColor;
    ctx.font = "20px 'Segoe UI', Arial, sans-serif";
    ctx.fillText(`Score: ${score}`, 10, 30);

    // Draw level progress
    const progress = Math.min((player.x / FINISH_LINE) * 100, 100);
    ctx.fillText(`Progress: ${Math.round(progress)}%`, 10, 60);

    // Draw distance to finish
    const distanceLeft = Math.max(0, FINISH_LINE - player.x);
    ctx.fillText(`Distance: ${Math.round(distanceLeft)}px`, 10, 90);

    // Draw game speed
    ctx.fillText(`Speed: ${gameSpeed}x`, 10, 120);

    // Draw power-up status
    if (powerUpActive.speed) ctx.fillText(`SPEED BOOST!`, 10, 150);
    if (powerUpActive.jump) ctx.fillText(`JUMP BOOST!`, 10, 180);
    if (powerUpActive.shield) ctx.fillText(`SHIELD ACTIVE!`, 10, 210);

    // Draw camera position for debugging
    ctx.fillText(`Camera: ${Math.round(cameraX)}px`, 10, 240);
    ctx.fillText(`Player: ${Math.round(player.x)}px`, 10, 270);

    // Draw instructions with theme-based color
    ctx.fillStyle = textColor;
    ctx.font = "16px 'Segoe UI', Arial, sans-serif";
    ctx.fillText(
      "Use WASD or Arrow Keys to move, Space to jump",
      10,
      CANVAS_HEIGHT - 20
    );
  };

  const resetGame = () => {
    playerRef.current = {
      x: 100,
      y: 300,
      width: 30,
      height: 30,
      velocityX: 0,
      velocityY: 0,
      onGround: false,
    };

    // Reset platforms to just starting ground
    platformsRef.current = [{ x: 0, y: 400, width: 200, height: 40 }];

    // Clear all objects
    bricksRef.current = [];
    enemiesRef.current = [];
    coinsRef.current = [];
    powerUpsRef.current = [];

    setScore(0);
    setCameraX(0);
    setGameSpeed(2);
    setPowerUpActive({ speed: false, jump: false, shield: false });
    setGameState("playing");
  };

  const toggleDarkMode = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    onDarkModeChange(newDarkMode);
  };

  return (
    <div className={`mario-game ${darkMode ? "dark-mode" : ""}`}>
      <div className="game-header">
        <h1>Mario Brick Breaker</h1>
        <button className="theme-toggle" onClick={toggleDarkMode}>
          {darkMode ? "☀️ Light Mode" : "🌙 Dark Mode"}
        </button>
      </div>

      <div className="game-container">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="game-canvas"
        />

        {gameState === "gameOver" && (
          <div className="game-over">
            <h2>Game Over!</h2>
            <p>Final Score: {score}</p>
            <p>Distance Reached: {Math.round(playerRef.current.x)}px</p>
            <button onClick={resetGame}>Play Again</button>
          </div>
        )}

        {gameState === "won" && (
          <div className="game-over">
            <h2>You Won! 🎉</h2>
            <p>Final Score: {score}</p>
            <p>You reached the finish line!</p>
            <button onClick={resetGame}>Play Again</button>
          </div>
        )}

        {gameState === "paused" && (
          <div className="pause-menu">
            <h2>Paused</h2>
            <button onClick={() => setGameState("playing")}>Resume</button>
          </div>
        )}
      </div>

      <div className="controls">
        <h3>Controls:</h3>
        <p>WASD or Arrow Keys - Move</p>
        <p>Space - Jump</p>
        <p>P - Pause</p>
        <div className="level-info">
          <p>Finish Line: {FINISH_LINE}px</p>
          <p>Current Speed: {gameSpeed}x</p>
          <p>Bricks: {bricksRef.current.filter((b) => !b.broken).length}</p>
          <p>Enemies: {enemiesRef.current.length}</p>
          <p>
            Coins: {coinsRef.current.filter((c) => !c.collected).length}/
            {coinsRef.current.length}
          </p>
        </div>
      </div>
    </div>
  );
};

export default MarioGame;
