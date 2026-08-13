import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

import Dashboard from '@/components/Dashboard'

beforeEach(() => {
  global.fetch = vi.fn()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Dashboard', () => {
  it('lists workflows returned by the API', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        workflows: [
          {
            _id: '1',
            name: 'Alpha',
            nodes: [{}, {}],
            edges: [{}],
            updatedAt: '2026-08-10T10:00:00Z',
          },
          { _id: '2', name: 'Beta', nodes: [], edges: [] },
        ],
      }),
    })

    render(<Dashboard />)

    expect(await screen.findByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
    expect(screen.getByText(/2 nodes/)).toBeInTheDocument()
  })

  it('shows the empty state when there are no workflows', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ workflows: [] }),
    })

    render(<Dashboard />)

    expect(await screen.findByText('No workflows yet.')).toBeInTheDocument()
  })

  it('shows an error when loading fails', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'boom' }),
    })

    render(<Dashboard />)

    expect(await screen.findByText('boom')).toBeInTheDocument()
  })
})
