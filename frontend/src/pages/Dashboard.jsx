import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import StatusBadge from '../components/StatusBadge'
import AIRecommendation from '../components/AIRecommendation'

function SummaryCard({ label, value, sub, color }) {
  return (
    <div className="card p-5 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
        <div className="w-3 h-3 rounded-full bg-current opacity-70" />
      </div>
      <div>
        <p className="text-slate-400 text-sm">{label}</p>
        <p className="text-2xl font-bold text-white mt-0.5">{value}</p>
        <p className="text-slate-600 text-xs mt-0.5">{sub}</p>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [expandedAI, setExpandedAI] = useState(null)

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.orders.list(statusFilter ? { status: statusFilter } : {})
      setOrders(Array.isArray(data) ? data : [])
    } catch { setOrders([]) }
    finally { setLoading(false) }
  }, [statusFilter])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  const handleStatusChange = async (id, status) => {
    await api.orders.update(id, { status })
    setOrders(prev => prev.map(o => o._id === id ? { ...o, status } : o))
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this order? This cannot be undone.')) return
    await api.orders.delete(id)
    setOrders(prev => prev.filter(o => o._id !== id))
  }

  const handleSeed = async () => {
    await api.seed()
    fetchOrders()
  }

  const filtered = orders.filter(o => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      o.clientName?.toLowerCase().includes(q) ||
      o.formula?.toLowerCase().includes(q) ||
      o.sku?.toLowerCase().includes(q) ||
      o.assignedCoPacker?.toLowerCase().includes(q)
    )
  })

  const stats = {
    total: orders.length,
    active: orders.filter(o => o.status === 'in-production').length,
    pending: orders.filter(o => o.status === 'pending').length,
    completed: orders.filter(o => o.status === 'completed').length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">Production Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">AI-powered order routing and co-packer management</p>
        </div>
        <Link to="/orders/new" className="btn-primary text-sm">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Order
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard label="Total Orders" value={stats.total} sub="all time" color="bg-indigo-500/10 text-indigo-400" />
        <SummaryCard label="In Production" value={stats.active} sub="active runs" color="bg-blue-500/10 text-blue-400" />
        <SummaryCard label="Pending" value={stats.pending} sub="awaiting start" color="bg-amber-500/10 text-amber-400" />
        <SummaryCard label="Completed" value={stats.completed} sub="fulfilled" color="bg-emerald-500/10 text-emerald-400" />
      </div>

      {/* Artwork Proofing */}
      <div className="card p-5 flex items-center gap-5 border border-violet-500/20 bg-violet-500/5">
        <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center flex-shrink-0">
          <svg className="w-6 h-6 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm">Artwork Proofing</p>
          <p className="text-slate-400 text-xs mt-0.5">Check FDA compliance and Halo Private Label requirements on packaging artwork before production.</p>
        </div>
        <Link
          to="/proofing"
          className="flex-shrink-0 flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          Start Proofing
        </Link>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by client, formula, SKU, or co-packer..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input pl-9 text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="input w-full sm:w-44 text-sm"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="in-production">In Production</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-3 py-20 text-slate-400">
            <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading orders...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-slate-400 text-sm">
            {orders.length === 0 ? (
              <>
                No orders yet.{' '}
                <Link to="/orders/new" className="text-indigo-400 hover:underline">Submit your first order</Link>
                {' '}or{' '}
                <button onClick={handleSeed} className="text-indigo-400 hover:underline">seed sample data</button>.
              </>
            ) : 'No orders match your filters.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  {['Client', 'Formula', 'SKU / Flavor', 'Qty', 'Co-Packer', 'Status', 'Date', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-slate-400 font-medium first:pl-4 last:text-right">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(order => (
                  <React.Fragment key={order.id}>
                    <tr className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                      <td className="px-4 py-3 text-white font-medium">{order.clientName}</td>
                      <td className="px-4 py-3">
                        <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded text-xs font-mono font-semibold">
                          {order.formula}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300 max-w-[180px] truncate">{order.sku}</td>
                      <td className="px-4 py-3 text-slate-300 font-mono">{order.quantity?.toLocaleString()}</td>
                      <td className="px-4 py-3 text-slate-300">
                        {order.assignedCoPacker || <span className="text-slate-600 italic">Unassigned</span>}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={order.status}
                          onChange={e => handleStatusChange(order.id, e.target.value)}
                          className="bg-transparent border-0 p-0 text-xs w-0 h-0 absolute opacity-0"
                          id={`status-select-${order.id}`}
                        />
                        <label htmlFor={`status-select-${order.id}`} className="cursor-pointer">
                          <StatusBadge status={order.status} />
                        </label>
                        <select
                          value={order.status}
                          onChange={e => handleStatusChange(order.id, e.target.value)}
                          className="input text-xs py-1 w-32 mt-1"
                        >
                          <option value="pending">Pending</option>
                          <option value="in-production">In Production</option>
                          <option value="completed">Completed</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {order.createdAt ? order.createdAt.slice(0, 10) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {order.aiRecommendation && (
                            <button
                              onClick={() => setExpandedAI(expandedAI === order.id ? null : order.id)}
                              className="btn-ghost text-indigo-400 hover:text-indigo-300"
                              title="View AI Recommendation"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                              </svg>
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(order.id)}
                            className="btn-ghost text-red-400 hover:text-red-300"
                            title="Delete order"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedAI === order.id && order.aiRecommendation && (
                      <tr key={`${order.id}-ai`} className="bg-indigo-950/20">
                        <td colSpan={8} className="px-4 py-4">
                          <div className="bg-indigo-950/40 border border-indigo-500/20 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                              </svg>
                              <span className="text-indigo-400 text-xs font-semibold uppercase tracking-wide">AI Recommendation</span>
                            </div>
                            <AIRecommendation text={order.aiRecommendation} />
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && filtered.length > 0 && (
        <p className="text-slate-600 text-xs text-right">
          Showing {filtered.length} of {orders.length} orders
        </p>
      )}
    </div>
  )
}
