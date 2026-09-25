import { useState } from 'react'
import { useNavigate, Link, Navigate } from 'react-router-dom'
import { LogIn, Mail, Lock, AlertCircle } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { Logo } from '@/components/Logo'
import { LoadingSpinner } from '@/components/LoadingSpinner'

export function LoginPage() {
  const { signIn, session } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (session) {
    return <Navigate to="/gestion" replace />
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await signIn(email, password)
    if (error) {
      setError(error)
      setLoading(false)
    } else {
      navigate('/gestion')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 dark:bg-neutral-950">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center">
          <Logo size={56} showText={false} />
          <h1 className="mt-4 font-display text-2xl font-bold text-neutral-900 dark:text-white">
            Connexion
          </h1>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            Accédez à l'espace de gestion Daltek
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900"
        >
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-500/20 dark:bg-error-500/10 dark:text-error-500">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="mb-4">
            <label className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="vous@exemple.com"
                className="w-full rounded-lg border border-neutral-300 bg-neutral-50 py-2.5 pl-10 pr-4 text-neutral-900 placeholder:text-neutral-400 focus:border-daltek-500 focus:ring-2 focus:ring-daltek-500/20 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
              />
            </div>
          </div>

          <div className="mb-6">
            <label className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Mot de passe
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full rounded-lg border border-neutral-300 bg-neutral-50 py-2.5 pl-10 pr-4 text-neutral-900 placeholder:text-neutral-400 focus:border-daltek-500 focus:ring-2 focus:ring-daltek-500/20 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-daltek-600 px-4 py-3 font-medium text-white transition-colors hover:bg-daltek-700 disabled:opacity-50"
          >
            {loading ? (
              <LoadingSpinner size="sm" />
            ) : (
              <>
                <LogIn className="h-5 w-5" />
                Se connecter
              </>
            )}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-neutral-600 dark:text-neutral-400">
          Pas encore de compte ?{' '}
          <Link to="/signup" className="font-medium text-daltek-600 hover:underline dark:text-daltek-400">
            Créer un compte
          </Link>
        </p>
      </div>
    </div>
  )
}
