import { useState, useEffect } from 'react'
import { api } from '../api'
import Modal from '../components/Modal'

const EMPTY_FORM = { name: '', description: '', specialRequirements: '', skus: [{ name: '', description: '' }] }

export default function Formulas() {
  const [formulas, setFormulas] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    api.formulas.list()
      .then(data => setFormulas(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false))
  }, [])

  const openNew = () => { setEditing(null); setForm(EMPTY_FORM); setError(''); setShowModal(true) }
  const openEdit = (f) => {
    setEditing(f)
    setForm({ name: f.name, description: f.description || '', specialRequirements: f.specialRequirements || '',
      skus: f.skus?.length ? f.skus.map(s => ({ name: s.name, description: s.description || '' })) : [{ name: '', description: '' }] })
    setError(''); setShowModal(true)
  }
  const closeModal = () => { setShowModal(false); setEditing(null) }

  const set = f => e => setForm(prev => ({ ...prev, [f]: e.target.value }))
  const setSKU = (i, f) => e => setForm(prev => ({ ...prev, skus: prev.skus.map((s, idx) => idx === i ? { ...s, [f]: e.target.value } : s) }))
  const addSKU = () => setForm(prev => ({ ...prev, skus: [...prev.skus, { name: '', description: '' }] }))
  const removeSKU = (i) => setForm(prev => ({ ...prev, skus: prev.skus.filter((_, idx) => idx !== i) }))

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true); setError('')
    try {
      const payload = { ...form, skus: form.skus.filter(s => s.name.trim()) }
      const data = editing
        ? await api.formulas.update(editing._id, payload)
        : await api.formulas.create(payload)
      setFormulas(prev => editing ? prev.map(f => f._id === editing._id ? data : f) : [...prev, data])
      closeModal()
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete formula "${name}"?`)) return
    await api.formulas.delete(id)
    setFormulas(prev => prev.filter(f => f._id !== id))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">Formulas &amp; Products</h1>
          <p className="text-slate-400 text-sm mt-1">Manage product formulas and their SKU variants.</p>
        </div>
        <button onClick={openNew} className="btn-primary text-sm">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          Add Formula
        </button>
      </div>

      {showModal && (
        <Modal title={editing ? `Edit: ${editing.name}` : 'Add Formula'} onClose={closeModal}>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="label">Formula Name / Code *</label>
              <input className="input" placeholder="e.g. HSV1" value={form.name} onChange={set('name')} required />
            </div>
            <div>
              <label className="label">Description</label>
              <textarea className="input resize-none" rows={2} placeholder="Brief description of this formula..." value={form.description} onChange={set('description')} />
            </div>
            <div>
              <label className="label">Special Requirements</label>
              <textarea className="input resize-none" rows={3} placeholder="Manufacturing constraints, certifications, storage..." value={form.specialRequirements} onChange={set('specialRequirements')} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label mb-0">SKUs / Variants</label>
                <button type="button" onClick={addSKU} className="text-indigo-400 text-xs flex items-center gap-1 hover:text-indigo-300">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                  Add SKU
                </button>
              </div>
              <div className="space-y-2">
                {form.skus.map((sku, i) => (
                  <div key={i} className="flex gap-2 p-3 bg-slate-800/50 rounded-lg">
                    <div className="flex-1 space-y-2">
                      <input className="input text-sm py-1.5" placeholder="SKU name (e.g. HSV1-OmegaCore-60ct)" value={sku.name} onChange={setSKU(i, 'name')} />
                      <input className="input text-sm py-1.5" placeholder="Description (optional)" value={sku.description} onChange={setSKU(i, 'description')} />
                    </div>
                    {form.skus.length > 1 && (
                      <button type="button" onClick={() => removeSKU(i)} className="btn-ghost text-red-400 hover:text-red-300 flex-shrink-0 self-start">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
            {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm">{error}</div>}
            <div className="flex justify-end gap-3 pt-1">
              <button type="button" onClick={closeModal} className="btn-secondary text-sm">Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary text-sm">{saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Formula'}</button>
            </div>
          </form>
        </Modal>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-3 py-20 text-slate-400">
          <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading...
        </div>
      ) : formulas.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-slate-400">No formulas yet.</p>
          <button onClick={openNew} className="btn-primary mt-4 text-sm">Add Your First Formula</button>
        </div>
      ) : (
        <div className="space-y-3">
          {formulas.map(f => (
            <div key={f._id} className="card overflow-hidden">
              <div
                className="flex items-center justify-between gap-4 px-5 py-4 cursor-pointer hover:bg-slate-800/20 transition-colors"
                onClick={() => setExpanded(expanded === f._id ? null : f._id)}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-3 py-1 rounded-lg text-sm font-mono font-bold flex-shrink-0">{f.name}</span>
                  <div className="min-w-0">
                    <p className="text-white font-medium truncate">{f.description || 'No description'}</p>
                    <p className="text-slate-500 text-xs mt-0.5">{f.skus?.length || 0} SKU{f.skus?.length !== 1 ? 's' : ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={e => { e.stopPropagation(); openEdit(f) }} className="btn-ghost">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>
                  </button>
                  <button onClick={e => { e.stopPropagation(); handleDelete(f._id, f.name) }} className="btn-ghost text-red-400 hover:text-red-300">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                  </button>
                  <svg className={`w-4 h-4 text-slate-500 transition-transform ml-1 ${expanded === f._id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </div>
              </div>

              {expanded === f._id && (
                <div className="border-t border-slate-800 px-5 py-4 space-y-4">
                  {f.skus?.length > 0 && (
                    <div>
                      <h4 className="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-2">SKUs / Variants</h4>
                      <div>
                        {f.skus.map(sku => (
                          <div key={sku.name} className="flex items-start gap-3 py-1.5 border-b border-slate-800/50 last:border-0">
                            <span className="text-white text-sm font-mono">{sku.name}</span>
                            {sku.description && <span className="text-slate-400 text-sm">{sku.description}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {f.specialRequirements && (
                    <div>
                      <h4 className="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-2">Special Requirements</h4>
                      <p className="text-slate-300 text-sm leading-relaxed">{f.specialRequirements}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
