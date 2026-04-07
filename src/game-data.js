const fs = require('fs');
const path = require('path');
const os = require('os');

const DATA_DIR = path.join(os.homedir(), '.claude-kun');
const DATA_FILE = path.join(DATA_DIR, 'rpg_data.json');

const DEFAULT_DATA = {
  level: 1,
  xp: 0,
  xpToNext: 100,
  totalXp: 0,
  stage: 1,
  bossHp: 1500,
  bossMaxHp: 1500,
  bossName: "UncaughtException",
  score: 0,
  feverGauge: 0,
  feverLevel: 0,
  feverTimer: 0,
  stats: { totalDamage: 0, bossesKilled: 0, toolUses: {}, critCount: 0, maxCombo: 0 },
  weapons: { normal: 1, homing: 1, bomb: 1, support: 1 },
  achievements: [],
  streakDays: 0,
  lastPlayDate: null,
  totalPlayTime: 0,
  sessionCount: 0,
  enemiesOnScreen: [],
  endlessMode: false,
  endlessBossCount: 0,
  prestige: 0
};

// --- Stage Definitions ---

const STAGES = [
  // Stage 1-5: Hand-crafted
  {
    stage: 1,
    name: "Syntax Jungle",
    theme: "jungle",
    bossName: "UncaughtException",
    bossHp: 1500,
    enemies: [
      { type: "SyntaxError", hp: 30, count: 8 },
      { type: "Typo", hp: 15, count: 12 },
      { type: "MissingSemicolon", hp: 20, count: 10 }
    ]
  },
  {
    stage: 2,
    name: "Runtime Wasteland",
    theme: "wasteland",
    bossName: "SegmentationFault",
    bossHp: 5000,
    enemies: [
      { type: "NullPointer", hp: 60, count: 10 },
      { type: "StackOverflow", hp: 80, count: 6 },
      { type: "MemoryLeak", hp: 50, count: 8 }
    ]
  },
  {
    stage: 3,
    name: "Dependency Hell",
    theme: "hell",
    bossName: "node_modules",
    bossHp: 15000,
    enemies: [
      { type: "VersionConflict", hp: 120, count: 10 },
      { type: "CircularDep", hp: 150, count: 6 },
      { type: "DeprecatedPackage", hp: 90, count: 12 }
    ]
  },
  {
    stage: 4,
    name: "Production Nightmare",
    theme: "nightmare",
    bossName: "rm -rf /",
    bossHp: 50000,
    enemies: [
      { type: "500Error", hp: 250, count: 8 },
      { type: "DataCorruption", hp: 400, count: 5 },
      { type: "DDoS", hp: 200, count: 15 }
    ]
  },
  {
    stage: 5,
    name: "Legacy Dungeon",
    theme: "dungeon",
    bossName: "LegacyMonolith",
    bossHp: 200000,
    enemies: [
      { type: "SpaghettiCode", hp: 600, count: 10 },
      { type: "UndocumentedAPI", hp: 500, count: 8 },
      { type: "TechDebt", hp: 800, count: 6 }
    ]
  }
];

// Stages 6-20: generated with ~2.5x HP scaling
const generatedStages = [
  { name: "Async Abyss",          theme: "abyss",      bossName: "CallbackHell",        enemyTypes: ["UnhandledPromise", "RaceCondition", "Deadlock"] },
  { name: "Regex Labyrinth",      theme: "labyrinth",  bossName: "CatastrophicBacktrack", enemyTypes: ["LookaheadTrap", "GreedyQuantifier", "EscapeChar"] },
  { name: "Docker Depths",        theme: "depths",     bossName: "ImageBloat",          enemyTypes: ["DanglingVolume", "PortConflict", "LayerCache"] },
  { name: "CI/CD Warzone",        theme: "warzone",    bossName: "PipelineOfDoom",      enemyTypes: ["FlakyTest", "BuildTimeout", "SecretLeak"] },
  { name: "Cloud Citadel",        theme: "citadel",    bossName: "BillShock",           enemyTypes: ["ZombieInstance", "IAMTangle", "RegionOutage"] },
  { name: "Merge Conflict Arena", theme: "arena",      bossName: "GitRebaseGone",       enemyTypes: ["ConflictMarker", "DetachedHead", "ForcePush"] },
  { name: "TypeSystem Void",      theme: "void",       bossName: "AnyType",             enemyTypes: ["GenericHell", "InferenceLoop", "NeverType"] },
  { name: "Microservice Maze",    theme: "maze",       bossName: "DistributedMonolith", enemyTypes: ["ServiceMesh", "EventStorm", "SagaFailure"] },
  { name: "Security Fortress",    theme: "fortress",   bossName: "ZeroDay",             enemyTypes: ["SQLInjection", "XSSWorm", "BufferOverflow"] },
  { name: "Kernel Panic Plains",  theme: "plains",     bossName: "KernelPanic",         enemyTypes: ["DriverCrash", "IRQConflict", "OOM_Killer"] },
  { name: "Quantum Bug Realm",    theme: "quantum",    bossName: "Heisenbug",           enemyTypes: ["Schrodinbug", "Mandelbug", "Bohrbug"] },
  { name: "AI Singularity",       theme: "singularity",bossName: "HallucinationEngine", enemyTypes: ["OverfitGhost", "GradientVanish", "DataPoison"] },
  { name: "Blockchain Bog",       theme: "bog",        bossName: "51%Attack",           enemyTypes: ["GasWar", "ReentrancyBug", "RugPull"] },
  { name: "Compiler Inferno",     theme: "inferno",    bossName: "UndefinedBehavior",   enemyTypes: ["LinkerError", "TemplateMeta", "SegFault"] },
  { name: "Final Deploy",         theme: "final",      bossName: "EndOfStack",          enemyTypes: ["CascadeFailure", "CorruptedState", "TotalEntropy"] }
];

let bossHp = 200000;
generatedStages.forEach((def, i) => {
  bossHp = Math.floor(bossHp * 2.5);
  const stageNum = i + 6;
  const enemyBaseHp = Math.floor(bossHp * 0.004);
  STAGES.push({
    stage: stageNum,
    name: def.name,
    theme: def.theme,
    bossName: def.bossName,
    bossHp: bossHp,
    enemies: def.enemyTypes.map((type, j) => ({
      type,
      hp: Math.floor(enemyBaseHp * (1 + j * 0.3)),
      count: Math.max(4, 12 - Math.floor(i / 3))
    }))
  });
});

// --- Phase Calculation ---

function getPhase(level) {
  if (level <= 15) return "Awakening";
  if (level <= 35) return "Growth";
  if (level <= 55) return "Ascension";
  if (level <= 80) return "Transcendence";
  return "Godhood";
}

// --- Level Multiplier ---

function getLevelMult(level) {
  return 1.0 + (level - 1) * 0.08;
}

// --- XP Curve ---

function xpToNext(level) {
  return Math.floor(100 * Math.pow(1.15, level - 1));
}

// --- File Operations ---

function load() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const saved = JSON.parse(raw);
      // Merge with defaults to fill any missing fields
      return { ...structuredClone(DEFAULT_DATA), ...saved, stats: { ...DEFAULT_DATA.stats, ...(saved.stats || {}) } };
    }
  } catch (err) {
    console.error('[game-data] Failed to load save data, using defaults:', err.message);
  }
  return structuredClone(DEFAULT_DATA);
}

function save(data) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('[game-data] Failed to save data:', err.message);
  }
}

function reset() {
  const data = structuredClone(DEFAULT_DATA);
  save(data);
  return data;
}

// --- Exports ---

module.exports = {
  load,
  save,
  reset,
  getPhase,
  getLevelMult,
  xpToNext,
  STAGES,
  DEFAULT_DATA,
  DATA_FILE
};
