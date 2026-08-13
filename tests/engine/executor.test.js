// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { executeWorkflow } from '@/lib/engine/executor.js'
import { createStarterWorkflow } from '@/lib/engine/starter.js'

function collector() {
  const events = []
  return {
    events,
    onEvent: (event, payload) => events.push({ event, payload }),
  }
}

const finishedIds = (events) =>
  events.filter((e) => e.event === 'node:finished').map((e) => e.payload.nodeId)
const skippedIds = (events) =>
  events.filter((e) => e.event === 'node:skipped').map((e) => e.payload.nodeId)

describe('executeWorkflow', () => {
  it('runs the starter workflow and follows the true branch', async () => {
    const { nodes, edges } = createStarterWorkflow()
    const { events, onEvent } = collector()

    const result = await executeWorkflow({
      workflow: { id: 'wf1', nodes, edges },
      runId: 'run1',
      onEvent,
    })

    expect(result.status).toBe('success')
    expect(result.nodeRuns).toHaveLength(nodes.length)
    expect(finishedIds(events)).toEqual(
      expect.arrayContaining(['trigger-1', 'code-1', 'if-1', 'set-1'])
    )
    expect(skippedIds(events)).toContain('delay-1')
  })

  it('emits run lifecycle events', async () => {
    const { nodes, edges } = createStarterWorkflow()
    const { events, onEvent } = collector()

    await executeWorkflow({
      workflow: { id: 'wf1', nodes, edges },
      runId: 'run1',
      onEvent,
    })

    const names = events.map((e) => e.event)
    expect(names[0]).toBe('run:started')
    expect(names).toContain('node:started')
    expect(names).toContain('node:finished')
    expect(names[names.length - 1]).toBe('run:finished')
  })

  it('captures each node input and output', async () => {
    const { nodes, edges } = createStarterWorkflow()
    const { events, onEvent } = collector()

    await executeWorkflow({
      workflow: { id: 'wf1', nodes, edges },
      runId: 'run1',
      onEvent,
    })

    const code = events.find(
      (e) => e.event === 'node:finished' && e.payload.nodeId === 'code-1'
    )
    expect(code.payload.input).toEqual({ message: 'hello world', value: 21 })
    expect(code.payload.output).toMatchObject({ value: 21, doubled: 42 })
  })

  it('follows the false branch when the condition is false', async () => {
    const { nodes, edges } = createStarterWorkflow()
    nodes.find((n) => n.id === 'trigger-1').data.payload = JSON.stringify({
      value: 5,
    })
    const { events, onEvent } = collector()

    const result = await executeWorkflow({
      workflow: { id: 'wf1', nodes, edges },
      runId: 'run2',
      onEvent,
    })

    expect(result.status).toBe('success')
    expect(finishedIds(events)).toContain('delay-1')
    expect(skippedIds(events)).toContain('set-1')
  })

  it('fails fast when a node throws', async () => {
    const nodes = [
      { id: 't', type: 'manualTrigger', data: { payload: '{"value":1}' } },
      { id: 'c', type: 'code', data: { code: 'throw new Error("kaboom")' } },
      { id: 's', type: 'set', data: { fields: [] } },
    ]
    const edges = [
      { id: 'e1', source: 't', target: 'c' },
      { id: 'e2', source: 'c', target: 's' },
    ]
    const { events, onEvent } = collector()

    const result = await executeWorkflow({
      workflow: { id: 'wf2', nodes, edges },
      runId: 'run3',
      onEvent,
    })

    expect(result.status).toBe('failed')
    expect(result.error).toMatch(/kaboom/)
    expect(finishedIds(events)).not.toContain('s')
    expect(events[events.length - 1].event).toBe('run:failed')
  })

  it('reports cycles without running anything', async () => {
    const nodes = [
      { id: 'a', type: 'manualTrigger', data: {} },
      { id: 'b', type: 'code', data: {} },
    ]
    const edges = [
      { id: 'e1', source: 'a', target: 'b' },
      { id: 'e2', source: 'b', target: 'a' },
    ]
    const { onEvent } = collector()

    const result = await executeWorkflow({
      workflow: { id: 'wf3', nodes, edges },
      runId: 'run4',
      onEvent,
    })

    expect(result.status).toBe('failed')
    expect(result.error).toMatch(/cycle/i)
    expect(result.nodeRuns).toHaveLength(0)
  })

  it('marks unknown node types as failures', async () => {
    const nodes = [{ id: 'x', type: 'mystery', data: {} }]
    const { onEvent } = collector()

    const result = await executeWorkflow({
      workflow: { id: 'wf4', nodes, edges: [] },
      runId: 'run5',
      onEvent,
    })

    expect(result.status).toBe('failed')
    expect(result.error).toMatch(/Unknown node type/)
  })
})
