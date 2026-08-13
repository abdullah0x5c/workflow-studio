import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import NodePalette from '@/components/NodePalette'

describe('NodePalette', () => {
  it('groups node types by category', () => {
    render(<NodePalette onAddNode={() => {}} />)
    expect(screen.getByText('Triggers')).toBeInTheDocument()
    expect(screen.getByText('Logic')).toBeInTheDocument()
    expect(screen.getByText('Network')).toBeInTheDocument()
    expect(screen.getByText('Flow')).toBeInTheDocument()
  })

  it('renders every node type', () => {
    render(<NodePalette onAddNode={() => {}} />)
    for (const label of ['Manual Trigger', 'Code', 'HTTP Request', 'Delay', 'If', 'Set', 'Merge']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })

  it('calls onAddNode when a node is clicked', () => {
    const onAddNode = vi.fn()
    render(<NodePalette onAddNode={onAddNode} />)
    fireEvent.click(screen.getByText('Code').closest('button'))
    expect(onAddNode).toHaveBeenCalledWith('code')
  })

  it('makes palette entries draggable', () => {
    render(<NodePalette onAddNode={() => {}} />)
    const button = screen.getByText('Delay').closest('button')
    expect(button).toHaveAttribute('draggable', 'true')
  })
})
