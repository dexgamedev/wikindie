export function roleBadgeClass(role: string | null | undefined) {
  if (role === 'admin') return 'border-info/40 bg-info/15 text-info'
  if (role === 'editor') return 'border-success/40 bg-success/15 text-success'
  return 'border-text-muted/30 bg-text-muted/15 text-text-muted'
}
