// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest'
import { getNodeDefinition } from '@/lib/engine/nodeTypes.js'

const originalFetch = global.fetch

afterEach(() => {
  global.fetch = originalFetch
})

describe('manualTrigger', () => {
  const def = getNodeDefinition('manualTrigger')

  it('parses a JSON payload', async () => {
    const result = await def.run({ data: { payload: '{"a":1}' } })
    expect(result.output).toEqual({ a: 1 })
  })

  it('falls back to a value wrapper for non-JSON payloads', async () => {
    const result = await def.run({ data: { payload: 'not json' } })
    expect(result.output).toEqual({ value: 'not json' })
  })

  it('emits a manual marker when no payload is configured', async () => {
    const result = await def.run({ data: {} })
    expect(result.output.trigger).toBe('manual')
  })
})

describe('code node', () => {
  const def = getNodeDefinition('code')

  it('transforms the input', async () => {
    const result = await def.run({
      input: { value: 3 },
      data: { code: 'return { ...input, doubled: input.value * 2 }' },
      ctx: {},
    })
    expect(result.error).toBeNull()
    expect(result.output).toEqual({ value: 3, doubled: 6 })
  })

  it('surfaces code errors instead of throwing', async () => {
    const result = await def.run({
      input: {},
      data: { code: 'throw new Error("nope")' },
      ctx: {},
    })
    expect(result.error).toBe('nope')
  })
})

describe('delay node', () => {
  const def = getNodeDefinition('delay')

  it('waits and passes data through', async () => {
    const started = Date.now()
    const result = await def.run({ input: { a: 1 }, data: { ms: 30 } })
    expect(Date.now() - started).toBeGreaterThanOrEqual(25)
    expect(result.output).toEqual({ a: 1 })
  })
})

describe('if node', () => {
  const def = getNodeDefinition('if')

  it('routes to the true branch', async () => {
    const result = await def.run({
      input: { value: 50 },
      data: { code: 'return input.value > 10' },
      ctx: {},
    })
    expect(result.branch).toBe('true')
    expect(result.output._branch).toBe('true')
  })

  it('routes to the false branch', async () => {
    const result = await def.run({
      input: { value: 5 },
      data: { code: 'return input.value > 10' },
      ctx: {},
    })
    expect(result.branch).toBe('false')
  })

  it('reports condition errors', async () => {
    const result = await def.run({
      input: {},
      data: { code: 'throw new Error("bad condition")' },
      ctx: {},
    })
    expect(result.error).toBe('bad condition')
  })
})

describe('set node', () => {
  const def = getNodeDefinition('set')

  it('evaluates field expressions', async () => {
    const result = await def.run({
      input: { a: 1 },
      data: {
        fields: [
          { key: 'b', value: 'input.a + 1' },
          { key: 'label', value: '"item-" + input.a' },
        ],
      },
      ctx: {},
    })
    expect(result.output).toEqual({ a: 1, b: 2, label: 'item-1' })
  })

  it('keeps the raw string when an expression is invalid', async () => {
    const result = await def.run({
      input: {},
      data: { fields: [{ key: 'note', value: 'not an expression' }] },
      ctx: {},
    })
    expect(result.output.note).toBe('not an expression')
  })

  it('skips fields without a key', async () => {
    const result = await def.run({
      input: { a: 1 },
      data: { fields: [{ key: '', value: '1' }] },
      ctx: {},
    })
    expect(result.output).toEqual({ a: 1 })
  })
})

describe('merge node', () => {
  const def = getNodeDefinition('merge')

  it('merges plain objects', async () => {
    const result = await def.run({ inputs: [{ a: 1 }, { b: 2 }] })
    expect(result.output).toEqual({ a: 1, b: 2 })
  })

  it('returns a single value untouched', async () => {
    const result = await def.run({ inputs: [{ a: 1 }] })
    expect(result.output).toEqual({ a: 1 })
  })

  it('collects non-objects into items', async () => {
    const result = await def.run({ inputs: [1, 2] })
    expect(result.output).toEqual({ items: [1, 2] })
  })

  it('returns an empty object when nothing arrives', async () => {
    const result = await def.run({ inputs: [] })
    expect(result.output).toEqual({})
  })
})

describe('httpRequest node', () => {
  const def = getNodeDefinition('httpRequest')

  it('performs a request and normalizes the response', async () => {
    global.fetch = vi.fn(async () => {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    })

    const result = await def.run({
      data: { url: 'https://example.com/api', method: 'GET' },
    })

    expect(result.output.status).toBe(200)
    expect(result.output.ok).toBe(true)
    expect(result.output.data).toEqual({ ok: true })
    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(global.fetch.mock.calls[0][0]).toBe('https://example.com/api')
  })

  it('throws when no URL is configured', async () => {
    await expect(def.run({ data: {} })).rejects.toThrow(/URL/)
  })

  it('adds a JSON content-type for request bodies', async () => {
    global.fetch = vi.fn(async () => new Response('{}', { status: 201 }))
    await def.run({
      data: {
        url: 'https://example.com/api',
        method: 'POST',
        body: '{"hello":"world"}',
      },
    })
    const options = global.fetch.mock.calls[0][1]
    expect(options.method).toBe('POST')
    expect(options.body).toBe('{"hello":"world"}')
    expect(options.headers['Content-Type']).toBe('application/json')
  })
})
