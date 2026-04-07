// combat.js - Combat, damage calculation, and fever system module

// ── Tool Definitions ──────────────────────────────────────────────
const TOOLS = {
  Write:     { type: 'normal',  baseDMG: 15 },
  Edit:      { type: 'normal',  baseDMG: 12 },
  MultiEdit: { type: 'bomb',    baseDMG: 80 },
  Grep:      { type: 'homing',  baseDMG: 20 },
  Glob:      { type: 'homing',  baseDMG: 18 },
  Read:      { type: 'normal',  baseDMG:  8 },
  Bash:      { type: 'support', baseDMG: 10 },
  Task:      { type: 'support', baseDMG: 25 },
  WebFetch:  { type: 'homing',  baseDMG: 15 },
  TodoWrite: { type: 'normal',  baseDMG: 10 },
};

// ── Weight Multipliers ────────────────────────────────────────────
const WEIGHT_MULT = {
  light:       0.8,
  normal:      1.0,
  heavy:       1.5,
  super_heavy: 2.0,
  extreme:     3.0,
};

// ── Fever System (Infinite Scaling) ──────────────────────────────
// Fever level = floor(gauge / 30). No cap.
// DMG mult scales: 1.0 at Lv.0, then 2 + level * 1.5
// Auto DPS scales: 1 at Lv.0, then 3 + level * 3
// Crit chance scales: 5% base, +3% per level (cap 50%)
// Crit mult scales: 2.0 base, +0.5 per level
const FEVER_GAUGE_PER_LEVEL = 10;
const BOOST_DMG_MULT = 1.5;
const BOOST_AUTO_DPS = 2;

function getFeverLevel(gauge) {
  return Math.floor(gauge / FEVER_GAUGE_PER_LEVEL);
}

function getFeverDmgMult(level) {
  if (level <= 0) return 1.0;
  return 2.0 + level * 1.5;
}

function getFeverAutoDPS(level) {
  if (level <= 0) return 1;
  return 3 + level * 3;
}

function getFeverCrit(level) {
  return {
    chance: Math.min(0.50, 0.05 + level * 0.03),
    mult: 2.0 + level * 0.5,
  };
}

const DECAY_DELAY    = 90;   // 1.5 minutes before decay starts
const BOOST_DURATION = 5;    // seconds of boost per tool use
const DECAY_RATE     = 1;    // slow decay (1 unit/sec)

// ── Level Multiplier ──────────────────────────────────────────────
function getLevelMult(level) {
  return 1.0 + (level - 1) * 0.1;
}

// ── Weapon Bonus ──────────────────────────────────────────────────
function getWeaponBonus(toolName, weaponLevels) {
  const wl = (weaponLevels && weaponLevels[toolName]) || 0;
  return 1.0 + wl * 0.05;
}

// ── Public API ────────────────────────────────────────────────────

/**
 * Return the type string for a tool.
 * @param {string} toolName
 * @returns {'normal'|'homing'|'bomb'|'support'}
 */
function getToolType(toolName) {
  const tool = TOOLS[toolName];
  return tool ? tool.type : 'normal';
}

/**
 * Get the fever damage multiplier.
 * If the player is in boost state (but not yet at Fever Lv.1+), use boost mult.
 * @param {number} feverLevel  0-3
 * @param {boolean} isBoosted
 * @returns {number}
 */
function getFeverMult(feverLevel, isBoosted) {
  if (feverLevel >= 1) return getFeverDmgMult(feverLevel);
  return isBoosted ? BOOST_DMG_MULT : 1.0;
}

/**
 * Calculate damage for a single tool use.
 * @param {string}  toolName      Name of the tool (e.g. 'Write')
 * @param {number}  level         Player level (1+)
 * @param {Object}  weaponLevels  { [toolName]: number }
 * @param {number}  feverLevel    0-3
 * @param {string}  weight        'light'|'normal'|'heavy'|'super_heavy'|'extreme'
 * @returns {{ damage: number, isCrit: boolean, type: string }}
 */
function calculateDamage(toolName, level, weaponLevels, feverLevel, weight, prestige) {
  const tool = TOOLS[toolName];
  if (!tool) {
    return { damage: 0, isCrit: false, type: 'normal' };
  }

  const baseDMG     = tool.baseDMG;
  const levelMult   = getLevelMult(level);
  const weightMult  = WEIGHT_MULT[weight] || 1.0;
  const feverMult   = getFeverDmgMult(feverLevel);
  const weaponBonus = getWeaponBonus(toolName, weaponLevels);
  const prestigeMult = 1.0 + (prestige || 0) * 0.1; // +10% per prestige

  // Crit roll (scales with fever level)
  const crit   = getFeverCrit(feverLevel);
  const isCrit = Math.random() < crit.chance;
  const critMult = isCrit ? crit.mult : 1.0;

  const damage = Math.round(
    baseDMG * levelMult * weightMult * feverMult * critMult * weaponBonus * prestigeMult
  );

  return { damage, isCrit, type: tool.type };
}

/**
 * Get the current auto-DPS value (base per second, before per-weapon scaling).
 * @param {number} level
 * @param {Object} weaponLevels
 * @param {number} feverLevel 0-3
 * @returns {number}
 */
function getAutoDPS(level, weaponLevels, feverLevel) {
  const levelMult = getLevelMult(level);

  // Sum base DPS across all owned weapons
  let totalBase = 0;
  for (const name of Object.keys(weaponLevels || {})) {
    const tool = TOOLS[name];
    if (!tool) continue;
    const wl = weaponLevels[name];
    if (wl <= 0) continue;
    totalBase += tool.baseDMG * getWeaponBonus(name, weaponLevels);
  }

  const dpsMult = getFeverAutoDPS(feverLevel);

  return Math.round(totalBase * levelMult * dpsMult);
}

/**
 * Advance the fever state by deltaTime seconds, optionally registering a tool use.
 *
 * @param {{ gauge: number, level: number, boostTimer: number, decayTimer: number }} feverState
 * @param {number}  deltaTime  Seconds elapsed since last update
 * @param {boolean} toolUsed   Whether a tool was fired this frame
 * @returns {{ gauge: number, level: number, boostTimer: number, decayTimer: number }}
 */
function updateFever(feverState, deltaTime, toolUsed, weight) {
  let { gauge, level, boostTimer, decayTimer } = feverState;

  if (toolUsed) {
    // Gauge gain = number of lines changed (minimum 1)
    let lines = 1;
    if (weight && typeof weight === 'object' && weight.lines) {
      lines = weight.lines;
    } else if (typeof weight === 'number') {
      lines = weight;
    }
    gauge += Math.max(1, lines);
    boostTimer = BOOST_DURATION;
    decayTimer = DECAY_DELAY;
  } else {
    // Count down timers
    boostTimer = Math.max(0, boostTimer - deltaTime);
    decayTimer = Math.max(0, decayTimer - deltaTime);

    // If inactivity threshold exceeded, start decaying gauge
    if (decayTimer <= 0 && gauge > 0) {
      gauge = Math.max(0, gauge - DECAY_RATE * deltaTime);
    }
  }

  // Infinite scaling: level = floor(gauge / 30)
  level = getFeverLevel(gauge);

  return { gauge, level, boostTimer, decayTimer };
}

// ── Exports ───────────────────────────────────────────────────────
module.exports = {
  TOOLS,
  WEIGHT_MULT,
  FEVER_GAUGE_PER_LEVEL,
  getFeverLevel,
  getFeverDmgMult,
  getFeverAutoDPS,
  getFeverCrit,
  calculateDamage,
  getToolType,
  getFeverMult,
  getAutoDPS,
  updateFever,
};
