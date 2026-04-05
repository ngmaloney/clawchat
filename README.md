<p align="center">
  <img src="clawchat-icon.png" alt="ClawChat" width="200">
</p>

<h1 align="center">💬 ClawChat</h1>

<p align="center"><strong>Desktop client for OpenClaw gateways and Claude Code channels.</strong><br>No Node.js, no npm, no complexity — just download and connect.</p>

---

![Electron](https://img.shields.io/badge/Electron-30-47848F?logo=electron)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)

![ClawChat Screenshot](screenshot.png)

## Why ClawChat?

ClawChat supports two backends:

### OpenClaw Gateway
Connect to remote [OpenClaw](https://github.com/openclaw/openclaw) gateways over WebSocket. Full protocol v3 support including streaming deltas, session management, and SSH tunneling.

### Claude Code Channels
Connect to a [Claude Code](https://claude.ai/code) instance running with a custom MCP channel server. Uses your Claude Max subscription — no API billing. Claude Code runs on a server (e.g., Docker), and ClawChat connects via WebSocket to the channel server.

> **🎯 Quick Guide:**
> - Have an OpenClaw gateway? → Select **OpenClaw** tab on connect screen
> - Have Claude Code + channel server? → Select **Claude Channels** tab
> - Using Windows or Linux? → **ClawChat** (only cross-platform option)

---

## Download

Pre-built releases for macOS, Windows, and Linux are available on the [Releases](https://github.com/ngmaloney/clawchat/releases) page.

- **macOS** — `.dmg` installer
- **Windows** — `.exe` installer
- **Linux** — `.AppImage` (portable)

Or build from source (see [Quick Start](#quick-start) below).

## Perfect for Remote Backends

ClawChat connects to backends running elsewhere — whether that's a dedicated server, a home lab, or a cloud instance.

**OpenClaw setup:**
1. Run OpenClaw gateway on a Linux server or remote Mac
2. Install ClawChat on your laptop
3. Connect via WebSocket (direct or SSH tunnel)

**Claude Channels setup:**
1. Run Claude Code in a Docker container with a channel server (MCP)
2. The channel server exposes a WebSocket endpoint
3. Install ClawChat on your laptop and connect

Your conversations and credentials stay on your infrastructure. ClawChat is just a lightweight UI.

## Features

- **Full chat UI** — Send messages, receive streamed responses with live text updates
- **Markdown rendering** — Code blocks with syntax highlighting, bold, italic, links, lists
- **Image attachments** — Upload and view images inline
- **Session management** — Switch between multiple chat sessions
- **Slash commands** — Type `/` to access commands like `/new`, `/model`, `/thinking`, `/status`, etc.
- **Auto-reconnect** — Resilient WebSocket connection with exponential backoff
- **Persistent credentials** — Saved locally for auto-connect on launch
- **Cross-platform** — macOS, Windows, and Linux support
- **DevTools access** — F12 or Ctrl+Shift+I for debugging

### 🔮 Future: Node Mode

Node mode (camera, screen recording, system commands) is planned for a future release. This would allow ClawChat to act as an OpenClaw node, enabling the gateway to access your local machine's capabilities — making ClawChat the **only cross-platform node solution** for Windows and Linux users.

**Why it matters:** Currently, only the macOS app can expose node capabilities. ClawChat would be the first cross-platform option, essential for Windows/Linux users who want their gateway to access camera, screen, or run system commands remotely.

**Status:** Proof-of-concept validated (see [`feature/node-mode-poc`](https://github.com/ngmaloney/clawchat/tree/feature/node-mode-poc) branch). Implementation paused pending further investigation into the protocol requirements. Contributions welcome!

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- A running [OpenClaw Gateway](https://docs.openclaw.ai) or Claude Code channel server

### Install

```bash
git clone git@github.com:ngmaloney/clawchat.git
cd clawchat
npm install
```

### Development

```bash
npm run dev
```

### Production Build

```bash
npm run build
```

Outputs packaged binaries to `release/` directory.

## Connecting

### OpenClaw Gateway

1. Launch ClawChat
2. Select the **OpenClaw** tab
3. Enter your gateway URL (e.g., `ws://localhost:18789`)
4. Enter your gateway auth token
5. Click **Connect**

For remote gateways, use the **SSH Tunnel** toggle to connect securely:

```bash
# Or manually from terminal:
ssh -N -L 18789:127.0.0.1:18789 your-gateway-host
```

### Claude Code Channels

1. Launch ClawChat
2. Select the **Claude Channels** tab
3. Enter your channel server URL (e.g., `ws://your-server:9700`)
4. Click **Connect** (token is optional if the server doesn't require one)

#### Setting up the channel server

The channel server is an MCP server that runs as a subprocess of Claude Code. It bridges WebSocket connections from ClawChat to Claude Code's channel notification system.

**Prerequisites:**
- A server with Docker
- Claude Max subscription
- OAuth token from `claude setup-token`

**1. Docker container setup:**

Create a `docker-compose.yml`:

```yaml
services:
  claude-code:
    image: node:22-slim
    container_name: claude-code
    env_file:
      - .env
    working_dir: /workspace
    ports:
      - "9700:9700"
    volumes:
      - /path/to/workspace:/workspace
      - claude-cache:/root/.claude
    environment:
      - TERM=xterm-256color
      - COLORTERM=truecolor
    command: >
      bash -c "
        apt-get update && apt-get install -y git tmux vim ripgrep curl &&
        npm install -g @anthropic-ai/claude-code &&
        ln -sf /root/.claude/.claude.json /root/.claude.json &&
        tail -f /dev/null
      "
    restart: unless-stopped

volumes:
  claude-cache:
```

Create `.env`:
```
CLAUDE_CODE_OAUTH_TOKEN=sk-ant-oat01-your-token-here
```

**2. Channel server:**

Create `/workspace/channel-test/package.json`:
```json
{
  "name": "channel-test",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.1",
    "ws": "^8.0.0",
    "uuid": "^9.0.0"
  }
}
```

Create `/workspace/channel-test/server.mjs` — an MCP channel server that:
- Connects to Claude Code over stdio (channel capability)
- Exposes a WebSocket server on port 9700 for ClawChat
- Translates between ClawChat's protocol and MCP channel notifications
- Registers a `send_reply` tool for Claude to respond through

See the [channel server source](https://github.com/ngmaloney/clawchat/blob/feature/channel-backend/channel-server-example.md) for the full implementation.

Create `/workspace/.mcp.json`:
```json
{
  "mcpServers": {
    "channel-test": {
      "command": "node",
      "args": ["/workspace/channel-test/server.mjs"],
      "env": { "CHANNEL_PORT": "9700" }
    }
  }
}
```

**3. First-time setup inside the container:**

```bash
# Install dependencies
cd /workspace/channel-test && npm install

# Set onboarding flags to skip the wizard
node -e "
const fs = require('fs');
const d = JSON.parse(fs.readFileSync('/root/.claude/.claude.json','utf8'));
d.hasCompletedOnboarding = true;
d.theme = 'dark';
fs.writeFileSync('/root/.claude/.claude.json', JSON.stringify(d, null, 2));
"
```

**4. Start Claude Code with channels:**

```bash
tmux new-session -d -s claude "claude --permission-mode default \
  --allowedTools mcp__channel-test__send_reply \
  --dangerously-load-development-channels server:channel-test"
```

Accept the development channels warning when prompted. Claude will show "Listening for channel messages from: server:channel-test" when ready.

**5. Add personality (optional):**

Create `/workspace/CLAUDE.md` with a system prompt / personality. Claude Code reads this automatically every session.

## Using Slash Commands

ClawChat supports OpenClaw slash commands when connected to an OpenClaw gateway. Type `/` in the message input to see available commands:

- `/new` — Start a new session
- `/model` — Show or switch models
- `/thinking` — Toggle extended thinking mode
- `/status` — Show session status and token usage
- `/stop` — Abort current generation
- `/compact` — Summarize and compress session history
- `/verbose` — Toggle verbose output
- `/reset` — Reset the current session

Commands autocomplete as you type.

## Tech Stack

- **Electron** — Cross-platform desktop runtime
- **React 18** — UI framework with hooks
- **TypeScript** — Type safety
- **Vite** — Fast build tooling with HMR
- **react-markdown** + **remark-gfm** — Markdown rendering
- **react-syntax-highlighter** — Code syntax highlighting
- **electron-store** — Local credential storage

## Architecture

ClawChat implements the OpenClaw Gateway Protocol v3 and Claude Code channel protocol, including handshake, request/response correlation, and event streaming.

```
electron/          # Main process (Node.js)
  main.ts          # App lifecycle, IPC handlers
  preload.ts       # Secure context bridge

src/               # Renderer process (React)
  lib/
    gateway-client.ts    # WebSocket protocol (OpenClaw + Channels)
  hooks/
    useGateway.ts        # Connection state management
    useChat.ts           # Message & session state
  components/
    ConnectScreen.tsx    # Backend selection + auth
    Dashboard.tsx        # Main UI layout
    ChatView.tsx         # Message list
    MessageInput.tsx     # Input with file upload
    ...
```

## License

Private — not yet published.

---

**Website:** [clawchat.dev](https://clawchat.dev)
