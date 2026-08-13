// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  topologicalOrder,
  validateGraph,
  isEdgeActive,
  indexGraph,
  findTriggerNodes,
} from '@/lib/engine/graph.js'

const nodes = [
  { id: 'a', type: 'manualTrigger' },
  { id: 'b', type: 'code' },
  { id: 'c', type: 'set' },
]
const edges = [
  { id: 'e1', source: 'a', target: 'b' },
  { id: 'e2', source: 'b', target: 'c' },
]

describe('topologicalOrder', () => {
  it('orders dependencies before dependents', () => {
    expect(topologicalOrder(['a', 'b', 'c'], edges)).toEqual(['a', 'b', 'c'])
  })

  it('throws on a cycle', () => {
    const cyclic = [
      { id: 'e1', source: 'a', target: 'b' },
      { id: 'e2', source: 'b', target: 'a' },
    ]
    expect(() => topologicalOrder(['a', 'b'], cyclic)).toThrow(/cycle/i)
  })
})

describe('validateGraph', () => {
  it('accepts a valid graph', () => {
    expect(validateGraph(nodes, edges).valid).toBe(true)
  })

  it('rejects an empty graph', () => {
    expect(validateGraph([], []).valid).toBe(false)
  })

  it('rejects edges pointing at unknown nodes', () => {
    const result = validateGraph(nodes, [{ id: 'x', source: 'a', target: 'zzz' }])
    expect(result.valid).toBe(false)
    expect(result.errors.join(' ')).toMatch(/unknown node/)
  })

  it('rejects duplicate node ids', () => {
    const result = validateGraph(
      [
        { id: 'a', type: 'code' },
        { id: 'a', type: 'set' },
      ],
      []
    )
    expect(result.errors.join(' ')).toMatch(/Duplicate/)
  })

  it('rejects self loops', () => {
    const result = validateGraph(nodes, [{ id: 'x', source: 'a', target: 'a' }])
    expect(result.valid).toBe(false)
  })

  it('requires at least one trigger node', () => {
    const result = validateGraph([{ id: 'a', type: 'code' }], [])
    expect(result.errors.join(' ')).toMatch(/trigger/i)
  })
})

describe('indexGraph', () => {
  it('indexes nodes and edges', () => {
    const { nodeMap, outgoingByNode, incomingByNode } = indexGraph(nodes, edges)
    expect(nodeMap.size).toBe(3)
    expect(outgoingByNode.get('a').map((e) => e.id)).toEqual(['e1'])
    expect(incomingByNode.get('c').map((e) => e.id)).toEqual(['e2'])
  })

  it('ignores edges that reference missing nodes', () => {
    const { outgoingByNode } = indexGraph(nodes, [
      { id: 'bad', source: 'ghost', target: 'a' },
    ])
    expect(outgoingByNode.get('a')).toEqual([])
  })
})

describe('findTriggerNodes', () => {
  it('finds trigger nodes', () => {
    expect(findTriggerNodes(nodes).map((n) => n.id)).toEqual(['a'])
  })
})

describe('isEdgeActive', () => {
  const nodeMap = new Map([
    ['if1', { id: 'if1', type: 'if' }],
    ['n', { id: 'n', type: 'code' }],
  ])

  it('follows the taken branch of an if node', () => {
    const results = new Map([['if1', { status: 'success', branch: 'true' }]])
    expect(isEdgeActive({ source: 'if1', sourceHandle: 'true' }, results, new Set(), nodeMap)).toBe(true)
    expect(isEdgeActive({ source: 'if1', sourceHandle: 'false' }, results, new Set(), nodeMap)).toBe(false)
  })

  it('defaults an if node with no branch to the true handle', () => {
    const results = new Map([['if1', { status: 'success' }]])
    expect(isEdgeActive({ source: 'if1', sourceHandle: 'true' }, results, new Set(), nodeMap)).toBe(true)
  })

  it('is inactive when the source failed', () => {
    const results = new Map([['n', { status: 'failed' }]])
    expect(isEdgeActive({ source: 'n' }, results, new Set(), nodeMap)).toBe(false)
  })

  it('is inactive when the source was skipped', () => {
    const results = new Map([['n', { status: 'success' }]])
    expect(isEdgeActive({ source: 'n' }, results, new Set(['n']), nodeMap)).toBe(false)
  })

  it('is active for a successful plain node', () => {
    const results = new Map([['n', { status: 'success' }]])
    expect(isEdgeActive({ source: 'n' }, results, new Set(), nodeMap)).toBe(true)
  })
})
