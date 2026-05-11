function initialsForUsername(username: string) {
  const clean = username.trim() || 'User'
  return clean
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

export function UserIconBadge({ username, className = 'size-5' }: { username: string; className?: string }) {
  return (
    <span
      className={`grid place-items-center rounded-full border border-card bg-accent text-[10px] font-bold text-white shadow-sm shadow-shadow ${className}`}
      title={`Assigned to ${username}`}
    >
      {initialsForUsername(username)}
    </span>
  )
}

export function AssigneeCorner({ assignees, limit = 3 }: { assignees: string[]; limit?: number }) {
  if (!assignees.length) return null

  const visible = assignees.slice(0, limit)
  const hidden = assignees.length - visible.length

  return (
    <div className="absolute bottom-2 right-2 flex items-center -space-x-1.5">
      {visible.map((assignee) => (
        <UserIconBadge key={assignee} username={assignee} className="size-6" />
      ))}
      {hidden > 0 && (
        <span className="grid h-6 min-w-6 place-items-center rounded-full border border-border bg-input px-1 text-[10px] font-bold text-text-muted shadow-sm shadow-shadow" title={`${hidden} more assignees`}>
          +{hidden}
        </span>
      )}
    </div>
  )
}

