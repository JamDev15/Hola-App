import { useMemo } from 'react'

function parseField(text, key) {
  const match = text.match(new RegExp(`${key}:\\s*(.+)`))
  return match ? match[1].trim() : null
}

export default function AIRecommendation({ text }) {
  const sections = useMemo(() => {
    if (!text) return {}
    const result = {}
    const headers = ['ROUTING DECISION', 'BATCHING ANALYSIS', 'OPERATIONAL FLAGS', 'RECOMMENDED NEXT STEP']
    let section = null
    let buf = []
    for (const line of text.split('\n')) {
      const t = line.trim()
      if (/^─{5,}/.test(t)) continue
      if (headers.includes(t)) {
        if (section) result[section] = buf.join('\n').trim()
        section = t
        buf = []
      } else {
        buf.push(line)
      }
    }
    if (section) result[section] = buf.join('\n').trim()
    return result
  }, [text])

  const routing  = sections['ROUTING DECISION']      || ''
  const batching = sections['BATCHING ANALYSIS']     || ''
  const flags    = sections['OPERATIONAL FLAGS']      || ''
  const nextStep = sections['RECOMMENDED NEXT STEP'] || ''

  const coPacker        = parseField(routing, 'RECOMMENDED CO-PACKER')
  const tier            = parseField(routing, 'TIER CLASSIFICATION')
  const confidenceFull  = parseField(routing, 'CONFIDENCE')
  const confidenceLevel  = confidenceFull?.split('—')[0]?.trim()
  const confidenceReason = confidenceFull?.split('—')[1]?.trim()
  const rationaleMatch  = routing.match(/RATIONALE:\s*([\s\S]+)/)
  const rationale       = rationaleMatch ? rationaleMatch[1].trim() : ''

  const batchingOpp    = parseField(batching, 'BATCHING OPPORTUNITY')
  const batchingDetail = batching.replace(/BATCHING OPPORTUNITY:.*\n?/, '').trim()

  const flagLines = flags.split('\n')
    .map(l => l.replace(/^[-•*\d.]\s*/, '').trim())
    .filter(Boolean)

  const confidenceStyle = {
    High:   'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    Medium: 'text-amber-400  bg-amber-500/10  border-amber-500/30',
    Low:    'text-red-400    bg-red-500/10    border-red-500/30',
  }[confidenceLevel] || 'text-slate-400 bg-slate-700/50 border-slate-600'

  return (
    <div className="space-y-3">

      {/* Routing Decision */}
      {routing && (
        <div className="rounded-xl border border-slate-700/60 overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-800/80 border-b border-slate-700/60 flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
            </svg>
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-widest">Routing Decision</span>
          </div>
          <div className="p-4 bg-slate-800/30 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              {coPacker && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">Recommended Co-Packer</p>
                  <p className="text-white font-bold text-xl leading-tight">{coPacker}</p>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {tier && (
                  <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/25">
                    Tier {tier}
                  </span>
                )}
                {confidenceLevel && (
                  <span className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${confidenceStyle}`}>
                    {confidenceLevel} Confidence
                  </span>
                )}
              </div>
            </div>
            {confidenceReason && (
              <p className="text-slate-400 text-sm italic border-l-2 border-indigo-500/40 pl-3 leading-relaxed">
                {confidenceReason}
              </p>
            )}
            {rationale && (
              <div className="space-y-1.5">
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Rationale</p>
                <p className="text-slate-300 text-sm leading-relaxed">{rationale}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Batching Analysis */}
      {batching && (
        <div className="rounded-xl border border-slate-700/60 overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-800/80 border-b border-slate-700/60 flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
            </svg>
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-widest">Batching Analysis</span>
          </div>
          <div className="p-4 bg-slate-800/30 space-y-2.5">
            {batchingOpp && (
              <div className="flex items-center gap-2.5">
                <span className="text-sm text-slate-400 font-medium">Batching Opportunity</span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                  batchingOpp.toLowerCase() === 'yes'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-slate-700/60 text-slate-400 border-slate-600'
                }`}>{batchingOpp}</span>
              </div>
            )}
            {batchingDetail && (
              <p className="text-slate-300 text-sm leading-relaxed">{batchingDetail}</p>
            )}
          </div>
        </div>
      )}

      {/* Operational Flags */}
      {flagLines.length > 0 && (
        <div className="rounded-xl border border-amber-500/20 overflow-hidden">
          <div className="px-4 py-2.5 bg-amber-500/5 border-b border-amber-500/20 flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <span className="text-xs font-semibold text-amber-400/80 uppercase tracking-widest">Operational Flags</span>
          </div>
          <div className="p-4 bg-slate-800/30">
            <ul className="space-y-3">
              {flagLines.map((flag, i) => {
                const colonIdx = flag.indexOf(':')
                const bold = colonIdx > 0 ? flag.slice(0, colonIdx) : null
                const rest = colonIdx > 0 ? flag.slice(colonIdx + 1).trim() : flag
                return (
                  <li key={i} className="flex items-start gap-2.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0 mt-1.5" />
                    <span className="text-sm text-slate-300 leading-relaxed">
                      {bold ? <><span className="text-white font-semibold">{bold}:</span> {rest}</> : flag}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      )}

      {/* Recommended Next Step */}
      {nextStep && (
        <div className="rounded-xl bg-indigo-600/10 border border-indigo-500/30 p-4 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-[10px] text-indigo-400 font-semibold uppercase tracking-widest mb-1">Recommended Next Step</p>
            <p className="text-white text-sm leading-relaxed">{nextStep}</p>
          </div>
        </div>
      )}
    </div>
  )
}
