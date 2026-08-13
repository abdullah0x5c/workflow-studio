import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import WorkflowNode from '@/components/nodes/WorkflowNode'

function renderNode(node) {
  return render(
    <ReactFlowProvider>
      <WorkflowNode {...node} />
    </ReactFlowProvider>
  )
}

describe('WorkflowNode', () => {
  it('renders the label, output preview and duration', () => {
    renderNode({
      id: 'n1',
      type: 'code',
      selected: false,
      data: {
        label: 'Double',
        runtime: { status: 'success', output: { doubled: 42 }, durationMs: 4 },
      },
    })
    expect(screen.getByText('Double')).toBeInTheDocument()
    expect(screen.getByText(/doubled/)).toBeInTheDocument()
    expect(screen.getByText('4 ms')).toBeInTheDocument()
  })

  it('shows the error message on failure', () => {
    renderNode({
      id: 'n2',
      type: 'code',
      selected: false,
      data: {
        label: 'Boom',
        runtime: { status: 'failed', error: 'kaboom' },
      },
    })
    expect(screen.getByText('kaboom')).toBeInTheDocument()
  })

  it('falls back to the node type label', () => {
    renderNode({
      id: 'n3',
      type: 'delay',
      selected: false,
      data: { runtime: { status: 'idle' } },
    })
    expect(screen.getAllByText('Delay').length).toBeGreaterThanOrEqual(1)
  })
})
