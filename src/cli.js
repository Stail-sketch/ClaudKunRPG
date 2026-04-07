#!/usr/bin/env node

const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");

// ── ASCII Art Banner ─────────────────────────────────────────

function makeBanner() {
  const c = '\x1b[36;1m';
  const y = '\x1b[33;1m';
  const m = '\x1b[35;1m';
  const d = '\x1b[2m';
  const r = '\x1b[0m';
  const bannerText = fs.readFileSync(path.join(__dirname, 'banner.txt'), 'utf-8');
  const lines = bannerText.split('\n');
  // Color: first 5 lines cyan, "KUN" part yellow, RPG box magenta, subtitle dim
  return lines.map((line, i) => {
    if (i <= 5) return c + line + r;
    if (i >= 7 && i <= 9) return m + line + r;
    if (i >= 10) return d + line + r;
    return line;
  }).join('\n');
}
const BANNER = makeBanner();

// ── Paths ────────────────────────────────────────────────────

const CLAUDE_KUN_DIR = path.join(os.homedir(), ".claude-kun");
const RPG_DATA_FILE = path.join(CLAUDE_KUN_DIR, "rpg_data.json");
const HOOK_FILE = path.join(CLAUDE_KUN_DIR, "hook.js");
const PROJECT_ROOT = path.resolve(__dirname, "..");

// ── Helpers ──────────────────────────────────────────────────

function isSetupDone() {
  return (
    fs.existsSync(CLAUDE_KUN_DIR) &&
    fs.existsSync(HOOK_FILE) &&
    fs.existsSync(RPG_DATA_FILE)
  );
}

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    setup: args.includes("--setup"),
    reset: args.includes("--reset"),
    help: args.includes("--help") || args.includes("-h"),
  };
}

function printHelp() {
  console.log(`
Usage: claude-kun-rpg [options]

Options:
  --setup    Force re-run setup (re-install hooks, re-copy files)
  --reset    Reset game data to defaults (level 1, stage 1)
  --help     Show this help message

Without options, launches the game window.
On first run, setup is performed automatically.
`);
}

// ── Setup ────────────────────────────────────────────────────

function runSetup(force = false) {
  const setup = require("./setup.js");
  setup.run({ force });
}

// ── Reset ────────────────────────────────────────────────────

function resetGameData() {
  console.log("\n  Resetting game data...");

  const gameData = require("./game-data.js");
  gameData.reset();

  console.log("  Game data has been reset to defaults.");
  console.log(`  File: ${RPG_DATA_FILE}\n`);
}

// ── Launch Electron ──────────────────────────────────────────

function findElectron() {
  // Try to find electron binary
  // 1. Check local node_modules
  const localElectron = path.join(
    PROJECT_ROOT,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "electron.cmd" : "electron"
  );
  if (fs.existsSync(localElectron)) {
    return localElectron;
  }

  // 2. Check if electron is globally available
  // We'll let spawn handle the PATH lookup
  return process.platform === "win32" ? "electron.cmd" : "electron";
}

function launchElectron() {
  const electronBin = findElectron();
  const mainScript = path.join(PROJECT_ROOT, "src", "main.js");

  console.log("  Launching Claude-kun RPG...\n");

  // Remove ELECTRON_RUN_AS_NODE which prevents Electron from initializing
  // (may be inherited from VSCode/Claude Code environment)
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;

  const child = spawn(electronBin, [PROJECT_ROOT], {
    stdio: "inherit",
    cwd: PROJECT_ROOT,
    detached: process.platform !== "win32",
    env,
    shell: process.platform === "win32",
  });

  child.on("error", (err) => {
    if (err.code === "ENOENT") {
      console.error("\n  [!] ERROR: Electron not found.");
      console.error("      Install it with: npm install electron --save-dev");
      console.error(`      Or install globally: npm install -g electron\n`);
    } else {
      console.error(`\n  [!] Failed to launch: ${err.message}\n`);
    }
    process.exit(1);
  });

  child.on("close", (code) => {
    process.exit(code || 0);
  });

  // On non-Windows, detach so the CLI can exit
  if (process.platform !== "win32") {
    child.unref();
  }
}

// ── Main ─────────────────────────────────────────────────────

function main() {
  const flags = parseArgs();

  // Print banner
  console.log(BANNER);

  // Help
  if (flags.help) {
    printHelp();
    process.exit(0);
  }

  // Reset game data
  if (flags.reset) {
    // Ensure setup has been done first
    if (!isSetupDone()) {
      runSetup(false);
    }
    resetGameData();
    if (!flags.setup) {
      // If only --reset, don't launch the game
      process.exit(0);
    }
  }

  // Setup (forced or first-run)
  if (flags.setup) {
    runSetup(true);
  } else if (!isSetupDone()) {
    console.log("  First run detected. Running setup...\n");
    runSetup(false);
  }

  // Launch the game
  launchElectron();
}

main();
