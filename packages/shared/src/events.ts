// SSE event types: Server → Web

export interface SseMessageEvent {
  type: 'msg'
  sid: string
  seq: number
  source: 'agent' | 'user' | 'system'
  content: unknown
  localId?: string
}

export interface SsePermissionRequestEvent {
  type: 'perm.req'
  sid: string
  seq: number
  id: string
  tool: string
  input: unknown
}

export interface SsePermissionResolvedEvent {
  type: 'perm.resolved'
  sid: string
  id: string
  approved: boolean
}

export interface SseSessionUpdateEvent {
  type: 'session.update'
  sid: string
  status: 'active' | 'inactive' | 'archived'
  thinking: boolean
  model?: string
  effort?: string
  permissionMode?: string
}

export interface SseHeartbeatEvent {
  type: 'heartbeat'
  ts: number
}

export interface SseUsageEvent {
  type: 'usage'
  sid: string
  inputTokens: number
  outputTokens: number
  cost: number
}

export interface SseMachineStatusEvent {
  type: 'machine.status'
  machineId: string
  online: boolean
}

export type SseEvent =
  | SseMessageEvent
  | SsePermissionRequestEvent
  | SsePermissionResolvedEvent
  | SseSessionUpdateEvent
  | SseHeartbeatEvent
  | SseUsageEvent
  | SseMachineStatusEvent
