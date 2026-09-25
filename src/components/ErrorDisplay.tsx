interface ErrorDisplayProps {
  message: string
  onRetry?: () => void
  className?: string
}

export function ErrorDisplay({ message, onRetry, className = '' }: ErrorDisplayProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl border border-error-200 bg-error-50 px-6 py-8 text-center dark:border-error-500/20 dark:bg-error-500/10 ${className}`}
    >
      <p className="font-medium text-error-700 dark:text-error-500">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 rounded-lg bg-error-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-error-700"
        >
          Réessayer
        </button>
      )}
    </div>
  )
}
