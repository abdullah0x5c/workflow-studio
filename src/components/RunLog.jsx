'use client'

const EVENT_COLOR = {
  'run:started': 'text-indigo-300',
  'run:finished': 'text-emerald-400',
  'run:failed': 'text-rose-400',
  'node:started': 'text-zinc-300',
  'node:finished': 'text-emerald-300',
  'node:failed': 'text-rose-400',
  'node:skipped': 'text-zinc-500',
}

function formatTime(value) {
  try {
    return new Date(value).toLocaleTimeString([], {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return ''
  }
}

export default function RunLog({ events = [], className = '' }) {
  return (
    <div className={`ws-panel flex flex-col rounded-xl border ${className}`}>
      <header className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
          Run log
        </span>
        <span className="text-[10px] text-zinc-600">{events.length} events</span>
      </header>
      <div className="ws-scroll max-h-40 min-h-[64px] overflow-y-auto px-3 py-2">
        {events.length === 0 ? (
          <p className="text-[11px] text-zinc-600">
            Press Run to execute the workflow and watch data flow through each node.
          </p>
        ) : (
          events.map((entry, index) => (
            <div key={index} className="flex items-baseline gap-2 py-0.5">
              <span className="shrink-0 font-mono text-[10px] text-zinc-600">
                {formatTime(entry.at)}
              </span>
              <span
                className={`shrink-0 font-mono text-[10px] ${
                  EVENT_COLOR[entry.event] || 'text-zinc-400'
                }`}
              >
                {entry.event}
              </span>
              <span className="truncate text-[11px] text-zinc-400">
                {entry.summary}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
