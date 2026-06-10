import { useState, useEffect } from 'react'
import { api } from '../api'
import Modal from '../components/Modal'

const EMPTY = { name: '', location: '', specialties: '', capacity: '', currentLoad: '0', notes: '', isActive: true }

function CapacityBar({ capacity, currentLoad }) {
  const pct = capacity > 0 ? Math.min(100, Math.round((currentLoad / capacity) * 100)) : 0
  const color = pct >= 85 ? 'bg-red-500' : pct >= 60 ? 'bg-amber-500' : 'bg-emerald-500'
  const textColor = pct >= 85 ? 'text-red-400' : pct >= 60 ? 'text-amber-400' : 'text-emerald-400'
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-slate-400">
        <span>{currentLoad?.toLocaleString()} / {capacity?.toLocaleString()} units</span>
        <span className={textColor}>{pct}% full</span>
      </div>
      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function CoPackers() {
  const [copackers, setCopackers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [expandedNotes, setExpandedNotes] = useState(null)

  useEffect(() => {
    api.copackers.list()
      .then(data => setCopackers(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false))
  }, [])

  const openNew = () => { setEditing(null); setForm(EMPTY); setError(''); setShowModal(true) }
  const openEdit = (cp) => {
    setEditing(cp)
    setForm({ ...cp, specialties: cp.specialties?.join(', ') || '', capacity: String(cp.capacity), currentLoad: String(cp.currentLoad) })
    setError(''); setShowModal(true)
  }
  const closeModal = () => { setShowModal(false); setEditing(null) }

  const set = f => e => setForm(prev => ({ ...prev, [f]: e.target.value }))

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      const payload = {
        ...form,
        specialties: form.specialties.split(',').map(s => s.trim()).filter(Boolean),
        capacity: Number(form.capacity),
        currentLoad: Number(form.currentLoad) || 0,
      }
      const data = editing
        ? await api.copackers.update(editing._id, payload)
        : await api.copackers.create(payload)
      setCopackers(prev => editing
        ? prev.map(cp => cp._id === editing._id ? data : cp)
        : [...prev, data])
      closeModal()
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete "${name}"?`)) return
    await api.copackers.delete(id)
    setCopackers(prev => prev.filter(cp => cp._id !== id))
  }

  const toggleActive = async (cp) => {
    const data = await api.copackers.update(cp._id, { isActive: !cp.isActive })
    setCopackers(prev => prev.map(c => c._id === cp._id ? data : c))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">Co-Packers</h1>
          <p className="text-slate-400 text-sm mt-1">Manage manufacturing partners. Notes are fed directly into AI recommendations.</p>
        </div>
        <button onClick={openNew} className="btn-primary text-sm">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Co-Packer
        </button>
      </div>

      {/* Modal */}
      {showModal && (
        <Modal title={editing ? `Edit: ${editing.name}` : 'Add Co-Packer'} onClose={closeModal}>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div><label className="label">Name *</label><input className="input" placeholder="NutraCo Manufacturing" value={form.name} onChange={set('name')} required /></div>
              <div><label className="label">Location *</label><input className="input" placeholder="Salt Lake City, UT" value={form.location} onChange={set('location')} required /></div>
              <div><label className="label">Total Capacity (units) *</label><input type="number" className="input" placeholder="500000" min={0} value={form.capacity} onChange={set('capacity')} required /></div>
              <div><label className="label">Current Load (units)</label><input type="number" className="input" placeholder="0" min={0} value={form.currentLoad} onChange={set('currentLoad')} /></div>
            </div>
            <div>
              <label className="label">Specialties</label>
              <input className="input" placeholder="softgels, capsules, GMP certified (comma-separated)" value={form.specialties} onChange={set('specialties')} />
            </div>
            <div>
              <label className="label">Notes / Capabilities</label>
              <textarea className="input resize-none" rows={5} placeholder="Equipment, lead times, MOQs, certifications... fed directly into AI" value={form.notes} onChange={set('notes')} />
              <p className="text-slate-500 text-xs mt-1">This text is included verbatim in AI analysis — be detailed.</p>
            </div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setForm(prev => ({ ...prev, isActive: !prev.isActive }))}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.isActive ? 'bg-indigo-600' : 'bg-slate-700'}`}>
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${form.isActive ? 'translate-x-4' : 'translate-x-1'}`} />
              </button>
              <label className="text-sm text-slate-300">Active (included in AI routing)</label>
            </div>
            {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm">{error}</div>}
            <div className="flex justify-end gap-3 pt-1">
              <button type="button" onClick={closeModal} className="btn-secondary text-sm">Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary text-sm">{saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Co-Packer'}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Cards */}
      {loading ? (
        <div className="flex items-center justify-center gap-3 py-20 text-slate-400">
          <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading...
        </div>
      ) : copackers.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-slate-400">No co-packers yet.</p>
          <button onClick={openNew} className="btn-primary mt-4 text-sm">Add Your First Co-Packer</button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {copackers.map(cp => (
            <div key={cp._id} className={`card p-5 space-y-4 ${!cp.isActive ? 'opacity-50' : ''}`}>
              {/* Card header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-white font-semibold truncate">{cp.name}</h3>
                    {!cp.isActive && <span className="text-xs text-slate-500 border border-slate-700 px-1.5 py-0.5 rounded flex-shrink-0">Inactive</span>}
                  </div>
                  <p className="text-slate-400 text-sm mt-0.5 flex items-center gap-1">
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                    </svg>
                    {cp.location}
                  </p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => openEdit(cp)} className="btn-ghost"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg></button>
                  <button onClick={() => handleDelete(cp._id, cp.name)} className="btn-ghost text-red-400 hover:text-red-300"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg></button>
                </div>
              </div>

              <CapacityBar capacity={cp.capacity} currentLoad={cp.currentLoad} />

              {cp.specialties?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {cp.specialties.map(s => (
                    <span key={s} className="bg-slate-800 text-slate-300 border border-slate-700 text-xs px-2 py-0.5 rounded-full">{s}</span>
                  ))}
                </div>
              )}

              {cp.notes && (
                <div>
                  <button onClick={() => setExpandedNotes(expandedNotes === cp._id ? null : cp._id)}
                    className="text-indigo-400 text-xs flex items-center gap-1 hover:text-indigo-300 transition-colors">
                    <svg className={`w-3.5 h-3.5 transition-transform ${expandedNotes === cp._id ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                    {expandedNotes === cp._id ? 'Hide' : 'View'} capability notes
                  </button>
                  {expandedNotes === cp._id && (
                    <div className="mt-2 bg-slate-800/50 rounded-lg p-3">
                      <pre className="text-slate-300 text-xs whitespace-pre-wrap font-sans leading-relaxed">{cp.notes}</pre>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                <span className="text-slate-500 text-xs">Active in AI routing</span>
                <button onClick={() => toggleActive(cp)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${cp.isActive ? 'bg-indigo-600' : 'bg-slate-700'}`}>
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${cp.isActive ? 'translate-x-4' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
