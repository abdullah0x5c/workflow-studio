import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Inspector from '@/components/Inspector'

vi.mock('@/components/CodeEditor', () => ({
  default: () => <div data-testid="code-editor" />,
}))

const baseNode = {
  id: 'n1',
  type: 'delay',
  data: {
    label: 'Wait',
    ms: 250,
    runtime: {
      status: 'success',
      input: { a: 1 },
      output: { b: 2 },
      logs: [{ level: 'log', message: ['hello'], at: '2026-08-10T10:00:00Z' }],
    },
  },
}

describe('Inspector', () => {
  it('shows an empty state when no node is selected', () => {
    render(<Inspector node={null} onUpdateData={() => {}} onDelete={() => {}} />)
    expect(screen.getByText(/Select a node/)).toBeInTheDocument()
  })

  it('edits the node label', () => {
    const onUpdateData = vi.fn()
    render(
      <Inspector node={baseNode} onUpdateData={onUpdateData} onDelete={() => {}} />
    )
    fireEvent.change(screen.getByDisplayValue('Wait'), {
      target: { value: 'Pause' },
    })
    expect(onUpdateData).toHaveBeenCalledWith('n1', { label: 'Pause' })
  })

  it('edits the delay duration', () => {
    const onUpdateData = vi.fn()
    render(
      <Inspector node={baseNode} onUpdateData={onUpdateData} onDelete={() => {}} />
    )
    fireEvent.change(screen.getByDisplayValue('250'), {
      target: { value: '900' },
    })
    expect(onUpdateData).toHaveBeenCalledWith('n1', { ms: 900 })
  })

  it('switches between input, output and logs', () => {
    render(
      <Inspector node={baseNode} onUpdateData={() => {}} onDelete={() => {}} />
    )
    expect(screen.getByText(/"a": 1/)).toBeInTheDocument()

    fireEvent.click(screen.getByText('Output'))
    expect(screen.getByText(/"b": 2/)).toBeInTheDocument()

    fireEvent.click(screen.getByText(/Logs/))
    expect(screen.getByText('hello')).toBeInTheDocument()
  })

  it('deletes the selected node', () => {
    const onDelete = vi.fn()
    render(<Inspector node={baseNode} onUpdateData={() => {}} onDelete={onDelete} />)
    fireEvent.click(screen.getByText('delete'))
    expect(onDelete).toHaveBeenCalledWith('n1')
  })

  it('renders a code editor for code nodes', () => {
    const codeNode = {
      id: 'n2',
      type: 'code',
      data: { label: 'Code', code: 'return input' },
    }
    render(
      <Inspector node={codeNode} onUpdateData={() => {}} onDelete={() => {}} />
    )
    expect(screen.getByTestId('code-editor')).toBeInTheDocument()
  })

  it('adds and removes Set fields', () => {
    const onUpdateData = vi.fn()
    const setNode = {
      id: 'n3',
      type: 'set',
      data: { label: 'Set', fields: [{ key: 'a', value: '1' }] },
    }
    render(
      <Inspector node={setNode} onUpdateData={onUpdateData} onDelete={() => {}} />
    )
    fireEvent.click(screen.getByText('+ add'))
    expect(onUpdateData).toHaveBeenCalledWith('n3', {
      fields: [
        { key: 'a', value: '1' },
        { key: '', value: '' },
      ],
    })
  })
})
