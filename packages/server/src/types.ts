import type { Hono } from 'hono'

export type AppEnv = {
  Variables: {
    userId: string
    userRole: string
  }
}

export type AppHono = Hono<AppEnv>
