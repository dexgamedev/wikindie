export function Input({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`rounded-md border border-border bg-input px-3 py-2 text-text outline-none transition placeholder:text-text-muted focus:border-accent ${className}`}
    />
  )
}
