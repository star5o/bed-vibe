# Bed-Vibe

[English](./README.en.md)

用手机远程控制 AI 编程助手（Claude Code、Codex、Gemini CLI、OpenCode）。

随时随地发送消息、审批权限请求、实时查看输出 — 躺在床上也能 vibe coding。

## 特性

- 实时推送 Agent 输出到手机
- 远程审批权限请求（不再错过 tool 调用）
- 双端消息 — 手机和终端可同时使用
- 基于 seq 的消息重放，不丢消息
- PWA 支持 — 添加到主屏幕，体验接近原生 App
- 单 Docker 容器部署
- 支持 API key 模式（无需订阅）

## 架构

```
┌──────────┐        ┌──────────────────┐        ┌──────────┐
│ Mac/PC   │──WS──→ │ 你的服务器        │ ←─HTTP─ │ 手机     │
│ CLI 守护  │        │ (Docker)         │   SSE   │ PWA      │
│ + Agent  │        │ Bun + SQLite     │         │          │
└──────────┘        └──────────────────┘        └──────────┘
```

- **CLI → 服务器**: WebSocket，自动重连 + seq 重放
- **服务器 → 手机**: SSE + Last-Event-ID 重放
- **手机 → 服务器**: REST API
- **持久化**: SQLite (WAL 模式) — 消息和权限请求不丢失

## 快速开始

### 1. 部署服务器

```bash
docker run -d --name bed-vibe \
  -p 3000:3000 \
  -v bed-vibe-data:/app/data \
  star5o/bed-vibe:latest
```

或使用 docker compose:

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

首次启动后访问 Web 界面完成初始设置（创建管理员账号）。

### 2. 安装 CLI

```bash
npm install -g @bed-vibe/cli
```

### 3. 配对机器

```bash
bv init http://your-server:3000
```

终端会显示一个 6 位配对码，在 Web 界面「机器管理」中输入即可完成配对。

### 4. 启动守护进程

```bash
bv start
```

之后正常使用 `claude` 命令即可，守护进程会自动检测会话并桥接到手机。

### 5. 手机访问

浏览器打开 `http://your-server:3000`，登录后添加到主屏幕。

## CLI 命令

```bash
bv init <server-url>   # 配对机器（获取配对码）
bv start               # 启动守护进程
bv stop                # 停止守护进程
bv status              # 查看状态
bv config              # 手动配置连接信息
```

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `BV_PORT` | `3000` | 服务器端口 |
| `BV_DATA_DIR` | `./data` | 数据目录（SQLite） |
| `BV_JWT_SECRET` | 自动生成 | JWT 签名密钥 |

## 反向代理（Nginx/OpenResty）

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

## 开发

```bash
pnpm install

# 启动服务器（需要 Bun）
pnpm --filter @bed-vibe/server dev

# 启动 Web 开发服务器
pnpm --filter @bed-vibe/web dev

# 启动 CLI 开发模式
pnpm --filter @bed-vibe/cli dev
```

## License

MIT
