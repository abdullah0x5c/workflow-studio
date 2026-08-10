import { getNodeDefinition } from './nodeTypes.js'
import { indexGraph, topologicalOrder, isEdgeActive } from './graph.js'
import { toSerializable } from './sandbox.js'
import { emitRunEvent } from '../realtime/io.js'

const nowIso = () => new Date().toISOString()

/**
 * Executes a workflow graph node by node, emitting lifecycle events.
 * `onEvent(event, payload)` defaults to broadcasting over Socket.io.
 * `onNodeFinished(entry)` lets the caller persist incremental progress.
 */
export async function executeWorkflow({
  workflow,
  runId,
  onEvent,
  onNodeFinished,
} = {}) {
  const nodes = workflow?.nodes || []
  const edges = workflow?.edges || []
  const workflowId = workflow?.id || String(workflow?._id || '')
  const cache = {}

  const emit = (event, payload) => {
    const enriched = { runId, workflowId, at: nowIso(), ...payload }
    if (typeof onEvent === 'function') onEvent(event, enriched)
    else emitRunEvent({ workflowId, runId, event, payload: enriched })
  }

  const { nodeMap } = indexGraph(nodes, edges)
  const results = new Map()
  const skipped = new Set()
  const nodeRuns = []
  const startedAt = nowIso()
  const runStart = Date.now()

  const record = (entry) => {
    results.set(entry.nodeId, entry)
    nodeRuns.push(entry)
    if (typeof onNodeFinished === 'function') onNodeFinished(entry)
  }

  emit('run:started', { runId, workflowId, startedAt })

  let order
  try {
    order = topologicalOrder(nodes.map((n) => n.id), edges)
  } catch (err) {
    const finishedAt = nowIso()
    emit('run:failed', { error: err.message, finishedAt })
    return {
      status: 'failed',
      error: err.message,
      startedAt,
      finishedAt,
      durationMs: Date.now() - runStart,
      nodeRuns,
    }
  }

  let failure = null

  for (const nodeId of order) {
    const node = nodeMap.get(nodeId)
    const def = getNodeDefinition(node.type)
    const incomingEdges = edges.filter((edge) => edge.target === nodeId)
    const activeIncoming = incomingEdges.filter((edge) =>
      isEdgeActive(edge, results, skipped, nodeMap)
    )

    if (incomingEdges.length > 0 && activeIncoming.length === 0) {
      skipped.add(nodeId)
      const entry = {
        nodeId,
        type: node.type,
        status: 'skipped',
        input: null,
        output: null,
        logs: [],
        startedAt: null,
        finishedAt: null,
        durationMs: 0,
      }
      record(entry)
      emit('node:skipped', entry)
      continue
    }

    if (!def) {
      const entry = {
        nodeId,
        type: node.type,
        status: 'failed',
        input: null,
        output: null,
        error: `Unknown node type "${node.type}"`,
        logs: [],
        startedAt: nowIso(),
        finishedAt: nowIso(),
        durationMs: 0,
      }
      record(entry)
      skipped.add(nodeId)
      emit('node:failed', entry)
      failure = entry.error
      break
    }

    const collected = activeIncoming.map(
      (edge) => results.get(edge.source)?.output
    )
    let input
    if (def.inputMode === 'none') input = undefined
    else if (def.inputMode === 'multiple') input = collected
    else input = collected.length ? collected[collected.length - 1] : undefined

    const nodeStart = nowIso()
    emit('node:started', {
      nodeId,
      type: node.type,
      label: node.data?.label || def.label,
      input: toSerializable(input),
      startedAt: nodeStart,
    })

    try {
      const ctx = {
        nodeId,
        nodeType: node.type,
        nodeLabel: node.data?.label || def.label,
        workflowId,
        runId,
        cache,
      }
      const result = await def.run({
        input,
        inputs: collected,
        data: node.data || {},
        node,
        ctx,
      })

      if (result?.error) {
        const err = new Error(result.error)
        err.logs = result.logs || []
        throw err
      }

      const finishedAt = nowIso()
      const entry = {
        nodeId,
        type: node.type,
        status: 'success',
        branch: result?.branch || null,
        input: toSerializable(input),
        output: toSerializable(result?.output ?? null),
        logs: toSerializable(result?.logs || []),
        startedAt: nodeStart,
        finishedAt,
        durationMs: Date.parse(finishedAt) - Date.parse(nodeStart),
      }
      record(entry)
      emit('node:finished', entry)
    } catch (err) {
      const finishedAt = nowIso()
      const entry = {
        nodeId,
        type: node.type,
        status: 'failed',
        input: toSerializable(input),
        output: null,
        error: err?.message || 'Unknown node error',
        logs: toSerializable(err?.logs || []),
        startedAt: nodeStart,
        finishedAt,
        durationMs: Date.parse(finishedAt) - Date.parse(nodeStart),
      }
      record(entry)
      skipped.add(nodeId)
      emit('node:failed', entry)
      failure = entry.error
      break
    }
  }

  const finishedAt = nowIso()
  const status = failure ? 'failed' : 'success'
  emit(status === 'success' ? 'run:finished' : 'run:failed', {
    status,
    error: failure,
    finishedAt,
    durationMs: Date.now() - runStart,
  })

  return {
    status,
    error: failure,
    startedAt,
    finishedAt,
    durationMs: Date.now() - runStart,
    nodeRuns,
  }
}

export default executeWorkflow
