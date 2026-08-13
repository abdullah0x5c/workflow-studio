import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import RunLog from '@/components/RunLog'

describe('RunLog', () => {
  it('prompts the user when there are no events', () => {
    render(<RunLog events={[]} />)
    expect(screen.getByText(/Press Run/)).toBeInTheDocument()
  })

  it('renders each event with its summary', () => {
    const at = new Date('2026-08-10T10:00:00Z').toISOString()
    render(
      <RunLog
        events={[
          { event: 'run:started', at, summary: 'workflow started' },
          { event: 'node:finished', at, summary: 'Code -> {"doubled":42}' },
        ]}
      />
    )
    expect(screen.getByText('run:started')).toBeInTheDocument()
    expect(screen.getByText('workflow started')).toBeInTheDocument()
    expect(screen.getByText('node:finished')).toBeInTheDocument()
    expect(screen.getByText('2 events')).toBeInTheDocument()
  })
})
