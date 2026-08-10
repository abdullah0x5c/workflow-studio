/**
 * Client-safe metadata for every node type.
 * No server-only imports here so this can be bundled into the browser.
 */
export const NODE_META = {
  manualTrigger: {
    type: 'manualTrigger',
    label: 'Manual Trigger',
    category: 'Triggers',
    description: 'Entry point. Emits the JSON payload you configure.',
    color: '#f59e0b',
    badge: 'T',
    inputMode: 'none',
    inputs: [],
    outputs: [{ id: 'out', label: 'Out' }],
    defaultData: () => ({
      label: 'Manual Trigger',
      payload: '{\n  "message": "hello world",\n  "value": 21\n}',
    }),
  },

  code: {
    type: 'code',
    label: 'Code',
    category: 'Logic',
    description: 'Run JavaScript. Receives `input`, returns the output value.',
    color: '#6366f1',
    badge: '{}',
    inputMode: 'single',
    inputs: [{ id: 'in', label: 'In' }],
    outputs: [{ id: 'out', label: 'Out' }],
    defaultData: () => ({
      label: 'Code',
      code: '// `input` is the value from the previous node.\n// Return the value this node should output.\nreturn {\n  ...input,\n  doubled: (input.value ?? 0) * 2,\n}',
    }),
  },

  httpRequest: {
    type: 'httpRequest',
    label: 'HTTP Request',
    category: 'Network',
    description: 'Call an HTTP endpoint and inspect status, headers and body.',
    color: '#0ea5e9',
    badge: 'HTTP',
    inputMode: 'single',
    inputs: [{ id: 'in', label: 'In' }],
    outputs: [{ id: 'out', label: 'Out' }],
    defaultData: () => ({
      label: 'HTTP Request',
      method: 'GET',
      url: 'https://jsonplaceholder.typicode.com/todos/1',
      headers: '',
      body: '',
      timeoutMs: 10000,
    }),
  },

  delay: {
    type: 'delay',
    label: 'Delay',
    category: 'Flow',
    description: 'Pause for a number of milliseconds, then pass data through.',
    color: '#64748b',
    badge: 'ms',
    inputMode: 'single',
    inputs: [{ id: 'in', label: 'In' }],
    outputs: [{ id: 'out', label: 'Out' }],
    defaultData: () => ({ label: 'Delay', ms: 500 }),
  },

  if: {
    type: 'if',
    label: 'If',
    category: 'Logic',
    description: 'Evaluate a condition and route data to the true or false branch.',
    color: '#a855f7',
    badge: 'if',
    inputMode: 'single',
    inputs: [{ id: 'in', label: 'In' }],
    outputs: [
      { id: 'true', label: 'True' },
      { id: 'false', label: 'False' },
    ],
    defaultData: () => ({
      label: 'If',
      code: 'return (input.value ?? 0) > 10',
    }),
  },

  set: {
    type: 'set',
    label: 'Set',
    category: 'Logic',
    description: 'Assign computed values onto the incoming object.',
    color: '#10b981',
    badge: 'set',
    inputMode: 'single',
    inputs: [{ id: 'in', label: 'In' }],
    outputs: [{ id: 'out', label: 'Out' }],
    defaultData: () => ({
      label: 'Set',
      fields: [
        { key: 'greeting', value: '"hello " + (input.message ?? "world")' },
      ],
    }),
  },

  merge: {
    type: 'merge',
    label: 'Merge',
    category: 'Flow',
    description: 'Combine outputs from multiple branches into a single value.',
    color: '#14b8a6',
    badge: 'M',
    inputMode: 'multiple',
    inputs: [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ],
    outputs: [{ id: 'out', label: 'Out' }],
    defaultData: () => ({ label: 'Merge' }),
  },
}

export const NODE_META_LIST = Object.values(NODE_META)

export function getNodeMeta(type) {
  return NODE_META[type] || null
}

export function listNodeMeta() {
  return NODE_META_LIST.map((meta) => ({
    type: meta.type,
    label: meta.label,
    category: meta.category,
    description: meta.description,
    color: meta.color,
    badge: meta.badge,
    inputs: meta.inputs,
    outputs: meta.outputs,
    inputMode: meta.inputMode,
    defaultData: meta.defaultData(),
  }))
}
