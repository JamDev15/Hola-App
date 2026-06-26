import { useState, useRef, useCallback, useEffect } from 'react'
import { api } from '../api'
import { generateCompliancePDF } from '../utils/generatePDF'

// ── Metadata ─────────────────────────────────────────────────────────────────

const GROUP_META = {
  front:  { label: 'Front Panel',       color: 'text-indigo-400', bg: 'bg-indigo-500/10',  border: 'border-indigo-500/20'  },
  back:   { label: 'Back Panel',        color: 'text-violet-400', bg: 'bg-violet-500/10',  border: 'border-violet-500/20'  },
  claims: { label: 'Claims Compliance', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
}

const STATUS_META = {
  pass:           { label: 'Pass',    icon: '✓', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  fail:           { label: 'Fail',    icon: '✗', cls: 'bg-red-500/10 text-red-400 border-red-500/20'            },
  warning:        { label: 'Warning', icon: '!', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20'      },
  not_applicable: { label: 'N/A',     icon: '—', cls: 'bg-slate-800 text-slate-500 border-slate-700'            },
}

const LOADING_STEPS = [
  'Uploading file to Claude AI…',
  'Detecting panel layout…',
  'Checking front label elements…',
  'Reviewing back panel…',
  'Validating claims compliance…',
  'Generating compliance report…',
]

// ── Small reusable components ─────────────────────────────────────────────────

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
          {counts.pass    > 0 && <span className="text-emerald-400">{counts.pass} passed</span>}
          {counts.fail    > 0 && <span className="text-red-400">{counts.fail} failed</span>}
          {counts.warning > 0 && <span className="text-amber-400">{counts.warning} warnings</span>}
        </div>
      </div>
      <div>{checks.map(c => <CheckRow key={c.id} check={c} />)}</div>
    </div>
  )
}

// ── Upload zone ───────────────────────────────────────────────────────────────

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,application/pdf,.pdf'

function ImageLightbox({ src, name, onClose }) {
  useEffect(() => {
    const handler = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative max-w-6xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <span className="text-slate-300 text-sm truncate">{name}</span>
          <button
            onClick={onClose}
            className="ml-4 flex-shrink-0 w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center transition-colors"
          >
            <svg className="w-4 h-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <img
          src={src}
          alt="Artwork"
          className="w-full h-full object-contain rounded-xl max-h-[82vh]"
        />
      </div>
    </div>
  )
}

function FilePreview({ file, preview, onExpand }) {
  if (!file) return null
  if (file.type === 'application/pdf') {
    return (
      <div className="card flex items-center gap-3 px-4 py-3">
        <div className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        </div>
        <div className="min-w-0">
          <p className="text-slate-200 text-sm font-medium truncate">{file.name}</p>
          <p className="text-slate-500 text-xs">PDF document · {(file.size / 1024).toFixed(0)} KB</p>
        </div>
      </div>
    )
  }
  return (
    <div className="card overflow-hidden">
      <div className="relative group cursor-zoom-in" onClick={() => onExpand?.(preview, file.name)}>
        <img src={preview} alt="Artwork" className="w-full object-contain max-h-44 bg-slate-900" />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900/80 rounded-full p-2">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6" />
            </svg>
          </div>
        </div>
      </div>
      <div className="px-3 py-2 border-t border-slate-800">
        <span className="text-slate-500 text-xs truncate block">{file.name}</span>
      </div>
    </div>
  )
}

function PanelUploadZone({ label, hint, accentBorder, accentBg, dotColor, file, preview, onFile, onRemove, onExpand }) {
  const inputRef = useRef()
  const [dragging, setDragging] = useState(false)

  const handleFile = useCallback((f) => {
    if (!f) return
    const ok = f.type.startsWith('image/') || f.type === 'application/pdf'
    if (ok) onFile(f)
  }, [onFile])

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }, [handleFile])

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${dotColor}`} />
        <span className="text-slate-300 text-sm font-medium">{label}</span>
        {file && (
          <button onClick={onRemove} className="ml-auto text-slate-500 hover:text-red-400 text-xs transition-colors">Remove</button>
        )}
      </div>
      {!file ? (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`rounded-xl border-2 border-dashed p-6 flex flex-col items-center gap-3 cursor-pointer transition-all ${
            dragging ? `${accentBorder} ${accentBg}` : 'border-slate-700 hover:border-slate-600 hover:bg-slate-800/20'
          }`}
        >
          <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center">
            <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-slate-300 text-sm font-medium">{label}</p>
            <p className="text-slate-500 text-xs mt-0.5">{hint || 'JPEG, PNG, WEBP or PDF — drag or click'}</p>
          </div>
          <input ref={inputRef} type="file" accept={ACCEPT} className="hidden" onChange={e => handleFile(e.target.files[0])} />
        </div>
      ) : (
        <FilePreview file={file} preview={preview} onExpand={onExpand} />
      )}
    </div>
  )
}

// ── SharePoint URL input ──────────────────────────────────────────────────────

function SharePointInput({ label, dotColor, value, onChange }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${dotColor}`} />
        <span className="text-slate-300 text-sm font-medium">{label}</span>
      </div>
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2">
          <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
          </svg>
        </div>
        <input
          type="url"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="Paste SharePoint sharing link…"
          className="w-full bg-slate-800/60 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-slate-200 text-sm placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
        />
        {value && (
          <button onClick={() => onChange('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      <p className="text-slate-600 text-xs pl-1">Open the file in SharePoint → Share → Copy link</p>
    </div>
  )
}

// ── Loading card ──────────────────────────────────────────────────────────────

function LoadingCard({ step, round }) {
  const isRevision = round > 1
  return (
    <div className="card p-6 sm:p-10 flex flex-col items-center gap-4 text-center">
      <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 flex items-center justify-center">
        <svg className="animate-spin w-7 h-7 text-indigo-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
      <div>
        <p className="text-white font-medium">{isRevision ? `Expert Revision — Round ${round}…` : 'Analyzing artwork…'}</p>
        <p className="text-slate-500 text-xs mt-1">{isRevision ? 'Senior AI expert re-examining all findings…' : 'Large files may take 20–30 seconds'}</p>
      </div>
      <div className="w-full space-y-2 text-left">
        {LOADING_STEPS.map((s, i) => (
          <div key={i} className={`flex items-center gap-2 text-xs transition-colors ${i === step ? 'text-indigo-300' : i < step ? 'text-slate-600' : 'text-slate-700'}`}>
            {i < step ? (
              <svg className="w-3 h-3 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            ) : i === step ? (
              <svg className="animate-spin w-3 h-3 text-indigo-400 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <span className="w-3 h-3 flex-shrink-0" />
            )}
            {s}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Results card ──────────────────────────────────────────────────────────────

function ResultsCard({ result, grouped, passCount, failCount, warnCount, round }) {
  return (
    <>
      <div className={`card p-4 sm:p-5 flex items-start gap-4 border ${result.overall_pass ? 'border-emerald-500/30' : 'border-red-500/30'}`}>
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
            <span className="text-slate-600 text-xs border border-slate-700 px-1.5 py-0.5 rounded capitalize">
              {result.panel_detected} panel
            </span>
            {round > 1 && (
              <span className="text-xs bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-1.5 py-0.5 rounded">
                Round {round}
              </span>
            )}
          </div>
          <p className="text-slate-400 text-sm mt-1">{result.summary}</p>
          <div className="flex items-center gap-3 mt-2 text-xs">
            <span className="text-emerald-400">{passCount} passed</span>
            {failCount > 0 && <span className="text-red-400">{failCount} failed</span>}
            {warnCount > 0 && <span className="text-amber-400">{warnCount} warnings</span>}
          </div>
        </div>
      </div>

      {result.dropbox_uploads?.length > 0 && (
        <div className="card px-4 py-3 flex items-start gap-3 border border-blue-500/20 bg-blue-500/5">
          <svg className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L6 6.5l6 4.5 6-4.5L12 2zm-6 9.5L0 16l6 4.5 6-4.5-6-4.5zm12 0l-6 4.5 6 4.5 6-4.5-6-4.5zM6 21.5L12 26l6-4.5-6-4.5-6 4.5z"/>
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-blue-300 text-xs font-semibold mb-1">Saved to Dropbox</p>
            <div className="space-y-0.5">
              {result.dropbox_uploads.map((u, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500 capitalize">{u.panel}:</span>
                  {u.url ? (
                    <a href={u.url} target="_blank" rel="noopener noreferrer"
                       className="text-blue-400 hover:text-blue-300 truncate underline underline-offset-2">
                      {u.name}
                    </a>
                  ) : (
                    <span className="text-slate-400 truncate">{u.name}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {Object.entries(grouped).map(([g, checks]) => (
          <CheckGroup key={g} group={g} checks={checks} />
        ))}
      </div>
    </>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Proofing() {
  const [sourceMode, setSourceMode] = useState('upload')
  const [panelMode,  setPanelMode]  = useState('separate')

  const [frontFile,    setFrontFile]    = useState(null)
  const [frontPreview, setFrontPreview] = useState(null)
  const [backFile,     setBackFile]     = useState(null)
  const [backPreview,  setBackPreview]  = useState(null)
  const [combinedFile,    setCombinedFile]    = useState(null)
  const [combinedPreview, setCombinedPreview] = useState(null)

  const [frontUrl,    setFrontUrl]    = useState('')
  const [backUrl,     setBackUrl]     = useState('')
  const [combinedUrl, setCombinedUrl] = useState('')

  const [loading,        setLoading]       = useState(false)
  const [loadingStep,    setLoadingStep]   = useState(0)
  const [result,         setResult]        = useState(null)
  const [error,          setError]         = useState('')
  const [lightbox,       setLightbox]      = useState(null)
  const [analysisRound,  setAnalysisRound] = useState(0)

  // Cycle through loading steps while analyzing
  useEffect(() => {
    if (!loading) { setLoadingStep(0); return }
    const id = setInterval(() => setLoadingStep(s => Math.min(s + 1, LOADING_STEPS.length - 1)), 4000)
    return () => clearInterval(id)
  }, [loading])

  const readPreview = (f, setPreview) => {
    if (f.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = e => setPreview(e.target.result)
      reader.readAsDataURL(f)
    } else {
      setPreview(null)
    }
  }

  const makeThumbnail = (dataUrl) => new Promise(resolve => {
    if (!dataUrl) return resolve(null)
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const scale = Math.min(200 / img.width, 120 / img.height, 1)
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', 0.65))
    }
    img.onerror = () => resolve(null)
    img.src = dataUrl
  })

  const saveToSession = async (data, round) => {
    try {
      const preview = combinedPreview || frontPreview || backPreview || null
      const thumbnail = await makeThumbnail(preview)
      const fileName = combinedFile?.name || frontFile?.name || backFile?.name || null
      sessionStorage.setItem('lastProof', JSON.stringify({ result: data, round, fileName, thumbnail, timestamp: Date.now() }))
    } catch {}
  }

  const handleFrontFile    = useCallback((f) => { setFrontFile(f);    setResult(null); setError(''); readPreview(f, setFrontPreview)    }, [])
  const handleBackFile     = useCallback((f) => { setBackFile(f);     setResult(null); setError(''); readPreview(f, setBackPreview)     }, [])
  const handleCombinedFile = useCallback((f) => { setCombinedFile(f); setResult(null); setError(''); readPreview(f, setCombinedPreview) }, [])

  const switchMode      = (m) => { setSourceMode(m); setResult(null); setError('') }
  const switchPanelMode = (m) => { setPanelMode(m);  setResult(null); setError('') }

  const hasInput = sourceMode === 'upload'
    ? (panelMode === 'separate' ? (frontFile || backFile) : combinedFile)
    : panelMode === 'separate'
    ? (frontUrl.trim() || backUrl.trim())
    : combinedUrl.trim()

  const handleAnalyze = async () => {
    if (!hasInput) return
    setLoading(true); setError(''); setResult(null); setAnalysisRound(0)
    try {
      let data
      if (sourceMode === 'sharepoint') {
        data = panelMode === 'combined'
          ? await api.proofFromSharePoint({ combinedUrl: combinedUrl.trim() })
          : await api.proofFromSharePoint({ frontUrl: frontUrl.trim(), backUrl: backUrl.trim() })
      } else if (panelMode === 'combined') {
        data = await api.proof({ combinedFile })
      } else {
        data = await api.proof({ frontFile, backFile })
      }
      setResult(data)
      setAnalysisRound(1)
      saveToSession(data, 1)
    } catch (err) {
      setError(err.message || 'Analysis failed.')
    } finally {
      setLoading(false)
    }
  }

  const handleRevise = async () => {
    if (!result || sourceMode === 'sharepoint') return
    const nextRound = analysisRound + 1
    setLoading(true); setError('')
    try {
      let data
      if (panelMode === 'combined') {
        data = await api.reviseProof({ combinedFile, previousFindings: result, round: nextRound })
      } else {
        data = await api.reviseProof({ frontFile, backFile, previousFindings: result, round: nextRound })
      }
      setResult(data)
      setAnalysisRound(nextRound)
      saveToSession(data, nextRound)
    } catch (err) {
      setError(err.message || 'Revision failed.')
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setFrontFile(null);    setFrontPreview(null)
    setBackFile(null);     setBackPreview(null)
    setCombinedFile(null); setCombinedPreview(null)
    setFrontUrl('');       setBackUrl('');     setCombinedUrl('')
    setResult(null);       setError('');       setAnalysisRound(0)
  }

  const handleExportPDF = () => {
    if (!result) return
    let frontName, backName
    if (sourceMode === 'sharepoint') {
      if (panelMode === 'combined') { frontName = combinedUrl || undefined }
      else { frontName = frontUrl || undefined; backName = backUrl || undefined }
    } else if (panelMode === 'combined') {
      frontName = combinedFile?.name
    } else {
      frontName = frontFile?.name; backName = backFile?.name
    }
    generateCompliancePDF(result, { frontName, backName })
  }

  const grouped = result?.checks
    ? ['front', 'back', 'claims'].reduce((acc, g) => {
        const items = result.checks.filter(c => c.group === g)
        if (items.length) acc[g] = items
        return acc
      }, {})
    : {}

  const passCount = result?.checks?.filter(c => c.status === 'pass').length    || 0
  const failCount = result?.checks?.filter(c => c.status === 'fail').length    || 0
  const warnCount = result?.checks?.filter(c => c.status === 'warning').length || 0

  const panelLabel = panelMode === 'combined' ? '(Combined)'
    : sourceMode === 'sharepoint'
    ? (frontUrl && backUrl ? '(Both Panels)' : frontUrl ? '(Front Panel)' : backUrl ? '(Back Panel)' : '')
    : (frontFile && backFile ? '(Both Panels)' : frontFile ? '(Front Panel)' : backFile ? '(Back Panel)' : '')

  return (
    <div className="max-w-4xl mx-auto space-y-6 px-4 sm:px-0">
      {lightbox && (
        <ImageLightbox src={lightbox.src} name={lightbox.name} onClose={() => setLightbox(null)} />
      )}
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Artwork Proofing</h1>
        <p className="text-slate-400 text-sm mt-1">Upload packaging artwork or import from SharePoint to check FDA compliance and Halo Private Label requirements.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 items-start">
        {/* ── Left column: upload controls ── */}
        <div className="space-y-4">

          {/* Source mode toggle */}
          <div className="card p-1 flex gap-1">
            <button
              onClick={() => switchMode('upload')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                sourceMode === 'upload' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              Upload File
            </button>
            <button
              onClick={() => switchMode('sharepoint')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                sourceMode === 'sharepoint' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" />
              </svg>
              SharePoint
            </button>
          </div>

          {/* Input area */}
          <div className="card p-4 sm:p-5 space-y-5">
            <div className="flex items-center justify-between">
              <p className="text-slate-300 text-sm font-semibold">
                {sourceMode === 'upload' ? 'Upload Artwork Panels' : 'Import from SharePoint'}
              </p>
              <span className="text-slate-600 text-xs">Upload one or both panels</span>
            </div>

            {/* Panel mode sub-toggle */}
            <div className="flex gap-1 bg-slate-800/50 rounded-lg p-1">
              <button
                onClick={() => switchPanelMode('separate')}
                className={`flex-1 text-xs px-3 py-1.5 rounded-md font-medium transition-all ${
                  panelMode === 'separate' ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                Separate (Front &amp; Back)
              </button>
              <button
                onClick={() => switchPanelMode('combined')}
                className={`flex-1 text-xs px-3 py-1.5 rounded-md font-medium transition-all ${
                  panelMode === 'combined' ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                Combined (one file)
              </button>
            </div>

            {sourceMode === 'upload' ? (
              panelMode === 'separate' ? (
                <>
                  <PanelUploadZone
                    label="Front Panel" dotColor="bg-indigo-400"
                    accentBorder="border-indigo-500" accentBg="bg-indigo-500/5"
                    file={frontFile} preview={frontPreview}
                    onFile={handleFrontFile}
                    onRemove={() => { setFrontFile(null); setFrontPreview(null) }}
                    onExpand={(src, name) => setLightbox({ src, name })}
                  />
                  <div className="border-t border-slate-800/60" />
                  <PanelUploadZone
                    label="Back Panel" dotColor="bg-violet-400"
                    accentBorder="border-violet-500" accentBg="bg-violet-500/5"
                    file={backFile} preview={backPreview}
                    onFile={handleBackFile}
                    onRemove={() => { setBackFile(null); setBackPreview(null) }}
                    onExpand={(src, name) => setLightbox({ src, name })}
                  />
                </>
              ) : (
                <PanelUploadZone
                  label="Front + Back Panel"
                  hint="Single image or PDF containing both panels — drag or click"
                  dotColor="bg-indigo-400" accentBorder="border-indigo-500" accentBg="bg-indigo-500/5"
                  file={combinedFile} preview={combinedPreview}
                  onFile={handleCombinedFile}
                  onRemove={() => { setCombinedFile(null); setCombinedPreview(null) }}
                  onExpand={(src, name) => setLightbox({ src, name })}
                />
              )
            ) : (
              <>
                <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-lg px-3 py-2 text-xs text-indigo-300">
                  Paste SharePoint sharing link(s). Files must be shared or your Azure app must have access.
                </div>
                {panelMode === 'separate' ? (
                  <>
                    <SharePointInput label="Front Panel" dotColor="bg-indigo-400" value={frontUrl} onChange={setFrontUrl} />
                    <div className="border-t border-slate-800/60" />
                    <SharePointInput label="Back Panel"  dotColor="bg-violet-400"  value={backUrl}  onChange={setBackUrl}  />
                  </>
                ) : (
                  <SharePointInput label="Front + Back Panel" dotColor="bg-indigo-400" value={combinedUrl} onChange={setCombinedUrl} />
                )}
              </>
            )}
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm break-words">{error}</div>
          )}

          {hasInput && !result && (
            <button onClick={handleAnalyze} disabled={loading} className="btn-primary w-full justify-center">
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Analyzing with Claude AI…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                  Run Compliance Check {panelLabel}
                </>
              )}
            </button>
          )}

          {result && (
            <div className="flex gap-2">
              <button onClick={reset} className="btn-secondary flex-1 justify-center text-sm">Proof Another</button>
              <button
                onClick={handleExportPDF}
                className="btn-secondary flex items-center gap-2 px-4 text-sm text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/10"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Export PDF
              </button>
            </div>
          )}

          {/* ── Revision button ── */}
          {result && !loading && analysisRound > 0 && analysisRound < 3 && sourceMode === 'upload' && (
            <div className="card p-4 border border-indigo-500/20 bg-indigo-500/5 space-y-3">
              <div className="flex items-center gap-2">
                {[1, 2, 3].map(r => (
                  <div key={r} className={`w-2 h-2 rounded-full transition-colors ${r <= analysisRound ? 'bg-indigo-400' : 'bg-slate-700'}`} />
                ))}
                <span className="text-slate-500 text-xs ml-1">Round {analysisRound} of 3</span>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <p className="text-indigo-300 text-sm font-semibold">
                    {warnCount > 0 ? `${warnCount} warning${warnCount > 1 ? 's' : ''} — refine for certainty` : 'Run deeper expert review'}
                  </p>
                  <p className="text-slate-500 text-xs mt-0.5">
                    AI re-examines as a senior artwork expert, resolving all uncertainty
                  </p>
                </div>
                <button onClick={handleRevise} disabled={loading} className="btn-primary text-sm whitespace-nowrap flex-shrink-0">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                  {analysisRound === 1 ? 'Expert Revision' : 'Final Check'}
                </button>
              </div>
            </div>
          )}

          {result && !loading && analysisRound === 3 && (
            <div className="card px-4 py-3 flex items-center gap-2 border border-emerald-500/20 bg-emerald-500/5">
              <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-emerald-400 text-xs font-semibold">Final expert analysis complete — all 3 rounds done</p>
            </div>
          )}

          {/* ── Mobile-only results (shown inline, below button) ── */}
          {(loading || result) && (
            <div className="lg:hidden space-y-4">
              {loading && <LoadingCard step={loadingStep} round={analysisRound} />}
              {result && !loading && (
                <ResultsCard
                  result={result} grouped={grouped}
                  passCount={passCount} failCount={failCount} warnCount={warnCount}
                  round={analysisRound}
                />
              )}
            </div>
          )}

          {/* What gets checked */}
          <div className="card p-4 space-y-3">
            <h3 className="text-slate-300 text-sm font-semibold">What gets checked</h3>
            {Object.entries(GROUP_META).map(([g, m]) => (
              <div key={g} className="flex items-start gap-2">
                <span className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${m.color.replace('text-', 'bg-')}`} />
                <div>
                  <span className={`text-xs font-medium ${m.color}`}>{m.label}</span>
                  <span className="text-slate-600 text-xs ml-2">
                    {g === 'front'  && '— Identity, weight, flavor name & statement'}
                    {g === 'back'   && '— SFP, UPC, directions, Manufactured By, origin'}
                    {g === 'claims' && '— No medical claims, no unauthorized trademarks'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right column: results (desktop only) ── */}
        <div className="hidden lg:block space-y-4">
          {loading && <LoadingCard step={loadingStep} round={analysisRound} />}
          {result && !loading && (
            <ResultsCard
              result={result} grouped={grouped}
              passCount={passCount} failCount={failCount} warnCount={warnCount}
              round={analysisRound}
            />
          )}
          {!result && !loading && (
            <div className="card p-10 flex flex-col items-center gap-3 text-center text-slate-500">
              <svg className="w-10 h-10 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
              <p className="text-sm">Upload artwork or paste a SharePoint link to see compliance results</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
