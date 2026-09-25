import { useState, useEffect, useCallback } from 'react'
import { PhoneCall, RotateCcw, Check, X, ChevronRight, AlertCircle } from 'lucide-react'
import { useQueue } from '@/lib/useQueue'
import { useAuth } from '@/lib/auth'
import {
  callNextTicket,
  callSpecificTicket,
  recallTicket,
  serveTicket,
  cancelTicket,
} from '@/lib/queueService'
import { CurrentNumberDisplay } from '@/components/CurrentNumberDisplay'
import { QueueList } from '@/components/QueueList'
import { ConnectionStatus } from '@/components/ConnectionStatus'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { ErrorDisplay } from '@/components/ErrorDisplay'
import { Navigate } from 'react-router-dom'

export function ManagementPage() {
  const { currentCall, waitingTickets, establishment, loading, error, connected } = useQueue()
  const { profile, hasRole } = useAuth()
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [specificNumber, setSpecificNumber] = useState('')
  const [counter, setCounter] = useState('')

  // Load saved counter from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('daltek_counter')
    if (saved) setCounter(saved)
  }, [])

  useEffect(() => {
    localStorage.setItem('daltek_counter', counter)
  }, [counter])

  const handleAction = useCallback(async (action: () => Promise<void>) => {
    setActionLoading(true)
    setActionError(null)
    try {
      await action()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Une erreur est survenue'
      setActionError(translateError(message))
    } finally {
      setActionLoading(false)
    }
  }, [])

  if (loading) {
    return <LoadingSpinner label="Chargement du système de gestion..." className="py-20" />
  }

  if (!hasRole('admin', 'agent')) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="mx-auto max-w-7xl">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-neutral-900 dark:text-white">
            Gestion
          </h1>
          <p className="mt-1 text-neutral-600 dark:text-neutral-400">
            {establishment?.name} — Agent: {profile?.display_name || profile?.email}
          </p>
        </div>
        <ConnectionStatus connected={connected} />
      </div>

      {error && <ErrorDisplay message={error} className="mb-6" />}

      {actionError && (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-500/20 dark:bg-error-500/10 dark:text-error-500">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {actionError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: Current number + actions */}
        <div className="lg:col-span-2">
          <CurrentNumberDisplay
            currentCall={currentCall}
            establishmentName={establishment?.name}
            size="large"
            className="mb-6"
          />

          {/* Counter input */}
          <div className="mb-6 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Guichet / Poste
            </label>
            <input
              type="text"
              value={counter}
              onChange={(e) => setCounter(e.target.value)}
              placeholder="Ex: 1, A, Guichet 3..."
              className="w-full rounded-lg border border-neutral-300 bg-neutral-50 px-4 py-2.5 text-neutral-900 placeholder:text-neutral-400 focus:border-daltek-500 focus:ring-2 focus:ring-daltek-500/20 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
            />
          </div>

          {/* Main actions */}
          <div className="space-y-4">
            {/* Call next - primary action */}
            <button
              onClick={() => handleAction(() => callNextTicket(establishment?.id, counter || undefined))}
              disabled={actionLoading || waitingTickets.length === 0}
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-daltek-600 px-6 py-5 font-display text-xl font-bold text-white shadow-lg transition-all hover:bg-daltek-700 hover:shadow-xl active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <PhoneCall className="h-6 w-6" />
              Appeler le prochain
            </button>

            {/* Secondary actions */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <button
                onClick={() => handleAction(() => recallTicket(establishment?.id))}
                disabled={actionLoading || !currentCall}
                className="flex flex-col items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-4 font-medium text-neutral-700 transition-colors hover:bg-warning-50 hover:text-warning-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-warning-500/10 dark:hover:text-warning-500"
              >
                <RotateCcw className="h-5 w-5" />
                <span className="text-sm">Rappeler</span>
              </button>

              <button
                onClick={() => handleAction(() => serveTicket(establishment?.id))}
                disabled={actionLoading || !currentCall}
                className="flex flex-col items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-4 font-medium text-neutral-700 transition-colors hover:bg-success-50 hover:text-success-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-success-500/10 dark:hover:text-success-500"
              >
                <Check className="h-5 w-5" />
                <span className="text-sm">Terminer</span>
              </button>

              <button
                onClick={() => {
                  if (currentCall?.ticket_number) {
                    handleAction(() => cancelTicket(currentCall.ticket_number!, establishment?.id))
                  }
                }}
                disabled={actionLoading || !currentCall}
                className="flex flex-col items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-4 font-medium text-neutral-700 transition-colors hover:bg-error-50 hover:text-error-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-error-500/10 dark:hover:text-error-500"
              >
                <X className="h-5 w-5" />
                <span className="text-sm">Annuler</span>
              </button>

              <div className="flex flex-col items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-4 dark:border-neutral-800 dark:bg-neutral-900">
                <div className="flex w-full items-center gap-1">
                  <input
                    type="number"
                    value={specificNumber}
                    onChange={(e) => setSpecificNumber(e.target.value)}
                    placeholder="N°"
                    className="w-full rounded-lg border border-neutral-300 bg-neutral-50 px-2 py-1.5 text-center text-sm text-neutral-900 focus:border-daltek-500 focus:ring-1 focus:ring-daltek-500/20 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                  />
                </div>
                <button
                  onClick={() => {
                    const num = parseInt(specificNumber, 10)
                    if (!isNaN(num) && num > 0) {
                      handleAction(() => callSpecificTicket(num, establishment?.id, counter || undefined))
                      setSpecificNumber('')
                    }
                  }}
                  disabled={actionLoading || !specificNumber}
                  className="flex items-center gap-1 text-sm font-medium text-daltek-600 hover:text-daltek-700 disabled:opacity-50 dark:text-daltek-400"
                >
                  Appeler
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Queue list */}
        <div>
          <QueueList tickets={waitingTickets} max={15} />
        </div>
      </div>
    </div>
  )
}

function translateError(message: string): string {
  if (message.includes('Authentification')) return 'Vous devez être connecté pour effectuer cette action.'
  if (message.includes('Permissions')) return 'Permissions insuffisantes pour cette action.'
  if (message.includes('existe pas')) return 'Ce ticket n\'existe pas.'
  if (message.includes('Aucun numéro')) return 'Aucun numéro n\'est actuellement appelé.'
  if (message.includes('Aucun établissement')) return 'Aucun établissement trouvé.'
  if (message.includes('Failed to fetch')) return 'Impossible de se connecter au serveur.'
  return 'Une erreur est survenue. Veuillez réessayer.'
}
