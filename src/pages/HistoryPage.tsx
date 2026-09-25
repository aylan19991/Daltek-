import { useState, useEffect, useCallback } from 'react'
import { History, Filter } from 'lucide-react'
import { getHistory, getProfiles } from '@/lib/queueService'
import { useQueue } from '@/lib/useQueue'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { ErrorDisplay } from '@/components/ErrorDisplay'
import type { TicketHistoryEntry } from '@/types'

const actionLabels: Record<string, string> = {
  created: 'Créé',
  called: 'Appelé',
  recalled: 'Rappelé',
  served: 'Terminé',
  cancelled: 'Annulé',
  reset: 'Réinitialisé',
}

const actionColors: Record<string, string> = {
  created: 'bg-daltek-50 text-daltek-700 dark:bg-daltek-500/10 dark:text-daltek-400',
  called: 'bg-accent-50 text-accent-700 dark:bg-accent-500/10 dark:text-accent-500',
  recalled: 'bg-warning-50 text-warning-700 dark:bg-warning-500/10 dark:text-warning-500',
  served: 'bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-500',
  cancelled: 'bg-error-50 text-error-700 dark:bg-error-500/10 dark:text-error-500',
  reset: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400',
}

interface AgentInfo {
  id: string
  email: string
  display_name: string | null
}

export function HistoryPage() {
  const { establishment, loading: estLoading } = useQueue()
  const [entries, setEntries] = useState<TicketHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [agents, setAgents] = useState<AgentInfo[]>([])

  // Filters
  const [filterDate, setFilterDate] = useState('')
  const [filterAction, setFilterAction] = useState('all')
  const [filterAgent, setFilterAgent] = useState('all')

  const loadHistory = useCallback(async () => {
    if (!establishment) return
    try {
      setError(null)
      const data = await getHistory(establishment.id, {
        date: filterDate || undefined,
        status: filterAction !== 'all' ? filterAction : undefined,
        agent: filterAgent !== 'all' ? filterAgent : undefined,
      })
      setEntries(data)
    } catch (err) {
      setError('Impossible de charger l\'historique')
    } finally {
      setLoading(false)
    }
  }, [establishment, filterDate, filterAction, filterAgent])

  useEffect(() => {
    if (establishment) {
      loadHistory()
      getProfiles().then(setAgents).catch(() => {})
    }
  }, [establishment, loadHistory])

  if (estLoading || loading) {
    return <LoadingSpinner label="Chargement de l'historique..." className="py-20" />
  }

  if (error) {
    return <ErrorDisplay message={error} onRetry={loadHistory} className="mt-8" />
  }

  const agentName = (id: string | null): string => {
    if (!id) return '—'
    const agent = agents.find((a) => a.id === id)
    return agent?.display_name || agent?.email || 'Inconnu'
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 font-display text-3xl font-bold text-neutral-900 dark:text-white">
          <History className="h-7 w-7 text-daltek-600 dark:text-daltek-400" />
          Historique
        </h1>
        <p className="mt-1 text-neutral-600 dark:text-neutral-400">
          Journal des actions sur les tickets
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
          <Filter className="h-4 w-4" />
          Filtres
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-500">Date</label>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-neutral-900 focus:border-daltek-500 focus:ring-1 focus:ring-daltek-500/20 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-500">Action</label>
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-neutral-900 focus:border-daltek-500 focus:ring-1 focus:ring-daltek-500/20 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
            >
              <option value="all">Toutes</option>
              <option value="created">Créé</option>
              <option value="called">Appelé</option>
              <option value="recalled">Rappelé</option>
              <option value="served">Terminé</option>
              <option value="cancelled">Annulé</option>
              <option value="reset">Réinitialisé</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-500">Agent</label>
            <select
              value={filterAgent}
              onChange={(e) => setFilterAgent(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-neutral-900 focus:border-daltek-500 focus:ring-1 focus:ring-daltek-500/20 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
            >
              <option value="all">Tous</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.display_name || a.email}
                </option>
              ))}
            </select>
          </div>
        </div>
        {(filterDate || filterAction !== 'all' || filterAgent !== 'all') && (
          <button
            onClick={() => {
              setFilterDate('')
              setFilterAction('all')
              setFilterAgent('all')
            }}
            className="mt-3 text-sm text-daltek-600 hover:underline dark:text-daltek-400"
          >
            Réinitialiser les filtres
          </button>
        )}
      </div>

      {/* History table */}
      {entries.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200 bg-white py-16 text-center dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-neutral-500 dark:text-neutral-400">Aucune entrée dans l'historique</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
          {/* Desktop table */}
          <table className="hidden w-full sm:table">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800">
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Ticket</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Heure</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Action</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Guichet</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Agent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {entries.map((entry) => (
                <tr key={entry.id} className="transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                  <td className="px-5 py-3">
                    <span className="font-display text-lg font-bold text-neutral-900 dark:text-white">{entry.ticket_number}</span>
                  </td>
                  <td className="px-5 py-3 text-sm text-neutral-600 dark:text-neutral-400">
                    {new Date(entry.created_at).toLocaleString('fr-FR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${actionColors[entry.action]}`}>
                      {actionLabels[entry.action] || entry.action}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm text-neutral-600 dark:text-neutral-400">
                    {entry.counter || '—'}
                  </td>
                  <td className="px-5 py-3 text-sm text-neutral-600 dark:text-neutral-400">
                    {agentName(entry.performed_by)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile cards */}
          <ul className="divide-y divide-neutral-200 dark:divide-neutral-800 sm:hidden">
            {entries.map((entry) => (
              <li key={entry.id} className="px-5 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 font-display text-lg font-bold text-neutral-900 dark:bg-neutral-800 dark:text-white">
                      {entry.ticket_number}
                    </span>
                    <div>
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${actionColors[entry.action]}`}>
                        {actionLabels[entry.action] || entry.action}
                      </span>
                      <p className="mt-1 text-xs text-neutral-500">
                        {new Date(entry.created_at).toLocaleString('fr-FR', {
                          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right text-xs text-neutral-500">
                    {entry.counter && <p>Guichet {entry.counter}</p>}
                    <p>{agentName(entry.performed_by)}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
