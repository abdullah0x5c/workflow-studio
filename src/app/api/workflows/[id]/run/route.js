import { NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { connectDb } from '@/lib/db'
import Workflow from '@/lib/models/Workflow'
import Run from '@/lib/models/Run'
import { validateGraph } from '@/lib/engine/graph'
import { executeWorkflow } from '@/lib/engine/executor'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function runWorkflow(workflow, runId, runDocId) {
  try {
    const execution = await executeWorkflow({ workflow, runId })
    await Run.findByIdAndUpdate(runDocId, {
      status: execution.status,
      startedAt: execution.startedAt,
      finishedAt: execution.finishedAt,
      durationMs: execution.durationMs,
      error: execution.error,
      nodeRuns: execution.nodeRuns,
    })
  } catch (err) {
    await Run.findByIdAndUpdate(runDocId, {
      status: 'failed',
      finishedAt: new Date().toISOString(),
      error: err.message,
    }).catch(() => {})
  }
}

export async function POST(_request, { params }) {
  const { id } = await params
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: 'Invalid workflow id' }, { status: 400 })
  }

  try {
    await connectDb()
    const workflow = await Workflow.findById(id).lean()
    if (!workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
    }

    const validation = validateGraph(workflow.nodes, workflow.edges)
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'invalid_graph', errors: validation.errors },
        { status: 400 }
      )
    }

    const run = await Run.create({
      workflowId: workflow._id,
      status: 'running',
      startedAt: new Date().toISOString(),
    })
    const runId = run._id.toString()

    const serialized = {
      id: workflow._id.toString(),
      name: workflow.name,
      nodes: workflow.nodes,
      edges: workflow.edges,
    }

    runWorkflow(serialized, runId, run._id).catch((err) => {
      console.error('[workflow-studio] run failed', err)
    })

    return NextResponse.json(
      { runId, runDocId: runId, workflowId: serialized.id },
      { status: 202 }
    )
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to start run', detail: err.message },
      { status: 500 }
    )
  }
}
