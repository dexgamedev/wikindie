const base = 'inline-flex items-center gap-1.5 rounded-md text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50'

const variants = {
  default: `${base} border border-control-border bg-control px-2.5 py-1.5 text-text hover:border-accent hover:bg-control-hover`,
  primary: `${base} bg-accent px-3 py-1.5 text-white hover:brightness-110`,
  ghost: `${base} px-2 py-1.5 text-text-muted hover:bg-accent/10 hover:text-text`,
  danger: `${base} border border-danger/30 bg-danger/10 px-2.5 py-1.5 text-danger hover:bg-danger/20`,
} as const

export type ButtonVariant = keyof typeof variants

export function Button({
  variant = 'default',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      {...props}
      className={`${variants[variant]} ${className}`}
    />
  )
}
