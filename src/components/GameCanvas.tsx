"use client";

import { useEffect, useRef, useState } from 'react';
import { 
  TILE_SIZE, MAP_WIDTH, MAP_HEIGHT, CORE_X, CORE_Y, 
  Enemy, Building, Wall, BasicTower, LaserTower, MissileTower, Projectile, 
  findPath 
} from '@/game/engine';

type BuildMode = "WALL" | "TURRET" | "LASER" | "MISSILE";
const BUILD_MODES: BuildMode[] = ["WALL", "TURRET", "LASER", "MISSILE"];
type LaserEffect = { x1: number, y1: number, x2: number, y2: number, life: number };
type ExplosionEffect = { x: number, y: number, radius: number, life: number };

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [hp, setHp] = useState(20);
  const [gold, setGold] = useState(200); 
  const [wave, setWave] = useState(1);
  const [score, setScore] = useState(0);
  const [status, setStatus] = useState<"PLAYING" | "GAME_OVER" | "VICTORY">("PLAYING");
  const [buildMode, setBuildMode] = useState<BuildMode>("WALL");
  const [playerName, setPlayerName] = useState("");
  const [isSaved, setIsSaved] = useState(false);

  const mousePos = useRef({ x: -1, y: -1 });
  const currentModeRef = useRef<BuildMode>("WALL");
  const [isRotated, setIsRotated] = useState(false);
  const isRotatedRef = useRef(false);

  useEffect(() => {
    currentModeRef.current = buildMode;
    // 重置旋轉狀態當切換武器時
    if (buildMode !== "WALL") {
      setIsRotated(false);
    }
  }, [buildMode]);

  useEffect(() => {
    isRotatedRef.current = isRotated;
  }, [isRotated]);

  const gameState = useRef({
    hp: 20,
    gold: 200,
    wave: 1,
    score: 0,
    status: "PLAYING" as "PLAYING" | "GAME_OVER" | "VICTORY",
    enemies: [] as Enemy[],
    buildings: [] as Building[],
    projectiles: [] as Projectile[],
    laserEffects: [] as LaserEffect[],
    explosionEffects: [] as ExplosionEffect[],
    lastTime: 0,
    spawnTimer: 0,
    enemiesSpawned: 0,
    totalEnemies: 8 // 下調初始敵人數量
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && gameState.current.status === "PLAYING") {
        e.preventDefault();
        const mx = mousePos.current.x;
        const my = mousePos.current.y;
        if (mx < 0 || my < 0) return;

        const state = gameState.current;
        const bIndex = state.buildings.findIndex(b => mx >= b.x && mx < b.x + b.w && my >= b.y && my < b.y + b.h);
        if (bIndex !== -1) {
          const b = state.buildings[bIndex];
          b.isDead = true;
          b.hp = 0;
          state.gold += b.cost / 2;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setHp(Math.floor(gameState.current.hp));
      setGold(Math.floor(gameState.current.gold));
      setWave(gameState.current.wave);
      setScore(gameState.current.score);
      setStatus(gameState.current.status);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const recalculateAllPaths = () => {
    const state = gameState.current;
    state.enemies.forEach(e => {
      const path = findPath(e.x, e.y, state.buildings);
      if (path) {
        e.path = path;
      }
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    const gameLoop = (timestamp: number) => {
      const state = gameState.current;
      if (state.lastTime === 0) state.lastTime = timestamp;
      const dt = (timestamp - state.lastTime) / 1000;
      state.lastTime = timestamp;

      if (state.status !== "PLAYING") {
        animationId = requestAnimationFrame(gameLoop);
        return;
      }

      state.gold += 5 * dt;

      let buildingsChanged = false;
      const originalBuildingCount = state.buildings.length;
      state.buildings = state.buildings.filter(b => !b.isDead);
      if (state.buildings.length !== originalBuildingCount) {
        buildingsChanged = true;
      }

      if (buildingsChanged) {
        recalculateAllPaths();
      }

      // 從左側隨機生成
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0 && state.enemiesSpawned < state.totalEnemies) {
        const startX = 0;
        const startY = Math.floor(Math.random() * MAP_HEIGHT);

        const rand = Math.random();
        let hp = 60 * state.wave;
        let speed = 40 + state.wave * 15;
        let reward = 30;
        let type: "NORMAL" | "SCOUT" | "TANK" = "NORMAL";

        if (rand < 0.25) {
          type = "SCOUT";
          hp = hp * 0.5;
          speed = speed * 1.5;
          reward = 15;
        } else if (rand > 0.85) {
          type = "TANK";
          hp = hp * 3;
          speed = speed * 0.6;
          reward = 80;
        }

        const enemy = new Enemy(startX, startY, hp, speed, reward, type);
        const path = findPath(enemy.x, enemy.y, state.buildings);
        if (path) {
          enemy.path = path;
          state.enemies.push(enemy);
        }
        state.spawnTimer = 1.2; 
        state.enemiesSpawned++;
      }

      state.buildings.forEach(b => {
        b.update(dt, state.enemies, state.projectiles, (x1, y1, x2, y2) => {
          state.laserEffects.push({ x1, y1, x2, y2, life: 0.15 });
        });
      });
      
      state.projectiles.forEach(p => {
        p.update(dt, state.enemies, (x, y, r) => {
          state.explosionEffects.push({ x, y, radius: r, life: 0.3 });
        });
      });
      state.projectiles = state.projectiles.filter(p => !p.isDead);

      state.laserEffects.forEach(l => l.life -= dt);
      state.laserEffects = state.laserEffects.filter(l => l.life > 0);

      state.explosionEffects.forEach(ex => ex.life -= dt);
      state.explosionEffects = state.explosionEffects.filter(ex => ex.life > 0);

      state.enemies.forEach(e => {
        e.update(dt, state.buildings);
        if (e.x === CORE_X && e.y === CORE_Y && !e.isDead) {
          e.isDead = true;
          state.hp -= 1;
          if (state.hp <= 0) state.status = "GAME_OVER";
        } else if (e.hp <= 0 && !e.isDead) {
          e.isDead = true;
          state.gold += e.reward;
          state.score += e.reward * 10;
        }
      });
      state.enemies = state.enemies.filter(e => !e.isDead);

      if (state.enemiesSpawned >= state.totalEnemies && state.enemies.length === 0) {
        // 無盡模式：無限進入下一波
        state.wave++;
        state.enemiesSpawned = 0;
        state.totalEnemies += 3;
      }

      // ================= 繪圖 =================
      ctx.fillStyle = '#0a101d';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = 'rgba(100, 150, 255, 0.15)';
      ctx.lineWidth = 1;
      for (let x = 0; x < MAP_WIDTH; x++) {
        for (let y = 0; y < MAP_HEIGHT; y++) {
          ctx.strokeRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = 'rgba(100, 150, 255, 0.3)';
          ctx.fillRect(x * TILE_SIZE - 1, y * TILE_SIZE - 1, 2, 2);
        }
      }

      const corePx = CORE_X * TILE_SIZE + TILE_SIZE / 2;
      const corePy = CORE_Y * TILE_SIZE + TILE_SIZE / 2;
      const pulse = Math.abs(Math.sin(timestamp / 500));
      ctx.shadowBlur = 15 + pulse * 10;
      ctx.shadowColor = "#00ffff";
      ctx.fillStyle = "#003366";
      ctx.beginPath();
      ctx.arc(corePx, corePy, 18, 0, Math.PI * 2);
      ctx.fill();
      const coreGrad = ctx.createRadialGradient(corePx, corePy, 0, corePx, corePy, 15);
      coreGrad.addColorStop(0, "#ffffff");
      coreGrad.addColorStop(0.5, "#00ffff");
      coreGrad.addColorStop(1, "transparent");
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(corePx, corePy, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowColor = "transparent";

      state.buildings.forEach(b => b.draw(ctx));
      state.enemies.forEach(e => e.draw(ctx));
      state.projectiles.forEach(p => p.draw(ctx));

      state.laserEffects.forEach(l => {
        ctx.shadowBlur = 10;
        ctx.shadowColor = "#00ffff";
        ctx.strokeStyle = `rgba(150, 255, 255, ${l.life * 6})`;
        ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(l.x1, l.y1); ctx.lineTo(l.x2, l.y2); ctx.stroke();
        ctx.strokeStyle = `rgba(255, 255, 255, ${l.life * 6})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(l.x1, l.y1); ctx.lineTo(l.x2, l.y2); ctx.stroke();
        ctx.shadowColor = "transparent";
      });

      state.explosionEffects.forEach(ex => {
        const alpha = Math.max(0, ex.life / 0.3);
        ctx.shadowBlur = 15;
        ctx.shadowColor = "#f97316";
        ctx.fillStyle = `rgba(249, 115, 22, ${alpha * 0.4})`;
        ctx.beginPath();
        ctx.arc(ex.x, ex.y, ex.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(251, 146, 60, ${alpha})`;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.shadowColor = "transparent";
      });

      // 滑鼠預覽
      if (mousePos.current.x >= 0 && mousePos.current.y >= 0 && state.status === "PLAYING") {
        const mx = mousePos.current.x;
        const my = mousePos.current.y;
        const mode = currentModeRef.current;
        const rotated = isRotatedRef.current;
        
        const w = mode === "WALL" ? (rotated ? 1 : 2) : 1;
        const h = mode === "WALL" ? (rotated ? 2 : 1) : 1;
        
        let canBuild = true;
        let cost = mode === "WALL" ? 10 : mode === "TURRET" ? 50 : mode === "LASER" ? 100 : 250;
        
        if (state.gold < cost) canBuild = false;
        
        // 邊界檢查
        if (mx < 0 || mx + w > MAP_WIDTH || my < 0 || my + h > MAP_HEIGHT) {
            canBuild = false;
        } else {
            for (let i = 0; i < w; i++) {
                for (let j = 0; j < h; j++) {
                    const cx = mx + i;
                    const cy = my + j;
                    
                    if (cx === 0) canBuild = false; // 左邊界禁止
                    if (cx === CORE_X && cy === CORE_Y) canBuild = false; // 主堡禁止
                    if (state.buildings.some(b => {
                        return cx >= b.x && cx < b.x + b.w && cy >= b.y && cy < b.y + b.h;
                    })) canBuild = false;
                    if (state.enemies.some(e => e.x === cx && e.y === cy)) canBuild = false;
                }
            }
        }

        if (canBuild) {
          const isObstacle = mode === "WALL";
          const tempBuilding = new Building(mx, my, w, h, 1, mode, 0, isObstacle);
          const testBuildings = [...state.buildings, tempBuilding];
          
          if (!findPath(0, CORE_Y, testBuildings)) {
            canBuild = false;
          }
          
          if (canBuild) {
            for (const e of state.enemies) {
               if (!findPath(e.x, e.y, testBuildings)) { canBuild = false; break; }
            }
          }
        }

        ctx.fillStyle = canBuild ? 'rgba(0, 255, 0, 0.4)' : 'rgba(255, 0, 0, 0.4)';
        ctx.fillRect(mx * TILE_SIZE, my * TILE_SIZE, w * TILE_SIZE, h * TILE_SIZE);
      }

      if (state.status !== "PLAYING") {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        // HTML Overlay 會負責顯示 Game Over 畫面
      }

      animationId = requestAnimationFrame(gameLoop);
    };

    animationId = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animationId);
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const rect = canvas?.getBoundingClientRect();
    if (!rect || !canvas) return;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    mousePos.current = {
      x: Math.floor(((e.clientX - rect.left) * scaleX) / TILE_SIZE),
      y: Math.floor(((e.clientY - rect.top) * scaleY) / TILE_SIZE)
    };
  };

  const handleMouseLeave = () => {
    mousePos.current = { x: -1, y: -1 };
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault(); 
    setBuildMode(prev => {
      const idx = BUILD_MODES.indexOf(prev);
      if (e.deltaY > 0) {
        return BUILD_MODES[(idx + 1) % BUILD_MODES.length];
      } else {
        return BUILD_MODES[(idx - 1 + BUILD_MODES.length) % BUILD_MODES.length]; 
      }
    });
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault(); // 防止右鍵選單
    if (buildMode === "WALL") {
      setIsRotated(prev => !prev);
    }
  };

  const handleCanvasClick = () => {
    const state = gameState.current;
    if (state.status !== "PLAYING") return;
    const { x, y } = mousePos.current;
    if (x < 0 || y < 0) return;

    const mode = buildMode;
    const rotated = isRotated;
    const w = mode === "WALL" ? (rotated ? 1 : 2) : 1;
    const h = mode === "WALL" ? (rotated ? 2 : 1) : 1;
    let cost = mode === "WALL" ? 10 : mode === "TURRET" ? 50 : mode === "LASER" ? 100 : 250;
    
    if (state.gold < cost) return;
    if (x < 0 || x + w > MAP_WIDTH || y < 0 || y + h > MAP_HEIGHT) return;
    
    for (let i = 0; i < w; i++) {
        for (let j = 0; j < h; j++) {
            const cx = x + i;
            const cy = y + j;
            if (cx === 0) return;
            if (cx === CORE_X && cy === CORE_Y) return;
            if (state.buildings.some(b => cx >= b.x && cx < b.x + b.w && cy >= b.y && cy < b.y + b.h)) return;
            if (state.enemies.some(e => e.x === cx && e.y === cy)) return;
        }
    }

    const isObstacle = mode === "WALL";
    const tempBuilding = new Building(x, y, w, h, 1, mode, 0, isObstacle);
    const testBuildings = [...state.buildings, tempBuilding];
    
    if (!findPath(0, CORE_Y, testBuildings)) return;
    
    for (const e of state.enemies) {
        if (!findPath(e.x, e.y, testBuildings)) return;
    }

    if (mode === "WALL") state.buildings.push(new Wall(x, y, w, h));
    else if (mode === "TURRET") state.buildings.push(new BasicTower(x, y));
    else if (mode === "LASER") state.buildings.push(new LaserTower(x, y));
    else if (mode === "MISSILE") state.buildings.push(new MissileTower(x, y));
    
    state.gold -= cost;
    recalculateAllPaths();
  };

  const handleSaveScore = async () => {
    if (!playerName || isSaved) return;
    try {
      await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: playerName, score: score, wave: wave, timestamp: new Date().toISOString() })
      });
      setIsSaved(true);
    } catch (e) { }
  };

  const handleRestart = () => {
    gameState.current = {
      hp: 20,
      gold: 200,
      wave: 1,
      score: 0,
      status: "PLAYING",
      enemies: [],
      buildings: [],
      projectiles: [],
      laserEffects: [],
      explosionEffects: [],
      lastTime: performance.now(),
      spawnTimer: 0,
      enemiesSpawned: 0,
      totalEnemies: 8
    };
    setHp(20);
    setGold(200);
    setWave(1);
    setScore(0);
    setStatus("PLAYING");
    setPlayerName("");
    setIsSaved(false);
    recalculateAllPaths();
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <div className="star-layer" />
      
      <div className="mb-4 bg-gray-900 bg-opacity-90 p-4 rounded-lg border border-cyan-700 shadow-[0_0_20px_#0055ff] relative w-[850px]">
        <button
          onClick={handleRestart}
          className="absolute right-4 top-4 px-4 py-2 bg-red-800 text-white font-bold rounded shadow-[0_0_10px_red] hover:bg-red-700 text-xs transition"
        >
          RESTART
        </button>
        <h1 className="text-3xl text-cyan-300 mb-2 text-center drop-shadow-[0_0_8px_#00aaff] font-bold">16-BIT CORE DEFENSE</h1>
        <div className="flex justify-between w-[800px] text-sm tracking-wider mb-2 font-bold mx-auto">
          <span className="text-red-400 drop-shadow-[0_0_3px_red]">CORE HP: {hp}</span>
          <span className="text-yellow-300 drop-shadow-[0_0_3px_yellow]">GOLD: {gold} <span className="text-xs text-gray-400">(+5/s)</span></span>
          <span className="text-green-400 drop-shadow-[0_0_3px_green]">WAVE: {wave}</span>
          <span className="text-purple-400 drop-shadow-[0_0_3px_purple]">SCORE: {score}</span>
        </div>
        <div className="flex justify-center gap-4 border-t border-cyan-800 pt-3">
          <button 
            onClick={() => setBuildMode("WALL")}
            className={`px-6 py-2 border-2 rounded ${buildMode === "WALL" ? 'border-cyan-300 bg-cyan-900 shadow-[0_0_10px_#00ffff]' : 'border-gray-600 bg-black'} font-mono text-xs transition-all`}
          >
            [1] WALL [2x1] (10G)
            <span className="block text-[8px] text-gray-300 mt-1">Right Click to Rotate</span>
          </button>
          <button 
            onClick={() => setBuildMode("TURRET")}
            className={`px-6 py-2 border-2 rounded ${buildMode === "TURRET" ? 'border-pink-400 bg-pink-900 shadow-[0_0_10px_#ff00ff]' : 'border-gray-600 bg-black'} font-mono text-xs transition-all`}
          >
            [2] TURRET (50G)
          </button>
          <button 
            onClick={() => setBuildMode("LASER")}
            className={`px-6 py-2 border-2 rounded ${buildMode === "LASER" ? 'border-blue-400 bg-blue-900 shadow-[0_0_10px_#0088ff]' : 'border-gray-600 bg-black'} font-mono text-xs transition-all`}
          >
            [3] LASER (100G)
          </button>
          <button 
            onClick={() => setBuildMode("MISSILE")}
            className={`px-6 py-2 border-2 rounded ${buildMode === "MISSILE" ? 'border-orange-400 bg-orange-900 shadow-[0_0_10px_#ff8800]' : 'border-gray-600 bg-black'} font-mono text-xs transition-all`}
          >
            [4] MISSILE (250G)
          </button>
        </div>
        <p className="text-center text-[10px] text-gray-400 mt-2">Mouse Wheel: Switch Weapon | Spacebar: Demolish (50% Refund) | Right Click: Rotate</p>
      </div>

      <div className="relative">
        <canvas
          ref={canvasRef}
          width={MAP_WIDTH * TILE_SIZE}
          height={MAP_HEIGHT * TILE_SIZE}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onWheel={handleWheel}
          onClick={handleCanvasClick}
          onContextMenu={handleContextMenu}
          className="bg-[#050510] border-4 border-cyan-900 shadow-[0_0_30px_#000] cursor-crosshair rounded-sm"
        />

        {status === "GAME_OVER" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-70 pointer-events-auto">
            <h2 className="text-5xl text-red-500 mb-8 font-bold drop-shadow-[0_0_10px_red]">GAME OVER</h2>
            <div className="bg-gray-800 p-6 rounded-lg border-2 border-purple-500 shadow-[0_0_15px_purple] flex flex-col items-center">
              <p className="text-xl text-white mb-2">Final Score: <span className="text-purple-400">{score}</span></p>
              <p className="text-lg text-gray-300 mb-6">Waves Survived: {wave}</p>
              
              {!isSaved ? (
                <>
                  <input 
                    type="text" 
                    placeholder="Enter your name" 
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    className="mb-4 px-4 py-2 bg-gray-900 border border-gray-500 text-white rounded text-center w-64 focus:outline-none focus:border-cyan-500 font-mono"
                    maxLength={15}
                  />
                  <button 
                    onClick={handleSaveScore}
                    disabled={!playerName}
                    className="px-6 py-2 bg-purple-700 text-white rounded font-bold hover:bg-purple-600 disabled:opacity-50 transition mb-4"
                  >
                    SUBMIT SCORE
                  </button>
                  <button 
                    onClick={handleRestart}
                    className="px-6 py-2 bg-gray-700 text-white rounded font-bold hover:bg-gray-600 transition"
                  >
                    TRY AGAIN
                  </button>
                </>
              ) : (
                <>
                  <p className="text-green-400 font-bold text-xl mt-4 mb-4 drop-shadow-[0_0_5px_green]">SCORE SAVED!</p>
                  <button 
                    onClick={handleRestart}
                    className="px-6 py-2 bg-gray-700 text-white rounded font-bold hover:bg-gray-600 transition"
                  >
                    TRY AGAIN
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
