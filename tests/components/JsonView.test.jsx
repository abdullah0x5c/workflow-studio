import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import JsonView from '@/components/JsonView'

describe('JsonView', () => {
  it('renders the serialized value', () => {
    render(<JsonView value={{ a: 1, b: [1, 2] }} />)
    expect(screen.getByText(/"a": 1/)).toBeInTheDocument()
    expect(screen.getByText(/"b": \[/)).toBeInTheDocument()
  })

  it('renders an empty state for null/undefined', () => {
    render(<JsonView value={undefined} empty="Nothing here" />)
    expect(screen.getByText('Nothing here')).toBeInTheDocument()
  })

  it('renders strings as-is', () => {
    render(<JsonView value="plain text" />)
    expect(screen.getByText('"plain text"')).toBeInTheDocument()
  })

  it('offers a copy button when there is data', () => {
    render(<JsonView value={{ a: 1 }} />)
    expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument()
  })
})
