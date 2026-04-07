// renderer.js — Claude-kun RPG Game Engine (ENHANCED GRAPHICS)
const { ipcRenderer } = require('electron');
const combat = require('./combat');
const gameData = require('./game-data');
const achievements = require('./achievements');

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;

// Offscreen buffer for glow effects
const glowCanvas = document.createElement('canvas');
glowCanvas.width = W; glowCanvas.height = H;
const glowCtx = glowCanvas.getContext('2d');

// ============================================================
// Game State
// ============================================================
let data = { ...gameData.DEFAULT_DATA };
let fever = { gauge: 0, level: 0, boostTimer: 0, decayTimer: 0 };
let damageLog = [];
let lastTime = performance.now();
let gameTime = 0;
let stars = [];
let bgParticles = [];
let bullets = [];
let effects = [];
let meteors = [];
let boss = null;
let player = { x: W / 2, y: H - 100, dir: 1, speed: 1.8, shootTimer: 0, animFrame: 0, trail: [] };
let shakeTimer = 0, shakeIntensity = 0, meteorTimer = 0;
let combo = 0, comboTimer = 0, maxCombo = 0;

// Power-up system
let powerups = []; // { x, y, type, vy, life }
let activePowerups = {}; // { type: remainingSeconds }
const POWERUP_TYPES = [
  { type: 'speed', label: 'SPD UP', color: '#44aaff', duration: 8, icon: '>>',  chance: 0.08 },
  { type: 'shield', label: 'SHIELD', color: '#44ffaa', duration: 10, icon: '()', chance: 0.06 },
  { type: 'barrage', label: 'BARRAGE', color: '#ff44aa', duration: 6, icon: '**', chance: 0.04 },
  { type: 'xp2', label: 'XP x2', color: '#ffdd44', duration: 12, icon: 'x2', chance: 0.05 },
];

// Stage transition
let stageTransition = { active: false, timer: 0, stage: 0, name: '' };

// Stats panel
let statsPanelOpen = false;
const STATS_BTN = { x: 0, y: 0, w: 28, h: 20 };

// Ultimate attack
let ultimateEffect = { active: false, type: '', timer: 0 };

// Tool use big display
let toolFlash = { active: false, name: '', timer: 0, damage: 0 };

// Prestige system
// prestige count stored in data.prestige (default 0)
// Each prestige gives +10% permanent DMG bonus

// Stage result screen
let stageResult = { active: false, timer: 0, xp: 0, time: 0, toolUses: 0, stage: 0, bossName: '' };
let stageStartTime = 0;
let stageToolUses = 0;
let achievementQueue = [], achievementCheckTimer = 0;
let achPanelOpen = false, achPanelScroll = 0, achPanelCategory = 0;
const ACH_CATEGORIES = ['All','Progression','Combat','Coding','Fever','Streak','Time','Collection','Evolution','Challenge','Seasonal','Milestone','Hidden'];
const TROPHY_BTN = { x: 0, y: 0, w: 36, h: 36 };
const PIN_BTN = { x: 0, y: 0, w: 28, h: 20 };
let alwaysOnTop = true;

// ============================================================
// Enhanced Background: Multi-layer parallax + Nebula
// ============================================================
const STAR_LAYERS = [
  { count: 60, speed: 0.3, size: 1, alpha: 0.4 },
  { count: 40, speed: 0.8, size: 1.5, alpha: 0.6 },
  { count: 20, speed: 1.5, size: 2, alpha: 0.9 },
  { count: 8, speed: 2.2, size: 3, alpha: 1.0 },
];

function initStars() {
  stars = [];
  for (const layer of STAR_LAYERS) {
    for (let i = 0; i < layer.count; i++) {
      stars.push({
        x: Math.random() * W, y: Math.random() * H,
        speed: layer.speed + (Math.random() - 0.5) * 0.2,
        size: layer.size,
        alpha: layer.alpha * (0.5 + Math.random() * 0.5),
        twinkle: Math.random() * Math.PI * 2,
        color: ['#ffffff','#aaccff','#ffccaa','#aaffcc'][Math.floor(Math.random()*4)],
      });
    }
  }
  // Background nebula particles
  bgParticles = [];
  for (let i = 0; i < 12; i++) {
    bgParticles.push({
      x: Math.random() * W, y: Math.random() * H,
      r: 60 + Math.random() * 120,
      color: ['rgba(40,20,80,','rgba(20,40,80,','rgba(80,20,40,','rgba(20,60,60,'][Math.floor(Math.random()*4)],
      speed: 0.1 + Math.random() * 0.2,
      phase: Math.random() * Math.PI * 2,
    });
  }
}
initStars();

// Stage background themes
const STAGE_BG = [
  { top:'#030010', mid:'#0a0a1e', bot:'#0d0518' }, // 1: deep space (default)
  { top:'#100800', mid:'#1a0a00', bot:'#0d0500' }, // 2: wasteland (amber)
  { top:'#000810', mid:'#001020', bot:'#000818' }, // 3: dependency hell (dark blue)
  { top:'#100005', mid:'#1a000a', bot:'#100008' }, // 4: production nightmare (crimson)
  { top:'#080808', mid:'#0a0a0a', bot:'#050505' }, // 5: legacy dungeon (dark gray)
  { top:'#001008', mid:'#001a10', bot:'#000d08' }, // 6: matrix green
  { top:'#080010', mid:'#0f001a', bot:'#08000d' }, // 7: purple void
  { top:'#101000', mid:'#1a1a00', bot:'#0d0d00' }, // 8: golden realm
  { top:'#001010', mid:'#001a1a', bot:'#000d0d' }, // 9: frozen
  { top:'#100010', mid:'#1a001a', bot:'#0d000d' }, // 10+: neon
];

function drawBackground() {
  const bgIdx = Math.min((data.stage-1) % STAGE_BG.length, STAGE_BG.length-1);
  const bg = STAGE_BG[bgIdx];
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, bg.top);
  grad.addColorStop(0.5, bg.mid);
  grad.addColorStop(1, bg.bot);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Nebula blobs
  for (const p of bgParticles) {
    p.y += p.speed;
    p.phase += 0.003;
    if (p.y - p.r > H) { p.y = -p.r; p.x = Math.random() * W; }
    const pulse = 0.15 + Math.sin(p.phase) * 0.05;
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
    g.addColorStop(0, p.color + pulse + ')');
    g.addColorStop(1, p.color + '0)');
    ctx.fillStyle = g;
    ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
  }

  // Stars with twinkle
  for (const s of stars) {
    s.y += s.speed * 0.016 * 60;
    s.twinkle += 0.03 + Math.random() * 0.02;
    if (s.y > H) { s.y = 0; s.x = Math.random() * W; }
    const twinkleAlpha = s.alpha * (0.6 + Math.sin(s.twinkle) * 0.4);
    ctx.globalAlpha = twinkleAlpha;
    ctx.fillStyle = s.color;
    if (s.size >= 2.5) {
      // Big stars get a cross-shaped glow
      ctx.shadowColor = s.color;
      ctx.shadowBlur = 6;
      ctx.fillRect(s.x - 0.5, s.y - s.size, 1, s.size * 2);
      ctx.fillRect(s.x - s.size, s.y - 0.5, s.size * 2, 1);
      ctx.shadowBlur = 0;
    }
    ctx.fillRect(Math.floor(s.x), Math.floor(s.y), s.size, s.size);
  }
  ctx.globalAlpha = 1;
}

// ============================================================
// Claude-kun (Enhanced with engine flames + afterimage)
// ============================================================
function drawClaudeKun(x, y, level, animFrame) {
  const bodyW = 50, bodyH = 26, legLen = 12, legW = 5, legGap = 7;
  const cx = Math.floor(x), cy = Math.floor(y);

  // Afterimage trail
  player.trail.push({ x: cx, y: cy, life: 8 });
  if (player.trail.length > 6) player.trail.shift();
  for (let i = 0; i < player.trail.length; i++) {
    const t = player.trail[i];
    ctx.globalAlpha = (i / player.trail.length) * 0.15;
    ctx.fillStyle = level >= 50 ? '#88aaff' : '#cc7e58';
    roundRect(ctx, t.x - bodyW / 2, t.y - bodyH / 2, bodyW, bodyH, 6);
    t.life--;
  }
  ctx.globalAlpha = 1;

  ctx.save();
  let bodyColor = '#cc7e58', lightColor = '#d88c64', shadowColor = '#b86e4c', darkColor = '#a46040';
  let eyeColor = '#2a1a12', glowColor = null, auraColor = null;

  if (level >= 85) { bodyColor = '#1a1a2e'; lightColor = '#2a2a3e'; shadowColor = '#0a0a1e'; darkColor = '#050510'; glowColor = '#ffd700'; auraColor = '#ffd70044'; }
  else if (level >= 65) { bodyColor = '#c0c0d0'; lightColor = '#d8d8e8'; shadowColor = '#a0a0b0'; darkColor = '#808898'; glowColor = '#e8e8ff'; auraColor = '#8888ff22'; }
  else if (level >= 50) { bodyColor = '#7788aa'; lightColor = '#8899bb'; shadowColor = '#667799'; darkColor = '#556688'; glowColor = '#88aaff'; auraColor = '#4466ff22'; }
  else if (level >= 35) { bodyColor = '#4477bb'; lightColor = '#5588cc'; shadowColor = '#336699'; darkColor = '#225588'; auraColor = '#2244aa11'; }
  else if (level >= 18) { bodyColor = '#b06040'; lightColor = '#c07050'; shadowColor = '#904830'; darkColor = '#803820'; }
  else if (level >= 8) { bodyColor = '#d07050'; lightColor = '#e08060'; shadowColor = '#c06040'; darkColor = '#b05030'; }
  if (level >= 13) eyeColor = '#2244aa';
  if (level >= 33) eyeColor = '#cc2222';

  // Aura
  if (auraColor) {
    const ar = 40 + Math.sin(gameTime * 3) * 8;
    const ag = ctx.createRadialGradient(cx, cy, 10, cx, cy, ar);
    ag.addColorStop(0, auraColor);
    ag.addColorStop(1, 'transparent');
    ctx.fillStyle = ag;
    ctx.fillRect(cx - ar, cy - ar, ar * 2, ar * 2);
  }

  // Engine flames (bottom)
  const flameH = 8 + Math.random() * 8 + (fever.level * 4);
  const flameColors = fever.level >= 2 ? ['#ff4400','#ffaa00','#ffff44'] : ['#4488ff','#66bbff','#aaddff'];
  for (let i = 0; i < 3; i++) {
    const fx = cx - 10 + i * 10;
    const fw = 6 - i;
    const fh = flameH * (1 - i * 0.2) * (0.7 + Math.random() * 0.3);
    ctx.fillStyle = flameColors[i];
    ctx.globalAlpha = 0.8 - i * 0.2;
    ctx.beginPath();
    ctx.moveTo(fx - fw/2, cy + bodyH/2 + legLen - 2);
    ctx.lineTo(fx, cy + bodyH/2 + legLen + fh);
    ctx.lineTo(fx + fw/2, cy + bodyH/2 + legLen - 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Glow
  if (glowColor) { ctx.shadowColor = glowColor; ctx.shadowBlur = 15 + Math.sin(gameTime * 4) * 5; }

  // Body
  ctx.fillStyle = shadowColor;
  roundRect(ctx, cx - bodyW/2 + 1, cy - bodyH/2 + 1, bodyW, bodyH, 6);
  ctx.fillStyle = bodyColor;
  roundRect(ctx, cx - bodyW/2, cy - bodyH/2, bodyW, bodyH, 6);
  ctx.fillStyle = lightColor;
  roundRect(ctx, cx - bodyW/2 + 3, cy - bodyH/2 + 2, bodyW - 6, 7, 3);
  ctx.shadowBlur = 0;

  // Eyes with glow
  const eyeW = 3, eyeH = 9, eyeGap = 10;
  ctx.fillStyle = eyeColor;
  ctx.fillRect(cx - eyeGap/2 - eyeW, cy - eyeH/2 - 1, eyeW, eyeH);
  ctx.fillRect(cx + eyeGap/2, cy - eyeH/2 - 1, eyeW, eyeH);
  if (level >= 6) {
    const ec = level >= 33 ? '#ff4444' : '#4488ff';
    ctx.shadowColor = ec; ctx.shadowBlur = 8;
    ctx.globalAlpha = 0.5 + Math.sin(gameTime * 5) * 0.2;
    ctx.fillStyle = ec;
    ctx.fillRect(cx - eyeGap/2 - eyeW - 1, cy - eyeH/2 - 2, eyeW + 2, eyeH + 2);
    ctx.fillRect(cx + eyeGap/2 - 1, cy - eyeH/2 - 2, eyeW + 2, eyeH + 2);
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  }

  // Legs
  const legStartX = cx - (legGap * 1.5);
  for (let i = 0; i < 4; i++) {
    const lx = legStartX + i * legGap;
    const lo = Math.sin(animFrame * 0.15 + i * Math.PI / 2) * 3;
    ctx.fillStyle = darkColor;
    ctx.fillRect(lx - legW/2, cy + bodyH/2 - 2, legW, legLen + lo);
  }

  // Wings (lv25+) with transparency and animation
  if (level >= 25) {
    const ws = level >= 40 ? 20 : level >= 30 ? 12 : 6;
    const wingFlap = Math.sin(gameTime * 6) * 3;
    ctx.fillStyle = level >= 60 ? '#aaddff55' : '#ffffff33';
    ctx.shadowColor = level >= 60 ? '#88ccff' : '#ffffff';
    ctx.shadowBlur = level >= 60 ? 10 : 4;
    ctx.beginPath(); ctx.moveTo(cx - bodyW/2, cy - 4); ctx.lineTo(cx - bodyW/2 - ws, cy - ws + wingFlap); ctx.lineTo(cx - bodyW/2 - 2, cy + 4); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx + bodyW/2, cy - 4); ctx.lineTo(cx + bodyW/2 + ws, cy - ws + wingFlap); ctx.lineTo(cx + bodyW/2 + 2, cy + 4); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Antenna (lv10+)
  if (level >= 10) {
    const antX = cx + Math.sin(gameTime * 4) * 4;
    const antY = cy - bodyH/2 - 12;
    ctx.strokeStyle = darkColor; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx, cy - bodyH/2); ctx.lineTo(antX, antY); ctx.stroke();
    ctx.shadowColor = '#ffdd44'; ctx.shadowBlur = 8;
    ctx.fillStyle = '#ffdd44';
    ctx.beginPath(); ctx.arc(antX, antY, 3, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Crown (lv75+) with jewel sparkle
  if (level >= 75) {
    const crownY = cy - bodyH/2 - 4;
    ctx.fillStyle = '#ffd700';
    ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 8;
    ctx.fillRect(cx - 10, crownY - 7, 20, 7);
    for (let i = 0; i < 3; i++) ctx.fillRect(cx - 8 + i * 7, crownY - 12, 3, 5);
    ctx.shadowBlur = 0;
    // Jewel
    ctx.fillStyle = '#ff2244';
    ctx.beginPath(); ctx.arc(cx, crownY - 4, 2, 0, Math.PI * 2); ctx.fill();
  }

  // Spawn particles
  if (level >= 10 && Math.random() < 0.4) {
    effects.push({ type: 'particle', x: cx + (Math.random()-0.5)*bodyW, y: cy + bodyH/2 + legLen + 5,
      vx: (Math.random()-0.5)*1.5, vy: Math.random()*2+1, life: 15, color: fever.level >= 2 ? '#ff6600' : '#4488ff', size: 1+Math.random()*2 });
  }

  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y);
  ctx.closePath(); ctx.fill();
}

// ============================================================
// Meteors (Enhanced with glow + fragments)
// ============================================================
function spawnMeteor() {
  // 3% chance for RARE meteor
  const isRare = Math.random() < 0.03;
  let t;
  if (isRare) {
    t = { name:'RARE', w:28, h:28, hp:100, speed:0.6+Math.random()*0.5, color:'#ffdd44', glow:'#ffd700', xp:50 };
  } else {
    const types = [
      { name:'ROCK', w:18, h:18, hp:20, speed:1+Math.random()*1.5, color:'#888899', glow:'#666688', xp:3 },
      { name:'ICE', w:14, h:14, hp:10, speed:1.5+Math.random()*2, color:'#88ccff', glow:'#44aaff', xp:2 },
      { name:'FIRE', w:22, h:22, hp:40, speed:0.8+Math.random(), color:'#ff6633', glow:'#ff4400', xp:5 },
      { name:'GOLD', w:16, h:16, hp:15, speed:1.2+Math.random()*1.5, color:'#ffdd44', glow:'#ffaa00', xp:8 },
    ];
    t = types[Math.floor(Math.random()*types.length)];
  }
  const s = 1 + (data.stage-1)*0.3;
  meteors.push({ x:20+Math.random()*(W-40), y:-30, w:t.w, h:t.h,
    hp:Math.floor(t.hp*s), maxHp:Math.floor(t.hp*s), speed:t.speed,
    color:t.color, glow:t.glow, name:t.name, xp:Math.floor(t.xp*s),
    alive:true, hitFlash:0, rot:Math.random()*Math.PI*2, rotSpeed:(Math.random()-0.5)*0.1,
    trail:[], rare:isRare });
}

function updateMeteors(dt) {
  meteorTimer += dt;
  // ~1 meteor per second base, scales gently with stage
  const baseRate = Math.max(0.3, 1.0 - data.stage * 0.03);
  if (meteorTimer >= baseRate) {
    meteorTimer = 0;
    spawnMeteor();
    // Bonus meteor at higher stages
    if (data.stage >= 5 && Math.random() < 0.3) spawnMeteor();
  }
  for (const m of meteors) {
    if (!m.alive) continue;
    m.y += m.speed * dt * 60;
    m.rot += m.rotSpeed;
    m.trail.push({ x: m.x, y: m.y, life: 10 });
    if (m.trail.length > 6) m.trail.shift();
    if (m.y > H + 40) { m.alive = false; combo = 0; comboTimer = 0; } // missed = combo break
  }
  meteors = meteors.filter(m => m.alive);
}

function drawMeteors() {
  for (const m of meteors) {
    if (!m.alive) continue;
    // Trail
    for (let i = 0; i < m.trail.length; i++) {
      const t = m.trail[i];
      ctx.globalAlpha = (i / m.trail.length) * 0.2;
      ctx.fillStyle = m.glow;
      ctx.beginPath(); ctx.arc(t.x, t.y, m.w * 0.3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.rotate(m.rot);

    if (m.rare) {
      // RARE meteor: pulsing golden star with sparkle ring
      const pulse = 1 + Math.sin(gameTime * 6) * 0.2;
      ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 25;
      ctx.fillStyle = m.hitFlash > 0 ? '#ffffff' : '#ffd700';
      if (m.hitFlash > 0) m.hitFlash--;
      // Star shape
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (i/10)*Math.PI*2, r = (i%2===0 ? m.w/2 : m.w/4) * pulse;
        if (i===0) ctx.moveTo(Math.cos(a)*r,Math.sin(a)*r);
        else ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);
      }
      ctx.closePath(); ctx.fill();
      ctx.shadowBlur = 0;
      // Sparkle ring
      ctx.strokeStyle = '#ffdd4488'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(0, 0, m.w * 0.8 * pulse, 0, Math.PI * 2); ctx.stroke();
    } else {
      ctx.shadowColor = m.glow;
      ctx.shadowBlur = m.hitFlash > 0 ? 20 : 8;
      ctx.fillStyle = m.hitFlash > 0 ? '#ffffff' : m.color;
      if (m.hitFlash > 0) m.hitFlash--;
      ctx.beginPath();
      const s = m.w / 2;
      for (let i = 0; i < 7; i++) {
        const a = (i/7)*Math.PI*2, r = s*(0.7+Math.sin(i*3.7)*0.3);
        if (i===0) ctx.moveTo(Math.cos(a)*r,Math.sin(a)*r);
        else ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);
      }
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
}

// ============================================================
// Boss (Enhanced with shield + energy patterns)
// ============================================================
let bossBullets = [];

function createBoss(stage) {
  const sd = gameData.STAGES[Math.min(stage-1, gameData.STAGES.length-1)];
  let hp, name;
  if (data.endlessMode) {
    hp = Math.floor(200000*Math.pow(1.2,data.endlessBossCount));
    const ns = ['InfiniteLoop','StackOverflow','MemoryLeak','RaceCondition','Deadlock','HeisenbugX'];
    name = ns[data.endlessBossCount%ns.length]+' Mk.'+ Math.floor(data.endlessBossCount/ns.length+1);
  } else { hp = sd ? sd.bossHp : 1500; name = sd ? sd.bossName : 'UnknownError'; }
  bossBullets = [];
  return { x:W/2, y:140, w:70, h:45, hp, maxHp:hp, name, alive:true, hitFlash:0, moveDir:1, phase:0, attackTimer:0, pattern:0 };
}

function drawBoss(b) {
  if (!b || !b.alive) return;
  ctx.save();
  b.phase += 0.02;
  const hpRatio = b.hp / b.maxHp;

  // Danger aura when low HP
  if (hpRatio < 0.3) {
    ctx.globalAlpha = 0.15 + Math.sin(gameTime*8)*0.1;
    const ag = ctx.createRadialGradient(b.x, b.y, 10, b.x, b.y, 60);
    ag.addColorStop(0, '#ff000088');
    ag.addColorStop(1, 'transparent');
    ctx.fillStyle = ag;
    ctx.fillRect(b.x-60, b.y-60, 120, 120);
    ctx.globalAlpha = 1;
  }

  // Shield rings
  ctx.strokeStyle = hpRatio > 0.5 ? '#ff446644' : '#ff000044';
  ctx.lineWidth = 2;
  for (let i = 0; i < 2; i++) {
    const sr = 45 + i * 12;
    ctx.beginPath();
    ctx.arc(b.x, b.y, sr, b.phase + i, b.phase + i + Math.PI * 1.2);
    ctx.stroke();
  }

  // Stage-based boss colors
  const BOSS_COLORS = [
    { body:'#cc2244', inner:'#881133', glow:'#cc2244', eye:'#ffff00' }, // 1
    { body:'#cc8822', inner:'#885511', glow:'#ff8800', eye:'#ff4400' }, // 2
    { body:'#2244cc', inner:'#113388', glow:'#4466ff', eye:'#44ffff' }, // 3
    { body:'#aa2222', inner:'#661111', glow:'#ff0000', eye:'#ffdd00' }, // 4
    { body:'#444455', inner:'#222233', glow:'#888899', eye:'#ff4444' }, // 5
    { body:'#22aa44', inner:'#116622', glow:'#44ff66', eye:'#ffffff' }, // 6
    { body:'#6622aa', inner:'#331166', glow:'#8844ff', eye:'#ff44ff' }, // 7
    { body:'#aaaa22', inner:'#666611', glow:'#ffff44', eye:'#ff8800' }, // 8
    { body:'#2288aa', inner:'#114466', glow:'#44ccff', eye:'#ffffff' }, // 9
    { body:'#aa2288', inner:'#661144', glow:'#ff44cc', eye:'#ffdd44' }, // 10
  ];
  const bc = BOSS_COLORS[(data.stage - 1) % BOSS_COLORS.length];

  // Body with glow
  const pulse = Math.sin(gameTime*4) * 2;
  const bodySize = 1 + Math.min(data.stage * 0.03, 0.5); // bosses get bigger
  const bw = b.w * bodySize, bh = b.h * bodySize;
  ctx.shadowColor = b.hitFlash > 0 ? '#ffffff' : (hpRatio < 0.25 ? '#ff0000' : bc.glow);
  ctx.shadowBlur = b.hitFlash > 0 ? 25 : 12;
  ctx.fillStyle = b.hitFlash > 0 ? '#ffffff' : (hpRatio < 0.25 ? '#ff2222' : bc.body);
  if (b.hitFlash > 0) b.hitFlash--;
  roundRect(ctx, b.x-bw/2+pulse, b.y-bh/2, bw-pulse*2, bh, 8);

  // Inner pattern
  ctx.fillStyle = hpRatio < 0.25 ? '#880000' : bc.inner;
  roundRect(ctx, b.x-b.w/2+6+pulse, b.y-b.h/2+4, b.w-12-pulse*2, b.h-8, 4);
  ctx.shadowBlur = 0;

  // Eyes with glow (stage-colored)
  ctx.shadowColor = bc.eye; ctx.shadowBlur = 12;
  ctx.fillStyle = bc.eye;
  ctx.fillRect(b.x-14, b.y-7, 7, 9);
  ctx.fillRect(b.x+7, b.y-7, 7, 9);
  ctx.shadowBlur = 0;

  // Pupils
  ctx.fillStyle = '#ff0000';
  ctx.fillRect(b.x-12, b.y-4, 3, 3);
  ctx.fillRect(b.x+10, b.y-4, 3, 3);

  // Name with glow
  ctx.shadowColor = '#ff4466'; ctx.shadowBlur = 6;
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(b.name, b.x, b.y - b.h/2 - 28);
  ctx.shadowBlur = 0;

  // HP bar (fancy gradient)
  const barW=200, barH=14, barX=b.x-barW/2, barY=b.y-b.h/2-18;
  ctx.fillStyle = '#111122';
  ctx.fillRect(barX-1, barY-1, barW+2, barH+2);
  const hpGrad = ctx.createLinearGradient(barX, 0, barX+barW*hpRatio, 0);
  if (hpRatio > 0.5) { hpGrad.addColorStop(0,'#ff2244'); hpGrad.addColorStop(1,'#ff6688'); }
  else if (hpRatio > 0.25) { hpGrad.addColorStop(0,'#ff6600'); hpGrad.addColorStop(1,'#ffaa00'); }
  else { hpGrad.addColorStop(0,'#ff0000'); hpGrad.addColorStop(1,'#ff4444'); }
  ctx.fillStyle = hpGrad;
  ctx.fillRect(barX, barY, barW*hpRatio, barH);
  // HP bar shine
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(barX, barY, barW*hpRatio, barH/2);
  // HP text
  ctx.fillStyle = '#ffffff';
  ctx.font = '11px monospace';
  ctx.fillText(`${Math.floor(b.hp).toLocaleString()} / ${b.maxHp.toLocaleString()}`, b.x, barY+barH+14);

  // Spawn boss particles
  if (Math.random() < 0.3) {
    const angle = Math.random() * Math.PI * 2;
    effects.push({ type:'particle', x:b.x+Math.cos(angle)*40, y:b.y+Math.sin(angle)*40,
      vx:Math.cos(angle)*0.5, vy:Math.sin(angle)*0.5, life:20, color:hpRatio<0.3?'#ff4400':'#ff446688', size:1+Math.random()*2 });
  }

  ctx.restore();
}

function updateBoss(dt) {
  if (!boss || !boss.alive) return;
  // Movement
  boss.x += boss.moveDir * (0.8 + data.stage * 0.1) * dt * 60;
  if (boss.x > W-50) boss.moveDir = -1;
  if (boss.x < 50) boss.moveDir = 1;

  // Attack patterns
  boss.attackTimer += dt;
  const atkRate = Math.max(0.4, 2.0 - data.stage * 0.08);
  if (boss.attackTimer >= atkRate) {
    boss.attackTimer = 0;
    boss.pattern = (boss.pattern + 1) % 3;
    const hpRatio = boss.hp / boss.maxHp;

    if (boss.pattern === 0) {
      // Spread shot (3-7 bullets in a fan)
      const count = 3 + Math.floor(data.stage / 4);
      for (let i = 0; i < count; i++) {
        const a = Math.PI/2 + (i-(count-1)/2) * 0.3;
        bossBullets.push({ x:boss.x, y:boss.y+boss.h/2, angle:a, speed:2+data.stage*0.15, size:4, life:200, color:'#ff4466' });
      }
    } else if (boss.pattern === 1) {
      // Aimed shot at player
      const dx = player.x - boss.x, dy = player.y - boss.y;
      const a = Math.atan2(dy, dx);
      const count = 1 + Math.floor(data.stage / 6);
      for (let i = 0; i < count; i++) {
        bossBullets.push({ x:boss.x, y:boss.y+boss.h/2, angle:a+(i-(count-1)/2)*0.15, speed:3+data.stage*0.1, size:5, life:200, color:'#ffaa00' });
      }
    } else if (boss.pattern === 2 && hpRatio < 0.5) {
      // Ring burst (low HP rage mode)
      const count = 8 + data.stage;
      for (let i = 0; i < count; i++) {
        const a = (i/count) * Math.PI * 2;
        bossBullets.push({ x:boss.x, y:boss.y, angle:a, speed:1.5+data.stage*0.1, size:3, life:250, color:'#ff66ff' });
      }
    }
  }

  // Update boss bullets
  for (const b of bossBullets) {
    b.x += Math.cos(b.angle) * b.speed * dt * 60;
    b.y += Math.sin(b.angle) * b.speed * dt * 60;
    b.life--;
  }
  bossBullets = bossBullets.filter(b => b.life > 0 && b.x > -20 && b.x < W+20 && b.y > -20 && b.y < H+20);
}

function drawBossBullets() {
  for (const b of bossBullets) {
    ctx.save();
    ctx.shadowColor = b.color; ctx.shadowBlur = 8;
    ctx.fillStyle = b.color;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.size, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#ffffff88';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.size*0.4, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }
}

// ============================================================
// Bullets (Enhanced with neon glow + varied shapes)
// ============================================================
// movement: 'straight','wave','spiral','homing','accel','split','orbit'
function createBullet(x, y, type, angle, dmg, movement) {
  return { x, y, type, angle:angle||-Math.PI/2,
    speed: type==='homing'?3.5:type==='bomb'?2.5:5,
    dmg:dmg||10, life:300,
    size: type==='bomb'?6:type==='homing'?4:3,
    glow:false, trail:[], feverLv: fever.level,
    movement: movement||'straight', age:0, baseAngle:angle||-Math.PI/2 };
}

let shootPattern = 0; // cycles through patterns
let patternTimer = 0;

function autoShoot() {
  const dps = combat.getAutoDPS(data.level, data.weapons, fever.level);
  const fl = fever.level;
  const baseDmg = dps / 60;
  const px = player.x, py = player.y - 18;

  patternTimer += 0.01;
  if (patternTimer >= 0.8) { patternTimer = 0; shootPattern = (shootPattern + 1) % 8; }
  const pat = shootPattern;

  // Find nearest target
  let ta = -Math.PI/2;
  if (boss && boss.alive) { ta = Math.atan2(boss.y-player.y, boss.x-player.x); }
  else { let nd=Infinity; for (const m of meteors) { if(!m.alive) continue; const d=Math.hypot(m.x-px,m.y-py); if(d<nd){nd=d;ta=Math.atan2(m.y-py,m.x-px);} } }

  const mk = (x,y,a,d,mv,spd) => { const b=createBullet(x,y,'normal',a,d,mv); b.glow=true; if(spd) b.speed=spd; bullets.push(b); };
  const spread = (n,sp,d,mv) => { for(let i=0;i<n;i++) mk(px,py,-Math.PI/2+(i-(n-1)/2)*sp,d/n,mv||'straight'); };
  const aimed = (n,sp,d,mv,spd) => { for(let i=0;i<n;i++) mk(px,py,ta+(i-(n-1)/2)*sp,d/n,mv||'straight',spd); };
  const twin = (gap,d,mv) => { mk(px-gap,py,-Math.PI/2,d*0.5,mv); mk(px+gap,py,-Math.PI/2,d*0.5,mv); };
  const sides = (d) => { mk(px-20,py-10,-Math.PI/2-0.4,d*0.3,'wave'); mk(px+20,py-10,-Math.PI/2+0.4,d*0.3,'wave'); };
  const back = (d) => { mk(px,py+38,Math.PI/2,d*0.2,'straight'); };
  const orbit = (n,d) => { for(let i=0;i<n;i++){const a=gameTime*3+i*Math.PI*2/n; mk(px+Math.cos(a)*25,py+Math.sin(a)*25,ta,d/n,'straight',7);} };
  const ring = (n,d) => { for(let i=0;i<n;i++) mk(px,py,(i/n)*Math.PI*2,d/n,'straight',4); };

  // ════════════════════════════════════════════════
  //  Fever Lv 0-100: Bullet Patterns
  // ════════════════════════════════════════════════

  if (fl >= 95) {
    // ── 95-100: FINAL FORM — 全部載せ ──
    aimed(5, 0.06, baseDmg*0.5, 'accel', 8);       // 狙い加速弾5連
    sides(baseDmg);                                   // サイドウェーブ
    if(pat%2===0) orbit(6, baseDmg*0.6);             // 6基サテライト
    if(pat%2===1) ring(12, baseDmg*0.4);             // 全方位12発
    back(baseDmg);                                    // 後方弾
    spread(3, 0.5, baseDmg*0.3, 'homing');           // ホーミング3発
  } else if (fl >= 90) {
    // ── 90-94: 東方 最終スペルカード ──
    aimed(4, 0.07, baseDmg*0.5, 'accel', 8);
    sides(baseDmg);
    if(pat%2===0) orbit(5, baseDmg*0.5);
    if(pat%3===0) ring(10, baseDmg*0.3);
    back(baseDmg);
  } else if (fl >= 85) {
    // ── 85-89: サテライト6基 + 狙い撃ち + ウェーブ + 後方 ──
    aimed(3, 0.08, baseDmg*0.5, 'accel', 7);
    sides(baseDmg*0.8);
    orbit(6, baseDmg*0.5);
    back(baseDmg);
  } else if (fl >= 80) {
    // ── 80-84: 全方位リング + 集中レーザー交互 ──
    if(pat%2===0) { aimed(5, 0.05, baseDmg*0.7, 'accel', 7); }
    else { ring(10, baseDmg*0.4); }
    sides(baseDmg*0.6);
    orbit(4, baseDmg*0.4);
  } else if (fl >= 75) {
    // ── 75-79: 怒首領蜂 ハイパー — 集中8連 + サテライト ──
    aimed(8, 0.04, baseDmg*0.6, 'accel', 8);
    orbit(4, baseDmg*0.4);
    if(pat%3===0) back(baseDmg);
  } else if (fl >= 70) {
    // ── 70-74: スパイラル弾 + 集中 + ウェーブ ──
    aimed(3, 0.08, baseDmg*0.4, 'accel', 7);
    if(pat%2===0) { for(let i=0;i<3;i++) mk(px,py,-Math.PI/2+i*0.3-0.3,baseDmg*0.2,'spiral'); }
    sides(baseDmg*0.6);
  } else if (fl >= 65) {
    // ── 65-69: 全方位8発 + 狙い加速 ──
    aimed(3, 0.1, baseDmg*0.5, 'accel', 6);
    if(pat%2===0) ring(8, baseDmg*0.3);
    sides(baseDmg*0.4);
  } else if (fl >= 60) {
    // ── 60-64: 怒首領蜂 集中6連 + ワイド交互 ──
    if(pat%2===0) { aimed(6, 0.04, baseDmg*0.7, 'accel', 7); }
    else { spread(7, 0.2, baseDmg*0.5); }
    back(baseDmg*0.8);
  } else if (fl >= 55) {
    // ── 55-59: サテライト4基 + 狙い + 後方 ──
    aimed(3, 0.08, baseDmg*0.5, 'accel', 6);
    orbit(4, baseDmg*0.4);
    if(pat%3===0) back(baseDmg*0.6);
  } else if (fl >= 50) {
    // ── 50-54: 東方風 — 加速狙い + サイドウェーブ + サテライト ──
    aimed(3, 0.08, baseDmg*0.5, 'accel', 6);
    sides(baseDmg*0.5);
    if(pat%3===0) orbit(4, baseDmg*0.3);
  } else if (fl >= 45) {
    // ── 45-49: 怒首領蜂 集中5連 + ワイド8発交互 ──
    if(pat%2===0) { aimed(5, 0.05, baseDmg*0.7, 'accel', 7); }
    else { spread(8, 0.15, baseDmg*0.5); }
  } else if (fl >= 40) {
    // ── 40-44: 1941 後方弾追加 + 集中4連 + スプレッド ──
    aimed(4, 0.06, baseDmg*0.5, 'accel', 6);
    if(pat%2===0) spread(5, 0.2, baseDmg*0.3);
    back(baseDmg*0.5);
  } else if (fl >= 35) {
    // ── 35-39: 怒首領蜂 集中4連 + ワイド6発 交互 ──
    if(pat%2===0) { aimed(4, 0.06, baseDmg*0.6, 'accel', 7); }
    else { spread(6, 0.18, baseDmg*0.5); }
  } else if (fl >= 30) {
    // ── 30-34: 集中レーザー3連(加速) + ワイド5発 交互 ──
    if(pat%2===0) { aimed(3, 0.08, baseDmg*0.6, 'accel', 6); }
    else { spread(5, 0.2, baseDmg*0.5); }
  } else if (fl >= 27) {
    // ── 27-29: ツインビー ホーミング2発 + 5WAY ──
    spread(5, 0.15, baseDmg*0.5);
    if(pat%2===0) { mk(px-15,py,ta,baseDmg*0.3,'homing',3); mk(px+15,py,ta,baseDmg*0.3,'homing',3); }
  } else if (fl >= 24) {
    // ── 24-26: 5WAYスプレッド + ウェーブ ──
    spread(5, 0.15, baseDmg*0.5);
    if(pat%2===0) sides(baseDmg*0.3);
  } else if (fl >= 21) {
    // ── 21-23: 4WAYスプレッド + ホーミング1発 ──
    spread(4, 0.18, baseDmg*0.5);
    if(pat%2===0) mk(px,py,ta,baseDmg*0.3,'homing',3);
  } else if (fl >= 18) {
    // ── 18-20: 4WAYスプレッド ──
    spread(4, 0.18, baseDmg*0.6);
  } else if (fl >= 15) {
    // ── 15-17: ツインビー 3WAY + ホーミング ──
    spread(3, 0.2, baseDmg*0.5);
    if(pat%2===0) mk(px,py,ta,baseDmg*0.3,'homing',3);
  } else if (fl >= 12) {
    // ── 12-14: ゼビウス ツイン + ウェーブ ──
    twin(10, baseDmg*0.6);
    if(pat%2===0) mk(px,py,-Math.PI/2,baseDmg*0.3,'wave');
  } else if (fl >= 10) {
    // ── 10-11: ゼビウス ツイン + 狙い1発 ──
    twin(8, baseDmg*0.5);
    mk(px,py,ta,baseDmg*0.3,'straight',6);
  } else if (fl >= 7) {
    // ── 7-9: ゼビウス ツインショット ──
    twin(8, baseDmg*0.7);
  } else if (fl >= 5) {
    // ── 5-6: スターソルジャー 3WAY ──
    spread(3, 0.2, baseDmg*0.7);
  } else if (fl >= 3) {
    // ── 3-4: ワイドダブル ──
    twin(12, baseDmg*0.8);
  } else if (fl >= 1) {
    // ── 1-2: ダブルショット ──
    twin(6, baseDmg*0.8);
  } else {
    // ── 0: 単発 ──
    mk(px,py,-Math.PI/2,baseDmg,'straight');
  }
}

function fireTool(toolName, dmgResult) {
  const type = combat.getToolType(toolName);
  const count = type==='bomb'?1:type==='homing'?3:2;
  for (let i = 0; i < count; i++) {
    const b = createBullet(player.x, player.y-18, type, -Math.PI/2+(i-(count-1)/2)*0.2, dmgResult.damage/count);
    b.glow=true; b.size=type==='bomb'?10:5;
    bullets.push(b);
  }
  if (dmgResult.isCrit) {
    effects.push({ type:'text', x:player.x, y:player.y-40, text:'CRITICAL!', color:'#ffff00', life:60, size:22 });
    shakeTimer=10; shakeIntensity=4;
    // Screen flash
    effects.push({ type:'flash', x:0, y:0, life:8, color:'#ffff4422' });
  }
  addDamageLog(toolName, dmgResult);
}

function updateBullets(dt) {
  for (const b of bullets) {
    b.age += dt;

    // Movement patterns
    if (b.movement === 'homing' || (b.type==='homing'&&boss&&boss.alive)) {
      // Track nearest enemy
      let tx=boss?boss.x:W/2, ty=boss?boss.y:0;
      if (boss && boss.alive) { tx=boss.x; ty=boss.y; }
      else {
        let nd=Infinity;
        for (const m of meteors) { if (!m.alive) continue; const d=Math.hypot(m.x-b.x,m.y-b.y); if(d<nd){nd=d;tx=m.x;ty=m.y;} }
      }
      const ta=Math.atan2(ty-b.y,tx-b.x);
      let diff=ta-b.angle; while(diff>Math.PI) diff-=Math.PI*2; while(diff<-Math.PI) diff+=Math.PI*2;
      b.angle+=diff*0.08;
    } else if (b.movement === 'wave') {
      // Sine wave perpendicular to direction
      b.angle = b.baseAngle + Math.sin(b.age * 12) * 0.4;
    } else if (b.movement === 'spiral') {
      b.angle = b.baseAngle + b.age * 3;
    } else if (b.movement === 'accel') {
      b.speed = Math.min(12, b.speed + dt * 15); // accelerating
    }

    b.x+=Math.cos(b.angle)*b.speed*dt*60;
    b.y+=Math.sin(b.angle)*b.speed*dt*60;
    b.life--;
    if (b.glow||b.type!=='normal') { b.trail.push({x:b.x,y:b.y,life:10}); if(b.trail.length>8) b.trail.shift(); }
    // Hit meteors
    for (const m of meteors) {
      if (!m.alive) continue;
      if (Math.abs(b.x-m.x)<m.w/2+b.size && Math.abs(b.y-m.y)<m.h/2+b.size) {
        m.hp-=b.dmg; m.hitFlash=4;
        if (m.hp<=0) { m.alive=false; onMeteorKilled(m); }
        b.life=0; break;
      }
    }
    if (b.life>0&&boss&&boss.alive) {
      if (Math.abs(b.x-boss.x)<boss.w/2+b.size && Math.abs(b.y-boss.y)<boss.h/2+b.size) {
        boss.hp-=b.dmg; boss.hitFlash=4; data.stats.totalDamage+=b.dmg;
        if (b.type==='bomb') { shakeTimer=8; shakeIntensity=5; addExplosion(b.x,b.y); }
        if (boss.hp<=0) { boss.alive=false; onBossDefeated(); }
        b.life=0;
      }
    }
  }
  bullets=bullets.filter(b=>b.life>0&&b.x>-20&&b.x<W+20&&b.y>-20&&b.y<H+20);
}

function drawBullets() {
  for (const b of bullets) {
    ctx.save();
    const wl = data.weapons[b.type==='homing'?'homing':b.type==='bomb'?'bomb':b.type==='support'?'support':'normal']||1;

    // Color: weapon level + fever (baked into bullet at creation time)
    const fl = b.feverLv || 0;
    let bc, core;
    let sz = b.size;
    // Bullet shape: 0=circle, 1=diamond, 2=laser, 3=star6, 4=star8, 5=hex+ring
    let shape = 0;

    // ──────── Fever Lv 0-100 Bullet Visuals ────────
    if (fl >= 90) {
      // Lv90-100: RAINBOW SUPERNOVA — the ultimate reward
      const hue = (gameTime * 500 + b.x * 5 + b.y * 3) % 360;
      bc = `hsl(${hue}, 100%, 85%)`; core = '#ffffff';
      sz *= 4.0 + Math.sin(gameTime*12)*0.8; shape = 5;
    } else if (fl >= 80) {
      // Lv80-89: white-gold pulsing plasma
      bc = '#ffffee'; core = '#ffd700';
      sz *= 3.5 + Math.sin(gameTime*10)*0.5; shape = 5;
    } else if (fl >= 70) {
      // Lv70-79: prismatic (shifts between fixed colors fast)
      const colors = ['#ff0044','#ff8800','#ffff00','#00ff88','#0088ff','#8800ff'];
      bc = colors[Math.floor(gameTime*8 + b.x)%colors.length]; core = '#ffffff';
      sz *= 3.2; shape = 4;
    } else if (fl >= 60) {
      // Lv60-69: electric blue-white
      bc = '#88ddff'; core = '#ffffff';
      sz *= 3.0 + Math.sin(gameTime*8)*0.4; shape = 4;
    } else if (fl >= 50) {
      // Lv50-59: deep purple + bright core
      bc = '#aa44ff'; core = '#ffddff';
      sz *= 2.8; shape = 4;
    } else if (fl >= 40) {
      // Lv40-49: emerald green flame
      bc = '#22ff88'; core = '#aaffcc';
      sz *= 2.5 + Math.sin(gameTime*6)*0.3; shape = 3;
    } else if (fl >= 30) {
      // Lv30-39: white hot
      bc = '#ffffff'; core = '#ffddaa';
      sz *= 2.3; shape = 3;
    } else if (fl >= 20) {
      // Lv20-29: crimson + dark core
      bc = '#ff2244'; core = '#440000';
      sz *= 2.0; shape = 3;
    } else if (fl >= 15) {
      // Lv15-19: magenta pulse
      bc = '#ff44cc'; core = '#ffffff';
      sz *= 1.8 + Math.sin(gameTime*6)*0.2; shape = 2;
    } else if (fl >= 10) {
      // Lv10-14: orange blaze
      bc = '#ff6600'; core = '#ffdd44';
      sz *= 1.7; shape = 2;
    } else if (fl >= 7) {
      // Lv7-9: hot red
      bc = '#ff2200'; core = '#ffaa44';
      sz *= 1.5; shape = 2;
    } else if (fl >= 5) {
      // Lv5-6: amber
      bc = '#ffaa00'; core = '#ffff88';
      sz *= 1.4; shape = 2;
    } else if (fl >= 3) {
      // Lv3-4: warm gold
      bc = '#ffcc22'; core = '#ffffff';
      sz *= 1.3; shape = 1;
    } else if (fl >= 2) {
      // Lv2: light gold
      bc = '#eebb33'; core = '#ffffff';
      sz *= 1.2; shape = 1;
    } else if (fl >= 1) {
      // Lv1: pale yellow
      bc = '#ddaa44'; core = '#ffffff';
      sz *= 1.1; shape = 1;
    } else {
      // Lv0: weapon level colors
      if (b.type==='normal') {
        bc = wl>=20?'#44ffaa':wl>=10?'#aaeeff':wl>=5?'#88ddff':'#66ccff';
        core = wl>=20?'#aaffdd':'#ffffff';
      } else if (b.type==='homing') {
        bc = wl>=15?'#ff44ff':wl>=8?'#ffaa44':'#ff8844'; core = '#ffffff';
      } else if (b.type==='bomb') {
        bc = wl>=10?'#ffff44':wl>=5?'#ff6644':'#ff4444'; core = '#ffffff';
      } else { bc = '#44ff88'; core = '#ffffff'; }
    }

    // Trail: longer and brighter with fever
    const trailLen = Math.min(b.trail.length, 4 + Math.floor(wl/3) + Math.min(fl, 20));
    for (let i=Math.max(0,b.trail.length-trailLen);i<b.trail.length;i++) {
      const t=b.trail[i];
      ctx.globalAlpha=((i-(b.trail.length-trailLen))/trailLen)*Math.min(0.7, 0.2+fl*0.01);
      ctx.fillStyle=bc;
      ctx.beginPath(); ctx.arc(t.x,t.y,sz*0.35,0,Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha=1;

    // Draw shape based on fever tier
    ctx.shadowColor=bc;
    ctx.shadowBlur=Math.min(50, (b.glow?10:4)+Math.min(fl,50)*0.6);
    ctx.fillStyle=bc;
    if (shape === 5) {
      // Hexagon + outer ring
      ctx.beginPath();
      for (let p=0;p<6;p++) { const a=(p/6)*Math.PI*2+gameTime*4; const r=sz; if(p===0) ctx.moveTo(b.x+Math.cos(a)*r,b.y+Math.sin(a)*r); else ctx.lineTo(b.x+Math.cos(a)*r,b.y+Math.sin(a)*r); }
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle=bc; ctx.lineWidth=1; ctx.globalAlpha=0.4;
      ctx.beginPath(); ctx.arc(b.x,b.y,sz*1.5,0,Math.PI*2); ctx.stroke();
      ctx.globalAlpha=1;
    } else if (shape === 4) {
      // 8-point star
      ctx.beginPath();
      for (let p=0;p<16;p++) { const a=(p/16)*Math.PI*2+gameTime*3; const r=p%2===0?sz:sz*0.5; if(p===0) ctx.moveTo(b.x+Math.cos(a)*r,b.y+Math.sin(a)*r); else ctx.lineTo(b.x+Math.cos(a)*r,b.y+Math.sin(a)*r); }
      ctx.closePath(); ctx.fill();
    } else if (shape === 3) {
      // 6-point star
      ctx.beginPath();
      for (let p=0;p<12;p++) { const a=(p/12)*Math.PI*2+gameTime*2.5; const r=p%2===0?sz:sz*0.4; if(p===0) ctx.moveTo(b.x+Math.cos(a)*r,b.y+Math.sin(a)*r); else ctx.lineTo(b.x+Math.cos(a)*r,b.y+Math.sin(a)*r); }
      ctx.closePath(); ctx.fill();
    } else if (shape === 2) {
      // Laser ellipse
      ctx.beginPath();
      ctx.ellipse(b.x,b.y,sz*0.5,sz*2,b.angle+Math.PI/2,0,Math.PI*2);
      ctx.fill();
    } else if (shape === 1) {
      // Diamond
      ctx.beginPath();
      ctx.moveTo(b.x,b.y-sz*1.3); ctx.lineTo(b.x+sz*0.7,b.y);
      ctx.lineTo(b.x,b.y+sz*1.3); ctx.lineTo(b.x-sz*0.7,b.y);
      ctx.closePath(); ctx.fill();
    } else {
      ctx.beginPath(); ctx.arc(b.x,b.y,sz,0,Math.PI*2); ctx.fill();
    }
    // Core
    ctx.fillStyle=core;
    ctx.beginPath(); ctx.arc(b.x,b.y,sz*0.25,0,Math.PI*2); ctx.fill();
    // Sparkle particles (scale with fever, cap at reasonable rate)
    if (fl >= 3 && Math.random() < Math.min(0.4, 0.05 + fl * 0.005)) {
      effects.push({ type:'particle', x:b.x, y:b.y, vx:(Math.random()-0.5)*2, vy:(Math.random()-0.5)*2, life:6+Math.min(fl,30)*0.3, color:bc, size:1+Math.min(fl,50)*0.05 });
    }
    ctx.restore();
  }
}

// ============================================================
// Effects (Enhanced)
// ============================================================
function addExplosion(x, y) {
  for (let i=0;i<24;i++) {
    const a=(i/24)*Math.PI*2;
    effects.push({ type:'particle', x, y, vx:Math.cos(a)*(2+Math.random()*4), vy:Math.sin(a)*(2+Math.random()*4),
      life:25+Math.random()*20, color:['#ff4400','#ffaa00','#ffff44','#ffffff'][Math.floor(Math.random()*4)], size:2+Math.random()*4 });
  }
  effects.push({ type:'flash', x:0, y:0, life:6, color:'#ffffff33' });
  effects.push({ type:'ring', x, y, life:20, radius:5, maxRadius:60, color:'#ff880088' });
}

function onMeteorKilled(m) {
  // Combo system (visual + score only, no XP bonus)
  combo++; comboTimer = 3.0;
  if (combo > maxCombo) maxCombo = combo;

  // More particles for higher combos
  const particleCount = Math.min(20, 8 + Math.floor(combo / 3));
  for (let i=0; i<particleCount; i++) {
    const angle = (i/particleCount) * Math.PI * 2;
    const speed = 2 + Math.random() * 3;
    effects.push({ type:'particle', x:m.x, y:m.y,
      vx: Math.cos(angle)*speed, vy: Math.sin(angle)*speed,
      life:15+Math.random()*12, color: m.color, size:1.5+Math.random()*3 });
  }
  effects.push({ type:'ring', x:m.x, y:m.y, life:15, radius:3, maxRadius:35+combo*2, color:m.glow+'aa' });

  // Screen shake on high combo
  if (combo >= 10) { shakeTimer = 3; shakeIntensity = 1 + combo * 0.1; }
  // Flash on milestone combos
  if (combo % 25 === 0) effects.push({ type:'flash', x:0, y:0, life:6, color:'#ffdd4422' });

  let xp = m.xp||1;
  if (activePowerups.xp2) xp *= 2;
  data.xp+=xp; data.totalXp+=xp;
  data.score += xp * 10 + combo * 5;
  effects.push({ type:'text', x:m.x, y:m.y, text:'+'+xp+' XP', color: activePowerups.xp2 ? '#ffdd44' : '#44ffaa', life:35, size:14 });
  if (combo >= 5) {
    effects.push({ type:'text', x:m.x, y:m.y-18, text:combo+'x COMBO!',
      color: combo>=50?'#ff44ff':combo>=20?'#ffaa00':combo>=10?'#ffdd44':'#aaddff',
      life:30, size: Math.min(22, 12+combo*0.2) });
  }
  while (data.xp>=data.xpToNext) { data.xp-=data.xpToNext; data.level++; data.xpToNext=gameData.xpToNext(data.level); onLevelUp(); }

  // Power-up drop chance
  for (const pu of POWERUP_TYPES) {
    if (Math.random() < pu.chance) {
      powerups.push({ x:m.x, y:m.y, type:pu.type, label:pu.label, color:pu.color, icon:pu.icon, duration:pu.duration, vy:1.5, life:300 });
      break; // max 1 drop per kill
    }
  }
  saveGame();
}

function addDamageLog(toolName, dmgResult) {
  const c = dmgResult.isCrit?'#ffff00':dmgResult.type==='bomb'?'#ff4444':dmgResult.type==='homing'?'#ff8844':'#66ccff';
  damageLog.unshift({ text:`${toolName} +${Math.floor(dmgResult.damage)} DMG`, color:c, timer:180 });
  if (damageLog.length>4) damageLog.pop();
  effects.push({ type:'text', x:boss?boss.x+(Math.random()-0.5)*40:W/2, y:boss?boss.y+20:100,
    text:Math.floor(dmgResult.damage).toLocaleString(), color:c, life:50, size:dmgResult.isCrit?24:18 });
}

function updateEffects(dt) {
  for (const e of effects) {
    e.life-=dt*60;
    if (e.type==='particle') { e.x+=e.vx*dt*60; e.y+=e.vy*dt*60; e.vy+=0.05; e.size*=0.98; }
    if (e.type==='text') { e.y-=0.8*dt*60; }
    if (e.type==='ring') { e.radius+=(e.maxRadius-e.radius)*0.15; }
  }
  effects=effects.filter(e=>e.life>0);
  for (const d of damageLog) d.timer--;
  damageLog=damageLog.filter(d=>d.timer>0);

  // Power-ups: fall, check pickup, tick active timers
  for (const p of powerups) {
    p.y += p.vy * dt * 60;
    p.life--;
    // Auto-pickup when near player
    if (Math.abs(p.x - player.x) < 30 && Math.abs(p.y - player.y) < 30) {
      activePowerups[p.type] = (activePowerups[p.type] || 0) + p.duration;
      effects.push({ type:'text', x:p.x, y:p.y-20, text:p.label+'!', color:p.color, life:60, size:18 });
      effects.push({ type:'ring', x:p.x, y:p.y, life:15, radius:5, maxRadius:40, color:p.color+'88' });
      p.life = 0;
    }
  }
  powerups = powerups.filter(p => p.life > 0 && p.y < H + 20);

  // Tick active powerups
  for (const key of Object.keys(activePowerups)) {
    activePowerups[key] -= dt;
    if (activePowerups[key] <= 0) delete activePowerups[key];
  }

  // Apply barrage powerup: extra bullets in all directions
  if (activePowerups.barrage && Math.random() < 0.3) {
    const a = Math.random() * Math.PI * 2;
    const b = createBullet(player.x, player.y, 'normal', a, combat.getAutoDPS(data.level, data.weapons, fever.level) / 60);
    b.glow = true;
    bullets.push(b);
  }

  // Apply speed powerup: faster player movement
  player.speed = activePowerups.speed ? 3.5 : 1.8;

  // Stage transition timer
  if (stageTransition.active) {
    stageTransition.timer -= dt;
    if (stageTransition.timer <= 0) stageTransition.active = false;
  }

  // Ultimate effect timer
  if (ultimateEffect.active) {
    ultimateEffect.timer -= dt;
    if (ultimateEffect.timer <= 0) ultimateEffect.active = false;
  }
}

function drawEffects() {
  for (const e of effects) {
    ctx.save();
    ctx.globalAlpha=Math.min(1,e.life/12);
    if (e.type==='particle') {
      ctx.shadowColor=e.color; ctx.shadowBlur=4;
      ctx.fillStyle=e.color;
      ctx.beginPath(); ctx.arc(e.x,e.y,Math.max(0.5,e.size),0,Math.PI*2); ctx.fill();
    }
    if (e.type==='text') {
      ctx.fillStyle=e.color;
      ctx.font=`bold ${e.size}px monospace`;
      ctx.textAlign='center';
      ctx.shadowColor=e.color; ctx.shadowBlur=8;
      ctx.fillText(e.text,e.x,e.y);
    }
    if (e.type==='flash') {
      ctx.globalAlpha=e.life/10;
      ctx.fillStyle=e.color;
      ctx.fillRect(0,0,W,H);
    }
    if (e.type==='ring') {
      ctx.strokeStyle=e.color;
      ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(e.x,e.y,e.radius,0,Math.PI*2); ctx.stroke();
    }
    ctx.restore();
  }
}

function drawPowerups() {
  // Falling items
  for (const p of powerups) {
    ctx.save();
    ctx.shadowColor = p.color; ctx.shadowBlur = 10;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - 10, p.y - 10, 20, 20);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1;
    ctx.strokeRect(p.x - 10, p.y - 10, 20, 20);
    ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
    ctx.fillText(p.icon, p.x, p.y + 4);
    ctx.restore();
  }
  // Active powerup indicators (top of screen)
  const activeKeys = Object.keys(activePowerups);
  if (activeKeys.length > 0) {
    ctx.save();
    for (let i = 0; i < activeKeys.length; i++) {
      const key = activeKeys[i];
      const def = POWERUP_TYPES.find(t => t.type === key);
      if (!def) continue;
      const px = 12 + i * 80, py = 74;
      ctx.fillStyle = def.color + '44'; ctx.fillRect(px, py, 72, 16);
      ctx.font = 'bold 10px monospace'; ctx.textAlign = 'left'; ctx.fillStyle = def.color;
      ctx.fillText(`${def.label} ${Math.ceil(activePowerups[key])}s`, px + 4, py + 12);
    }
    ctx.restore();
  }
}

function drawStageTransition() {
  if (!stageTransition.active) return;
  ctx.save();
  const t = stageTransition.timer;
  const total = 3.0;
  const alpha = t > total - 0.5 ? (total - t) / 0.5 : t > 0.5 ? 1.0 : t / 0.5;
  ctx.globalAlpha = alpha * 0.85;
  ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = alpha;
  ctx.font = 'bold 28px monospace'; ctx.textAlign = 'center';
  ctx.shadowColor = '#ffdd44'; ctx.shadowBlur = 15;
  ctx.fillStyle = '#ffdd44';
  ctx.fillText(`STAGE ${stageTransition.stage}`, W / 2, H / 2 - 20);
  ctx.shadowBlur = 0;
  ctx.font = '16px monospace'; ctx.fillStyle = '#aaaacc';
  ctx.fillText(stageTransition.name, W / 2, H / 2 + 15);
  ctx.font = '12px monospace'; ctx.fillStyle = '#666';
  ctx.fillText('GET READY', W / 2, H / 2 + 45);
  ctx.restore();
}

// ── Tool Flash (big tool name on screen) ──
function drawToolFlash() {
  if (!toolFlash.active) return;
  toolFlash.timer -= 1/60;
  if (toolFlash.timer <= 0) { toolFlash.active = false; return; }
  ctx.save();
  const progress = toolFlash.timer / 1.2;
  const alpha = progress > 0.7 ? (1 - progress) / 0.3 : Math.min(1, progress / 0.3);
  ctx.globalAlpha = alpha * 0.9;

  // Tool name colors
  const toolColors = { WRITE:'#66ccff', EDIT:'#66ccff', READ:'#88aacc', GREP:'#ff8844', GLOB:'#ff8844', BASH:'#44ff88', MULTIEDIT:'#ff4444', WEBFETCH:'#ff8844', TASK:'#44ff88', TODOWRITE:'#aaaacc' };
  const color = toolColors[toolFlash.name] || '#ffffff';

  // Big tool name
  const sz = 32 + (1 - progress) * 10;
  ctx.font = `bold ${Math.floor(sz)}px monospace`;
  ctx.textAlign = 'center';
  ctx.shadowColor = color; ctx.shadowBlur = 20;
  ctx.fillStyle = color;
  ctx.fillText(toolFlash.name + '!', W / 2, H / 2 + 60);

  // Damage number below
  ctx.shadowBlur = 8;
  ctx.font = 'bold 20px monospace';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('+' + toolFlash.damage.toLocaleString() + ' DMG', W / 2, H / 2 + 90);

  ctx.restore();
}

// ── Stage Result Screen ──
function drawStageResult() {
  if (!stageResult.active) return;
  stageResult.timer -= 1/60;
  if (stageResult.timer <= 0) { stageResult.active = false; return; }
  ctx.save();
  const t = stageResult.timer;
  const total = 5.0;
  const alpha = t > total - 0.5 ? (total - t) / 0.5 : t > 0.8 ? 1.0 : t / 0.8;
  ctx.globalAlpha = alpha * 0.92;
  ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = alpha;

  // STAGE CLEAR title
  ctx.font = 'bold 32px monospace'; ctx.textAlign = 'center';
  ctx.shadowColor = '#44ffaa'; ctx.shadowBlur = 15;
  ctx.fillStyle = '#44ffaa';
  ctx.fillText('STAGE CLEAR!', W / 2, H / 2 - 80);
  ctx.shadowBlur = 0;

  // Boss name
  ctx.font = '16px monospace'; ctx.fillStyle = '#ff8888';
  ctx.fillText(stageResult.bossName + ' defeated', W / 2, H / 2 - 50);

  // Stats with staggered reveal
  const reveal = Math.min(1, (total - t) / 2); // 0->1 over 2 seconds
  ctx.textAlign = 'left';
  const stats = [
    { label: 'XP Gained', value: '+' + stageResult.xp.toLocaleString(), color: '#ffdd44' },
    { label: 'Time', value: Math.floor(stageResult.time) + 's', color: '#88aaff' },
    { label: 'Tools Used', value: stageResult.toolUses + ' times', color: '#44ff88' },
    { label: 'Stage', value: stageResult.stage + ' complete', color: '#aaaacc' },
  ];

  for (let i = 0; i < stats.length; i++) {
    const lineReveal = Math.max(0, Math.min(1, (reveal - i * 0.2) / 0.3));
    if (lineReveal <= 0) continue;
    ctx.globalAlpha = alpha * lineReveal;
    const y = H / 2 - 15 + i * 32;
    ctx.font = '14px monospace'; ctx.fillStyle = '#888';
    ctx.fillText(stats[i].label, 60, y);
    ctx.font = 'bold 16px monospace'; ctx.fillStyle = stats[i].color;
    ctx.textAlign = 'right';
    ctx.fillText(stats[i].value, W - 60, y);
    ctx.textAlign = 'left';
  }

  // Prestige hint at bottom
  if (data.level >= 95) {
    ctx.globalAlpha = alpha * Math.min(1, reveal);
    ctx.font = '12px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#ff44ff';
    ctx.fillText('Lv.100 \u2192 PRESTIGE available!', W / 2, H / 2 + 130);
  }

  ctx.restore();
}

// ── Prestige System ──
function drawPrestigeButton() {
  if (data.level < 100) return;
  ctx.save();
  const pulse = Math.sin(gameTime * 4) * 0.2 + 0.8;
  ctx.globalAlpha = pulse;
  ctx.shadowColor = '#ff44ff'; ctx.shadowBlur = 12;
  ctx.fillStyle = '#ff44ff';
  const bx = W / 2 - 70, by = H - 38;
  ctx.fillRect(bx, by, 140, 24);
  ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  const prestigeCount = data.prestige || 0;
  ctx.fillText(`PRESTIGE (x${prestigeCount + 1})`, W / 2, by + 16);
  ctx.restore();
  // Store button bounds for click
  drawPrestigeButton._bounds = { x: bx, y: by, w: 140, h: 24 };
}
drawPrestigeButton._bounds = null;

function doPrestige() {
  const p = (data.prestige || 0) + 1;
  // Keep: prestige count, total XP, total damage, bosses killed, achievements, streakDays, sessionCount
  const keep = {
    prestige: p,
    totalXp: data.totalXp,
    achievements: data.achievements || [],
    streakDays: data.streakDays,
    lastPlayDate: data.lastPlayDate,
    sessionCount: data.sessionCount,
    stats: {
      totalDamage: data.stats.totalDamage,
      bossesKilled: data.stats.bossesKilled,
      toolUses: data.stats.toolUses,
      critCount: data.stats.critCount || 0,
      maxCombo: Math.max(maxCombo, data.stats.maxCombo || 0),
    },
  };
  // Reset
  data = { ...gameData.DEFAULT_DATA, ...keep };
  data.stats = { ...gameData.DEFAULT_DATA.stats, ...keep.stats };
  data.weapons = { ...gameData.DEFAULT_DATA.weapons };
  combo = 0; maxCombo = keep.stats.maxCombo;
  fever = { gauge: 0, level: 0, boostTimer: 0, decayTimer: 0 };

  // Big prestige effect
  effects.push({ type:'flash', x:0, y:0, life:30, color:'#ff44ff66' });
  effects.push({ type:'text', x:W/2, y:H/2, text:`PRESTIGE ${p}!`, color:'#ff44ff', life:180, size:30 });
  effects.push({ type:'text', x:W/2, y:H/2+35, text:`+${p*10}% permanent DMG`, color:'#ffaaff', life:150, size:16 });
  for (let i = 0; i < 40; i++) {
    const a = Math.random()*Math.PI*2;
    effects.push({ type:'particle', x:W/2, y:H/2, vx:Math.cos(a)*5, vy:Math.sin(a)*5, life:40, color:'#ff44ff', size:3 });
  }
  shakeTimer = 30; shakeIntensity = 10;

  spawnStage();
  saveGame();
}

function drawUltimateEffect() {
  if (!ultimateEffect.active) return;
  ctx.save();
  const t = ultimateEffect.timer;
  if (ultimateEffect.type === 'beam') {
    // Full screen vertical beam from player
    ctx.globalAlpha = Math.min(1, t / 0.3) * 0.7;
    const grad = ctx.createLinearGradient(player.x - 30, 0, player.x + 30, 0);
    grad.addColorStop(0, 'transparent'); grad.addColorStop(0.3, '#44ddff88');
    grad.addColorStop(0.5, '#ffffff'); grad.addColorStop(0.7, '#44ddff88');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fillRect(player.x - 60, 0, 120, H);
    // Core beam
    ctx.globalAlpha = Math.min(1, t / 0.3);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(player.x - 3, 0, 6, player.y);
    // Damage all enemies on screen
    if (t > 0.5) {
      for (const m of meteors) { if (m.alive) { m.hp -= 5; if (m.hp <= 0) { m.alive = false; onMeteorKilled(m); } } }
      if (boss && boss.alive) { boss.hp -= 50; boss.hitFlash = 3; }
    }
  } else if (ultimateEffect.type === 'explosion') {
    // Full screen explosion
    const progress = 1 - t / 1.5;
    ctx.globalAlpha = Math.min(1, t / 0.5) * 0.6;
    const grad = ctx.createRadialGradient(W/2, H/2, 10, W/2, H/2, progress * W);
    grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.3, '#ff440088');
    grad.addColorStop(0.7, '#ff000044'); grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    // Damage everything
    if (Math.random() < 0.3) {
      for (const m of meteors) { if (m.alive) { m.hp -= 10; if (m.hp <= 0) { m.alive = false; onMeteorKilled(m); } } }
      if (boss && boss.alive) { boss.hp -= 100; boss.hitFlash = 3; }
    }
  } else if (ultimateEffect.type === 'homing_storm') {
    // Spawn homing bullets everywhere
    if (Math.random() < 0.5) {
      const b = createBullet(Math.random()*W, Math.random()*H*0.5, 'homing', Math.PI/2, combat.getAutoDPS(data.level,data.weapons,fever.level)/10);
      b.glow = true; b.size = 5;
      bullets.push(b);
    }
    ctx.globalAlpha = Math.min(0.2, t / 0.5);
    ctx.fillStyle = '#ff884422';
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}

function drawStatsPanel() {
  if (!statsPanelOpen) return;
  ctx.save();
  ctx.fillStyle = 'rgba(5,5,20,0.93)'; ctx.fillRect(0, 0, W, H);
  ctx.shadowColor = '#44aaff'; ctx.shadowBlur = 6;
  ctx.font = 'bold 22px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#44aaff';
  ctx.fillText('STATISTICS', W/2, 35);
  ctx.shadowBlur = 0;
  ctx.font = '12px monospace'; ctx.fillStyle = '#555';
  ctx.fillText('click or ESC to close', W/2, 52);

  const stats = [
    ['Level', `${data.level}`],
    ['Stage', `${data.stage}${data.endlessMode?' (ENDLESS)':''}`],
    ['Total XP', data.totalXp.toLocaleString()],
    ['Score', data.score.toLocaleString()],
    ['Total Damage', Math.floor(data.stats.totalDamage).toLocaleString()],
    ['Bosses Killed', `${data.stats.bossesKilled}`],
    ['Max Combo', `${maxCombo || data.stats.maxCombo || 0}x`],
    ['Streak Days', `${data.streakDays}`],
    ['Sessions', `${data.sessionCount}`],
  ];

  ctx.textAlign = 'left'; ctx.font = '14px monospace';
  for (let i = 0; i < stats.length; i++) {
    const y = 80 + i * 28;
    ctx.fillStyle = '#888'; ctx.fillText(stats[i][0], 20, y);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'right';
    ctx.fillText(stats[i][1], W - 20, y);
    ctx.textAlign = 'left';
  }

  // Tool usage bar chart
  const tools = data.stats.toolUses || {};
  const toolNames = Object.keys(tools).sort((a,b) => tools[b] - tools[a]);
  const maxUse = Math.max(1, ...Object.values(tools));
  ctx.font = 'bold 14px monospace'; ctx.fillStyle = '#44aaff';
  ctx.fillText('Tool Usage', 20, 340);
  ctx.font = '11px monospace';
  const barColors = { Write:'#66ccff', Edit:'#66ccff', Read:'#88aacc', Grep:'#ff8844', Glob:'#ff8844', Bash:'#44ff88', MultiEdit:'#ff4444', WebFetch:'#ff8844', Task:'#44ff88', TodoWrite:'#aaaacc' };
  for (let i = 0; i < Math.min(toolNames.length, 10); i++) {
    const y = 360 + i * 22;
    const name = toolNames[i];
    const count = tools[name];
    const barW = (count / maxUse) * (W - 130);
    ctx.fillStyle = '#888'; ctx.textAlign = 'left';
    ctx.fillText(name, 20, y + 3);
    ctx.fillStyle = barColors[name] || '#888';
    ctx.fillRect(90, y - 8, barW, 14);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'right';
    ctx.fillText(`${count}`, W - 20, y + 3);
    ctx.textAlign = 'left';
  }

  ctx.restore();
}

// ============================================================
// Fever Overlay (Enhanced with pulsing neon borders)
// ============================================================
function drawFeverOverlay() {
  if (fever.level<=0 && fever.boostTimer<=0) return;
  const fl = fever.level;
  ctx.save();

  // ──────── Background tint: evolves through color spectrum ────────
  if (fl >= 1) {
    const intensity = Math.min(0.18, 0.015 + fl * 0.002);
    ctx.globalAlpha = intensity + Math.sin(gameTime * (4 + Math.min(fl,30))) * intensity * 0.5;
    let tintColor;
    if (fl >= 90)      { const h=(gameTime*80)%360; tintColor=`hsl(${h},100%,60%)`; }  // rainbow
    else if (fl >= 70) { tintColor='#ffffff'; }     // white hot
    else if (fl >= 60) { tintColor='#88ddff'; }     // electric blue
    else if (fl >= 50) { tintColor='#aa44ff'; }     // deep purple
    else if (fl >= 40) { tintColor='#22ff88'; }     // emerald
    else if (fl >= 30) { tintColor='#ffffff'; }     // white
    else if (fl >= 20) { tintColor='#ff2244'; }     // crimson
    else if (fl >= 15) { tintColor='#ff44cc'; }     // magenta
    else if (fl >= 10) { tintColor='#ff6600'; }     // orange
    else if (fl >= 7)  { tintColor='#ff2200'; }     // red
    else if (fl >= 5)  { tintColor='#ffaa00'; }     // amber
    else if (fl >= 3)  { tintColor='#ffcc22'; }     // gold
    else               { tintColor='#ddaa44'; }     // pale gold
    ctx.fillStyle = tintColor;
    ctx.fillRect(0, 0, W, H);
  }

  // Scanlines (intensity scales)
  if (fl >= 7) {
    ctx.globalAlpha = Math.min(0.06, 0.01 + fl * 0.001);
    ctx.fillStyle = fl >= 70 ? '#ffffff' : fl >= 40 ? '#88ffaa' : '#ff4400';
    for (let y = 0; y < H; y += (fl >= 50 ? 3 : 4)) ctx.fillRect(0, y, W, 1);
  }

  // ──────── Border glow: evolves in color, thickness, and layers ────────
  if (fl >= 1) {
    const glow = Math.sin(gameTime * (3 + Math.min(fl,20) * 0.3)) * 0.3 + 0.5;
    ctx.globalAlpha = Math.min(0.85, glow * (0.15 + fl * 0.01));
    let borderColor;
    if (fl >= 90)      { const h=(gameTime*120)%360; borderColor=`hsl(${h},100%,75%)`; }
    else if (fl >= 70) { borderColor='#ffffff'; }
    else if (fl >= 60) { borderColor='#88ddff'; }
    else if (fl >= 50) { borderColor='#aa44ff'; }
    else if (fl >= 40) { borderColor='#22ff88'; }
    else if (fl >= 30) { borderColor='#ffffff'; }
    else if (fl >= 20) { borderColor='#ff2244'; }
    else if (fl >= 15) { borderColor='#ff44cc'; }
    else if (fl >= 10) { borderColor='#ff6600'; }
    else if (fl >= 7)  { borderColor='#ff2200'; }
    else if (fl >= 5)  { borderColor='#ffaa00'; }
    else if (fl >= 3)  { borderColor='#ffcc22'; }
    else               { borderColor='#ddaa44'; }
    ctx.shadowColor = borderColor;
    ctx.shadowBlur = Math.min(40, 6 + fl * 0.8);
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = Math.min(10, 1 + fl * 0.12);
    ctx.strokeRect(3, 3, W-6, H-6);
    // Multi-layer borders at higher levels
    if (fl >= 15) { ctx.globalAlpha *= 0.5; ctx.strokeRect(8, 8, W-16, H-16); }
    if (fl >= 40) { ctx.globalAlpha *= 0.5; ctx.strokeRect(14, 14, W-28, H-28); }
    if (fl >= 70) { ctx.globalAlpha *= 0.5; ctx.strokeRect(20, 20, W-40, H-40); }
    ctx.shadowBlur = 0;
  }
  ctx.globalAlpha=1;
  ctx.restore();
}

// ============================================================
// HUD (Enhanced with glowing elements)
// ============================================================
function drawHUD() {
  ctx.save();
  const phase = gameData.getPhase(data.level);
  const phaseNames = {Awakening:'覚醒期',Growth:'成長期',Ascension:'昇華期',Transcendence:'超越期',Godhood:'神域'};

  // Semi-transparent top bar
  ctx.fillStyle='rgba(5,5,20,0.5)';
  ctx.fillRect(0,0,W,70);

  // Level
  ctx.shadowColor='#44ffaa'; ctx.shadowBlur=4;
  ctx.fillStyle='#ffffff';
  ctx.font='bold 22px monospace'; ctx.textAlign='left';
  ctx.fillText(`Lv.${data.level}`,12,28);
  ctx.shadowBlur=0;
  ctx.font='14px monospace'; ctx.fillStyle='#88aacc';
  ctx.fillText(phaseNames[phase]||phase,12,46);

  // Score
  ctx.textAlign='right';
  ctx.shadowColor='#ffdd44'; ctx.shadowBlur=4;
  ctx.font='bold 20px monospace'; ctx.fillStyle='#ffdd44';
  ctx.fillText(data.score.toLocaleString()+' pts',W-12,28);
  ctx.shadowBlur=0;
  ctx.font='13px monospace'; ctx.fillStyle='#aaaaaa';
  const stageLabel=data.endlessMode?`ENDLESS #${data.endlessBossCount+1}`:`Stage ${data.stage}`;
  ctx.fillText(stageLabel,W-50,46);

  // XP Bar (fancy)
  const xpY=56, xpH=10, xpW=W-24;
  ctx.fillStyle='#111122';
  ctx.fillRect(11,xpY-1,xpW+2,xpH+2);
  const xpR=data.xp/data.xpToNext;
  const xpGrad=ctx.createLinearGradient(12,0,12+xpW*xpR,0);
  xpGrad.addColorStop(0,'#2266aa'); xpGrad.addColorStop(1,'#44ddff');
  ctx.fillStyle=xpGrad;
  ctx.fillRect(12,xpY,xpW*xpR,xpH);
  ctx.fillStyle='rgba(255,255,255,0.15)';
  ctx.fillRect(12,xpY,xpW*xpR,xpH/2);
  ctx.font='10px monospace'; ctx.textAlign='center'; ctx.fillStyle='#fff';
  ctx.fillText(`XP ${data.xp}/${data.xpToNext}`,W/2,xpY+9);

  // Fever gauge
  if (fever.gauge>0||fever.level>0) {
    const fy=H-45, fw=W-24;
    ctx.fillStyle='rgba(5,5,20,0.5)';
    ctx.fillRect(0,fy-15,W,40);
    ctx.fillStyle='#111122';
    ctx.fillRect(12,fy,fw,8);
    // Bar shows progress to NEXT level (gauge % 30 / 30)
    const nextLevelGauge = combat.FEVER_GAUGE_PER_LEVEL;
    const inLevel = fever.gauge % nextLevelGauge;
    const gr = fever.level > 0 ? (inLevel / nextLevelGauge) || 1.0 : fever.gauge / nextLevelGauge;
    // Color intensifies with level
    const hue = Math.max(0, 60 - fever.level * 12); // yellow -> orange -> red -> deep red
    const fc = fever.level <= 0 ? '#888' : `hsl(${hue}, 100%, ${Math.max(40, 60 - fever.level * 2)}%)`;
    const fg = ctx.createLinearGradient(12,0,12+fw*Math.min(gr,1),0);
    fg.addColorStop(0, fc); fg.addColorStop(1, '#ffff88');
    ctx.fillStyle = fg;
    ctx.fillRect(12, fy, fw * Math.min(gr,1), 8);
    // Always show fever info when gauge > 0
    ctx.textAlign = 'center';
    if (fever.level > 0) {
      const fs = Math.min(22, 14 + fever.level);
      ctx.shadowColor = fc; ctx.shadowBlur = 10 + fever.level * 2;
      ctx.font = `bold ${fs}px monospace`;
      ctx.fillStyle = fc;
      ctx.fillText(`FEVER Lv.${fever.level}`, W/2, fy-8);
      ctx.font = '12px monospace';
      ctx.fillStyle = '#ffff88';
      ctx.fillText(`DMG x${combat.getFeverDmgMult(fever.level).toFixed(1)}  CRIT ${(combat.getFeverCrit(fever.level).chance*100).toFixed(0)}%`, W/2, fy+20);
      ctx.shadowBlur = 0;
    } else {
      ctx.font = '11px monospace';
      ctx.fillStyle = '#666';
      ctx.fillText(`Fever ${Math.floor(fever.gauge)}/${combat.FEVER_GAUGE_PER_LEVEL}`, W/2, fy-4);
    }
  }

  // Damage log
  ctx.textAlign='left'; ctx.font='13px monospace';
  for (let i=0;i<damageLog.length&&i<3;i++) {
    const d=damageLog[i];
    ctx.globalAlpha=Math.min(1,d.timer/30);
    ctx.shadowColor=d.color; ctx.shadowBlur=4;
    ctx.fillStyle=d.color;
    ctx.fillText(d.text,12,H-55-i*18);
  }
  ctx.globalAlpha=1; ctx.shadowBlur=0;

  // Combo counter (center-right, big and flashy)
  if (combo >= 3) {
    const comboAlpha = Math.min(1, comboTimer / 0.5);
    ctx.globalAlpha = comboAlpha;
    const cs = Math.min(36, 18 + combo * 0.3);
    const cc = combo >= 50 ? '#ff44ff' : combo >= 20 ? '#ff6600' : combo >= 10 ? '#ffdd44' : '#aaddff';
    ctx.shadowColor = cc; ctx.shadowBlur = 12 + combo * 0.5;
    ctx.font = `bold ${cs}px monospace`; ctx.textAlign = 'right';
    ctx.fillStyle = cc;
    ctx.fillText(`${combo}x`, W - 15, H / 2 + 10);
    ctx.font = '12px monospace'; ctx.fillStyle = '#aaa';
    ctx.fillText('COMBO', W - 15, H / 2 + 26);
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
  }

  // Weapon levels
  ctx.font='12px monospace'; ctx.textAlign='right'; ctx.fillStyle='#667788';
  ctx.fillText(`N:${data.weapons.normal} H:${data.weapons.homing} B:${data.weapons.bomb} S:${data.weapons.support}`,W-12,H-55);

  // Trophy button
  const progress=achievements.getProgress(data);
  TROPHY_BTN.x=W-48; TROPHY_BTN.y=52;
  ctx.fillStyle=achPanelOpen?'#ffdd44':'rgba(40,40,60,0.8)';
  ctx.fillRect(TROPHY_BTN.x,TROPHY_BTN.y,TROPHY_BTN.w,TROPHY_BTN.h);
  ctx.strokeStyle='#ffdd44'; ctx.lineWidth=1;
  ctx.strokeRect(TROPHY_BTN.x,TROPHY_BTN.y,TROPHY_BTN.w,TROPHY_BTN.h);
  ctx.font='18px monospace'; ctx.textAlign='center';
  ctx.fillStyle=achPanelOpen?'#222':'#ffdd44';
  ctx.fillText('\u2605',TROPHY_BTN.x+TROPHY_BTN.w/2,TROPHY_BTN.y+25);
  ctx.font='9px monospace'; ctx.fillStyle='#888';
  ctx.fillText(`${progress.unlocked}/${progress.total}`,TROPHY_BTN.x+TROPHY_BTN.w/2,TROPHY_BTN.y+TROPHY_BTN.h+10);

  // Pin (always-on-top) button
  PIN_BTN.x=12; PIN_BTN.y=H-18;
  ctx.fillStyle=alwaysOnTop?'rgba(68,170,255,0.8)':'rgba(40,40,60,0.6)';
  ctx.fillRect(PIN_BTN.x,PIN_BTN.y,PIN_BTN.w,PIN_BTN.h);
  ctx.font='10px monospace'; ctx.textAlign='center';
  ctx.fillStyle=alwaysOnTop?'#fff':'#888';
  ctx.fillText(alwaysOnTop?'\u{1F4CC}ON':'\u{1F4CC}--',PIN_BTN.x+PIN_BTN.w/2,PIN_BTN.y+14);

  // Stats button
  STATS_BTN.x=46; STATS_BTN.y=H-18;
  ctx.fillStyle=statsPanelOpen?'rgba(68,170,255,0.8)':'rgba(40,40,60,0.6)';
  ctx.fillRect(STATS_BTN.x,STATS_BTN.y,STATS_BTN.w,STATS_BTN.h);
  ctx.font='10px monospace'; ctx.textAlign='center';
  ctx.fillStyle=statsPanelOpen?'#fff':'#888';
  ctx.fillText('STAT',STATS_BTN.x+STATS_BTN.w/2,STATS_BTN.y+14);

  ctx.restore();
}

// ============================================================
// Game Logic
// ============================================================
function onBossDefeated() {
  data.stats.bossesKilled++;
  shakeTimer=40; shakeIntensity=12;

  // XP: flat percentage of bossHP, no multipliers
  const xpGain = Math.floor(boss.maxHp * 0.15);
  data.xp += xpGain; data.totalXp += xpGain;
  data.score += Math.floor(boss.maxHp);

  // Cascade text: XP number rains down in multiple sizes
  effects.push({ type:'text', x:W/2, y:H/2-40, text:'BOSS DEFEATED!', color:'#ff4466', life:150, size:28 });
  effects.push({ type:'text', x:W/2, y:H/2, text:`+${xpGain.toLocaleString()} XP`, color:'#ffdd44', life:150, size:26 });

  // MASSIVE explosion - 120 particles in waves
  for (let wave = 0; wave < 3; wave++) {
    setTimeout(() => {
      for (let i = 0; i < 40; i++) {
        const a = Math.random() * Math.PI * 2;
        const spd = 3 + Math.random() * 8 + wave * 2;
        effects.push({ type:'particle', x:boss.x+(Math.random()-0.5)*30, y:boss.y+(Math.random()-0.5)*30,
          vx:Math.cos(a)*spd, vy:Math.sin(a)*spd,
          life:50+Math.random()*40, color:['#ff4400','#ffaa00','#ffff44','#ffffff','#ff66aa','#44ffaa','#4488ff'][Math.floor(Math.random()*7)],
          size:2+Math.random()*7 });
      }
      effects.push({ type:'flash', x:0, y:0, life:8, color:'#ffffff44' });
    }, wave * 200);
  }

  // Multi-ring shockwave
  effects.push({ type:'flash', x:0, y:0, life:25, color:'#ffffff55' });
  for (let i = 0; i < 5; i++) {
    setTimeout(() => {
      effects.push({ type:'ring', x:boss.x, y:boss.y, life:35, radius:5+i*5, maxRadius:100+i*40, color:['#ffdd4488','#ff440066','#ffffff44','#ff66aa44','#44ffaa44'][i] });
    }, i * 100);
  }

  // Level up cascade
  while (data.xp>=data.xpToNext) { data.xp-=data.xpToNext; data.level++; data.xpToNext=gameData.xpToNext(data.level); onLevelUp(); }
  upgradeWeapons();

  // Stage Result screen (shows for 5 seconds, then stage transition)
  const elapsedTime = gameTime - stageStartTime;
  stageResult = { active:true, timer:5.0, xp:xpGain, time:elapsedTime, toolUses:stageToolUses, stage:data.stage, bossName:boss.name };

  setTimeout(() => {
    if (!data.endlessMode) { data.stage++; if (data.stage>gameData.STAGES.length) { data.endlessMode=true; data.endlessBossCount=0; effects.push({type:'text',x:W/2,y:H/2,text:'ENDLESS MODE!',color:'#ff44ff',life:180,size:24}); } }
    else data.endlessBossCount++;
    stageToolUses = 0;
    stageStartTime = gameTime;
    spawnStage(); saveGame();
  }, 6000); // 5s result + 1s buffer
}

function onLevelUp() {
  effects.push({ type:'text', x:W/2, y:H/2-30, text:`LEVEL UP! Lv.${data.level}`, color:'#44ffaa', life:90, size:24 });
  effects.push({ type:'ring', x:player.x, y:player.y, life:25, radius:5, maxRadius:80, color:'#44ffaa88' });
  effects.push({ type:'flash', x:0, y:0, life:8, color:'#44ffaa22' });
  shakeTimer=6; shakeIntensity=3;
}

function upgradeWeapons() {
  const u=data.stats.toolUses;
  data.weapons.normal=Math.max(1,Math.floor(Math.sqrt((u.Write||0)+(u.Edit||0))*0.5)+1);
  data.weapons.homing=Math.max(1,Math.floor(Math.sqrt((u.Grep||0)+(u.Glob||0)+(u.WebFetch||0))*0.5)+1);
  data.weapons.bomb=Math.max(1,Math.floor(Math.sqrt((u.MultiEdit||0))*0.7)+1);
  data.weapons.support=Math.max(1,Math.floor(Math.sqrt((u.Bash||0)+(u.Task||0))*0.5)+1);
}

function spawnStage() {
  meteors=[]; bullets=[]; bossBullets=[]; powerups=[];
  boss=createBoss(data.stage);
  data.bossHp=boss.hp; data.bossMaxHp=boss.maxHp; data.bossName=boss.name;
  // Stage title card
  const sd = gameData.STAGES[Math.min(data.stage-1, gameData.STAGES.length-1)];
  stageTransition = { active:true, timer:3.0, stage:data.stage, name: sd ? sd.name || sd.bossName : 'Unknown Zone' };
}

function updatePlayer(dt) {
  player.animFrame++;
  player.x+=player.dir*player.speed*dt*60;
  if (player.x>W-40) player.dir=-1;
  if (player.x<40) player.dir=1;
  player.shootTimer+=dt;
  // Much faster shooting: base 0.12s, scales down with fever
  const rate=Math.max(0.03, 0.12 - fever.level * 0.01);
  if (player.shootTimer>=rate) { player.shootTimer=0; autoShoot(); }
}

// ============================================================
// Main Game Loop
// ============================================================
function gameLoop(time) {
  const dt=Math.min((time-lastTime)/1000,0.05);
  lastTime=time; gameTime+=dt;
  fever=combat.updateFever(fever,dt,false);
  // Combo decay
  if (comboTimer > 0) { comboTimer -= dt; if (comboTimer <= 0) { combo = 0; } }
  updatePlayer(dt); updateBullets(dt); updateMeteors(dt); updateBoss(dt); updateEffects(dt);

  ctx.clearRect(0,0,W,H);
  ctx.save();
  if (shakeTimer>0) { ctx.translate((Math.random()-0.5)*shakeIntensity,(Math.random()-0.5)*shakeIntensity); shakeTimer--; }

  drawBackground();
  drawFeverOverlay();
  drawMeteors();
  drawBoss(boss);
  drawBossBullets();
  drawBullets();
  drawClaudeKun(player.x, player.y, data.level, player.animFrame);
  drawEffects();
  drawPowerups();
  drawUltimateEffect();
  ctx.restore();
  drawHUD();
  drawToolFlash();
  drawPrestigeButton();
  drawStageTransition();
  drawStageResult();
  checkAndDrawAchievements(dt);
  if (achPanelOpen) drawAchievementPanel();
  if (statsPanelOpen) drawStatsPanel();
  requestAnimationFrame(gameLoop);
}

// ============================================================
// Achievement System
// ============================================================
function checkAchievementsNow() {
  if (!data.achievements) data.achievements = [];
  const newlyUnlocked=achievements.checkAchievements(data);
  for (const id of newlyUnlocked) {
    data.achievements.push(id); // Record as unlocked so it doesn't fire again
    const ach=achievements.getAchievement(id);
    if (ach) {
      achievementQueue.push({ name:ach.name, desc:ach.desc, timer:240 });
      if (ach.reward && ach.reward.type==='xp') {
        data.xp+=ach.reward.value; data.totalXp+=ach.reward.value;
        while (data.xp>=data.xpToNext) { data.xp-=data.xpToNext; data.level++; data.xpToNext=gameData.xpToNext(data.level); onLevelUp(); }
      }
    }
  }
  if (newlyUnlocked.length > 0) saveGame();
}

function checkAndDrawAchievements(dt) {
  achievementCheckTimer+=dt;
  if (achievementCheckTimer>=2) { achievementCheckTimer=0; checkAchievementsNow(); }
  if (achievementQueue.length===0) return;
  const a=achievementQueue[0]; a.timer--;
  if (a.timer<=0) { achievementQueue.shift(); return; }
  ctx.save();
  const alpha=a.timer>200?Math.min(1,(240-a.timer)/40):Math.min(1,a.timer/40);
  ctx.globalAlpha=alpha;
  const bw=320,bh=54,bx=(W-bw)/2,by=80;
  ctx.fillStyle='rgba(10,10,30,0.9)'; ctx.fillRect(bx,by,bw,bh);
  ctx.shadowColor='#ffdd44'; ctx.shadowBlur=10;
  ctx.strokeStyle='#ffdd44'; ctx.lineWidth=2; ctx.strokeRect(bx,by,bw,bh);
  ctx.shadowBlur=0;
  ctx.font='20px monospace'; ctx.textAlign='left'; ctx.fillStyle='#ffdd44';
  ctx.fillText('\u2605',bx+12,by+34);
  ctx.font='bold 14px monospace'; ctx.fillStyle='#ffdd44';
  ctx.fillText(a.name,bx+40,by+22);
  ctx.font='11px monospace'; ctx.fillStyle='#aaaacc';
  ctx.fillText(a.desc,bx+40,by+40);
  ctx.restore();
}

// ============================================================
// Achievement Panel
// ============================================================
function drawAchievementPanel() {
  ctx.save();
  ctx.fillStyle='rgba(5,5,20,0.93)'; ctx.fillRect(0,0,W,H);
  ctx.shadowColor='#ffdd44'; ctx.shadowBlur=6;
  ctx.font='bold 22px monospace'; ctx.textAlign='center'; ctx.fillStyle='#ffdd44';
  ctx.fillText('\u2605 ACHIEVEMENTS \u2605',W/2,35);
  ctx.shadowBlur=0;
  ctx.font='12px monospace'; ctx.fillStyle='#555';
  ctx.fillText('click \u2605 or ESC to close',W/2,55);

  const tabY=65,tabH=24,tabW=Math.floor((W-20)/4);
  const tabStart=Math.floor(achPanelCategory/4)*4;
  const tabs=ACH_CATEGORIES.slice(tabStart,tabStart+4);
  if (tabStart>0) { ctx.fillStyle='#888'; ctx.font='14px monospace'; ctx.textAlign='left'; ctx.fillText('\u25C0',4,tabY+16); }
  if (tabStart+4<ACH_CATEGORIES.length) { ctx.fillStyle='#888'; ctx.font='14px monospace'; ctx.textAlign='right'; ctx.fillText('\u25B6',W-4,tabY+16); }
  for (let i=0;i<tabs.length;i++) {
    const idx=tabStart+i, tx=10+i*tabW, sel=idx===achPanelCategory;
    ctx.fillStyle=sel?'#ffdd44':'#222233'; ctx.fillRect(tx,tabY,tabW-4,tabH);
    ctx.font=sel?'bold 11px monospace':'10px monospace'; ctx.fillStyle=sel?'#111':'#888'; ctx.textAlign='center';
    let label=tabs[i]; if (label.length>7) label=label.substring(0,6)+'.';
    ctx.fillText(label,tx+(tabW-4)/2,tabY+16);
  }
  const catName=ACH_CATEGORIES[achPanelCategory];
  const allAchs=achievements.ACHIEVEMENTS;
  const filtered=catName==='All'?allAchs:allAchs.filter(a=>a.category===catName);
  const unlocked=data.achievements||[];
  const listY=tabY+tabH+10, listH=H-listY-25, itemH=52;
  const maxScroll=Math.max(0,filtered.length*itemH-listH);
  achPanelScroll=Math.max(0,Math.min(achPanelScroll,maxScroll));
  ctx.beginPath(); ctx.rect(8,listY,W-16,listH); ctx.clip();
  for (let i=0;i<filtered.length;i++) {
    const a=filtered[i], iy=listY+i*itemH-achPanelScroll;
    if (iy>H||iy+itemH<listY) continue;
    const isU=unlocked.includes(a.id), isH=a.hidden&&!isU;
    ctx.fillStyle=isU?'rgba(255,221,68,0.08)':'rgba(30,30,50,0.6)'; ctx.fillRect(12,iy+2,W-24,itemH-4);
    ctx.fillStyle=isU?'#ffdd44':'#333'; ctx.fillRect(12,iy+2,3,itemH-4);
    ctx.font='18px monospace'; ctx.textAlign='left'; ctx.fillStyle=isU?'#ffdd44':'#444';
    ctx.fillText(isU?'\u2605':'\u2606',22,iy+30);
    ctx.font='bold 13px monospace'; ctx.fillStyle=isU?'#ffdd44':(isH?'#555':'#999');
    ctx.fillText(isH?'???':a.name,46,iy+20);
    ctx.font='11px monospace'; ctx.fillStyle=isU?'#bbbb99':(isH?'#444':'#666');
    const desc=isH?'Hidden achievement':a.desc;
    ctx.fillText(desc.length>35?desc.substring(0,33)+'..':desc,46,iy+38);
    if (a.reward&&!isH) {
      ctx.font='9px monospace'; ctx.textAlign='right'; ctx.fillStyle=isU?'#88aa88':'#555';
      const rText=a.reward.type==='xp'?`+${a.reward.value} XP`:a.reward.type==='dmg_boost'?`DMG +${(a.reward.value*100).toFixed(0)}%`:a.reward.type;
      ctx.fillText(rText,W-18,iy+20); ctx.textAlign='left';
    }
  }
  if (maxScroll>0) {
    const sbX=W-10,sbThumbH=Math.max(20,(listH/(filtered.length*itemH))*listH);
    const sbThumbY=listY+(achPanelScroll/maxScroll)*(listH-sbThumbH);
    ctx.fillStyle='#222'; ctx.fillRect(sbX,listY,4,listH);
    ctx.fillStyle='#555'; ctx.fillRect(sbX,sbThumbY,4,sbThumbH);
  }
  ctx.restore();
  ctx.save();
  const uc=filtered.filter(a=>unlocked.includes(a.id)).length;
  ctx.font='12px monospace'; ctx.textAlign='center'; ctx.fillStyle='#888';
  ctx.fillText(`${uc} / ${filtered.length} unlocked`,W/2,H-6);
  ctx.restore();
}

// ============================================================
// Input
// ============================================================
canvas.addEventListener('click',(e)=>{
  const rect=canvas.getBoundingClientRect();
  const mx=(e.clientX-rect.left)*(W/rect.width), my=(e.clientY-rect.top)*(H/rect.height);
  if (mx>=TROPHY_BTN.x&&mx<=TROPHY_BTN.x+TROPHY_BTN.w&&my>=TROPHY_BTN.y&&my<=TROPHY_BTN.y+TROPHY_BTN.h) { achPanelOpen=!achPanelOpen; achPanelScroll=0; return; }
  // Pin button
  if (mx>=PIN_BTN.x&&mx<=PIN_BTN.x+PIN_BTN.w&&my>=PIN_BTN.y&&my<=PIN_BTN.y+PIN_BTN.h) {
    ipcRenderer.invoke('toggle-always-on-top').then(v => { alwaysOnTop = v; });
    return;
  }
  // Stats button
  if (mx>=STATS_BTN.x&&mx<=STATS_BTN.x+STATS_BTN.w&&my>=STATS_BTN.y&&my<=STATS_BTN.y+STATS_BTN.h) {
    statsPanelOpen = !statsPanelOpen;
    return;
  }
  // Prestige button
  if (drawPrestigeButton._bounds && data.level >= 100) {
    const pb = drawPrestigeButton._bounds;
    if (mx>=pb.x&&mx<=pb.x+pb.w&&my>=pb.y&&my<=pb.y+pb.h) { doPrestige(); return; }
  }
  // Close stats panel on click anywhere
  if (statsPanelOpen) { statsPanelOpen = false; return; }
  if (achPanelOpen) {
    const tabY=65,tabH=24,tabW=Math.floor((W-20)/4),tabStart=Math.floor(achPanelCategory/4)*4;
    if (my>=tabY&&my<=tabY+tabH) {
      if (mx<15&&tabStart>0) { achPanelCategory=Math.max(0,achPanelCategory-4); return; }
      if (mx>W-15&&tabStart+4<ACH_CATEGORIES.length) { achPanelCategory=Math.min(ACH_CATEGORIES.length-1,achPanelCategory+4); return; }
      for (let i=0;i<4;i++) { const idx=tabStart+i; if (idx>=ACH_CATEGORIES.length) break; const tx=10+i*tabW; if (mx>=tx&&mx<=tx+tabW-4) { achPanelCategory=idx; achPanelScroll=0; return; } }
    }
  }
});
canvas.addEventListener('wheel',(e)=>{ if (achPanelOpen) { achPanelScroll+=e.deltaY*0.5; e.preventDefault(); } },{passive:false});
document.addEventListener('keydown',(e)=>{ if (e.key==='Escape') { achPanelOpen=false; statsPanelOpen=false; } });

// ============================================================
// Event Handling
// ============================================================
function handleGameEvent(event) {
  if (!event) return;
  if (event.event==='PostToolUse') {
    const toolName=event.tool_name||'Unknown', weight=event.weight||'normal';
    data.stats.toolUses[toolName]=(data.stats.toolUses[toolName]||0)+1;
    const dmgResult=combat.calculateDamage(toolName,data.level,data.weapons,fever.level,weight,data.prestige||0);
    if (boss&&boss.alive) { boss.hp-=dmgResult.damage; boss.hitFlash=5; data.stats.totalDamage+=dmgResult.damage; if (boss.hp<=0) { boss.alive=false; onBossDefeated(); } }
    fever=combat.updateFever(fever,0,true,weight);
    fireTool(toolName,dmgResult);
    data.score+=Math.floor(dmgResult.damage);
    upgradeWeapons();
    stageToolUses++;

    // Big tool name flash on screen
    toolFlash = { active:true, name:toolName.toUpperCase(), timer:1.2, damage:Math.floor(dmgResult.damage) };

    // Ultimate attacks triggered by big tool uses
    const lines = (weight && weight.lines) || 1;
    if (toolName === 'Write' && lines >= 30) {
      // Write 30+ lines: FULL SCREEN BEAM
      ultimateEffect = { active:true, type:'beam', timer:1.5 };
      effects.push({ type:'text', x:W/2, y:H/2-60, text:'WRITE BEAM!', color:'#44ddff', life:80, size:24 });
      shakeTimer = 15; shakeIntensity = 5;
    } else if (toolName === 'MultiEdit') {
      // MultiEdit: FULL SCREEN EXPLOSION
      ultimateEffect = { active:true, type:'explosion', timer:1.5 };
      effects.push({ type:'text', x:W/2, y:H/2-60, text:'MULTI-EDIT BLAST!', color:'#ff4400', life:80, size:22 });
      shakeTimer = 20; shakeIntensity = 8;
    } else if ((toolName === 'Grep' || toolName === 'Glob') && lines >= 10) {
      // Search 10+ results: HOMING STORM
      ultimateEffect = { active:true, type:'homing_storm', timer:2.0 };
      effects.push({ type:'text', x:W/2, y:H/2-60, text:'SEARCH STORM!', color:'#ff8844', life:80, size:22 });
    }
    saveGame();
  }
  if (event.event==='SessionStart') {
    data.sessionCount++;
    const today=new Date().toDateString();
    if (data.lastPlayDate!==today) { const last=data.lastPlayDate?new Date(data.lastPlayDate):null; if (last&&(new Date()-last)<48*60*60*1000) data.streakDays++; else data.streakDays=1; data.lastPlayDate=today; }
    saveGame();
  }
}

// ============================================================
// Save/Load
// ============================================================
function saveGame() {
  try { ipcRenderer.send('save-game',data); } catch(e) {}
  document.title = `Claude-kun RPG | Lv.${data.level} | Stage ${data.stage} | ${data.score.toLocaleString()} pts`;
}
function loadGame() {
  try {
    const s = ipcRenderer.sendSync('load-game');
    if (s) {
      data = { ...gameData.DEFAULT_DATA, ...s };
      data.stats = { ...gameData.DEFAULT_DATA.stats, ...s.stats };
      data.weapons = { ...gameData.DEFAULT_DATA.weapons, ...s.weapons };
      data.achievements = s.achievements || [];
      console.log('Loaded save: Lv.' + data.level + ' Stage ' + data.stage);
    }
  } catch(e) { console.error('loadGame failed:', e); }
}

// ============================================================
// Init
// ============================================================
function init() {
  loadGame(); spawnStage();
  ipcRenderer.on('game-event',(_,event)=>handleGameEvent(event));
  ipcRenderer.on('game-data',(_,saved)=>{ if (saved) { data={...gameData.DEFAULT_DATA,...saved}; data.stats={...gameData.DEFAULT_DATA.stats,...saved.stats}; data.weapons={...gameData.DEFAULT_DATA.weapons,...saved.weapons}; data.achievements=saved.achievements||[]; spawnStage(); } });
  ipcRenderer.on('before-close',()=>saveGame());
  setInterval(saveGame,30000);
  requestAnimationFrame(gameLoop);
}
init();
