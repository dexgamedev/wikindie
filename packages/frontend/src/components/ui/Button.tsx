const base = 'inline-flex items-center gap-1.5 rounded-md text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50'

const variants = {
  default: `${base} h-7 border border-border bg-panel px-2.5 text-text hover:bg-surface-hover`,
  primary: `${base} h-7 bg-accent px-2.5 text-white hover:brightness-110`,
  ghost: `${base} h-7 px-2 text-text-muted hover:bg-surface-hover hover:text-text`,
  danger: `${base} h-7 border border-danger/30 bg-danger/10 px-2.5 text-danger hover:bg-danger/20`,
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
