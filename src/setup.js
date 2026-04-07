#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const os = require("os");

// ── Paths ────────────────────────────────────────────────────

const CLAUDE_KUN_DIR = path.join(os.homedir(), ".claude-kun");
const CLAUDE_SETTINGS_DIR = path.join(os.homedir(), ".claude");
const CLAUDE_SETTINGS_FILE = path.join(CLAUDE_SETTINGS_DIR, "settings.json");
const RPG_DATA_FILE = path.join(CLAUDE_KUN_DIR, "rpg_data.json");
const HOOK_DEST = path.join(CLAUDE_KUN_DIR, "hook.js");
const HOOK_SRC = path.resolve(__dirname, "hook.js");

const isWin = process.platform === "win32";

// ── Default RPG Data ─────────────────────────────────────────

const DEFAULT_RPG_DATA = {
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
  stats: {
    totalDamage: 0,
    bossesKilled: 0,
    toolUses: {},
    critCount: 0,
    maxCombo: 0,
  },
  weapons: { normal: 1, homing: 1, bomb: 1, support: 1 },
  achievements: [],
  streakDays: 0,
  lastPlayDate: null,
  totalPlayTime: 0,
  sessionCount: 0,
  enemiesOnScreen: [],
  endlessMode: false,
  endlessBossCount: 0,
};

// ── Helpers ──────────────────────────────────────────────────

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`  [+] Created directory: ${dir}`);
  }
}

function log(msg) {
  console.log(`  ${msg}`);
}

// ── Step 1: Create ~/.claude-kun/ ────────────────────────────

function setupClaudeKunDir() {
  console.log("\n[1/4] Setting up ~/.claude-kun/ directory...");
  ensureDir(CLAUDE_KUN_DIR);
}

// ── Step 2: Copy hook.js ─────────────────────────────────────

function copyHook() {
  console.log("\n[2/4] Installing hook script...");

  if (!fs.existsSync(HOOK_SRC)) {
    console.error(`  [!] ERROR: hook.js not found at ${HOOK_SRC}`);
    console.error("      Please ensure the package is installed correctly.");
    process.exit(1);
  }

  fs.copyFileSync(HOOK_SRC, HOOK_DEST);
  log(`[+] Copied hook.js -> ${HOOK_DEST}`);
}

// ── Step 3: Configure Claude settings.json hooks ─────────────

function buildHookCommand(eventName) {
  // Claude Code uses bash even on Windows, so always use bash syntax
  return `CLAUDE_HOOK_EVENT=${eventName} node "$HOME/.claude-kun/hook.js"`;
}

function mergeHooks() {
  console.log("\n[3/4] Configuring Claude Code hooks...");

  ensureDir(CLAUDE_SETTINGS_DIR);

  // Load existing settings or create empty
  let settings = {};
  if (fs.existsSync(CLAUDE_SETTINGS_FILE)) {
    try {
      const raw = fs.readFileSync(CLAUDE_SETTINGS_FILE, "utf-8");
      settings = JSON.parse(raw);
      log("[i] Found existing settings.json");
    } catch (err) {
      console.error(`  [!] Failed to parse settings.json: ${err.message}`);
      console.error("      Creating backup and starting fresh.");
      const backup = CLAUDE_SETTINGS_FILE + ".bak." + Date.now();
      fs.copyFileSync(CLAUDE_SETTINGS_FILE, backup);
      log(`[i] Backup saved to ${backup}`);
      settings = {};
    }
  } else {
    log("[i] No existing settings.json found, creating new one");
  }

  // Ensure hooks object exists
  if (!settings.hooks) {
    settings.hooks = {};
  }

  const HOOK_IDENTIFIER = "claude-kun-rpg";

  // Define the hook entries we want
  const desiredHooks = {
    PostToolUse: [
      {
        matcher:
          "Write|Edit|MultiEdit|Bash|Read|Grep|Glob|WebFetch|Task|TodoWrite",
        hooks: [
          {
            type: "command",
            command: buildHookCommand("PostToolUse"),
          },
        ],
      },
    ],
    Stop: [
      {
        hooks: [
          {
            type: "command",
            command: buildHookCommand("Stop"),
          },
        ],
      },
    ],
    SessionStart: [
      {
        hooks: [
          {
            type: "command",
            command: buildHookCommand("SessionStart"),
          },
        ],
      },
    ],
  };

  // Merge each hook event, avoiding duplicates
  for (const [eventName, hookEntries] of Object.entries(desiredHooks)) {
    if (!settings.hooks[eventName]) {
      settings.hooks[eventName] = [];
    }

    const existing = settings.hooks[eventName];

    for (const newEntry of hookEntries) {
      // Check if a claude-kun hook already exists for this event
      const alreadyExists = existing.some((entry) => {
        const cmds = (entry.hooks || []).map((h) => h.command || "");
        return cmds.some((cmd) => cmd.includes("claude-kun") || cmd.includes("hook.js"));
      });

      if (alreadyExists) {
        log(`[~] ${eventName}: hook already registered, skipping`);
      } else {
        existing.push(newEntry);
        log(`[+] ${eventName}: hook registered`);
      }
    }
  }

  // Write back
  fs.writeFileSync(
    CLAUDE_SETTINGS_FILE,
    JSON.stringify(settings, null, 2),
    "utf-8"
  );
  log(`[+] Saved settings to ${CLAUDE_SETTINGS_FILE}`);
}

// ── Step 4: Create initial rpg_data.json ─────────────────────

function createInitialData(force = false) {
  console.log("\n[4/4] Initializing game data...");

  if (fs.existsSync(RPG_DATA_FILE) && !force) {
    log("[~] rpg_data.json already exists, keeping existing save");
    return;
  }

  ensureDir(CLAUDE_KUN_DIR);
  fs.writeFileSync(
    RPG_DATA_FILE,
    JSON.stringify(DEFAULT_RPG_DATA, null, 2),
    "utf-8"
  );
  log(`[+] Created rpg_data.json with default data`);
}

// ── Main ─────────────────────────────────────────────────────

function run(options = {}) {
  const { force = false, silent = false } = options;

  if (!silent) {
    console.log("========================================");
    console.log("  Claude-kun RPG  -  Setup");
    console.log("========================================");
    console.log(`  Platform: ${process.platform}`);
    console.log(`  Home:     ${os.homedir()}`);
  }

  setupClaudeKunDir();
  copyHook();
  mergeHooks();
  createInitialData(force);

  if (!silent) {
    console.log("\n========================================");
    console.log("  Setup complete!");
    console.log("========================================");
    console.log(`\n  Hook:      ${HOOK_DEST}`);
    console.log(`  Settings:  ${CLAUDE_SETTINGS_FILE}`);
    console.log(`  Game data: ${RPG_DATA_FILE}`);
    console.log(`\n  Run 'npx claude-kun-rpg' to launch the game.`);
    console.log("");
  }
}

// Export for use by cli.js
module.exports = { run };

// Direct execution
if (require.main === module) {
  run();
}
