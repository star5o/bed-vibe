import { createRouter, createRootRoute, createRoute, redirect } from '@tanstack/react-router'
import { getToken } from './api/client'
import RootLayout from './components/layout/RootLayout'
import Login from './pages/Login'
import Setup from './pages/Setup'
import Sessions from './pages/Sessions'
import Chat from './pages/Chat'
import Machines from './pages/Machines'
import Settings from './pages/Settings'

const rootRoute = createRootRoute({
  component: RootLayout,
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: Login,
})

const setupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/setup',
  component: Setup,
})

const sessionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sessions',
  component: Sessions,
  beforeLoad: () => {
    if (!getToken()) throw redirect({ to: '/login' })
  },
})

const chatRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sessions/$sessionId',
  component: Chat,
  beforeLoad: () => {
    if (!getToken()) throw redirect({ to: '/login' })
  },
})

const machinesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/machines',
  component: Machines,
  beforeLoad: () => {
    if (!getToken()) throw redirect({ to: '/login' })
  },
})

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: Settings,
  beforeLoad: () => {
    if (!getToken()) throw redirect({ to: '/login' })
  },
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/sessions' })
  },
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  setupRoute,
  sessionsRoute,
  chatRoute,
  machinesRoute,
  settingsRoute,
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
