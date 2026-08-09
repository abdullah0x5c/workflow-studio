import vm from 'node:vm'

export const DEFAULT_NODE_TIMEOUT_MS = Number(process.env.NODE_TIMEOUT_MS || 5000)

function toSerializable(value) {
  if (value === undefined) return null
  if (typeof value === 'function') return `[Function ${value.name || 'anonymous'}]`
  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    /* fall through */
  }
  try {
    return structuredClone(value)
  } catch {
    /* fall through */
  }
  return String(value)
}

export function createCapturedConsole(logs) {
  const push = (level) => (...args) => {
    logs.push({
      level,
      message: args.map((arg) => toSerializable(arg)),
      at: new Date().toISOString(),
    })
  }
  return {
    log: push('log'),
    info: push('info'),
    warn: push('warn'),
    error: push('error'),
    debug: push('debug'),
  }
}

export function withTimeout(promise, timeoutMs, message) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs)
    if (typeof timer.unref === 'function') timer.unref()
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

/**
 * Runs a snippet of user JavaScript as the body of an async function.
 * The snippet may `return` a value and use `input`, `ctx` and `console`.
 * Synchronous runaway loops are cut off by the vm timeout; async ones by
 * a racing timeout. `node:vm` is NOT a security boundary - see README.
 */
export async function runUserCode(code, options = {}) {
  const {
    input = null,
    ctx = {},
    timeoutMs = DEFAULT_NODE_TIMEOUT_MS,
    filename = 'workflow-node.js',
  } = options

  const logs = []
  const capturedConsole = createCapturedConsole(logs)

  if (typeof code !== 'string' || code.trim() === '') {
    return { ok: true, output: null, logs }
  }

  const sandbox = {
    input: toSerializable(input),
    ctx,
    console: capturedConsole,
    fetch: typeof fetch === 'function' ? fetch : undefined,
    URL,
    URLSearchParams,
    TextEncoder,
    TextDecoder,
    AbortController,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    structuredClone,
    atob: typeof atob === 'function' ? atob : undefined,
    btoa: typeof btoa === 'function' ? btoa : undefined,
    Buffer: undefined,
    process: undefined,
    require: undefined,
  }

  const source = `(async () => {\n${code}\n})()`

  let script
  try {
    script = new vm.Script(source, { filename })
  } catch (err) {
    return { ok: false, output: null, error: `SyntaxError: ${err.message}`, logs }
  }

  try {
    const context = vm.createContext(sandbox, {
      name: 'workflow-studio-node',
      codeGeneration: { strings: true, wasm: false },
    })
    const started = script.runInContext(context, { timeout: timeoutMs })
    const value = await withTimeout(
      Promise.resolve(started),
      timeoutMs,
      `Execution timed out after ${timeoutMs}ms`
    )
    return { ok: true, output: toSerializable(value), logs }
  } catch (err) {
    const message =
      err && err.message ? err.message : 'Unknown error while running node code'
    return { ok: false, output: null, error: message, logs }
  }
}

export { toSerializable }
