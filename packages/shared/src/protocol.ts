// WebSocket protocol: CLI ↔ Server

// --- CLI → Server ---

export interface SessionStartMsg {
  t: 'session.start'
  sid: string
  agent: 'claude' | 'codex' | 'gemini' | 'opencode'
  cwd: string
  model?: string
  source?: 'local' | 'remote'
  pid?: number
}

export interface SessionEndMsg {
  t: 'session.end'
  sid: string
}

export interface SessionStatusMsg {
  t: 'session.status'
  sid: string
  status: 'thinking' | 'idle' | 'tool_running'
}

export interface AgentOutputMsg {
  t: 'msg'
  sid: string
  content: unknown
}

export interface AgentOutputBatchMsg {
  t: 'msg.batch'
  sid: string
  messages: unknown[]
}

export interface PermissionRequestMsg {
  t: 'perm.req'
  sid: string
  id: string
  tool: string
  input: unknown
}

export interface PermissionAckMsg {
  t: 'perm.ack'
  sid: string
  id: string
}

export interface RpcResponseMsg {
  t: 'rpc.res'
  requestId: string
  result?: unknown
  error?: string
}

export interface UsageReportMsg {
  t: 'usage'
  sid: string
  inputTokens: number
  outputTokens: number
  cacheRead: number
  cacheWrite: number
  cost: number
}

export interface SessionMetaUpdateMsg {
  t: 'session.meta'
  sid: string
  model?: string
  effort?: string
  permissionMode?: string
}

export type CliToServer =
  | SessionStartMsg
  | SessionEndMsg
  | SessionStatusMsg
  | AgentOutputMsg
  | AgentOutputBatchMsg
  | PermissionRequestMsg
  | PermissionAckMsg
  | RpcResponseMsg
  | UsageReportMsg
  | SessionMetaUpdateMsg

// --- Server → CLI ---

export interface UserMessageToCliMsg {
  t: 'user.msg'
  sid: string
  text: string
  localId: string
  source: 'web' | 'cli'
}

export interface PermissionResponseMsg {
  t: 'perm.res'
  sid: string
  id: string
  approved: boolean
  mode?: string
  allowTools?: string[]
}

export interface AbortMsg {
  t: 'abort'
  sid: string
}

export interface ReplayMsg {
  t: 'replay'
  fromSeq: number
  messages: ServerToCli[]
}

export interface SpawnSessionMsg {
  t: 'spawn'
  requestId: string
  cwd: string
  model?: string
  effort?: string
  permissionMode?: string
  prompt?: string
}

export interface CheckPathMsg {
  t: 'check-path'
  requestId: string
  path: string
}

export interface SetModelMsg {
  t: 'set-model'
  sid: string
  model: string
}

export interface SetEffortMsg {
  t: 'set-effort'
  sid: string
  effort: string
}

export interface SetPermModeMsg {
  t: 'set-perm-mode'
  sid: string
  mode: string
}

export interface SlashCommandMsg {
  t: 'slash-cmd'
  sid: string
  command: string
}

export interface UploadFileMsg {
  t: 'upload'
  sid: string
  filename: string
  mimeType: string
  data: string
}

export type ServerToCli =
  | UserMessageToCliMsg
  | PermissionResponseMsg
  | AbortMsg
  | ReplayMsg
  | SpawnSessionMsg
  | CheckPathMsg
  | SetModelMsg
  | SetEffortMsg
  | SetPermModeMsg
  | SlashCommandMsg
  | UploadFileMsg
