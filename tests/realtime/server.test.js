// @vitest-environment node
import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { io as ioClient } from 'socket.io-client'
import { createRealtimeServer } from '@/lib/realtime/server.js'
import { emitRunEvent } from '@/lib/realtime/io.js'

function listen(server) {
  return new Promise((resolve) => server.listen(0, () => resolve(server)))
}

function close(server) {
  return new Promise((resolve) => server.close(resolve))
}

function connect(port) {
  return new Promise((resolve, reject) => {
    const client = ioClient(`http://localhost:${port}`, {
      transports: ['websocket'],
      reconnection: false,
    })
    client.on('connect', () => resolve(client))
    client.on('connect_error', reject)
  })
}

describe('realtime server', () => {
  it('responds to the health check', async () => {
    const { httpServer } = createRealtimeServer()
    await listen(httpServer)
    const response = await request(httpServer).get('/health')
    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      ok: true,
      service: 'workflow-studio-realtime',
    })
    await close(httpServer)
  })

  it('404s unknown routes', async () => {
    const { httpServer } = createRealtimeServer()
    await listen(httpServer)
    const response = await request(httpServer).get('/nope')
    expect(response.status).toBe(404)
    await close(httpServer)
  })

  it('delivers run events to subscribers of that run', async () => {
    const { httpServer } = createRealtimeServer()
    await listen(httpServer)
    const port = httpServer.address().port
    const client = await connect(port)

    const received = new Promise((resolve) => client.on('node:started', resolve))
    client.emit('run:subscribe', 'run-123')
    await new Promise((resolve) => setTimeout(resolve, 50))

    emitRunEvent({
      workflowId: 'wf-1',
      runId: 'run-123',
      event: 'node:started',
      payload: { runId: 'run-123', nodeId: 'node-1' },
    })

    const payload = await received
    expect(payload.nodeId).toBe('node-1')

    client.close()
    await close(httpServer)
  })

  it('does not deliver events to unsubscribed clients', async () => {
    const { httpServer } = createRealtimeServer()
    await listen(httpServer)
    const port = httpServer.address().port
    const client = await connect(port)

    let received = false
    client.on('node:finished', () => {
      received = true
    })

    emitRunEvent({
      workflowId: 'wf-2',
      runId: 'run-999',
      event: 'node:finished',
      payload: { nodeId: 'node-2' },
    })
    await new Promise((resolve) => setTimeout(resolve, 80))

    expect(received).toBe(false)

    client.close()
    await close(httpServer)
  })

  it('delivers workflow-scoped events to workflow subscribers', async () => {
    const { httpServer } = createRealtimeServer()
    await listen(httpServer)
    const port = httpServer.address().port
    const client = await connect(port)

    const received = new Promise((resolve) => client.on('run:finished', resolve))
    client.emit('workflow:subscribe', 'wf-3')
    await new Promise((resolve) => setTimeout(resolve, 50))

    emitRunEvent({
      workflowId: 'wf-3',
      runId: 'run-abc',
      event: 'run:finished',
      payload: { status: 'success' },
    })

    const payload = await received
    expect(payload.status).toBe('success')

    client.close()
    await close(httpServer)
  })
})
