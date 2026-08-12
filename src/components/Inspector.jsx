'use client'

import { useState } from 'react'
import CodeEditor from './CodeEditor'
import JsonView from './JsonView'
import { getNodeMeta } from '@/lib/engine/nodeCatalog'

const inputClass =
  'w-full rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-100 outline-none transition focus:border-indigo-500'
const labelClass =
  'block text-[10px] font-medium uppercase tracking-wide text-zinc-500'

const STATUS_TEXT = {
  idle: 'text-zinc-500',
  running: 'text-indigo-300',
  success: 'text-emerald-400',
  failed: 'text-rose-400',
  skipped: 'text-zinc-500',
}

function TabButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-2.5 py-1 text-[11px] transition ${
        active
          ? 'bg-zinc-800 text-zinc-100'
          : 'text-zinc-500 hover:text-zinc-300'
      }`}
    >
      {children}
    </button>
  )
}

function Field({ label, hint, children }) {
  return (
    <div className="space-y-1">
      <label className={labelClass}>{label}</label>
      {children}
      {hint ? <p className="text-[10px] text-zinc-600">{hint}</p> : null}
    </div>
  )
}

export default function Inspector({ node, onUpdateData, onDelete }) {
  const [tab, setTab] = useState('input')

  if (!node) {
    return (
      <aside className="ws-panel flex w-96 shrink-0 flex-col items-center justify-center border-l px-6 text-center">
        <p className="text-xs text-zinc-500">
          Select a node to edit its settings and inspect its input / output.
        </p>
      </aside>
    )
  }

  const meta = getNodeMeta(node.type) || { label: node.type, outputs: [] }
  const data = node.data || {}
  const runtime = data.runtime || {}
  const status = runtime.status || 'idle'
  const logs = Array.isArray(runtime.logs) ? runtime.logs : []

  const update = (patch) => onUpdateData(node.id, patch)

  const updateField = (index, patch) => {
    const fields = [...(data.fields || [])]
    fields[index] = { ...fields[index], ...patch }
    update({ fields })
  }

  const addField = () => update({ fields: [...(data.fields || []), { key: '', value: '' }] })

  const removeField = (index) =>
    update({ fields: (data.fields || []).filter((_, i) => i !== index) })

  return (
    <aside className="ws-panel flex w-96 shrink-0 flex-col border-l">
      <div className="flex items-start justify-between border-b border-zinc-800 px-4 py-3">
        <div>
          <div className="text-xs font-semibold text-zinc-200">
            {data.label || meta.label}
          </div>
          <div className="text-[10px] text-zinc-500">{meta.label}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-medium ${STATUS_TEXT[status]}`}>
            {status}
          </span>
          <button
            type="button"
            onClick={() => onDelete(node.id)}
            className="rounded border border-rose-900 px-2 py-0.5 text-[10px] text-rose-400 hover:bg-rose-950"
          >
            delete
          </button>
        </div>
      </div>

      <div className="ws-scroll flex-1 space-y-4 overflow-y-auto p-4">
        <Field label="Label">
          <input
            className={inputClass}
            value={data.label || ''}
            onChange={(event) => update({ label: event.target.value })}
            placeholder={meta.label}
          />
        </Field>

        {node.type === 'manualTrigger' ? (
          <Field label="Payload (JSON)" hint="Emitted as the trigger output.">
            <textarea
              className={`${inputClass} h-32 font-mono`}
              value={data.payload ?? ''}
              onChange={(event) => update({ payload: event.target.value })}
            />
          </Field>
        ) : null}

        {node.type === 'code' ? (
          <CodeEditor
            label="Code"
            value={data.code ?? ''}
            onChange={(code) => update({ code })}
            height="240px"
          />
        ) : null}

        {node.type === 'if' ? (
          <CodeEditor
            label="Condition (return truthy/falsy)"
            value={data.code ?? ''}
            onChange={(code) => update({ code })}
            height="150px"
          />
        ) : null}

        {node.type === 'httpRequest' ? (
          <>
            <div className="grid grid-cols-[110px_1fr] gap-2">
              <Field label="Method">
                <select
                  className={inputClass}
                  value={data.method || 'GET'}
                  onChange={(event) => update({ method: event.target.value })}
                >
                  {['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'].map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="URL">
                <input
                  className={inputClass}
                  value={data.url ?? ''}
                  onChange={(event) => update({ url: event.target.value })}
                  placeholder="https://api.example.com/things"
                />
              </Field>
            </div>
            <Field label="Headers (JSON)">
              <textarea
                className={`${inputClass} h-20 font-mono`}
                value={data.headers ?? ''}
                onChange={(event) => update({ headers: event.target.value })}
                placeholder={'{ "Authorization": "Bearer ..." }'}
              />
            </Field>
            <Field label="Body (JSON)">
              <textarea
                className={`${inputClass} h-24 font-mono`}
                value={data.body ?? ''}
                onChange={(event) => update({ body: event.target.value })}
              />
            </Field>
            <Field label="Timeout (ms)">
              <input
                type="number"
                className={inputClass}
                value={data.timeoutMs ?? 10000}
                onChange={(event) => update({ timeoutMs: Number(event.target.value) })}
              />
            </Field>
          </>
        ) : null}

        {node.type === 'delay' ? (
          <Field label="Delay (ms)">
            <input
              type="number"
              className={inputClass}
              value={data.ms ?? 500}
              onChange={(event) => update({ ms: Number(event.target.value) })}
            />
          </Field>
        ) : null}

        {node.type === 'set' ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className={labelClass}>Fields</span>
              <button
                type="button"
                onClick={addField}
                className="rounded border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-300 hover:bg-zinc-800"
              >
                + add
              </button>
            </div>
            {(data.fields || []).map((field, index) => (
              <div key={index} className="space-y-1 rounded-lg border border-zinc-800 p-2">
                <input
                  className={inputClass}
                  value={field.key ?? ''}
                  onChange={(event) => updateField(index, { key: event.target.value })}
                  placeholder="key"
                />
                <div className="flex gap-1">
                  <input
                    className={`${inputClass} font-mono`}
                    value={field.value ?? ''}
                    onChange={(event) => updateField(index, { value: event.target.value })}
                    placeholder='"literal" or input.foo'
                  />
                  <button
                    type="button"
                    onClick={() => removeField(index)}
                    className="rounded border border-zinc-700 px-2 text-[10px] text-zinc-400 hover:bg-zinc-800"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
            <p className="text-[10px] text-zinc-600">
              Values are JavaScript expressions evaluated with the incoming data as
              `input`.
            </p>
          </div>
        ) : null}

        {node.type === 'merge' ? (
          <p className="text-[10px] text-zinc-600">
            Merge combines every active incoming branch. Connect multiple edges into
            its input handles.
          </p>
        ) : null}

        <div className="space-y-2 border-t border-zinc-800 pt-4">
          <div className="flex items-center justify-between">
            <span className={labelClass}>Runtime</span>
            <div className="flex gap-1">
              <TabButton active={tab === 'input'} onClick={() => setTab('input')}>
                Input
              </TabButton>
              <TabButton active={tab === 'output'} onClick={() => setTab('output')}>
                Output
              </TabButton>
              <TabButton active={tab === 'logs'} onClick={() => setTab('logs')}>
                Logs {logs.length > 0 ? `(${logs.length})` : ''}
              </TabButton>
            </div>
          </div>

          {tab === 'input' ? (
            <JsonView value={runtime.input} empty="No input captured yet." />
          ) : null}
          {tab === 'output' ? (
            <JsonView
              value={runtime.output}
              empty={runtime.error || 'No output captured yet.'}
            />
          ) : null}
          {tab === 'logs' ? (
            logs.length === 0 ? (
              <JsonView value={undefined} empty="This node logged nothing." />
            ) : (
              <div className="ws-scroll max-h-60 space-y-1 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950 p-2">
                {logs.map((log, index) => (
                  <div key={index} className="font-mono text-[11px] text-zinc-300">
                    <span className="mr-1 text-zinc-600">[{log.level}]</span>
                    {Array.isArray(log.message)
                      ? log.message
                          .map((part) =>
                            typeof part === 'string' ? part : JSON.stringify(part)
                          )
                          .join(' ')
                      : String(log.message ?? '')}
                  </div>
                ))}
              </div>
            )
          ) : null}
        </div>
      </div>
    </aside>
  )
}
