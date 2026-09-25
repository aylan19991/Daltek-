import { useState, useEffect, useCallback } from 'react'
import { Settings as SettingsIcon, Save, AlertTriangle, Users } from 'lucide-react'
import { useQueue } from '@/lib/useQueue'
import { useAuth } from '@/lib/auth'
import {
  updateEstablishment,
  resetQueue,
  getProfiles,
  updateProfileRole,
} from '@/lib/queueService'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { ErrorDisplay } from '@/components/ErrorDisplay'
import { Navigate } from 'react-router-dom'

export function SettingsPage() {
  const { establishment, loading, error, connected } = useQueue()
  const { hasRole } = useAuth()
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [resetConfirm, setResetConfirm] = useState(false)
  const [profiles, setProfiles] = useState<Array<{ id: string; email: string; role: string; display_name: string | null }>>([])

  // Form state
  const [name, setName] = useState('')
  const [startingNumber, setStartingNumber] = useState(1)
  const [maxTickets, setMaxTickets] = useState(999)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [displayTheme, setDisplayTheme] = useState('dark')

  useEffect(() => {
    if (establishment) {
      setName(establishment.name)
      setStartingNumber(establishment.starting_number)
      setMaxTickets(establishment.max_tickets)
      setSoundEnabled(establishment.sound_enabled)
      setDisplayTheme(establishment.display_theme)
    }
  }, [establishment])

  const loadProfiles = useCallback(async () => {
    try {
      const data = await getProfiles()
      setProfiles(data)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    if (hasRole('admin')) {
      loadProfiles()
    }
  }, [hasRole, loadProfiles])

  const handleSave = useCallback(async () => {
    if (!establishment) return
    setSaving(true)
    setSaveError(null)
    setSaveSuccess(false)
    try {
      await updateEstablishment(establishment.id, {
        name,
        starting_number: startingNumber,
        max_tickets: maxTickets,
        sound_enabled: soundEnabled,
        display_theme: displayTheme as 'dark' | 'light',
      })
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      setSaveError('Impossible d\'enregistrer les paramètres')
    } finally {
      setSaving(false)
    }
  }, [establishment, name, startingNumber, maxTickets, soundEnabled, displayTheme])

  const handleReset = useCallback(async () => {
    if (!establishment) return
    setResetting(true)
    try {
      await resetQueue(establishment.id)
      setResetConfirm(false)
    } catch (err) {
      setSaveError('Impossible de réinitialiser la file')
    } finally {
      setResetting(false)
    }
  }, [establishment])

  const handleRoleChange = useCallback(async (profileId: string, role: string) => {
    try {
      await updateProfileRole(profileId, role)
      await loadProfiles()
    } catch {
      setSaveError('Impossible de modifier le rôle')
    }
  }, [loadProfiles])

  if (loading) {
    return <LoadingSpinner label="Chargement des paramètres..." className="py-20" />
  }

  if (!hasRole('admin', 'agent')) {
    return <Navigate to="/login" replace />
  }

  if (error) {
    return <ErrorDisplay message={error} className="mt-8" />
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 font-display text-3xl font-bold text-neutral-900 dark:text-white">
          <SettingsIcon className="h-7 w-7 text-daltek-600 dark:text-daltek-400" />
          Paramètres
        </h1>
        <p className="mt-1 text-neutral-600 dark:text-neutral-400">
          Configuration du système Daltek
        </p>
      </div>

      {saveError && <ErrorDisplay message={saveError} className="mb-6" />}
      {saveSuccess && (
        <div className="mb-6 rounded-xl border border-success-200 bg-success-50 px-4 py-3 text-sm font-medium text-success-700 dark:border-success-500/20 dark:bg-success-500/10 dark:text-success-500">
          Paramètres enregistrés avec succès
        </div>
      )}

      {/* Establishment settings */}
      <div className="mb-6 rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="mb-4 font-display text-xl font-semibold text-neutral-900 dark:text-white">
          Établissement
        </h2>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Nom de l'établissement
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 bg-neutral-50 px-4 py-2.5 text-neutral-900 focus:border-daltek-500 focus:ring-2 focus:ring-daltek-500/20 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Numéro de départ
              </label>
              <input
                type="number"
                value={startingNumber}
                onChange={(e) => setStartingNumber(parseInt(e.target.value) || 1)}
                min={1}
                className="w-full rounded-lg border border-neutral-300 bg-neutral-50 px-4 py-2.5 text-neutral-900 focus:border-daltek-500 focus:ring-2 focus:ring-daltek-500/20 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Nombre maximum de tickets
              </label>
              <input
                type="number"
                value={maxTickets}
                onChange={(e) => setMaxTickets(parseInt(e.target.value) || 999)}
                min={1}
                className="w-full rounded-lg border border-neutral-300 bg-neutral-50 px-4 py-2.5 text-neutral-900 focus:border-daltek-500 focus:ring-2 focus:ring-daltek-500/20 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Display & Sound */}
      <div className="mb-6 rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="mb-4 font-display text-xl font-semibold text-neutral-900 dark:text-white">
          Affichage et son
        </h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-neutral-900 dark:text-white">Son d'appel</p>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Jouer une notification sonore lors de l'appel d'un numéro
              </p>
            </div>
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`relative h-7 w-12 rounded-full transition-colors ${
                soundEnabled ? 'bg-daltek-600' : 'bg-neutral-300 dark:bg-neutral-700'
              }`}
            >
              <span
                className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                  soundEnabled ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Thème d'affichage
            </label>
            <select
              value={displayTheme}
              onChange={(e) => setDisplayTheme(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 bg-neutral-50 px-4 py-2.5 text-neutral-900 focus:border-daltek-500 focus:ring-2 focus:ring-daltek-500/20 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
            >
              <option value="dark">Sombre</option>
              <option value="light">Clair</option>
            </select>
          </div>
        </div>
      </div>

      {/* User management (admin only) */}
      {hasRole('admin') && (
        <div className="mb-6 rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="mb-4 flex items-center gap-2 font-display text-xl font-semibold text-neutral-900 dark:text-white">
            <Users className="h-5 w-5" />
            Gestion des utilisateurs
          </h2>
          {profiles.length === 0 ? (
            <p className="text-sm text-neutral-500">Aucun utilisateur enregistré</p>
          ) : (
            <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {profiles.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium text-neutral-900 dark:text-white">
                      {p.display_name || p.email}
                    </p>
                    <p className="text-xs text-neutral-500">{p.email}</p>
                  </div>
                  <select
                    value={p.role}
                    onChange={(e) => handleRoleChange(p.id, e.target.value)}
                    className="rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-1.5 text-sm text-neutral-900 focus:border-daltek-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                  >
                    <option value="user">Utilisateur</option>
                    <option value="agent">Agent</option>
                    <option value="admin">Admin</option>
                    <option value="screen">Écran</option>
                  </select>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Danger zone */}
      <div className="mb-6 rounded-2xl border border-error-200 bg-error-50 p-6 dark:border-error-500/20 dark:bg-error-500/10">
        <h2 className="mb-2 flex items-center gap-2 font-display text-xl font-semibold text-error-700 dark:text-error-500">
          <AlertTriangle className="h-5 w-5" />
          Zone de danger
        </h2>
        <p className="mb-4 text-sm text-error-600 dark:text-error-500/80">
          La réinitialisation de la file d'attente annule tous les tickets en attente et le numéro actuellement appelé.
          Cette action est irréversible.
        </p>
        {!resetConfirm ? (
          <button
            onClick={() => setResetConfirm(true)}
            disabled={!connected}
            className="rounded-xl border border-error-300 bg-white px-5 py-2.5 text-sm font-medium text-error-700 transition-colors hover:bg-error-100 dark:border-error-500/30 dark:bg-transparent dark:text-error-500 dark:hover:bg-error-500/10"
          >
            Réinitialiser la file d'attente
          </button>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={handleReset}
              disabled={resetting}
              className="rounded-xl bg-error-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-error-700 disabled:opacity-50"
            >
              {resetting ? 'Réinitialisation...' : 'Confirmer la réinitialisation'}
            </button>
            <button
              onClick={() => setResetConfirm(false)}
              className="rounded-xl border border-neutral-300 px-5 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              Annuler
            </button>
          </div>
        )}
      </div>

      {/* Save button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving || !connected}
          className="flex items-center gap-2 rounded-xl bg-daltek-600 px-6 py-3 font-medium text-white transition-colors hover:bg-daltek-700 disabled:opacity-50"
        >
          <Save className="h-5 w-5" />
          {saving ? 'Enregistrement...' : 'Enregistrer les paramètres'}
        </button>
      </div>
    </div>
  )
}
