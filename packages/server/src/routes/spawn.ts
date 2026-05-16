import { Hono } from 'hono'
import { sendRpcToMachine, isMachineOnline } from '../ws'
import { userOwnsMachine } from '../ownership'
import type { AppEnv } from '../types'

const spawn = new Hono<AppEnv>()

spawn.post('/', async (c) => {
  const userId = c.get('userId') as string
  const { machineId, cwd, model, effort, permissionMode, prompt } =
    await c.req.json<{
      machineId: string
      cwd: string
      model?: string
      effort?: string
      permissionMode?: string
      prompt?: string
    }>()

  if (!machineId || !cwd) {
    return c.json({ error: 'machineId and cwd required' }, 400)
  }

  if (!userOwnsMachine(userId, machineId)) {
    return c.json({ error: 'not found' }, 404)
  }

  if (!isMachineOnline(machineId)) {
    return c.json({ error: 'machine offline' }, 503)
  }

  const result = await sendRpcToMachine(machineId, {
    t: 'spawn',
    cwd,
    model,
    effort,
    permissionMode,
    prompt,
  }, 30000) as { sessionId?: string; error?: string }

  if (!result || result.error) {
    return c.json({ error: result?.error ?? 'spawn failed' }, 500)
  }

  return c.json({ sessionId: result.sessionId })
})

export default spawn
