// REST API types: Web ↔ Server

// --- Auth ---

export interface AuthStatusResponse {
  needsSetup: boolean
  registrationEnabled: boolean
}

export interface LoginRequest {
  username: string
  password: string
}

export interface RegisterRequest {
  username: string
  password: string
  displayName?: string
}

export interface AuthResponse {
  jwt: string
}

// --- Users ---

export interface UserInfo {
  id: string
  username: string
  displayName?: string
  isAdmin: boolean
  createdAt: number
}

// --- Machines ---

export interface MachineInfo {
  id: string
  name: string
  hostname?: string
  online?: boolean
  lastSeenAt?: number
  createdAt: number
}

export interface CreateMachineRequest {
  name: string
}

export interface CreateMachineResponse {
  machine: MachineInfo
  token: string
}

// --- Sessions ---

export interface SessionInfo {
  id: string
  agent: 'claude' | 'codex' | 'gemini' | 'opencode'
  cwd: string
  model?: string
  effort?: string
  permissionMode?: string
  name?: string
  machineId?: string
  machineName?: string
  status: 'active' | 'inactive' | 'archived'
  thinking: boolean
  source?: 'local' | 'remote'
  totalInputTokens?: number
  totalOutputTokens?: number
  totalCost?: number
  createdAt: number
  updatedAt: number
}

export interface SessionListResponse {
  sessions: SessionInfo[]
}

// --- Messages ---

export interface MessageRecord {
  id: number
  sessionId: string
  seq: number
  source: 'agent' | 'user' | 'system'
  content: unknown
  localId?: string
  createdAt: number
}

export interface MessageListResponse {
  messages: MessageRecord[]
  hasMore: boolean
}

export interface SendMessageRequest {
  text: string
  localId: string
  source: 'web' | 'cli'
}

// --- Permissions ---

export interface PermissionRecord {
  id: string
  sessionId: string
  tool: string
  input: unknown
  status: 'pending' | 'approved' | 'denied'
  createdAt: number
  resolvedAt?: number
}

export interface PermissionDecisionRequest {
  approved: boolean
  mode?: string
  allowTools?: string[]
}

// --- Session Spawn ---

export interface SpawnSessionRequest {
  machineId: string
  cwd: string
  model?: string
  effort?: string
  permissionMode?: string
  prompt?: string
}

export interface SpawnSessionResponse {
  sessionId: string
}

// --- Path Check ---

export interface CheckPathRequest {
  path: string
}

export interface CheckPathResponse {
  exists: boolean
  isDir: boolean
}

// --- Session Controls ---

export interface SetModelRequest {
  model: string
}

export interface SetEffortRequest {
  effort: string
}

export interface SetPermModeRequest {
  mode: string
}

export interface SlashCommandRequest {
  command: string
}

// --- Usage ---

export interface UsageInfo {
  inputTokens: number
  outputTokens: number
  cacheRead: number
  cacheWrite: number
  totalCost: number
}

// --- Push Notifications ---

export interface PushSubscribeRequest {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

export interface VapidKeyResponse {
  publicKey: string
}

// --- Admin ---

export interface AdminStats {
  totalUsers: number
  totalSessions: number
  activeSessions: number
  totalMessages: number
  machinesOnline: number
  machinesTotal: number
}
