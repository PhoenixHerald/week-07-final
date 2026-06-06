export const TILE_SIZE = 40;
export const MAP_WIDTH = 20; // 800px
export const MAP_HEIGHT = 15; // 600px

// 定義主堡中心點 (移至最右側)
export const CORE_X = MAP_WIDTH - 2; // 18
export const CORE_Y = Math.floor(MAP_HEIGHT / 2); // 7

// 建築基礎類別
export class Building {
  x: number;
  y: number;
  w: number; // 佔用的寬度格數
  h: number; // 佔用的高度格數
  hp: number;
  maxHp: number;
  type: "WALL" | "TURRET" | "LASER" | "MISSILE";
  cost: number;
  isDead: boolean = false;
  isObstacle: boolean; // 是否會阻擋敵人行進

  constructor(x: number, y: number, w: number, h: number, maxHp: number, type: "WALL" | "TURRET" | "LASER" | "MISSILE", cost: number, isObstacle: boolean = true) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.maxHp = maxHp;
    this.hp = maxHp;
    this.type = type;
    this.cost = cost;
    this.isObstacle = isObstacle;
  }

  takeDamage(amount: number) {
    this.hp -= amount;
    if (this.hp <= 0) {
      this.isDead = true;
    }
  }

  update(dt: number, enemies: Enemy[], projectiles: Projectile[], addLaserEffect: (x1: number, y1: number, x2: number, y2: number) => void) {}

  draw(ctx: CanvasRenderingContext2D) {
    // 繪製細緻血條 (16-bit 風格)
    if (this.hp < this.maxHp) {
      const px = this.x * TILE_SIZE + (this.w * TILE_SIZE) / 2;
      const py = this.y * TILE_SIZE + (this.h * TILE_SIZE) / 2;
      ctx.fillStyle = '#000000';
      ctx.fillRect(px - 16, py - 22, 32, 6);
      ctx.fillStyle = '#aa0000';
      ctx.fillRect(px - 15, py - 21, 30, 4);
      ctx.fillStyle = '#00ff00';
      ctx.fillRect(px - 15, py - 21, 30 * (Math.max(0, this.hp) / this.maxHp), 4);
    }
  }
}

export class MissileTower extends Building {
  cooldown: number = 3.0; // 射速極慢
  currentCooldown: number = 0;
  damage: number = 100;
  range: number = 160;

  constructor(x: number, y: number) {
    super(x, y, 1, 1, 200, "MISSILE", 250, false); // 不阻擋敵人，漲價至 250G
  }

  update(dt: number, enemies: Enemy[], projectiles: Projectile[]) {
    if (this.currentCooldown > 0) this.currentCooldown -= dt;

    if (this.currentCooldown <= 0) {
      let closestEnemy: Enemy | null = null;
      let minDist = this.range;
      const px = this.x * TILE_SIZE + TILE_SIZE / 2;
      const py = this.y * TILE_SIZE + TILE_SIZE / 2;

      for (const e of enemies) {
        const dx = e.px - px;
        const dy = e.py - py;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDist) {
          minDist = dist;
          closestEnemy = e;
        }
      }

      if (closestEnemy) {
        projectiles.push(new Projectile(px, py, closestEnemy, this.damage, 150, true, 80));
        this.currentCooldown = this.cooldown;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    const px = this.x * TILE_SIZE;
    const py = this.y * TILE_SIZE;

    // 底座
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);

    // 發射井警示線
    ctx.fillStyle = "#ea580c"; // 橘色
    ctx.fillRect(px + 8, py + 8, TILE_SIZE - 16, TILE_SIZE - 16);
    
    // 中間發射孔
    ctx.fillStyle = "#020617";
    ctx.beginPath();
    ctx.arc(px + TILE_SIZE / 2, py + TILE_SIZE / 2, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#f97316";
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

export class Wall extends Building {
  constructor(x: number, y: number, w: number = 2, h: number = 1) {
    super(x, y, w, h, 400, "WALL", 10, true); 
  }

  draw(ctx: CanvasRenderingContext2D) {
    const px = this.x * TILE_SIZE;
    const py = this.y * TILE_SIZE;
    const width = this.w * TILE_SIZE;
    const height = this.h * TILE_SIZE;
    
    // 16-bit 立體城牆
    ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    
    // 主體
    const grad = ctx.createLinearGradient(px, py, px + width, py + height);
    grad.addColorStop(0, "#8b9bb4");
    grad.addColorStop(1, "#4a5a75");
    ctx.fillStyle = grad;
    ctx.fillRect(px + 2, py + 2, width - 4, height - 4);

    ctx.shadowColor = "transparent";

    // 磚塊紋理線條
    ctx.strokeStyle = "#33415c";
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    if (this.w > this.h) {
      // 橫向
      ctx.moveTo(px + 2, py + height / 2);
      ctx.lineTo(px + width - 2, py + height / 2);
      for (let i = 1; i <= 3; i++) {
          ctx.moveTo(px + (width * i) / 4, py + height / 2);
          ctx.lineTo(px + (width * i) / 4, py + height - 2);
      }
      for (let i = 1; i <= 2; i++) {
          ctx.moveTo(px + (width * (i*2-1)) / 4 - width/8, py + 2);
          ctx.lineTo(px + (width * (i*2-1)) / 4 - width/8, py + height / 2);
      }
    } else {
      // 直向
      ctx.moveTo(px + width / 2, py + 2);
      ctx.lineTo(px + width / 2, py + height - 2);
      for (let i = 1; i <= 3; i++) {
          ctx.moveTo(px + width / 2, py + (height * i) / 4);
          ctx.lineTo(px + width - 2, py + (height * i) / 4);
      }
      for (let i = 1; i <= 2; i++) {
          ctx.moveTo(px + 2, py + (height * (i*2-1)) / 4 - height/8);
          ctx.lineTo(px + width / 2, py + (height * (i*2-1)) / 4 - height/8);
      }
    }

    ctx.stroke();
    super.draw(ctx);
  }
}

export class BasicTower extends Building {
  range: number = 140;
  cooldown: number = 0.8;
  currentCooldown: number = 0;
  damage: number = 25;
  angle: number = 0;

  constructor(x: number, y: number) {
    super(x, y, 1, 1, 150, "TURRET", 50, false); // 不阻擋敵人
  }

  update(dt: number, enemies: Enemy[], projectiles: Projectile[]) {
    if (this.currentCooldown > 0) this.currentCooldown -= dt;

    const px = this.x * TILE_SIZE + TILE_SIZE / 2;
    const py = this.y * TILE_SIZE + TILE_SIZE / 2;

    let closestEnemy: Enemy | null = null;
    let minDst = this.range;

    for (const enemy of enemies) {
      if (enemy.isDead) continue;
      const dist = Math.hypot(enemy.px - px, enemy.py - py);
      if (dist <= minDst) {
        minDst = dist;
        closestEnemy = enemy;
      }
    }

    if (closestEnemy) {
      // 瞄準角度
      this.angle = Math.atan2(closestEnemy.py - py, closestEnemy.px - px);
      if (this.currentCooldown <= 0) {
        const spawnX = px + Math.cos(this.angle) * 15;
        const spawnY = py + Math.sin(this.angle) * 15;
        projectiles.push(new Projectile(spawnX, spawnY, closestEnemy, this.damage, 450));
        this.currentCooldown = this.cooldown;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    const px = this.x * TILE_SIZE + TILE_SIZE / 2;
    const py = this.y * TILE_SIZE + TILE_SIZE / 2;

    // 底座
    ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 3;
    const baseGrad = ctx.createRadialGradient(px, py, 5, px, py, 18);
    baseGrad.addColorStop(0, "#4a4a4a");
    baseGrad.addColorStop(1, "#222222");
    ctx.fillStyle = baseGrad;
    ctx.beginPath();
    ctx.arc(px, py, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowColor = "transparent";

    // 砲管與旋轉台
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(this.angle);

    // 砲管
    const barrelGrad = ctx.createLinearGradient(0, -4, 20, 4);
    barrelGrad.addColorStop(0, "#aaaaaa");
    barrelGrad.addColorStop(1, "#555555");
    ctx.fillStyle = barrelGrad;
    ctx.fillRect(0, -4, 20, 8);
    
    // 旋轉中心
    ctx.fillStyle = "#ff66aa";
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(-2, -2, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    super.draw(ctx);
  }
}

export class LaserTower extends Building {
  range: number = 180;
  cooldown: number = 2.5;
  currentCooldown: number = 0;
  damage: number = 15;
  glowPhase: number = 0;

  constructor(x: number, y: number) {
    super(x, y, 1, 1, 120, "LASER", 100, false); // 不阻擋敵人
  }

  update(dt: number, enemies: Enemy[], projectiles: Projectile[], addLaserEffect: (x1: number, y1: number, x2: number, y2: number) => void) {
    this.glowPhase += dt * 3;
    if (this.currentCooldown > 0) this.currentCooldown -= dt;

    if (this.currentCooldown <= 0) {
      const px = this.x * TILE_SIZE + TILE_SIZE / 2;
      const py = this.y * TILE_SIZE + TILE_SIZE / 2;

      let closestEnemy: Enemy | null = null;
      let minDst = this.range;

      for (const enemy of enemies) {
        if (enemy.isDead) continue;
        const dist = Math.hypot(enemy.px - px, enemy.py - py);
        if (dist <= minDst) {
          minDst = dist;
          closestEnemy = enemy;
        }
      }

      if (closestEnemy) {
        closestEnemy.hp -= this.damage;
        closestEnemy.frozenTime = 2.0; 
        
        addLaserEffect(px, py, closestEnemy.px, closestEnemy.py);
        this.currentCooldown = this.cooldown;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    const px = this.x * TILE_SIZE + TILE_SIZE / 2;
    const py = this.y * TILE_SIZE + TILE_SIZE / 2;

    ctx.fillStyle = "#113355";
    ctx.beginPath();
    ctx.arc(px, py, 14, 0, Math.PI * 2);
    ctx.fill();

    const glowRadius = 8 + Math.sin(this.glowPhase) * 2;
    const coreGrad = ctx.createRadialGradient(px, py, 2, px, py, glowRadius);
    coreGrad.addColorStop(0, "#ffffff");
    coreGrad.addColorStop(0.4, "#00ffff");
    coreGrad.addColorStop(1, "transparent");
    
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(px, py, 18, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#44ccff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, 14, 0, Math.PI * 2);
    ctx.stroke();

    super.draw(ctx);
  }
}

export class Projectile {
  x: number;
  y: number;
  target: Enemy;
  damage: number;
  speed: number;
  isDead: boolean = false;
  isExplosive: boolean;
  splashRadius: number;

  constructor(x: number, y: number, target: Enemy, damage: number, speed: number, isExplosive: boolean = false, splashRadius: number = 0) {
    this.x = x;
    this.y = y;
    this.target = target;
    this.damage = damage;
    this.speed = speed;
    this.isExplosive = isExplosive;
    this.splashRadius = splashRadius;
  }

  update(dt: number, enemies: Enemy[], addExplosion?: (x: number, y: number, r: number) => void) {
    if (this.isDead) return;

    const dx = this.target.px - this.x;
    const dy = this.target.py - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < this.speed * dt) {
      if (this.isExplosive) {
        enemies.forEach(e => {
          const edx = e.px - this.x;
          const edy = e.py - this.y;
          if (Math.sqrt(edx*edx + edy*edy) <= this.splashRadius) {
            e.hp -= this.damage;
          }
        });
        if (addExplosion) addExplosion(this.x, this.y, this.splashRadius);
      } else {
        this.target.hp -= this.damage;
      }
      this.isDead = true;
    } else {
      this.x += (dx / dist) * this.speed * dt;
      this.y += (dy / dist) * this.speed * dt;
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.isExplosive) {
      ctx.shadowBlur = 10;
      ctx.shadowColor = "#f97316"; // 橘光飛彈
      ctx.fillStyle = "#fb923c";
      ctx.beginPath();
      ctx.arc(this.x, this.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowColor = "transparent";
    } else {
      ctx.shadowBlur = 5;
      ctx.shadowColor = "#ffff00";
      ctx.fillStyle = "#ffff00";
      ctx.beginPath();
      ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowColor = "transparent";
    }
  }
}

export class Enemy {
  x: number; 
  y: number;
  px: number; 
  py: number;
  hp: number;
  maxHp: number;
  speed: number;
  reward: number;
  isDead: boolean = false;
  type: "NORMAL" | "SCOUT" | "TANK";
  
  frozenTime: number = 0;
  path: {x: number, y: number}[] = [];
  
  attackDamage: number = 15;
  attackCooldown: number = 1.0;
  currentAttackCooldown: number = 0;
  enginePhase: number = 0;

  constructor(startX: number, startY: number, hp: number, speed: number, reward: number, type: "NORMAL" | "SCOUT" | "TANK" = "NORMAL") {
    this.x = startX;
    this.y = startY;
    this.px = this.x * TILE_SIZE + TILE_SIZE / 2;
    this.py = this.y * TILE_SIZE + TILE_SIZE / 2;
    this.hp = hp;
    this.maxHp = hp;
    this.speed = speed;
    this.reward = reward;
    this.type = type;
    this.enginePhase = Math.random() * Math.PI * 2;
  }

  update(dt: number, buildings: Building[]) {
    if (this.isDead) return;

    this.enginePhase += dt * 10;

    if (this.frozenTime > 0) {
      this.frozenTime -= dt;
      return;
    }

    if (this.currentAttackCooldown > 0) {
      this.currentAttackCooldown -= dt;
    }

    // 檢查鄰近是否有建築 (需考慮建築佔地多格)
    const adjacentBuildings = buildings.filter(b => {
      let isAdjacent = false;
      for (let i = 0; i < b.w; i++) {
        for (let j = 0; j < b.h; j++) {
          if (Math.abs(b.x + i - this.x) + Math.abs(b.y + j - this.y) <= 1) {
            isAdjacent = true;
          }
        }
      }
      return isAdjacent;
    });

    if (adjacentBuildings.length > 0) {
      if (this.currentAttackCooldown <= 0) {
        const target = adjacentBuildings[0];
        target.takeDamage(this.attackDamage);
        this.currentAttackCooldown = this.attackCooldown;
      }
      return; 
    }

    if (this.path.length > 0) {
      const targetNode = this.path[0];
      const targetPx = targetNode.x * TILE_SIZE + TILE_SIZE / 2;
      const targetPy = targetNode.y * TILE_SIZE + TILE_SIZE / 2;

      const dx = targetPx - this.px;
      const dy = targetPy - this.py;
      const dist = Math.hypot(dx, dy);

      if (dist < this.speed * dt) {
        this.px = targetPx;
        this.py = targetPy;
        this.x = targetNode.x;
        this.y = targetNode.y;
        this.path.shift();
      } else {
        this.px += (dx / dist) * this.speed * dt;
        this.py += (dy / dist) * this.speed * dt;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(this.px, this.py);
    
    if (this.path.length > 0 && this.frozenTime <= 0) {
       const targetNode = this.path[0];
       const targetPx = targetNode.x * TILE_SIZE + TILE_SIZE / 2;
       const targetPy = targetNode.y * TILE_SIZE + TILE_SIZE / 2;
       const angle = Math.atan2(targetPy - this.py, targetPx - this.px);
       ctx.rotate(angle);
    } else {
       const angle = Math.atan2(CORE_Y * TILE_SIZE + TILE_SIZE/2 - this.py, CORE_X * TILE_SIZE + TILE_SIZE/2 - this.px);
       ctx.rotate(angle);
    }

    if (this.type === "SCOUT") ctx.scale(0.7, 0.7);
    if (this.type === "TANK") ctx.scale(1.4, 1.4);

    if (this.frozenTime <= 0) {
      ctx.fillStyle = `rgba(255, 100, 0, ${0.5 + Math.sin(this.enginePhase) * 0.5})`;
      ctx.beginPath();
      ctx.moveTo(-10, -5);
      ctx.lineTo(-20 - Math.random() * 5, 0);
      ctx.lineTo(-10, 5);
      ctx.fill();
    }

    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 5;
    ctx.fillStyle = this.frozenTime > 0 ? '#0088ff' : 
                    this.type === "SCOUT" ? '#ffcc00' :
                    this.type === "TANK" ? '#9900ff' : '#00ddaa';
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(-10, 8);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-10, -8);
    ctx.closePath();
    ctx.fill();
    ctx.shadowColor = "transparent";

    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.beginPath();
    ctx.arc(2, 0, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    ctx.fillStyle = '#000000';
    ctx.fillRect(this.px - 16, this.py - 22, 32, 6);
    ctx.fillStyle = 'red';
    ctx.fillRect(this.px - 15, this.py - 21, 30, 4);
    ctx.fillStyle = '#00ff00';
    ctx.fillRect(this.px - 15, this.py - 21, 30 * (Math.max(0, this.hp) / this.maxHp), 4);
  }
}

// ==========================================
// A* Pathfinding Algorithm (指向 CORE_X, CORE_Y)
// ==========================================

class Node {
  x: number;
  y: number;
  g: number = 0;
  h: number = 0;
  f: number = 0;
  parent: Node | null = null;
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
}

export function findPath(startX: number, startY: number, buildings: Building[]): {x: number, y: number}[] | null {
  const grid: boolean[][] = Array(MAP_WIDTH).fill(null).map(() => Array(MAP_HEIGHT).fill(false));
  for (const b of buildings) {
    if (b.isObstacle) {
      for (let i = 0; i < b.w; i++) {
        for (let j = 0; j < b.h; j++) {
          const bx = b.x + i;
          const by = b.y + j;
          if (bx >= 0 && bx < MAP_WIDTH && by >= 0 && by < MAP_HEIGHT) {
            grid[bx][by] = true;
          }
        }
      }
    }
  }

  const openList: Node[] = [];
  const closedList: boolean[][] = Array(MAP_WIDTH).fill(null).map(() => Array(MAP_HEIGHT).fill(false));

  const startNode = new Node(startX, startY);
  openList.push(startNode);

  while (openList.length > 0) {
    openList.sort((a, b) => a.f - b.f);
    const currentNode = openList.shift()!;
    closedList[currentNode.x][currentNode.y] = true;

    if (currentNode.x === CORE_X && currentNode.y === CORE_Y) {
      const path: {x: number, y: number}[] = [];
      let curr: Node | null = currentNode;
      while (curr !== null) {
        path.push({x: curr.x, y: curr.y});
        curr = curr.parent;
      }
      return path.reverse().slice(1);
    }

    const neighbors = [
      {x: currentNode.x + 1, y: currentNode.y},
      {x: currentNode.x - 1, y: currentNode.y},
      {x: currentNode.x, y: currentNode.y + 1},
      {x: currentNode.x, y: currentNode.y - 1},
    ];

    for (const n of neighbors) {
      if (n.x < 0 || n.x >= MAP_WIDTH || n.y < 0 || n.y >= MAP_HEIGHT) continue;
      if (grid[n.x][n.y] || closedList[n.x][n.y]) continue;

      const gScore = currentNode.g + 1;
      const hScore = Math.abs(n.x - CORE_X) + Math.abs(n.y - CORE_Y);
      const fScore = gScore + hScore;

      const existingNode = openList.find(o => o.x === n.x && o.y === n.y);
      if (existingNode) {
        if (gScore < existingNode.g) {
          existingNode.g = gScore;
          existingNode.f = fScore;
          existingNode.parent = currentNode;
        }
      } else {
        const neighborNode = new Node(n.x, n.y);
        neighborNode.g = gScore;
        neighborNode.h = hScore;
        neighborNode.f = fScore;
        neighborNode.parent = currentNode;
        openList.push(neighborNode);
      }
    }
  }

  return null;
}
