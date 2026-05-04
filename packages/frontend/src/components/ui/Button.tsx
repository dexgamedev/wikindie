export function Button({ className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`rounded-lg border border-control-border bg-control px-3 py-2 text-sm text-text transition hover:border-accent hover:bg-control-hover disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    />
  )
}
