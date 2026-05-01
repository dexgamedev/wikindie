export function Button({ className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`rounded-lg border border-border bg-surface-hover px-3 py-2 text-sm text-text transition hover:border-accent disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    />
  )
}
