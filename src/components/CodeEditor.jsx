'use client'

import { useMemo } from 'react'
import dynamic from 'next/dynamic'
import { javascript } from '@codemirror/lang-javascript'

const CodeMirror = dynamic(() => import('@uiw/react-codemirror'), {
  ssr: false,
  loading: () => (
    <div className="flex h-40 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950 text-xs text-zinc-500">
      Loading editor...
    </div>
  ),
})

export default function CodeEditor({
  value = '',
  onChange,
  height = '200px',
  readOnly = false,
  label,
}) {
  const extensions = useMemo(() => [javascript()], [])

  return (
    <div className="space-y-1">
      {label ? (
        <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
          {label}
        </div>
      ) : null}
      <div className="overflow-hidden rounded-lg border border-zinc-800">
        <CodeMirror
          value={value ?? ''}
          height={height}
          theme="dark"
          extensions={extensions}
          readOnly={readOnly}
          onChange={(next) => onChange?.(next)}
          basicSetup={{
            lineNumbers: true,
            foldGutter: false,
            highlightActiveLine: true,
            autocompletion: true,
            tabSize: 2,
          }}
        />
      </div>
    </div>
  )
}
