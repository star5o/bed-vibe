# Bed-Vibe

Lightweight remote control for AI coding agents (Claude Code, Codex, Gemini CLI, OpenCode).

Control your AI coding sessions from your phone — send messages, approve permissions, monitor output in real-time.

## Features

- Real-time streaming of agent output to your phone
- Permission approval from anywhere (never miss a tool request)
- Dual-source messaging — use both phone and local terminal simultaneously
- Reliable message delivery with seq-based replay (no lost messages)
- PWA support — add to home screen for app-like experience
- Single Docker container deployment
- Works with API key mode (no subscription required)

## Quick Start

### 1. Deploy Server

```bash
docker compose up -d
# Check logs for your access token
docker compose logs | grep "Access token"
```

### 2. Connect CLI

```bash
npx bed-vibe connect --server https://your-server.com --token YOUR_TOKEN
```

### 3. Open Web UI

Visit `https://your-server.com` on your phone, enter the access token, and add to home screen.

## Architecture

```
┌──────────┐        ┌──────────────────┐        ┌──────────┐
│ Mac/PC   │──WS──→ │ Your Server      │ ←─HTTP─ │ Phone    │
│ CLI +    │        │ (Docker)         │   SSE   │ PWA      │
│ Agent    │        │ Bun + SQLite     │         │          │
└──────────┘        └──────────────────┘        └──────────┘
```

- **CLI → Server**: WebSocket with auto-reconnect and seq-based replay
- **Server → Phone**: SSE with Last-Event-ID replay
- **Phone → Server**: REST API
- **Persistence**: SQLite (WAL mode) — messages and permissions never lost

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `RV_PORT` | `3000` | Server port |
| `RV_DATA_DIR` | `./data` | Data directory (SQLite DB + token) |
| `RV_JWT_SECRET` | auto-generated | JWT signing secret |

### Reverse Proxy (Nginx/OpenResty)

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

## CLI Usage

```bash
# Save config (one-time)
rv config --server https://vibe.example.com --token YOUR_TOKEN

# Connect (uses saved config)
rv connect

# Connect with options
rv connect --agent claude --model claude-sonnet-4-20250514 --cwd ~/projects/myapp
```

## Development

```bash
# Install dependencies
pnpm install

# Start server (requires Bun)
pnpm --filter @bed-vibe/server dev

# Start web dev server
pnpm --filter @bed-vibe/web dev

# Start CLI in dev mode
pnpm --filter @bed-vibe/cli dev
```

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for planned features.

## License

MIT
