import type { Ticket } from '@/types'

interface QueueListProps {
  tickets: Ticket[]
  className?: string
  max?: number
}

const statusLabels: Record<string, string> = {
  waiting: 'En attente',
  called: 'Appelé',
  served: 'Terminé',
  cancelled: 'Annulé',
  recalled: 'Rappelé',
}

const statusColors: Record<string, string> = {
  waiting: 'bg-daltek-50 text-daltek-700 dark:bg-daltek-500/10 dark:text-daltek-400',
  called: 'bg-accent-50 text-accent-700 dark:bg-accent-500/10 dark:text-accent-500',
  served: 'bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-500',
  cancelled: 'bg-error-50 text-error-700 dark:bg-error-500/10 dark:text-error-500',
  recalled: 'bg-warning-50 text-warning-700 dark:bg-warning-500/10 dark:text-warning-500',
}

export function QueueList({ tickets, className = '', max = 10 }: QueueListProps) {
  const display = tickets.slice(0, max)

  return (
    <div className={`rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 ${className}`}>
      <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4 dark:border-neutral-800">
        <h3 className="font-display text-lg font-semibold text-neutral-900 dark:text-white">
          File d'attente
        </h3>
        <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-sm font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
          {tickets.length} en attente
        </span>
      </div>

      {display.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <p className="text-neutral-500 dark:text-neutral-400">Aucun ticket en attente</p>
        </div>
      ) : (
        <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
          {display.map((ticket) => (
            <li
              key={ticket.id}
              className="flex items-center justify-between px-5 py-3 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-daltek-50 font-display text-lg font-bold text-daltek-700 dark:bg-daltek-500/10 dark:text-daltek-400">
                  {ticket.number}
                </span>
                <div>
                  {ticket.category && (
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">{ticket.category}</p>
                  )}
                  <p className="text-xs text-neutral-400">
                    {new Date(ticket.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[ticket.status] || statusLabels.waiting}`}
              >
                {statusLabels[ticket.status] || ticket.status}
              </span>
            </li>
          ))}
        </ul>
      )}

      {tickets.length > max && (
        <div className="border-t border-neutral-200 px-5 py-2.5 text-center text-sm text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
          +{tickets.length - max} autres tickets
        </div>
      )}
    </div>
  )
}
