'use client'

const STATUS_DOT = {
  running: 'bg-indigo-400 animate-pulse',
  success: 'bg-emerald-400',
  failed: 'bg-rose-500',
}

function formatTime(value) {
  if (!value) return ''
  try {
    return new Date(value).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return ''
  }
}

export default function RunHistory({ runs = [], onSelect, activeRunId }) {
  return (
    <div className="ws-panel flex flex-col rounded-xl border">
      <header className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
          History
        </span>
        <span className="text-[10px] text-zinc-600">{runs.length}</span>
      </header>
      <div className="ws-scroll max-h-40 overflow-y-auto px-2 py-2">
        {runs.length === 0 ? (
          <p className="px-1 text-[11px] text-zinc-600">No runs yet.</p>
        ) : (
          runs.map((run) => {
            const id = run._id || run.id
            return (
              <button
                key={id}
                type="button"
                onClick={() => onSelect(id)}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition hover:bg-zinc-800 ${
                  activeRunId === id ? 'bg-zinc-800' : ''
                }`}
              >
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    STATUS_DOT[run.status] || 'bg-zinc-600'
                  }`}
                />
                <span className="flex-1 truncate text-[11px] text-zinc-300">
                  {formatTime(run.createdAt || run.startedAt)}
                </span>
                <span className="text-[10px] text-zinc-600">
                  {run.durationMs != null ? `${run.durationMs}ms` : run.status}
                </span>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
