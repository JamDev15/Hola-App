const BASE = '/api'
// File uploads bypass Vercel's 4.5 MB proxy limit by going directly to the backend
const DIRECT_BASE = 'https://hola-app-k5ov.onrender.com/api'

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
  proofJobs: {
    list: (params = {}) => req('/proof-jobs?' + new URLSearchParams(params)),
    get: (id) => req(`/proof-jobs/${id}`),
    create: (body) => req('/proof-jobs', { method: 'POST', body: JSON.stringify(body) }),
    update: (id, body) => req(`/proof-jobs/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id) => req(`/proof-jobs/${id}`, { method: 'DELETE' }),
  },
  proof: async ({ frontFile, backFile, combinedFile }) => {
    const form = new FormData()
    if (combinedFile) form.append('combined_file', combinedFile)
    if (frontFile) form.append('front_file', frontFile)
    if (backFile) form.append('back_file', backFile)
    const res = await fetch(`${DIRECT_BASE}/proof`, { method: 'POST', body: form })
    const text = await res.text()
    let data
    try { data = JSON.parse(text) } catch { throw new Error(text || 'Proof request failed') }
    if (!res.ok) throw new Error(data.detail || 'Proof request failed')
    return data
  },
  reviseProof: async ({ frontFile, backFile, combinedFile, previousFindings, round }) => {
    const form = new FormData()
    form.append('round', String(round))
    form.append('previous_findings', JSON.stringify(previousFindings))
    if (combinedFile) form.append('combined_file', combinedFile)
    if (frontFile)    form.append('front_file', frontFile)
    if (backFile)     form.append('back_file', backFile)
    const res = await fetch(`${DIRECT_BASE}/proof/revise`, { method: 'POST', body: form })
    const text = await res.text()
    let data
    try { data = JSON.parse(text) } catch { throw new Error(text || 'Revision failed') }
    if (!res.ok) throw new Error(data.detail || 'Revision failed')
    return data
  },
  proofFromSharePoint: ({ frontUrl, backUrl, combinedUrl }) =>
    req('/proof/sharepoint', {
      method: 'POST',
      body: JSON.stringify({
        front_url:    frontUrl    || '',
        back_url:     backUrl     || '',
        combined_url: combinedUrl || '',
      }),
    }),
  verifyFinalProof: async ({
    approvedFrontFile, approvedBackFile, approvedCombinedFile,
    finalFrontFile, finalBackFile, finalCombinedFile,
  }) => {
    const form = new FormData()
    if (approvedCombinedFile) form.append('approved_combined_file', approvedCombinedFile)
    if (approvedFrontFile)    form.append('approved_front_file', approvedFrontFile)
    if (approvedBackFile)     form.append('approved_back_file', approvedBackFile)
    if (finalCombinedFile)    form.append('final_combined_file', finalCombinedFile)
    if (finalFrontFile)       form.append('final_front_file', finalFrontFile)
    if (finalBackFile)        form.append('final_back_file', finalBackFile)
    const res = await fetch(`${DIRECT_BASE}/proof/verify`, { method: 'POST', body: form })
    const text = await res.text()
    let data
    try { data = JSON.parse(text) } catch { throw new Error(text || 'Verification failed') }
    if (!res.ok) throw new Error(data.detail || 'Verification failed')
    return data
  },
}
