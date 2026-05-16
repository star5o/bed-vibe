# Bed-Vibe Roadmap

## MVP (Phase 1) ✓

- [x] Monorepo 骨架（pnpm workspaces）
- [x] Server: Hono + WebSocket + SQLite (WAL) + REST API + SSE（seq 回放）
- [x] CLI: 守护进程架构，自动检测 Claude Code 会话，权限转发
- [x] Web: 会话列表 + 聊天界面 + 权限审批 + PWA
- [x] Docker 单容器部署
- [x] 双端同时操作：手机和终端都能发消息，双端实时可见
- [x] 配对码机器初始化（bv init）
- [x] 多语言支持（中文/英文）
- [x] GitHub Actions CI/CD（npm + Docker Hub）

## Phase 2

- [ ] Codex CLI 集成
- [ ] Gemini CLI 集成
- [ ] OpenCode 集成
- [ ] 文件上传/浏览
- [ ] Web Push 推送通知
- [ ] 会话搜索/归档
- [ ] 权限模式切换（default/acceptEdits/yolo）
- [ ] 模型/effort 远程切换

## Phase 3

- [ ] 安卓原生 App（Capacitor 打包）
- [ ] 多用户协作
- [ ] 会话共享
