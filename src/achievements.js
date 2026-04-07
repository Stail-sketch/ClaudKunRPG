// =============================================================
//  achievements.js - Achievement System (202 achievements, 12 categories)
// =============================================================

const ACHIEVEMENTS = [];

// ─── Helper: push with auto-index validation ─────────────────
function add(a) { ACHIEVEMENTS.push(a); }

// =============================================================
//  1. Progression (25) - Level milestones + Stage clears
// =============================================================

// Level milestones every 5 levels: 5,10,15,...,100 → 20 achievements
const LEVEL_NAMES = {
  5: 'First Steps', 10: 'Getting Serious', 15: 'Apprentice Coder',
  20: 'Junior Dev', 25: 'Quarter Century', 30: 'Seasoned Hand',
  35: 'Mid-Career', 40: 'Senior Dev', 45: 'Lead Engineer',
  50: 'Half Way There', 55: 'Veteran', 60: 'Staff Engineer',
  65: 'Distinguished', 70: 'Principal', 75: 'Three Quarters',
  80: 'Architect', 85: 'Fellow', 90: 'Legend', 95: 'Almost There',
  100: 'Centurion'
};

for (let lv = 5; lv <= 100; lv += 5) {
  add({
    id: `prog_lv${lv}`,
    name: LEVEL_NAMES[lv],
    desc: `Reach Level ${lv}`,
    category: 'Progression',
    check: ((threshold) => (d) => d.level >= threshold)(lv),
    reward: { type: 'xp', value: lv * 10 }
  });
}

// Stage clears: stages 1-5 hand-named
const STAGE_NAMES = {
  1: 'Jungle Explorer', 2: 'Desert Survivor', 3: 'Ocean Diver',
  4: 'Sky Walker', 5: 'Volcano Conqueror'
};
for (let s = 1; s <= 5; s++) {
  add({
    id: `prog_stage${s}`,
    name: STAGE_NAMES[s],
    desc: `Clear Stage ${s}`,
    category: 'Progression',
    check: ((threshold) => (d) => d.stage > threshold)(s),
    reward: { type: 'xp', value: s * 100 }
  });
}

// =============================================================
//  2. Combat (20) - Boss kills, total damage, speed kills, crits, combos
// =============================================================

// Boss kill milestones: 1, 5, 10, 25, 50, 100, 250, 500
const BOSS_MILESTONES = [
  { n: 1, name: 'Bug Squasher' }, { n: 5, name: 'Exterminator' },
  { n: 10, name: 'Bug Hunter', }, { n: 25, name: 'Debugger' },
  { n: 50, name: 'Exception Handler' }, { n: 100, name: 'Bug Slayer' },
  { n: 250, name: 'Pest Control' }, { n: 500, name: 'Annihilator' }
];
for (const m of BOSS_MILESTONES) {
  add({
    id: `combat_boss${m.n}`,
    name: m.name,
    desc: `Defeat ${m.n} boss${m.n > 1 ? 'es' : ''}`,
    category: 'Combat',
    check: ((threshold) => (d) => d.stats.bossesKilled >= threshold)(m.n),
    reward: { type: 'dmg_boost', value: 0.02 + m.n * 0.001 }
  });
}

// Total damage milestones: 10K, 50K, 100K, 500K, 1M, 5M, 10M, 50M
const DMG_MILESTONES = [
  { n: 10000, name: 'Chip Damage' }, { n: 50000, name: 'Scratch That' },
  { n: 100000, name: 'Heavy Hitter' }, { n: 500000, name: 'Wrecking Ball' },
  { n: 1000000, name: 'Megaton Punch' }, { n: 5000000, name: 'Gigaton Force' },
  { n: 10000000, name: 'Tera Strike' }, { n: 50000000, name: 'Peta Blast' }
];
for (const m of DMG_MILESTONES) {
  const label = m.n >= 1000000 ? `${m.n / 1000000}M` : `${m.n / 1000}K`;
  add({
    id: `combat_dmg${m.n}`,
    name: m.name,
    desc: `Deal ${label} total damage`,
    category: 'Combat',
    check: ((threshold) => (d) => d.stats.totalDamage >= threshold)(m.n),
    reward: { type: 'dmg_boost', value: 0.03 }
  });
}

// Crit milestones: 50, 200, 1000, 5000
const CRIT_MILESTONES = [
  { n: 50, name: 'Lucky Shot' }, { n: 200, name: 'Sharpshooter' },
  { n: 1000, name: 'Critical Mass' }, { n: 5000, name: 'Crit Machine' }
];
for (const m of CRIT_MILESTONES) {
  add({
    id: `combat_crit${m.n}`,
    name: m.name,
    desc: `Land ${m.n} critical hits`,
    category: 'Combat',
    check: ((threshold) => (d) => d.stats.critCount >= threshold)(m.n),
    reward: { type: 'crit_rate', value: 0.01 }
  });
}

// =============================================================
//  3. Coding (30) - Tool use counts for 10 tools × 3 tiers
// =============================================================

const TOOLS = ['Write', 'Edit', 'Grep', 'Glob', 'Bash', 'Read', 'MultiEdit', 'WebFetch', 'Task', 'TodoWrite'];
const TOOL_TIERS = [
  { n: 100, suffix: 'Novice', tier: 1 },
  { n: 500, suffix: 'Adept', tier: 2 },
  { n: 1000, suffix: 'Master', tier: 3 }
];

for (const tool of TOOLS) {
  for (const tier of TOOL_TIERS) {
    add({
      id: `coding_${tool.toLowerCase()}_${tier.n}`,
      name: `${tool} ${tier.suffix}`,
      desc: `Use ${tool} ${tier.n} times`,
      category: 'Coding',
      check: ((t, threshold) => (d) => (d.stats.toolUses[t] || 0) >= threshold)(tool, tier.n),
      reward: { type: 'xp', value: tier.n }
    });
  }
}

// =============================================================
//  4. Fever (15) - Fever activation, duration, level
// =============================================================

// Fever activation count: 1, 5, 10, 25, 50, 100, 250
const FEVER_ACT_MILESTONES = [
  { n: 1, name: 'First Rush' }, { n: 5, name: 'Adrenaline Junkie' },
  { n: 10, name: 'Fever Fanatic' }, { n: 25, name: 'Burning Up' },
  { n: 50, name: 'Inferno' }, { n: 100, name: 'Supernova' },
  { n: 250, name: 'Eternal Flame' }
];
for (const m of FEVER_ACT_MILESTONES) {
  add({
    id: `fever_act${m.n}`,
    name: m.name,
    desc: `Activate Fever ${m.n} time${m.n > 1 ? 's' : ''}`,
    category: 'Fever',
    check: ((threshold) => (d) => (d.stats.feverActivations || 0) >= threshold)(m.n),
    reward: { type: 'fever_rate', value: 0.02 }
  });
}

// Fever total duration: 60s, 300s, 600s, 1800s
const FEVER_DUR_MILESTONES = [
  { n: 60, name: 'Brief Burst', label: '1 minute' },
  { n: 300, name: 'Extended Burn', label: '5 minutes' },
  { n: 600, name: 'Long Fuse', label: '10 minutes' },
  { n: 1800, name: 'Marathon Blaze', label: '30 minutes' }
];
for (const m of FEVER_DUR_MILESTONES) {
  add({
    id: `fever_dur${m.n}`,
    name: m.name,
    desc: `Spend ${m.label} total in Fever mode`,
    category: 'Fever',
    check: ((threshold) => (d) => (d.stats.feverTotalDuration || 0) >= threshold)(m.n),
    reward: { type: 'fever_duration', value: 1 }
  });
}

// Fever level reached: 1, 2, 3, 4
const FEVER_LV_NAMES = ['Spark', 'Blaze', 'Firestorm', 'Supercritical'];
for (let lv = 1; lv <= 4; lv++) {
  add({
    id: `fever_lv${lv}`,
    name: FEVER_LV_NAMES[lv - 1],
    desc: `Reach Fever Level ${lv}`,
    category: 'Fever',
    check: ((threshold) => (d) => (d.stats.maxFeverLevel || 0) >= threshold)(lv),
    reward: { type: 'fever_rate', value: 0.05 }
  });
}

// =============================================================
//  5. Streak (15) - Consecutive days
// =============================================================

const STREAK_MILESTONES = [
  { n: 3, name: 'Three-Peat' }, { n: 7, name: 'Week Warrior' },
  { n: 14, name: 'Fortnight Fighter' }, { n: 30, name: 'Monthly Devotion' },
  { n: 60, name: 'Bimonthly Blitz' }, { n: 90, name: 'Quarter Committed' },
  { n: 120, name: 'Steadfast' }, { n: 150, name: 'Unwavering' },
  { n: 180, name: 'Half-Year Hero' }, { n: 210, name: 'Seasonal Stalwart' },
  { n: 240, name: 'Eight-Month Marvel' }, { n: 270, name: 'Nine-Month Ninja' },
  { n: 300, name: 'Persistence Pays' }, { n: 330, name: 'Almost Annual' },
  { n: 365, name: 'Year-Long Legend' }
];
for (const m of STREAK_MILESTONES) {
  add({
    id: `streak_${m.n}`,
    name: m.name,
    desc: `Maintain a ${m.n}-day streak`,
    category: 'Streak',
    check: ((threshold) => (d) => d.streakDays >= threshold)(m.n),
    reward: { type: 'xp_mult', value: 1 + m.n * 0.001 }
  });
}

// =============================================================
//  6. Time (12) - Time of day, total play time
// =============================================================

// Time of day achievements (4)
add({ id: 'time_early', name: 'Early Bird', desc: 'Play between 5:00-7:00 AM', category: 'Time',
  check: (d) => { const h = d.currentHour; return h >= 5 && h < 7; }, reward: { type: 'xp', value: 100 } });
add({ id: 'time_lunch', name: 'Lunch Break Coder', desc: 'Play between 12:00-13:00', category: 'Time',
  check: (d) => d.currentHour === 12, reward: { type: 'xp', value: 50 } });
add({ id: 'time_midnight', name: 'Night Owl', desc: 'Play between 0:00-3:00 AM', category: 'Time',
  check: (d) => { const h = d.currentHour; return h >= 0 && h < 3; }, reward: { type: 'xp', value: 100 } });
add({ id: 'time_golden', name: 'Golden Hour', desc: 'Play between 17:00-18:00', category: 'Time',
  check: (d) => d.currentHour === 17, reward: { type: 'xp', value: 75 } });

// Total play time: 1h, 5h, 10h, 24h, 48h, 100h, 250h, 500h (in seconds)
const PLAYTIME_MILESTONES = [
  { h: 1, name: 'Getting Started' }, { h: 5, name: 'Settling In' },
  { h: 10, name: 'Double Digits' }, { h: 24, name: 'Full Day' },
  { h: 48, name: 'Weekend Warrior' }, { h: 100, name: 'Century Hour' },
  { h: 250, name: 'Devoted Developer' }, { h: 500, name: 'Lifetime Coder' }
];
for (const m of PLAYTIME_MILESTONES) {
  add({
    id: `time_play${m.h}h`,
    name: m.name,
    desc: `Play for ${m.h} hour${m.h > 1 ? 's' : ''} total`,
    category: 'Time',
    check: ((threshold) => (d) => d.totalPlayTime >= threshold)(m.h * 3600),
    reward: { type: 'xp', value: m.h * 20 }
  });
}

// =============================================================
//  7. Collection (20) - Skins and titles collected
// =============================================================

// Skins collected: 1, 3, 5, 8, 10, 15, 20, 25, 30, 50
const SKIN_MILESTONES = [
  { n: 1, name: 'Fashion Starter' }, { n: 3, name: 'Wardrobe Basics' },
  { n: 5, name: 'Style Conscious' }, { n: 8, name: 'Trendsetter' },
  { n: 10, name: 'Fashion Forward' }, { n: 15, name: 'Collector' },
  { n: 20, name: 'Fashionista' }, { n: 25, name: 'Runway Ready' },
  { n: 30, name: 'Haute Couture' }, { n: 50, name: 'Fashion Icon' }
];
for (const m of SKIN_MILESTONES) {
  add({
    id: `collect_skin${m.n}`,
    name: m.name,
    desc: `Collect ${m.n} skin${m.n > 1 ? 's' : ''}`,
    category: 'Collection',
    check: ((threshold) => (d) => (d.skinsCollected || []).length >= threshold)(m.n),
    reward: { type: 'xp', value: m.n * 30 }
  });
}

// Titles collected: 1, 3, 5, 8, 10, 15, 20, 25, 30, 50
const TITLE_MILESTONES = [
  { n: 1, name: 'Named One' }, { n: 3, name: 'Title Holder' },
  { n: 5, name: 'Distinguished' }, { n: 8, name: 'Renowned' },
  { n: 10, name: 'Famous' }, { n: 15, name: 'Legendary' },
  { n: 20, name: 'Mythical' }, { n: 25, name: 'Transcendent' },
  { n: 30, name: 'Cosmic' }, { n: 50, name: 'Omnititular' }
];
for (const m of TITLE_MILESTONES) {
  add({
    id: `collect_title${m.n}`,
    name: m.name,
    desc: `Earn ${m.n} title${m.n > 1 ? 's' : ''}`,
    category: 'Collection',
    check: ((threshold) => (d) => (d.titlesEarned || []).length >= threshold)(m.n),
    reward: { type: 'xp', value: m.n * 25 }
  });
}

// =============================================================
//  8. Evolution (15) - Evolution/upgrade milestones
// =============================================================

// Weapon upgrades per weapon type (4 types × 3 tiers = 12)
const WEAPON_TYPES = [
  { key: 'normal', label: 'Normal Shot' },
  { key: 'homing', label: 'Homing Shot' },
  { key: 'bomb', label: 'Bomb' },
  { key: 'support', label: 'Support' }
];
const WEAPON_UPGRADE_TIERS = [
  { lv: 3, suffix: 'Upgrade' }, { lv: 5, suffix: 'Mastery' }, { lv: 7, suffix: 'Perfection' }
];
for (const wt of WEAPON_TYPES) {
  for (const tier of WEAPON_UPGRADE_TIERS) {
    add({
      id: `evo_${wt.key}_lv${tier.lv}`,
      name: `${wt.label} ${tier.suffix}`,
      desc: `Upgrade ${wt.label} to level ${tier.lv}`,
      category: 'Evolution',
      check: ((key, threshold) => (d) => (d.weapons[key] || 1) >= threshold)(wt.key, tier.lv),
      reward: { type: 'dmg_boost', value: 0.03 }
    });
  }
}

// Total weapon level sum milestones: 10, 20, 28 (max)
const TOTAL_WPN_MILESTONES = [
  { n: 10, name: 'Arsenal Builder' },
  { n: 20, name: 'Weapons Expert' },
  { n: 28, name: 'Fully Loaded' }
];
for (const m of TOTAL_WPN_MILESTONES) {
  add({
    id: `evo_total${m.n}`,
    name: m.name,
    desc: `Total weapon levels reach ${m.n}`,
    category: 'Evolution',
    check: ((threshold) => (d) => {
      const w = d.weapons || {};
      const sum = (w.normal || 1) + (w.homing || 1) + (w.bomb || 1) + (w.support || 1);
      return sum >= threshold;
    })(m.n),
    reward: { type: 'dmg_boost', value: 0.05 }
  });
}

// =============================================================
//  9. Challenge (15) - Special conditions
// =============================================================

add({ id: 'chal_nodmg_boss', name: 'Untouchable', desc: 'Defeat a boss without taking damage',
  category: 'Challenge', check: (d) => d.stats.perfectBossKills >= 1, reward: { type: 'xp', value: 500 } });
add({ id: 'chal_nodmg5', name: 'Ghost', desc: 'Defeat 5 bosses without taking damage',
  category: 'Challenge', check: (d) => d.stats.perfectBossKills >= 5, reward: { type: 'xp', value: 1000 } });
add({ id: 'chal_speed1', name: 'Speed Run', desc: 'Kill a boss in under 10 seconds',
  category: 'Challenge', check: (d) => d.stats.speedKills >= 1, reward: { type: 'dmg_boost', value: 0.05 } });
add({ id: 'chal_speed10', name: 'Lightning Fast', desc: 'Speed-kill 10 bosses',
  category: 'Challenge', check: (d) => d.stats.speedKills >= 10, reward: { type: 'dmg_boost', value: 0.1 } });
add({ id: 'chal_combo50', name: 'Combo Starter', desc: 'Reach a 50 combo',
  category: 'Challenge', check: (d) => d.stats.maxCombo >= 50, reward: { type: 'xp', value: 200 } });
add({ id: 'chal_combo100', name: 'Combo King', desc: 'Reach a 100 combo',
  category: 'Challenge', check: (d) => d.stats.maxCombo >= 100, reward: { type: 'xp', value: 500 } });
add({ id: 'chal_combo200', name: 'Combo God', desc: 'Reach a 200 combo',
  category: 'Challenge', check: (d) => d.stats.maxCombo >= 200, reward: { type: 'xp', value: 1000 } });
add({ id: 'chal_endless5', name: 'Endurance I', desc: 'Defeat 5 bosses in Endless Mode',
  category: 'Challenge', check: (d) => (d.stats.endlessBossesKilled || 0) >= 5, reward: { type: 'xp', value: 300 } });
add({ id: 'chal_endless10', name: 'Endurance II', desc: 'Defeat 10 bosses in Endless Mode',
  category: 'Challenge', check: (d) => (d.stats.endlessBossesKilled || 0) >= 10, reward: { type: 'xp', value: 600 } });
add({ id: 'chal_endless25', name: 'Endurance III', desc: 'Defeat 25 bosses in Endless Mode',
  category: 'Challenge', check: (d) => (d.stats.endlessBossesKilled || 0) >= 25, reward: { type: 'xp', value: 1200 } });
add({ id: 'chal_score10k', name: 'High Scorer', desc: 'Reach 10,000 score',
  category: 'Challenge', check: (d) => d.score >= 10000, reward: { type: 'xp', value: 200 } });
add({ id: 'chal_score50k', name: 'Score Chaser', desc: 'Reach 50,000 score',
  category: 'Challenge', check: (d) => d.score >= 50000, reward: { type: 'xp', value: 500 } });
add({ id: 'chal_score100k', name: 'Score Legend', desc: 'Reach 100,000 score',
  category: 'Challenge', check: (d) => d.score >= 100000, reward: { type: 'xp', value: 1000 } });
add({ id: 'chal_alltools', name: 'Full Stack', desc: 'Use all 10 tool types at least once',
  category: 'Challenge', check: (d) => {
    const uses = d.stats.toolUses || {};
    return ['Write','Edit','Grep','Glob','Bash','Read','MultiEdit','WebFetch','Task','TodoWrite']
      .every(t => (uses[t] || 0) >= 1);
  }, reward: { type: 'xp', value: 500 } });
add({ id: 'chal_fever_boss', name: 'Fever Finisher', desc: 'Defeat a boss during Fever mode',
  category: 'Challenge', check: (d) => (d.stats.feverBossKills || 0) >= 1, reward: { type: 'xp', value: 300 } });

// =============================================================
//  10. Seasonal (10) - Holiday play
// =============================================================

const SEASONAL = [
  { id: 'season_newyear', name: 'New Year Coder', desc: "Play on New Year's Day (Jan 1)", month: 1, day: 1 },
  { id: 'season_valentine', name: 'Code of Love', desc: "Play on Valentine's Day (Feb 14)", month: 2, day: 14 },
  { id: 'season_pi', name: 'Pi Day', desc: 'Play on Pi Day (Mar 14)', month: 3, day: 14 },
  { id: 'season_april1', name: 'No Joke', desc: "Play on April Fools' Day (Apr 1)", month: 4, day: 1 },
  { id: 'season_star_wars', name: 'May the Fourth', desc: 'Play on Star Wars Day (May 4)', month: 5, day: 4 },
  { id: 'season_summer', name: 'Summer Hacker', desc: 'Play on Summer Solstice (Jun 21)', month: 6, day: 21 },
  { id: 'season_halloween', name: 'Spooky Code', desc: 'Play on Halloween (Oct 31)', month: 10, day: 31 },
  { id: 'season_christmas', name: 'Christmas Commit', desc: 'Play on Christmas (Dec 25)', month: 12, day: 25 },
  { id: 'season_progday', name: 'Programmer Day', desc: 'Play on Programmer Day (Sep 13)', month: 9, day: 13 },
  { id: 'season_nye', name: 'Year-End Sprint', desc: "Play on New Year's Eve (Dec 31)", month: 12, day: 31 }
];
for (const s of SEASONAL) {
  add({
    id: s.id,
    name: s.name,
    desc: s.desc,
    category: 'Seasonal',
    check: ((m, day) => (d) => {
      const now = d.currentDate ? new Date(d.currentDate) : new Date();
      return (now.getMonth() + 1) === m && now.getDate() === day;
    })(s.month, s.day),
    reward: { type: 'xp', value: 200 }
  });
}

// =============================================================
//  11. Milestone (10) - Long-term milestones
// =============================================================

// Session count milestones
const SESSION_MILESTONES = [
  { n: 10, name: 'Regular User' }, { n: 50, name: 'Committed' },
  { n: 100, name: 'Centenarian Sessions' }, { n: 250, name: 'Quarter Thousand' },
  { n: 500, name: 'Half Millennium' }, { n: 1000, name: 'Thousand Sessions' }
];
for (const m of SESSION_MILESTONES) {
  add({
    id: `mile_session${m.n}`,
    name: m.name,
    desc: `Start ${m.n} coding sessions`,
    category: 'Milestone',
    check: ((threshold) => (d) => d.sessionCount >= threshold)(m.n),
    reward: { type: 'xp', value: m.n * 5 }
  });
}

// Total XP milestones
const XP_MILESTONES = [
  { n: 1000, name: 'XP Saver', label: '1K' },
  { n: 10000, name: 'XP Hoarder', label: '10K' },
  { n: 100000, name: 'XP Millionaire', label: '100K' },
  { n: 1000000, name: 'XP Tycoon', label: '1M' }
];
for (const m of XP_MILESTONES) {
  add({
    id: `mile_xp${m.n}`,
    name: m.name,
    desc: `Earn ${m.label} total XP`,
    category: 'Milestone',
    check: ((threshold) => (d) => d.totalXp >= threshold)(m.n),
    reward: { type: 'xp', value: Math.floor(m.n * 0.1) }
  });
}

// =============================================================
//  12. Hidden (15) - Secret conditions
// =============================================================

add({ id: 'hidden_first_death', name: '???', desc: '???', category: 'Hidden', hidden: true,
  realDesc: 'Die for the first time',
  check: (d) => (d.stats.deaths || 0) >= 1, reward: { type: 'xp', value: 50 } });
add({ id: 'hidden_lv1_boss', name: '???', desc: '???', category: 'Hidden', hidden: true,
  realDesc: 'Defeat a boss at Level 1',
  check: (d) => d.stats.lv1BossKill === true, reward: { type: 'xp', value: 1000 } });
add({ id: 'hidden_all_cat', name: '???', desc: '???', category: 'Hidden', hidden: true,
  realDesc: 'Unlock at least one achievement in every category',
  check: (d) => {
    const cats = new Set(ACHIEVEMENTS.filter(a => !a.hidden).map(a => a.category));
    const unlocked = new Set((d.achievements || []).map(id => {
      const a = ACHIEVEMENTS.find(x => x.id === id);
      return a ? a.category : null;
    }).filter(Boolean));
    for (const c of cats) { if (!unlocked.has(c)) return false; }
    return true;
  }, reward: { type: 'xp', value: 2000 } });
add({ id: 'hidden_99combo', name: '???', desc: '???', category: 'Hidden', hidden: true,
  realDesc: 'Reach exactly 99 combo',
  check: (d) => d.stats.maxCombo === 99 || d.stats.hit99combo === true, reward: { type: 'xp', value: 300 } });
add({ id: 'hidden_0dmg_stage', name: '???', desc: '???', category: 'Hidden', hidden: true,
  realDesc: 'Complete a stage without dealing any damage (let support handle it)',
  check: (d) => d.stats.pacifistStage === true, reward: { type: 'xp', value: 500 } });
add({ id: 'hidden_1hp', name: '???', desc: '???', category: 'Hidden', hidden: true,
  realDesc: 'Survive with 1 HP remaining',
  check: (d) => d.stats.survived1hp === true, reward: { type: 'xp', value: 300 } });
add({ id: 'hidden_triple_fever', name: '???', desc: '???', category: 'Hidden', hidden: true,
  realDesc: 'Activate Fever 3 times in a single session',
  check: (d) => (d.stats.sessionFeverCount || 0) >= 3, reward: { type: 'fever_rate', value: 0.1 } });
add({ id: 'hidden_5min_boss', name: '???', desc: '???', category: 'Hidden', hidden: true,
  realDesc: 'Spend over 5 minutes fighting a single boss',
  check: (d) => d.stats.longestBossFight >= 300, reward: { type: 'xp', value: 200 } });
add({ id: 'hidden_10tools_1min', name: '???', desc: '???', category: 'Hidden', hidden: true,
  realDesc: 'Use all 10 tool types within 1 minute',
  check: (d) => d.stats.allToolsInMinute === true, reward: { type: 'xp', value: 1000 } });
add({ id: 'hidden_palindrome_score', name: '???', desc: '???', category: 'Hidden', hidden: true,
  realDesc: 'Have a palindrome score over 1000',
  check: (d) => {
    const s = String(d.score);
    return d.score > 1000 && s === s.split('').reverse().join('');
  }, reward: { type: 'xp', value: 500 } });
add({ id: 'hidden_back2back', name: '???', desc: '???', category: 'Hidden', hidden: true,
  realDesc: 'Kill two bosses within 5 seconds of each other',
  check: (d) => d.stats.backToBackBossKill === true, reward: { type: 'xp', value: 500 } });
add({ id: 'hidden_overkill', name: '???', desc: '???', category: 'Hidden', hidden: true,
  realDesc: 'Deal 10x the boss HP in a single hit',
  check: (d) => d.stats.overkill10x === true, reward: { type: 'dmg_boost', value: 0.1 } });
add({ id: 'hidden_respawn_king', name: '???', desc: '???', category: 'Hidden', hidden: true,
  realDesc: 'Die and respawn 50 times',
  check: (d) => (d.stats.deaths || 0) >= 50, reward: { type: 'xp', value: 300 } });
add({ id: 'hidden_idle_master', name: '???', desc: '???', category: 'Hidden', hidden: true,
  realDesc: 'Leave the game idle for 10 minutes and return',
  check: (d) => d.stats.idleReturn === true, reward: { type: 'xp', value: 100 } });
add({ id: 'hidden_completionist', name: '???', desc: '???', category: 'Hidden', hidden: true,
  realDesc: 'Unlock all non-hidden achievements',
  check: (d) => {
    const nonHidden = ACHIEVEMENTS.filter(a => !a.hidden);
    const unlocked = new Set(d.achievements || []);
    return nonHidden.every(a => unlocked.has(a.id));
  }, reward: { type: 'xp', value: 10000 } });

// =============================================================
//  Validation
// =============================================================

if (ACHIEVEMENTS.length !== 202) {
  console.warn(`[achievements] Expected 202 achievements, got ${ACHIEVEMENTS.length}`);
}

// Build lookup map for fast access
const ACHIEVEMENT_MAP = {};
for (const a of ACHIEVEMENTS) {
  ACHIEVEMENT_MAP[a.id] = a;
}

// =============================================================
//  API Functions
// =============================================================

/**
 * Check all achievements against current game data.
 * Returns an array of newly unlocked achievement IDs.
 */
function checkAchievements(gameData) {
  const unlocked = new Set(gameData.achievements || []);
  const newlyUnlocked = [];

  for (const achievement of ACHIEVEMENTS) {
    if (unlocked.has(achievement.id)) continue;
    try {
      if (achievement.check(gameData)) {
        newlyUnlocked.push(achievement.id);
      }
    } catch (_e) {
      // Silently skip achievements that can't be checked due to missing data
    }
  }

  return newlyUnlocked;
}

/**
 * Get a single achievement by ID.
 */
function getAchievement(id) {
  return ACHIEVEMENT_MAP[id] || null;
}

/**
 * Get progress summary for the achievement system.
 */
function getProgress(gameData) {
  const unlocked = new Set(gameData.achievements || []);
  const byCategory = {};

  for (const a of ACHIEVEMENTS) {
    if (!byCategory[a.category]) {
      byCategory[a.category] = { total: 0, unlocked: 0 };
    }
    byCategory[a.category].total++;
    if (unlocked.has(a.id)) {
      byCategory[a.category].unlocked++;
    }
  }

  return {
    total: ACHIEVEMENTS.length,
    unlocked: unlocked.size,
    percentage: Math.round((unlocked.size / ACHIEVEMENTS.length) * 1000) / 10,
    byCategory
  };
}

// =============================================================
//  Exports
// =============================================================

module.exports = { ACHIEVEMENTS, checkAchievements, getAchievement, getProgress };
