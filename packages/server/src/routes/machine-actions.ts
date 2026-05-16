import { Hono } from 'hono'
import { sendRpcToMachine, isMachineOnline, getOnlineMachineIds } from '../ws'
import { userOwnsMachine } from '../ownership'
import type { AppEnv } from '../types'

const machineActions = new Hono<AppEnv>()

machineActions.post('/:id/check-path', async (c) => {
  const userId = c.get('userId') as string
  const machineId = c.req.param('id')

  if (!userOwnsMachine(userId, machineId)) {
    return c.json({ error: 'not found' }, 404)
  }

  if (!isMachineOnline(machineId)) {
    return c.json({ error: 'machine offline' }, 503)
  }

  const { path } = await c.req.json<{ path: string }>()
  if (!path) return c.json({ error: 'path required' }, 400)

  const result = await sendRpcToMachine(machineId, {
    t: 'check-path',
    path,
  }) as { exists?: boolean; isDir?: boolean; error?: string }

  if (result?.error) {
    return c.json({ error: result.error }, 500)
  }

  return c.json({ exists: result?.exists ?? false, isDir: result?.isDir ?? false })
})

machineActions.get('/:id/status', (c) => {
  const userId = c.get('userId') as string
  const machineId = c.req.param('id')

  if (!userOwnsMachine(userId, machineId)) {
    return c.json({ error: 'not found' }, 404)
  }

  return c.json({ online: isMachineOnline(machineId) })
})

export default machineActions
