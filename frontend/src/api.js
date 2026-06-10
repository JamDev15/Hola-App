const BASE = '/api'

async function req(url, options = {}) {
  const res = await fetch(BASE + url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const text = await res.text()
  let data
  try { data = JSON.parse(text) } catch { throw new Error(text || 'Request failed') }
  if (!res.ok) throw new Error(data.detail || 'Request failed')
  return data
}

export const api = {
  orders: {
    list: (params = {}) => req('/orders?' + new URLSearchParams(params)),
    create: (body) => req('/orders', { method: 'POST', body: JSON.stringify(body) }),
    update: (id, body) => req(`/orders/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id) => req(`/orders/${id}`, { method: 'DELETE' }),
  },
  copackers: {
    list: () => req('/co-packers'),
    create: (body) => req('/co-packers', { method: 'POST', body: JSON.stringify(body) }),
    update: (id, body) => req(`/co-packers/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id) => req(`/co-packers/${id}`, { method: 'DELETE' }),
  },
  formulas: {
    list: () => req('/formulas'),
    create: (body) => req('/formulas', { method: 'POST', body: JSON.stringify(body) }),
    update: (id, body) => req(`/formulas/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id) => req(`/formulas/${id}`, { method: 'DELETE' }),
  },
  seed: () => req('/seed', { method: 'POST' }),
  proof: async (file) => {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch('/api/proof', { method: 'POST', body: form })
    const text = await res.text()
    let data
    try { data = JSON.parse(text) } catch { throw new Error(text || 'Proof request failed') }
    if (!res.ok) throw new Error(data.detail || 'Proof request failed')
    return data
  },
}
