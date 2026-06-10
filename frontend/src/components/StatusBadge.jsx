const map = {
  pending: { cls: 'badge-pending', label: 'Pending' },
  'in-production': { cls: 'badge-in-production', label: 'In Production' },
  completed: { cls: 'badge-completed', label: 'Completed' },
}

export default function StatusBadge({ status }) {
  const { cls, label } = map[status] ?? { cls: 'badge-pending', label: status }
  return <span className={cls}>{label}</span>
}
