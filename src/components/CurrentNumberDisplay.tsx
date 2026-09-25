import type { CurrentCall } from '@/types'

interface CurrentNumberDisplayProps {
  currentCall: CurrentCall | null
  size?: 'default' | 'large' | 'huge'
  establishmentName?: string
  className?: string
}

export function CurrentNumberDisplay({
  currentCall,
  size = 'default',
  establishmentName,
  className = '',
}: CurrentNumberDisplayProps) {
  const sizeClasses = {
    default: {
      container: 'p-8',
      label: 'text-lg',
      number: 'text-7xl sm:text-8xl',
      sub: 'text-base',
    },
    large: {
      container: 'p-12',
      label: 'text-2xl',
      number: 'text-9xl',
      sub: 'text-xl',
    },
    huge: {
      container: 'p-16',
      label: 'text-3xl sm:text-4xl',
      number: 'text-[16rem] sm:text-[20rem] lg:text-[24rem]',
      sub: 'text-2xl sm:text-3xl',
    },
  }

  const cls = sizeClasses[size]

  return (
    <div
      className={`flex flex-col items-center justify-center rounded-3xl border border-neutral-200 bg-gradient-to-br from-neutral-50 to-neutral-100 dark:border-neutral-800 dark:from-neutral-900 dark:to-neutral-950 ${cls.container} ${className}`}
    >
      <p className={`font-display font-medium uppercase tracking-widest text-neutral-500 dark:text-neutral-400 ${cls.label}`}>
        Numéro appelé
      </p>

      {currentCall?.ticket_number != null ? (
        <p
          key={currentCall.ticket_number}
          className={`animate-number-pop font-display font-bold leading-none text-daltek-600 dark:text-daltek-400 ${cls.number}`}
        >
          {currentCall.ticket_number}
        </p>
      ) : (
        <p className={`${cls.number} font-display font-bold leading-none text-neutral-300 dark:text-neutral-700`}>
          —
        </p>
      )}

      {currentCall?.counter && (
        <p className={`mt-4 font-medium text-neutral-600 dark:text-neutral-300 ${cls.sub}`}>
          Guichet {currentCall.counter}
        </p>
      )}

      {establishmentName && (
        <p className={`mt-2 text-neutral-400 dark:text-neutral-500 ${cls.sub}`}>
          {establishmentName}
        </p>
      )}
    </div>
  )
}
