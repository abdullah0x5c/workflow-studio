'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
} from '@xyflow/react'
import FlowCanvas from './FlowCanvas'
import NodePalette from './NodePalette'
import Inspector from './Inspector'
import RunLog from './RunLog'
import RunHistory from './RunHistory'
import { getNodeMeta } from '@/lib/engine/nodeCatalog'
import { subscribeToWorkflow } from '@/lib/realtime/client'

const RUN_STATUS_STYLE = {
  idle: 'text-zinc-500',
  running: 'text-indigo-300',
  success: 'text-emerald-400',
  failed: 'text-rose-400',
}

const SAVE_STATUS_TEXT = {
  idle: '',
  saving: 'saving…',
  saved: 'saved',
  error: 'save failed',
}

function makeId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return Math.random().toString(36).slice(2, 10)
}

function stripRuntime(data = {}) {
  const { runtime: _runtime, ...rest } = data
  return rest
}

function serializeNodes(nodes) {
  return nodes.map((node) => ({
    id: node.id,
    type: node.type,
    position: { x: node.position?.x ?? 0, y: node.position?.y ?? 0 },
    data: stripRuntime(node.data),
  }))
}

function serializeEdges(edges) {
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle ?? null,
    targetHandle: edge.targetHandle ?? null,
    label: edge.label ?? null,
  }))
}

function previewValue(value) {
  try {
    const text = typeof value === 'string' ? value : JSON.stringify(value)
    if (!text) return ''
    return text.length > 60 ? `${text.slice(0, 60)}…` : text
  } catch {
    return ''
  }
}

function Editor({ workflow }) {
  const [nodes, setNodes, onNodesChange] = useNodesState(workflow.nodes || [])
  const [edges, setEdges, onEdgesChange] = useEdgesState(workflow.edges || [])
  const [name, setName] = useState(workflow.name || 'Untitled workflow')
  const [selectedId, setSelectedId] = useState(null)
  const [events, setEvents] = useState([])
  const [runStatus, setRunStatus] = useState('idle')
  const [saveStatus, setSaveStatus] = useState('idle')
  const [runs, setRuns] = useState([])
  const [activeRunId, setActiveRunId] = useState(null)

  const nodesRef = useRef(nodes)
  useEffect(() => {
    nodesRef.current = nodes
  }, [nodes])

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedId) || null,
    [nodes, selectedId]
  )

  const refreshRuns = useCallback(async () => {
    try {
      const res = await fetch(`/api/workflows/${workflow.id}/runs`)
      if (!res.ok) return
      const json = await res.json()
      setRuns(json.runs || [])
    } catch {
      /* offline is fine */
    }
  }, [workflow.id])

  useEffect(() => {
    refreshRuns()
  }, [refreshRuns])

  const addNode = useCallback(
    (type, position) => {
      const meta = getNodeMeta(type)
      if (!meta) return
      const id = `${type}-${makeId().slice(0, 8)}`
      setNodes((current) =>
        current.concat({
          id,
          type,
          position:
            position || {
              x: 160 + Math.random() * 240,
              y: 120 + Math.random() * 200,
            },
          data: { ...meta.defaultData() },
        })
      )
      setSelectedId(id)
    },
    [setNodes]
  )

  const onConnect = useCallback(
    (connection) => {
      setEdges((current) => {
        const id = `e-${connection.source}-${connection.sourceHandle || 'out'}-${connection.target}-${connection.targetHandle || 'in'}`
        if (current.some((edge) => edge.id === id)) return current
        return addEdge({ ...connection, id }, current)
      })
    },
    [setEdges]
  )

  const saveWorkflow = useCallback(async () => {
    setSaveStatus('saving')
    try {
      const res = await fetch(`/api/workflows/${workflow.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          nodes: serializeNodes(nodesRef.current),
          edges: serializeEdges(edges),
        }),
      })
      if (!res.ok) {
        setSaveStatus('error')
        return false
      }
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 1500)
      return true
    } catch {
      setSaveStatus('error')
      return false
    }
  }, [workflow.id, name, edges])

  const applyNodeRuntime = useCallback(
    (nodeId, runtime) => {
      setNodes((current) =>
        current.map((node) =>
          node.id === nodeId ? { ...node, data: { ...node.data, runtime } } : node
        )
      )
    },
    [setNodes]
  )

  const handleEvent = useCallback(
    (event, payload) => {
      const node = nodesRef.current.find((n) => n.id === payload.nodeId)
      const label =
        payload.label || node?.data?.label || node?.type || payload.nodeId || 'node'
      let summary = ''

      switch (event) {
        case 'run:started':
          setRunStatus('running')
          summary = 'workflow started'
          break
        case 'run:finished':
          setRunStatus('success')
          summary = `finished in ${payload.durationMs}ms`
          refreshRuns()
          break
        case 'run:failed':
          setRunStatus('failed')
          summary = payload.error || 'workflow failed'
          refreshRuns()
          break
        case 'node:started':
          applyNodeRuntime(payload.nodeId, {
            status: 'running',
            input: payload.input,
            startedAt: payload.startedAt,
          })
          summary = `${label} started`
          break
        case 'node:finished':
          applyNodeRuntime(payload.nodeId, {
            status: 'success',
            input: payload.input,
            output: payload.output,
            logs: payload.logs,
            branch: payload.branch,
            durationMs: payload.durationMs,
            startedAt: payload.startedAt,
            finishedAt: payload.finishedAt,
          })
          summary = `${label} -> ${previewValue(payload.output)}`
          break
        case 'node:failed':
          applyNodeRuntime(payload.nodeId, {
            status: 'failed',
            input: payload.input,
            error: payload.error,
            logs: payload.logs,
            durationMs: payload.durationMs,
            startedAt: payload.startedAt,
            finishedAt: payload.finishedAt,
          })
          summary = `${label} failed: ${payload.error}`
          break
        case 'node:skipped':
          applyNodeRuntime(payload.nodeId, { status: 'skipped' })
          summary = `${label} skipped`
          break
        default:
          summary = event
      }

      setEvents((current) => [
        ...current,
        { event, at: payload.at || new Date().toISOString(), summary },
      ])
    },
    [applyNodeRuntime, refreshRuns]
  )

  useEffect(() => {
    if (!workflow.id) return undefined
    return subscribeToWorkflow(workflow.id, handleEvent)
  }, [workflow.id, handleEvent])

  const runWorkflow = useCallback(async () => {
    setEvents([])
    setRunStatus('running')
    setNodes((current) =>
      current.map((node) => ({ ...node, data: { ...node.data, runtime: undefined } }))
    )
    await saveWorkflow()
    try {
      const res = await fetch(`/api/workflows/${workflow.id}/run`, { method: 'POST' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setRunStatus('failed')
        const message = Array.isArray(json.errors)
          ? json.errors.join('; ')
          : json.error || 'Failed to run workflow'
        setEvents([
          { event: 'run:failed', at: new Date().toISOString(), summary: message },
        ])
      }
    } catch (err) {
      setRunStatus('failed')
      setEvents([
        { event: 'run:failed', at: new Date().toISOString(), summary: err.message },
      ])
    }
  }, [saveWorkflow, setNodes, workflow.id])

  const openRun = useCallback(
    async (runId) => {
      setActiveRunId(runId)
      try {
        const res = await fetch(`/api/runs/${runId}`)
        if (!res.ok) return
        const { run } = await res.json()
        setNodes((current) =>
          current.map((node) => {
            const entry = (run.nodeRuns || []).find((nr) => nr.nodeId === node.id)
            if (!entry) return { ...node, data: { ...node.data, runtime: undefined } }
            return {
              ...node,
              data: {
                ...node.data,
                runtime: {
                  status: entry.status,
                  input: entry.input,
                  output: entry.output,
                  error: entry.error,
                  logs: entry.logs,
                  branch: entry.branch,
                  durationMs: entry.durationMs,
                  startedAt: entry.startedAt,
                  finishedAt: entry.finishedAt,
                },
              },
            }
          })
        )
        setRunStatus(run.status)
      } catch {
        /* ignore */
      }
    },
    [setNodes]
  )

  const deleteNode = useCallback(
    (nodeId) => {
      setNodes((current) => current.filter((node) => node.id !== nodeId))
      setEdges((current) =>
        current.filter((edge) => edge.source !== nodeId && edge.target !== nodeId)
      )
      setSelectedId((current) => (current === nodeId ? null : current))
    },
    [setNodes, setEdges]
  )

  const updateNodeData = useCallback(
    (nodeId, patch) => {
      setNodes((current) =>
        current.map((node) =>
          node.id === nodeId ? { ...node, data: { ...node.data, ...patch } } : node
        )
      )
    },
    [setNodes]
  )

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="flex items-center gap-3 border-b border-zinc-800 bg-zinc-950 px-4 py-2.5">
        <Link href="/" className="shrink-0 text-xs text-zinc-500 hover:text-zinc-200">
          ← all workflows
        </Link>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-semibold text-zinc-100 outline-none hover:border-zinc-800 focus:border-indigo-500"
          aria-label="Workflow name"
        />
        <span
          className={`text-[11px] ${
            saveStatus === 'error' ? 'text-rose-400' : 'text-zinc-600'
          }`}
        >
          {SAVE_STATUS_TEXT[saveStatus]}
        </span>
        <span className={`text-[11px] ${RUN_STATUS_STYLE[runStatus]}`}>
          run: {runStatus}
        </span>
        <button
          type="button"
          onClick={saveWorkflow}
          className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 transition hover:bg-zinc-800"
        >
          Save
        </button>
        <button
          type="button"
          onClick={runWorkflow}
          disabled={runStatus === 'running'}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
        >
          {runStatus === 'running' ? 'Running…' : 'Run'}
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <NodePalette onAddNode={addNode} />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1">
            <FlowCanvas
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={(_event, node) => setSelectedId(node.id)}
              onPaneClick={() => setSelectedId(null)}
              onAddNode={addNode}
            />
          </div>
          <div className="grid shrink-0 grid-cols-2 gap-3 border-t border-zinc-800 p-3">
            <RunLog events={events} />
            <RunHistory runs={runs} onSelect={openRun} activeRunId={activeRunId} />
          </div>
        </div>

        <Inspector
          node={selectedNode}
          onUpdateData={updateNodeData}
          onDelete={deleteNode}
        />
      </div>
    </div>
  )
}

export default function WorkflowEditor({ workflow }) {
  return (
    <ReactFlowProvider>
      <Editor workflow={workflow} />
    </ReactFlowProvider>
  )
}
