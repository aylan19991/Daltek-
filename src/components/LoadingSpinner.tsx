interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  label?: string
  className?: string
}

export function LoadingSpinner({ size = 'md', label, className = '' }: LoadingSpinnerProps) {
  const sizeClass = {
    sm: 'h-4 w-4 border-2',
    md: 'h-8 w-8 border-3',
    lg: 'h-12 w-12 border-4',
  }

  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <div
        className={`${sizeClass[size]} animate-spin rounded-full border-neutral-200 border-t-daltek-600 dark:border-neutral-700 dark:border-t-daltek-400`}
      />
      {label && <p className="text-sm text-neutral-500 dark:text-neutral-400">{label}</p>}
    </div>
  )
}
