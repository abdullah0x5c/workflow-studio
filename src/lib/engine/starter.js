import { getNodeDefinition } from './nodeTypes.js'

function node(id, type, position, overrides = {}) {
  const def = getNodeDefinition(type)
  return {
    id,
    type,
    position,
    data: { ...def.defaultData(), ...overrides },
  }
}

export function createStarterWorkflow() {
  const nodes = [
    node('trigger-1', 'manualTrigger', { x: 40, y: 200 }),
    node('code-1', 'code', { x: 320, y: 200 }, {
      label: 'Double the value',
      code: 'const value = Number(input.value ?? 0)\nreturn {\n  ...input,\n  value,\n  doubled: value * 2,\n}',
    }),
    node('if-1', 'if', { x: 600, y: 200 }, {
      label: 'Is score high?',
      code: 'return (input.doubled ?? 0) > 20',
    }),
    node('set-1', 'set', { x: 900, y: 80 }, {
      label: 'Mark as high',
      fields: [
        { key: 'tier', value: '"high"' },
        { key: 'checkedAt', value: 'new Date().toISOString()' },
      ],
    }),
    node('delay-1', 'delay', { x: 900, y: 340 }, {
      label: 'Wait a moment',
      ms: 400,
    }),
  ]

  const edges = [
    { id: 'e-trigger-code', source: 'trigger-1', target: 'code-1', sourceHandle: 'out', targetHandle: 'in' },
    { id: 'e-code-if', source: 'code-1', target: 'if-1', sourceHandle: 'out', targetHandle: 'in' },
    { id: 'e-if-set', source: 'if-1', target: 'set-1', sourceHandle: 'true', targetHandle: 'in' },
    { id: 'e-if-delay', source: 'if-1', target: 'delay-1', sourceHandle: 'false', targetHandle: 'in' },
  ]

  return { nodes, edges }
}

export const STARTER_WORKFLOW_NAME = 'My first workflow'
