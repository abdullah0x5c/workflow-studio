import { NODE_META } from './nodeCatalog.js'
import { runUserCode } from './sandbox.js'
import { isPlainObject } from './graph.js'

const parseJsonish = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback
  if (typeof value === 'object') return value
  try {
    return JSON.parse(String(value))
  } catch {
    return fallback
  }
}

const runners = {
  manualTrigger: async ({ data }) => {
    const raw = data?.payload
    if (raw === undefined || raw === null || String(raw).trim() === '') {
      return { output: { trigger: 'manual', startedAt: new Date().toISOString() } }
    }
    if (typeof raw === 'object') return { output: raw }
    try {
      return { output: JSON.parse(String(raw)) }
    } catch {
      return { output: { value: String(raw) } }
    }
  },

  code: async ({ input, data, ctx }) => {
    const code = data?.code ?? 'return input'
    const result = await runUserCode(code, { input, ctx })
    return {
      output: result.output,
      logs: result.logs,
      error: result.ok ? null : result.error,
    }
  },

  httpRequest: async ({ input: _input, data }) => {
    const method = String(data?.method || 'GET').toUpperCase()
    const url = data?.url
    if (!url) throw new Error('HTTP Request node needs a URL')
    const headers = parseJsonish(data?.headers, {})
    const timeoutMs = Math.min(Math.max(Number(data?.timeoutMs) || 10000, 100), 60000)

    let body
    if (method !== 'GET' && method !== 'HEAD' && data?.body) {
      body = typeof data.body === 'string' ? data.body : JSON.stringify(data.body)
      const hasContentType = Object.keys(headers).some(
        (key) => key.toLowerCase() === 'content-type'
      )
      if (!hasContentType) headers['Content-Type'] = 'application/json'
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetch(url, { method, headers, body, signal: controller.signal })
      const text = await response.text()
      let parsed = text
      try {
        parsed = JSON.parse(text)
      } catch {
        /* keep raw text */
      }
      return {
        output: {
          status: response.status,
          ok: response.ok,
          headers: Object.fromEntries(response.headers.entries()),
          data: parsed,
        },
        logs: [
          {
            level: 'log',
            message: [`${method} ${url} -> ${response.status}`],
            at: new Date().toISOString(),
          },
        ],
      }
    } finally {
      clearTimeout(timer)
    }
  },

  delay: async ({ input, data }) => {
    const ms = Math.min(Math.max(Number(data?.ms) || 0, 0), 30000)
    await new Promise((resolve) => setTimeout(resolve, ms))
    return {
      output: input,
      logs: [{ level: 'log', message: [`waited ${ms}ms`], at: new Date().toISOString() }],
    }
  },

  if: async ({ input, data, ctx }) => {
    const code = data?.code || 'return Boolean(input)'
    const result = await runUserCode(code, { input, ctx })
    if (!result.ok) return { error: result.error, logs: result.logs }
    const condition = Boolean(result.output)
    const passed = isPlainObject(input)
      ? { ...input, _branch: condition ? 'true' : 'false' }
      : { value: input, _branch: condition ? 'true' : 'false' }
    return {
      output: passed,
      branch: condition ? 'true' : 'false',
      logs: result.logs,
    }
  },

  set: async ({ input, data, ctx }) => {
    const fields = Array.isArray(data?.fields) ? data.fields : []
    const base = isPlainObject(input) ? { ...input } : { value: input }
    for (const field of fields) {
      if (!field || !field.key) continue
      const expression = field.value ?? 'null'
      const result = await runUserCode(`return (${expression})`, { input: base, ctx })
      base[field.key] = result.ok ? result.output : expression
    }
    return { output: base }
  },

  merge: async ({ inputs }) => {
    const items = (inputs || []).filter((value) => value !== undefined)
    if (items.length === 0) return { output: {} }
    if (items.length === 1) return { output: items[0] }
    if (items.every((item) => isPlainObject(item))) {
      return { output: Object.assign({}, ...items) }
    }
    return { output: { items } }
  },
}

export const NODE_DEFINITIONS = Object.fromEntries(
  Object.entries(NODE_META).map(([type, meta]) => [type, { ...meta, run: runners[type] }])
)

export const NODE_TYPE_LIST = Object.values(NODE_DEFINITIONS)

export function getNodeDefinition(type) {
  return NODE_DEFINITIONS[type] || null
}

export function listNodeDefinitions() {
  return NODE_TYPE_LIST.map((def) => ({
    type: def.type,
    label: def.label,
    category: def.category,
    description: def.description,
    color: def.color,
    badge: def.badge,
    inputs: def.inputs,
    outputs: def.outputs,
    defaultData: def.defaultData(),
  }))
}

export { parseJsonish }
