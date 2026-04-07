# Claude-kun RPG

**Claude Codeを使えば使うほどクロード君がレベルアップする放置シューティングRPG**

Idle Game x Vertical Shooter x Clicker

---

## What is this?

Claude Codeでコードを書くたびに、裏で動いてるシューティングゲームのキャラクターが強くなります。

- `Write` → 弾が飛んでボスにダメージ
- `Edit` → 弾が飛んでボスにダメージ
- `Grep` → ホーミングミサイル発射
- `MultiEdit` → 全画面爆破（必殺技）
- 大量のコードを書く → フィーバーゲージが溜まって弾幕が激化

## Features

- **20ステージ + エンドレスモード**
- **フィーバーシステム（Lv.100まで無限スケール）** - コード量に応じてゲージ蓄積、弾幕がSTG名作風に進化
- **202個の実績**（12カテゴリ）
- **30段階のキャラ進化**
- **4系統の武器進化**
- **コンボシステム** - 隕石連続撃破でスコアボーナス
- **パワーアップドロップ** - 弾速UP / シールド / 全方位弾幕 / XP2倍
- **レアメテオ** - 金色の星型、大量XP
- **ツール必殺技** - Write 30行以上で画面ビーム、MultiEditで全画面爆破
- **プレステージシステム** - Lv.100で周回、永続+10% DMGボーナス
- **ステージ別背景・ボス外見変化**
- **ボス攻撃パターン**（扇状弾 / 狙い撃ち / リング弾）
- **統計パネル** - ツール使用回数グラフ、総ダメージ等
- **リザルト画面** - ボス撃破後にSTAGE CLEAR演出

## Install & Run

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/claude-kun-rpg.git
cd claude-kun-rpg

# Install dependencies
npm install

# Setup hooks (connects to Claude Code)
node src/setup.js

# Launch the game
node src/cli.js
```

## How it works

```
Claude Code (hooks)
    |
    +-- PostToolUse --> hook.js --> events.jsonl
    +-- SessionStart --> hook.js --> events.jsonl
    |
    v
Electron App (game)
    +-- fs.watch(events.jsonl)
    +-- Canvas 2D game engine
    +-- Auto-play + fever system
```

1. `setup.js` がClaude Codeの `~/.claude/settings.json` にhookを登録
2. Claude Codeでツールが使われるたび `hook.js` がイベントを `~/.claude-kun/events.jsonl` に記録
3. Electronアプリがファイル変更を検知し、ゲームに反映

## Controls

ゲームは**完全オート**。放置してるだけでクロード君が戦います。

- Claude Codeを使う → ダメージ増加 + フィーバーゲージ蓄積
- 画面右上 **★** → 実績パネル
- 画面左下 **STAT** → 統計パネル
- 画面左下 **PIN** → 最前面表示 ON/OFF
- **ESC** → パネルを閉じる
- Lv.100で画面下に **PRESTIGE** ボタン出現

## Fever Levels (Bullet Patterns)

| Lv | Style | Pattern |
|----|-------|---------|
| 0 | Basic | Single shot |
| 1-6 | Star Soldier | Twin / 3-WAY spread |
| 7-14 | Xevious | Twin + wave / aimed |
| 15-29 | TwinBee | Spread + homing missiles |
| 30-49 | DoDonPachi | Focused laser stream / wide spread |
| 50-69 | Touhou | Accel aimed + satellites + wave |
| 70-89 | DoDonPachi Hyper | Spiral + ring burst + 6 satellites |
| 90-100 | Final Form | Everything at once |

## Tech Stack

- **Electron** - Desktop app
- **Canvas 2D** - Game rendering
- **Claude Code Hooks** - Event integration
- **Node.js** - Hook scripts

## License

MIT
