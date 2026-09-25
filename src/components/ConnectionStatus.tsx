interface ConnectionStatusProps {
  connected: boolean
  className?: string
}

export function ConnectionStatus({ connected, className = '' }: ConnectionStatusProps) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium ${
        connected
          ? 'bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-500'
          : 'bg-error-50 text-error-700 dark:bg-error-500/10 dark:text-error-500'
      } ${className}`}
    >
      <span className="relative flex h-2.5 w-2.5">
        {connected && (
          <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-success-500" />
        )}
        <span
          className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
            connected ? 'bg-success-500' : 'bg-error-500'
          }`}
        />
      </span>
      {connected ? 'Système connecté' : 'Connexion perdue'}
    </div>
  )
}
