import { useState, useRef, useCallback } from 'react'
import { api } from '../api'

const GROUP_META = {
  front: { label: 'Front Panel', color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
  back: { label: 'Back Panel', color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
  claims: { label: 'Claims Compliance', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
}

const STATUS_META = {
  pass: { label: 'Pass', icon: '✓', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  fail: { label: 'Fail', icon: '✗', cls: 'bg-red-500/10 text-red-400 border-red-500/20' },
  warning: { label: 'Warning', icon: '!', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  not_applicable: { label: 'N/A', icon: '—', cls: 'bg-slate-800 text-slate-500 border-slate-700' },
}

function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META.not_applicable
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${m.cls}`}>
      <span>{m.icon}</span> {m.label}
    </span>
  )
}

function CheckRow({ check }) {
  const [open, setOpen] = useState(check.status === 'fail' || check.status === 'warning')
  return (
    <div className="border-b border-slate-800/60 last:border-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-800/20 transition-colors text-left"
      >
        <StatusBadge status={check.status} />
        <span className="flex-1 text-slate-200 text-sm">{check.label}</span>
        <svg className={`w-4 h-4 text-slate-500 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {open && (
        <div className="px-4 pb-3 space-y-2 text-sm">
          <p className="text-slate-400">{check.finding}</p>
          {check.recommendation && (
            <div className="flex items-start gap-2 bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2">
              <svg className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
              </svg>
              <p className="text-amber-300 text-xs leading-relaxed">{check.recommendation}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function CheckGroup({ group, checks }) {
  const meta = GROUP_META[group]
  const counts = checks.reduce((acc, c) => { acc[c.status] = (acc[c.status] || 0) + 1; return acc }, {})
  return (
    <div className={`rounded-xl border ${meta.border} overflow-hidden`}>
      <div className={`flex items-center justify-between px-4 py-3 ${meta.bg} border-b ${meta.border}`}>
        <h3 className={`font-semibold text-sm ${meta.color}`}>{meta.label}</h3>
        <div className="flex items-center gap-2 text-xs">
          {counts.pass > 0 && <span className="text-emerald-400">{counts.pass} passed</span>}
          {counts.fail > 0 && <span className="text-red-400">{counts.fail} failed</span>}
          {counts.warning > 0 && <span className="text-amber-400">{counts.warning} warnings</span>}
        </div>
      </div>
      <div>
        {checks.map(c => <CheckRow key={c.id} check={c} />)}
      </div>
    </div>
  )
}

export default function Proofing() {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef()

  const handleFile = useCallback((f) => {
    if (!f || !f.type.startsWith('image/')) { setError('Please upload an image file.'); return }
    setFile(f)
    setResult(null)
    setError('')
    const reader = new FileReader()
    reader.onload = e => setPreview(e.target.result)
    reader.readAsDataURL(f)
  }, [])

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }, [handleFile])

  const handleAnalyze = async () => {
    if (!file) return
    setLoading(true); setError(''); setResult(null)
    try {
      const data = await api.proof(file)
      setResult(data)
    } catch (err) {
      setError(err.message || 'Analysis failed. Make sure your ANTHROPIC_API_KEY is set.')
    } finally {
      setLoading(false)
    }
  }

  const reset = () => { setFile(null); setPreview(null); setResult(null); setError('') }

  const grouped = result?.checks ? ['front', 'back', 'claims'].reduce((acc, g) => {
    const items = result.checks.filter(c => c.group === g)
    if (items.length) acc[g] = items
    return acc
  }, {}) : {}

  const passCount = result?.checks?.filter(c => c.status === 'pass').length || 0
  const failCount = result?.checks?.filter(c => c.status === 'fail').length || 0
  const warnCount = result?.checks?.filter(c => c.status === 'warning').length || 0

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Artwork Proofing</h1>
        <p className="text-slate-400 text-sm mt-1">Upload packaging artwork to check FDA compliance and Halo Private Label requirements.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 items-start">
        {/* Left: Upload */}
        <div className="space-y-4">
          {!preview ? (
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              className={`card p-10 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all border-2 border-dashed ${
                dragging ? 'border-indigo-500 bg-indigo-500/5' : 'border-slate-700 hover:border-slate-600 hover:bg-slate-800/20'
              }`}
            >
              <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center">
                <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-white font-medium">Drop artwork here</p>
                <p className="text-slate-500 text-sm mt-1">or click to browse — JPEG, PNG, WEBP</p>
              </div>
              <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={e => handleFile(e.target.files[0])} />
            </div>
          ) : (
            <div className="card overflow-hidden">
              <img src={preview} alt="Uploaded artwork" className="w-full object-contain max-h-96 bg-slate-900" />
              <div className="px-4 py-3 flex items-center justify-between border-t border-slate-800">
                <span className="text-slate-400 text-sm truncate">{file?.name}</span>
                <button onClick={reset} className="text-slate-500 hover:text-red-400 text-xs transition-colors">Remove</button>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm">{error}</div>
          )}

          {file && !result && (
            <button
              onClick={handleAnalyze}
              disabled={loading}
              className="btn-primary w-full justify-center"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Analyzing artwork with AI...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                  Run Compliance Check
                </>
              )}
            </button>
          )}

          {result && (
            <button onClick={reset} className="btn-secondary w-full justify-center text-sm">
              Proof Another Artwork
            </button>
          )}

          {/* Checklist reference */}
          <div className="card p-4 space-y-3">
            <h3 className="text-slate-300 text-sm font-semibold">What gets checked</h3>
            {Object.entries(GROUP_META).map(([g, m]) => (
              <div key={g} className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${m.color.replace('text-', 'bg-')}`} />
                <span className={`text-xs font-medium ${m.color}`}>{m.label}</span>
                <span className="text-slate-600 text-xs">
                  {g === 'front' && '— Identity, weight, flavor name & statement'}
                  {g === 'back' && '— SFP, UPC, directions, Manufactured By, origin'}
                  {g === 'claims' && '— No medical claims, no unauthorized trademarks'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Results */}
        <div className="space-y-4">
          {loading && (
            <div className="card p-10 flex flex-col items-center gap-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 flex items-center justify-center">
                <svg className="animate-spin w-7 h-7 text-indigo-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
              <div>
                <p className="text-white font-medium">Analyzing artwork...</p>
                <p className="text-slate-500 text-sm mt-1">Claude is checking all 16 compliance requirements</p>
              </div>
              <div className="w-full space-y-2 text-left">
                {['Detecting panels...', 'Checking front label elements...', 'Reviewing back panel...', 'Validating claims compliance...'].map((step, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-slate-500">
                    <svg className="animate-spin w-3 h-3 text-indigo-400 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    {step}
                  </div>
                ))}
              </div>
            </div>
          )}

          {result && !loading && (
            <>
              {/* Overall result */}
              <div className={`card p-5 flex items-start gap-4 border ${result.overall_pass ? 'border-emerald-500/30' : 'border-red-500/30'}`}>
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${result.overall_pass ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                  {result.overall_pass ? (
                    <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`font-semibold ${result.overall_pass ? 'text-emerald-400' : 'text-red-400'}`}>
                      {result.overall_pass ? 'Artwork Approved' : 'Revisions Required'}
                    </p>
                    <span className="text-slate-600 text-xs border border-slate-700 px-1.5 py-0.5 rounded capitalize">{result.panel_detected} panel</span>
                  </div>
                  <p className="text-slate-400 text-sm mt-1">{result.summary}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs">
                    <span className="text-emerald-400">{passCount} passed</span>
                    {failCount > 0 && <span className="text-red-400">{failCount} failed</span>}
                    {warnCount > 0 && <span className="text-amber-400">{warnCount} warnings</span>}
                  </div>
                </div>
              </div>

              {/* Grouped checks */}
              <div className="space-y-3">
                {Object.entries(grouped).map(([g, checks]) => (
                  <CheckGroup key={g} group={g} checks={checks} />
                ))}
              </div>
            </>
          )}

          {!result && !loading && (
            <div className="card p-10 flex flex-col items-center gap-3 text-center text-slate-500">
              <svg className="w-10 h-10 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
              <p className="text-sm">Upload artwork to see compliance results here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
