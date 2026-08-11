'use client'

import { io } from 'socket.io-client'

let socket = null

export function getSocket() {
  if (typeof window === 'undefined') return null
  if (!socket) {
    const url = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001'
    socket = io(url, {
      transports: ['websocket', 'polling'],
      reconnectionDelay: 500,
    })
  }
  return socket
}

export const RUN_EVENTS = [
  'run:started',
  'run:finished',
  'run:failed',
  'node:started',
  'node:finished',
  'node:failed',
  'node:skipped',
]

export function subscribeToWorkflow(workflowId, handler) {
  const s = getSocket()
  if (!s) return () => {}
  s.emit('workflow:subscribe', workflowId)
  const listeners = RUN_EVENTS.map((event) => {
    const listener = (payload) => handler(event, payload)
    s.on(event, listener)
    return { event, listener }
  })
  return () => {
    s.emit('workflow:unsubscribe', workflowId)
    listeners.forEach(({ event, listener }) => s.off(event, listener))
  }
}
