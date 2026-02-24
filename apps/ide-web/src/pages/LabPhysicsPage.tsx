/**
 * Physics Playground - Interactive physics simulation demos
 *
 * Demonstrates the corrected physics system with:
 * 1. Gravity and ground constraints
 * 2. Player movement and collisions
 * 3. Enemy AI and contact damage
 * 4. Projectile physics and hit detection
 * 5. Collision resolution
 */

import React, { useState, useEffect, useRef } from "react";
import { Vector3 } from "../math/Vector3";
import {
  PhysicsSimulator,
  Player,
  Enemy,
  Projectile,
  PhysicsObject,
} from "../math/Physics";
import "./LabPhysicsPage.css";

type SimulationMode =
  | "gravity"
  | "player"
  | "enemies"
  | "projectiles"
  | "collision";

const LabPhysicsPage: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  const [mode, setMode] = useState<SimulationMode>("gravity");
  const [isPlaying, setIsPlaying] = useState(true);
  const [time, setTime] = useState(0);

  // Physics simulator
  const simulatorRef = useRef<PhysicsSimulator | null>(null);
  const lastTimeRef = useRef<number>(0);

  // Controls
  const [gravity, setGravity] = useState(-9.8);
  const [enemyCount, setEnemyCount] = useState(3);
  const [playerSpeed, setPlayerSpeed] = useState(15);

  // Input state
  const keysPressed = useRef<Set<string>>(new Set());

  // Initialize physics simulator
  useEffect(() => {
    simulatorRef.current = new PhysicsSimulator({
      gravity: gravity,
      damping: 0.99,
      maxVelocity: 50,
      timestep: 1.0 / 60.0,
      useFixedTimestep: true,
    });

    setupScene();
  }, [mode, gravity, enemyCount]);

  const setupScene = () => {
    const sim = simulatorRef.current;
    if (!sim) return;

    // Clear previous scene
    sim.player = null;
    sim.enemies = [];
    sim.projectiles = [];
    sim.staticObjects = [];

    switch (mode) {
      case "gravity":
        setupGravityDemo(sim);
        break;
      case "player":
        setupPlayerDemo(sim);
        break;
      case "enemies":
        setupEnemiesDemo(sim);
        break;
      case "projectiles":
        setupProjectilesDemo(sim);
        break;
      case "collision":
        setupCollisionDemo(sim);
        break;
    }
  };

  const setupGravityDemo = (sim: PhysicsSimulator) => {
    // Drop several objects with different masses
    for (let i = 0; i < 5; i++) {
      const obj = new PhysicsObject(
        1 + i * 0.5, // Varying mass
        new Vector3(-15 + i * 7, 20 + i * 3, 0),
        Vector3.zero,
        0.5 + i * 0.2
      );
      sim.addStaticObject(obj);
    }
  };

  const setupPlayerDemo = (sim: PhysicsSimulator) => {
    const player = new Player(new Vector3(0, 1, 0));
    player.moveSpeed = playerSpeed;
    sim.setPlayer(player);
  };

  const setupEnemiesDemo = (sim: PhysicsSimulator) => {
    const player = new Player(new Vector3(0, 1, 0));
    sim.setPlayer(player);

    // Spawn enemies in a circle around player
    for (let i = 0; i < enemyCount; i++) {
      const angle = (i / enemyCount) * Math.PI * 2;
      const radius = 15;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      const enemy = new Enemy(new Vector3(x, 1, z));
      enemy.chaseSpeed = 8 + Math.random() * 4;
      sim.addEnemy(enemy);
    }
  };

  const setupProjectilesDemo = (sim: PhysicsSimulator) => {
    const player = new Player(new Vector3(0, 1, 0));
    sim.setPlayer(player);

    // Spawn enemies
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2;
      const radius = 12;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      const enemy = new Enemy(new Vector3(x, 1, z));
      enemy.chaseSpeed = 5;
      sim.addEnemy(enemy);
    }
  };

  const setupCollisionDemo = (sim: PhysicsSimulator) => {
    // Create several physics objects that will collide
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const radius = 15;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      const obj = new PhysicsObject(
        1.0,
        new Vector3(x, 1, z),
        new Vector3(-x * 0.3, 0, -z * 0.3), // Velocity toward center
        0.8
      );
      sim.addStaticObject(obj);
    }
  };

  // Handle keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current.add(e.key.toLowerCase());
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.key.toLowerCase());
    };

    const handleClick = (e: MouseEvent) => {
      if (mode === "projectiles" && simulatorRef.current?.player) {
        fireProjectile();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("click", handleClick);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("click", handleClick);
    };
  }, [mode]);

  const fireProjectile = () => {
    const sim = simulatorRef.current;
    if (!sim || !sim.player) return;

    const player = sim.player;
    const direction = new Vector3(
      Math.cos(time * 0.5),
      0.1,
      Math.sin(time * 0.5)
    ).normalize();

    const projectile = new Projectile(
      player.position.add(new Vector3(0, 0.5, 0)),
      direction.multiply(30)
    );

    sim.addProjectile(projectile);
  };

  const processPlayerInput = () => {
    const sim = simulatorRef.current;
    if (!sim || !sim.player) return;

    let moveX = 0;
    let moveZ = 0;

    if (keysPressed.current.has("w")) moveZ -= 1;
    if (keysPressed.current.has("s")) moveZ += 1;
    if (keysPressed.current.has("a")) moveX -= 1;
    if (keysPressed.current.has("d")) moveX += 1;

    if (moveX !== 0 || moveZ !== 0) {
      const moveDirection = new Vector3(moveX, 0, moveZ).normalize();
      sim.applyPlayerInput(moveDirection);
    }
  };

  // Animation loop
  useEffect(() => {
    if (!isPlaying) return;

    lastTimeRef.current = performance.now();

    const animate = (currentTime: number) => {
      const dt = (currentTime - lastTimeRef.current) / 1000;
      lastTimeRef.current = currentTime;

      // Update time
      setTime((t) => t + dt);

      // Process player input
      if (mode === "player" || mode === "enemies" || mode === "projectiles") {
        processPlayerInput();
      }

      // Update physics
      if (simulatorRef.current) {
        simulatorRef.current.update(dt);
      }

      // Render
      render();

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, mode]);

  const render = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const sim = simulatorRef.current;
    if (!sim) return;

    // Clear canvas
    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const scale = 15;

    // Project 3D to 2D (top-down view)
    const project = (pos: Vector3): [number, number] => {
      return [centerX + pos.x * scale, centerY + pos.z * scale];
    };

    // Draw ground grid
    ctx.strokeStyle = "#1a1a2f";
    ctx.lineWidth = 1;
    for (let i = -20; i <= 20; i += 2) {
      // Horizontal lines
      const [x1, y1] = project(new Vector3(-20, 0, i));
      const [x2, y2] = project(new Vector3(20, 0, i));
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // Vertical lines
      const [x3, y3] = project(new Vector3(i, 0, -20));
      const [x4, y4] = project(new Vector3(i, 0, 20));
      ctx.beginPath();
      ctx.moveTo(x3, y3);
      ctx.lineTo(x4, y4);
      ctx.stroke();
    }

    // Draw player
    if (sim.player) {
      const [x, y] = project(sim.player.position);
      ctx.fillStyle = sim.player.isDead ? "#666" : "#00ff88";
      ctx.beginPath();
      ctx.arc(x, y, sim.player.radius * scale, 0, Math.PI * 2);
      ctx.fill();

      // Health bar
      if (!sim.player.isDead) {
        const barWidth = 40;
        const barHeight = 4;
        const healthPercent = sim.player.hp / sim.player.maxHp;

        ctx.fillStyle = "#333";
        ctx.fillRect(x - barWidth / 2, y - 25, barWidth, barHeight);

        ctx.fillStyle = healthPercent > 0.5 ? "#00ff88" : "#ff4444";
        ctx.fillRect(
          x - barWidth / 2,
          y - 25,
          barWidth * healthPercent,
          barHeight
        );
      }
    }

    // Draw enemies
    for (const enemy of sim.enemies) {
      const [x, y] = project(enemy.position);
      ctx.fillStyle = enemy.isAlive() ? "#ff4444" : "#666";
      ctx.beginPath();
      ctx.arc(x, y, enemy.radius * scale, 0, Math.PI * 2);
      ctx.fill();

      // Health bar
      if (enemy.isAlive()) {
        const barWidth = 30;
        const barHeight = 3;
        const healthPercent = enemy.hp / enemy.maxHp;

        ctx.fillStyle = "#333";
        ctx.fillRect(x - barWidth / 2, y - 20, barWidth, barHeight);

        ctx.fillStyle = "#ff8844";
        ctx.fillRect(
          x - barWidth / 2,
          y - 20,
          barWidth * healthPercent,
          barHeight
        );
      }
    }

    // Draw projectiles
    for (const projectile of sim.projectiles) {
      const [x, y] = project(projectile.position);
      ctx.fillStyle = "#44aaff";
      ctx.beginPath();
      ctx.arc(x, y, projectile.hitRadius * scale, 0, Math.PI * 2);
      ctx.fill();

      // Trail
      const vel = projectile.velocity;
      const trailStart = projectile.position.subtract(vel.normalize().multiply(2));
      const [tx, ty] = project(trailStart);
      ctx.strokeStyle = "rgba(68, 170, 255, 0.3)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(x, y);
      ctx.stroke();
    }

    // Draw static objects
    for (const obj of sim.staticObjects) {
      const [x, y] = project(obj.position);

      // Height indicator (shadow)
      const shadowSize = obj.radius * scale * (1 - obj.position.y / 30);
      ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
      ctx.beginPath();
      ctx.arc(x, y, Math.max(0, shadowSize), 0, Math.PI * 2);
      ctx.fill();

      // Object
      const height = obj.position.y;
      const brightness = Math.min(255, 100 + height * 5);
      ctx.fillStyle = `rgb(${brightness}, ${brightness}, ${brightness})`;
      ctx.beginPath();
      ctx.arc(x, y - height * scale * 0.5, obj.radius * scale, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw metrics
    const metrics = sim.getMetrics();
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px monospace";
    ctx.fillText(`Objects: ${metrics.objectCount}`, 10, 20);
    ctx.fillText(
      `Energy: ${metrics.physicsEnergy.toFixed(1)} J`,
      10,
      35
    );
    ctx.fillText(
      `Avg Velocity: ${metrics.averageVelocity.toFixed(2)} m/s`,
      10,
      50
    );
    ctx.fillText(`Time: ${time.toFixed(1)}s`, 10, 65);
  };

  const handleReset = () => {
    setTime(0);
    setupScene();
  };

  const getModeDescription = (): string => {
    switch (mode) {
      case "gravity":
        return "Objects fall with gravity and bounce on ground. Ground constraint prevents infinite velocity buildup.";
      case "player":
        return "Control player with WASD. Player physics with movement, gravity, and ground collision.";
      case "enemies":
        return "Enemies chase player using AI. Contact with enemies deals damage. Player can die.";
      case "projectiles":
        return "Click to fire projectiles. Symmetric collision detection includes enemy radius.";
      case "collision":
        return "Multiple objects collide and resolve overlaps using sphere-sphere collision.";
      default:
        return "";
    }
  };

  const getModeFormula = (): string => {
    switch (mode) {
      case "gravity":
        return "F = mg, v ← v + a*dt, p ← p + v*dt";
      case "player":
        return "F_input = direction * moveSpeed * mass";
      case "enemies":
        return "F_chase = normalize(player - enemy) * chaseSpeed * mass";
      case "projectiles":
        return "hit = distance < (r_projectile + r_enemy)";
      case "collision":
        return "overlap = (r1 + r2) - distance, pushout = overlap/2";
      default:
        return "";
    }
  };

  return (
    <div className="lab-physics-container">
      <div className="lab-physics-wrapper">
        <h1 className="lab-physics-title">Physics Playground</h1>
        <p className="lab-physics-subtitle">
          Production-grade physics with corrected ground constraints, symmetric
          collisions, and dead player defense
        </p>

        <div className="lab-physics-main">
          {/* Canvas */}
          <div className="lab-physics-canvas-section">
            <canvas
              ref={canvasRef}
              width={800}
              height={600}
              className="lab-physics-canvas"
            />

            {/* Mode tabs */}
            <div className="lab-physics-mode-tabs">
              <button
                type="button"
                onClick={() => setMode("gravity")}
                className={`lab-physics-tab ${mode === "gravity" ? "active" : ""}`}
              >
                Gravity
              </button>
              <button
                type="button"
                onClick={() => setMode("player")}
                className={`lab-physics-tab ${mode === "player" ? "active" : ""}`}
              >
                Player
              </button>
              <button
                type="button"
                onClick={() => setMode("enemies")}
                className={`lab-physics-tab ${mode === "enemies" ? "active" : ""}`}
              >
                Enemies
              </button>
              <button
                type="button"
                onClick={() => setMode("projectiles")}
                className={`lab-physics-tab ${mode === "projectiles" ? "active" : ""}`}
              >
                Projectiles
              </button>
              <button
                type="button"
                onClick={() => setMode("collision")}
                className={`lab-physics-tab ${mode === "collision" ? "active" : ""}`}
              >
                Collisions
              </button>
            </div>
          </div>

          {/* Controls */}
          <div className="lab-physics-controls">
            <h3 className="lab-physics-controls-title">Controls</h3>

            {/* Play/Pause */}
            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              className="lab-physics-play-button"
            >
              {isPlaying ? "⏸ Pause" : "▶ Play"}
            </button>

            {/* Reset */}
            <button
              type="button"
              onClick={handleReset}
              className="lab-physics-reset-button"
            >
              🔄 Reset
            </button>

            {/* Gravity control */}
            <div className="lab-physics-control-group">
              <label className="lab-physics-control-label">
                Gravity: {gravity.toFixed(1)} m/s²
              </label>
              <input
                type="range"
                min="-20"
                max="0"
                step="0.5"
                value={gravity}
                onChange={(e) => setGravity(parseFloat(e.target.value))}
                className="lab-physics-range-input"
                title="Adjust gravity strength"
                aria-label="Gravity control"
              />
            </div>

            {/* Enemy count */}
            {(mode === "enemies" || mode === "projectiles") && (
              <div className="lab-physics-control-group">
                <label className="lab-physics-control-label">
                  Enemy Count: {enemyCount}
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="1"
                  value={enemyCount}
                  onChange={(e) => setEnemyCount(parseInt(e.target.value))}
                  className="lab-physics-range-input"
                  title="Adjust number of enemies"
                  aria-label="Enemy count control"
                />
              </div>
            )}

            {/* Player speed */}
            {(mode === "player" || mode === "enemies" || mode === "projectiles") && (
              <div className="lab-physics-control-group">
                <label className="lab-physics-control-label">
                  Player Speed: {playerSpeed}
                </label>
                <input
                  type="range"
                  min="5"
                  max="30"
                  step="1"
                  value={playerSpeed}
                  onChange={(e) => setPlayerSpeed(parseInt(e.target.value))}
                  className="lab-physics-range-input"
                  title="Adjust player movement speed"
                  aria-label="Player speed control"
                />
              </div>
            )}

            {/* Description */}
            <div className="lab-physics-info-box">
              <h4 className="lab-physics-info-title">Mode Info</h4>
              <p className="lab-physics-info-text">
                {getModeDescription()}
              </p>

              {(mode === "player" ||
                mode === "enemies" ||
                mode === "projectiles") && (
                <div className="lab-physics-info-controls">
                  <p className="lab-physics-info-control-item">
                    <strong>WASD:</strong> Move player
                  </p>
                  {mode === "projectiles" && (
                    <p className="lab-physics-info-control-item">
                      <strong>Click:</strong> Fire projectile
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Formula */}
            <div className="lab-physics-formula-box">
              <h4 className="lab-physics-formula-title">Physics Formula</h4>
              <code className="lab-physics-formula-code">
                {getModeFormula()}
              </code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LabPhysicsPage;
