# Bed-Vibe

[中文](./README.md)

Remote control for AI coding agents (Claude Code, Codex, Gemini CLI, OpenCode) from your phone.

Send messages, approve permissions, monitor output in real-time — vibe coding from anywhere.

## Features

- Real-time streaming of agent output to your phone
- Remote permission approval (never miss a tool request)
- Dual-source messaging — use both phone and local terminal simultaneously
- Seq-based message replay (no lost messages)
- PWA support — add to home screen for app-like experience
- Single Docker container deployment
- Works with API key mode (no subscription required)

## Architecture

```
┌──────────┐        ┌──────────────────┐        ┌──────────┐
│ Mac/PC   │──WS──→ │ Your Server      │ ←─HTTP─ │ Phone    │
│ CLI      │        │ (Docker)         │   SSE   │ PWA      │
│ Daemon   │        │ Bun + SQLite     │         │          │
└──────────┘        └──────────────────┘        └──────────┘
```

- **CLI → Server**: WebSocket with auto-reconnect and seq-based replay
- **Server → Phone**: SSE with Last-Event-ID replay
- **Phone → Server**: REST API
- **Persistence**: SQLite (WAL mode) — messages and permissions never lost

## Quick Start

### 1. Deploy Server

```bash
docker run -d --name bed-vibe \
  -p 3000:3000 \
  -v bed-vibe-data:/app/data \
  star5o/bed-vibe:latest
```

Or with docker compose:

```yaml
services:
  bed-vibe:
    image: star5o/bed-vibe:latest
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
    restart: unless-stopped
```

After first launch, visit the web UI to complete initial setup (create admin account).

### 2. Install CLI

```bash
npm install -g @bed-vibe/cli
```

### 3. Pair Machine

```bash
bv init http://your-server:3000
```

A 6-digit pairing code will be displayed. Enter it in the web UI under "Machine Management" to complete pairing.

### 4. Start Daemon

```bash
bv start
```

Then use `claude` as normal — the daemon auto-detects sessions and bridges them to your phone.

### 5. Phone Access

Open `http://your-server:3000` in your phone browser, log in, and add to home screen.

## CLI Commands

```bash
bv init <server-url>   # Pair machine (get pairing code)
bv start               # Start daemon
bv stop                # Stop daemon
bv status              # Show status
bv config              # Manually configure connection
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BV_PORT` | `3000` | Server port |
| `BV_DATA_DIR` | `./data` | Data directory (SQLite) |
| `BV_JWT_SECRET` | auto-generated | JWT signing secret |

## Reverse Proxy (Nginx/OpenResty)

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 86400s;
    proxy_send_timeout 86400s;
}
```

## Development

```bash
pnpm install

# Start server (requires Bun)
pnpm --filter @bed-vibe/server dev

# Start web dev server
pnpm --filter @bed-vibe/web dev

# Start CLI in dev mode
pnpm --filter @bed-vibe/cli dev
```

## License

MIT
