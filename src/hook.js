#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const os = require("os");

const EVENTS_DIR = path.join(os.homedir(), ".claude-kun");
const EVENTS_FILE = path.join(EVENTS_DIR, "events.jsonl");

function ensureDir() {
  if (!fs.existsSync(EVENTS_DIR)) {
    fs.mkdirSync(EVENTS_DIR, { recursive: true });
  }
}

function appendEvent(entry) {
  ensureDir();
  fs.appendFileSync(EVENTS_FILE, JSON.stringify(entry) + "\n");
}

function calcWeight(toolInput) {
  if (!toolInput) return { lines: 0, bytes: 0 };
  // Count actual newlines in text fields (content, new_string, command, etc.)
  let lines = 0;
  if (typeof toolInput === "string") {
    lines = toolInput.split("\n").length;
  } else if (typeof toolInput === "object") {
    // Sum newlines across all string values in the input
    for (const val of Object.values(toolInput)) {
      if (typeof val === "string") {
        lines += val.split("\n").length;
      }
    }
  }
  const bytes = Buffer.byteLength(JSON.stringify(toolInput), "utf8");
  return { lines: Math.max(1, lines), bytes };
}

function readStdin() {
  return new Promise((resolve) => {
    const chunks = [];
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => chunks.push(chunk));
    process.stdin.on("end", () => resolve(chunks.join("")));

    // If stdin has nothing piped, resolve quickly
    if (process.stdin.isTTY) {
      resolve("");
    }
  });
}

async function main() {
  const hookEvent = process.env.CLAUDE_HOOK_EVENT;
  if (!hookEvent) {
    process.exit(0);
  }

  const timestamp = new Date().toISOString();
  const raw = await readStdin();

  if (hookEvent === "PostToolUse") {
    let data = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      // ignore parse errors
    }
    const toolName = data.tool_name || "unknown";
    const weight = calcWeight(data.tool_input);
    appendEvent({
      timestamp,
      event: "PostToolUse",
      tool_name: toolName,
      weight,
      data: {
        tool_input_keys: data.tool_input ? Object.keys(data.tool_input) : [],
      },
    });
  } else if (hookEvent === "Stop") {
    let data = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      // ignore
    }
    appendEvent({
      timestamp,
      event: "Stop",
      data,
    });
  } else if (hookEvent === "SessionStart") {
    let data = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      // ignore
    }
    appendEvent({
      timestamp,
      event: "SessionStart",
      data,
    });
  } else {
    // Unknown event type, record it anyway
    appendEvent({
      timestamp,
      event: hookEvent,
    });
  }
}

main().catch(() => process.exit(1));
