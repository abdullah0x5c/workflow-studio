// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { MongoMemoryServer } from 'mongodb-memory-server'

let mongo
let routes

const params = (id) => ({ params: Promise.resolve({ id }) })
const json = async (response) => ({
  status: response.status,
  body: await response.json(),
})

beforeAll(async () => {
  mongo = await MongoMemoryServer.create()
  process.env.MONGODB_URI = mongo.getUri('workflow_studio_test')

  routes = {
    workflows: await import('@/app/api/workflows/route.js'),
    workflow: await import('@/app/api/workflows/[id]/route.js'),
    run: await import('@/app/api/workflows/[id]/run/route.js'),
    runs: await import('@/app/api/workflows/[id]/runs/route.js'),
    runById: await import('@/app/api/runs/[id]/route.js'),
  }
}, 180000)

afterAll(async () => {
  const { disconnectDb } = await import('@/lib/db.js')
  await disconnectDb()
  if (mongo) await mongo.stop()
})

describe('workflow API', () => {
  let workflowId

  it('creates a workflow seeded with the starter graph', async () => {
    const response = await routes.workflows.POST(
      new Request('http://test/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
    )
    const { status, body } = await json(response)
    expect(status).toBe(201)
    expect(body.workflow.name).toBe('Untitled workflow')
    expect(body.workflow.nodes.length).toBeGreaterThan(0)
    expect(body.workflow.edges.length).toBeGreaterThan(0)
    workflowId = body.workflow._id
  })

  it('lists workflows', async () => {
    const { status, body } = await json(await routes.workflows.GET())
    expect(status).toBe(200)
    expect(Array.isArray(body.workflows)).toBe(true)
    expect(body.workflows.length).toBeGreaterThanOrEqual(1)
  })

  it('reads a single workflow', async () => {
    const { status, body } = await json(
      await routes.workflow.GET(new Request('http://test'), params(workflowId))
    )
    expect(status).toBe(200)
    expect(body.workflow._id).toBe(workflowId)
  })

  it('updates a workflow name and graph', async () => {
    const response = await routes.workflow.PUT(
      new Request('http://test', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Renamed workflow' }),
      }),
      params(workflowId)
    )
    const { status, body } = await json(response)
    expect(status).toBe(200)
    expect(body.workflow.name).toBe('Renamed workflow')
  })

  it('rejects an invalid id', async () => {
    const { status } = await json(
      await routes.workflow.GET(new Request('http://test'), params('not-an-id'))
    )
    expect(status).toBe(400)
  })

  it('404s for a missing workflow', async () => {
    const missing = '0123456789abcdef01234567'
    const { status } = await json(
      await routes.workflow.GET(new Request('http://test'), params(missing))
    )
    expect(status).toBe(404)
  })

  it('rejects running a cyclic workflow', async () => {
    const created = await json(
      await routes.workflows.POST(
        new Request('http://test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Cyclic',
            nodes: [
              { id: 'a', type: 'manualTrigger', position: { x: 0, y: 0 }, data: {} },
              { id: 'b', type: 'code', position: { x: 1, y: 0 }, data: {} },
            ],
            edges: [
              { id: 'e1', source: 'a', target: 'b' },
              { id: 'e2', source: 'b', target: 'a' },
            ],
          }),
        })
      )
    )
    const cyclicId = created.body.workflow._id
    const { status, body } = await json(
      await routes.run.POST(new Request('http://test', { method: 'POST' }), params(cyclicId))
    )
    expect(status).toBe(400)
    expect(body.error).toBe('invalid_graph')
  })

  it('runs a workflow and persists node runs', async () => {
    const started = await json(
      await routes.run.POST(new Request('http://test', { method: 'POST' }), params(workflowId))
    )
    expect(started.status).toBe(202)
    expect(started.body.runId).toBeTruthy()

    let run
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const polled = await json(
        await routes.runById.GET(new Request('http://test'), params(started.body.runId))
      )
      run = polled.body.run
      if (run.status !== 'running') break
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    expect(run.status).toBe('success')
    expect(run.nodeRuns.length).toBeGreaterThan(0)
    expect(run.nodeRuns.some((entry) => entry.status === 'skipped')).toBe(true)
    expect(
      run.nodeRuns
        .filter((entry) => entry.status !== 'skipped')
        .every((entry) => entry.startedAt)
    ).toBe(true)
  }, 30000)

  it('lists runs for a workflow', async () => {
    const { status, body } = await json(
      await routes.runs.GET(new Request('http://test'), params(workflowId))
    )
    expect(status).toBe(200)
    expect(body.runs.length).toBeGreaterThanOrEqual(1)
  })

  it('deletes a workflow', async () => {
    const { status } = await json(
      await routes.workflow.DELETE(new Request('http://test'), params(workflowId))
    )
    expect(status).toBe(200)
    const after = await json(
      await routes.workflow.GET(new Request('http://test'), params(workflowId))
    )
    expect(after.status).toBe(404)
  })
})
