import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useAuth } from './AuthContext'
import { useConfirmation } from './ConfirmContext'

type AuthMode = 'login' | 'signup' | 'confirm'

const quickStats = [
  { value: '24/7', label: 'Clinical systems access' },
  { value: '< 2 min', label: 'Average staff portal login' },
  { value: 'HIPAA', label: 'Security aligned workflows' }
]

const supportItems = [
  'Review new patient registrations and identity checks',
  'Access protected records through authenticated sessions',
  'Keep onboarding and sign-in within the approved backend flow'
]

export default function App() {
  const { token, login, logout, isLoading, error, clearError } = useAuth()
  const { confirmation, signup, confirmSignup, clearConfirmation } = useConfirmation()
  const [mode, setMode] = useState<AuthMode>('login')
  const [formError, setFormError] = useState<string | null>(null)

  const isAuthenticated = Boolean(token)

  useEffect(() => {
    if (confirmation.confirmMessage) {
      setMode('login')
    }
  }, [confirmation.confirmMessage])

  const sessionPreview = useMemo(() => {
    if (!token) {
      return ''
    }

    return `${token.slice(0, 18)}...${token.slice(-12)}`
  }, [token])

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const email = String(formData.get('email') || '').trim()
    const password = String(formData.get('password') || '')

    setFormError(null)

    try {
      await login(email, password)
      event.currentTarget.reset()
    } catch {
      // Auth context surfaces the backend error for rendering.
    }
  }

  async function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const email = String(formData.get('email') || '').trim()
    const password = String(formData.get('password') || '')
    const confirmPassword = String(formData.get('confirmPassword') || '')

    clearError()
    clearConfirmation()
    setFormError(null)

    if (password !== confirmPassword) {
      setFormError('Passwords must match before creating the hospital portal account.')
      return
    }

    try {
      await signup(email, password)
      setMode('confirm')
      event.currentTarget.reset()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      // Confirmation context exposes the backend error for rendering.
    }
  }

  async function handleConfirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const email = String(formData.get('email') || confirmation.email || '').trim()
    const confirmationCode = String(formData.get('confirmationCode') || '').trim()

    clearError()
    setFormError(null)

    try {
      await confirmSignup(email, confirmationCode)
      event.currentTarget.reset()
      setMode('login')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      // Confirmation context exposes the backend error for rendering.
    }
  }

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode)
    clearError()
    clearConfirmation()
    setFormError(null)
  }

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <span className="eyebrow">Hospital Operations Portal</span>
          <h1>Secure access for clinical teams, patient onboarding, and protected records.</h1>
          <p>
            A professional front desk and staff sign-in experience wired to the backend
            authentication handlers already in place.
          </p>
        </div>

        <div className="hero-grid">
          {quickStats.map((item) => (
            <article key={item.label} className="stat-card">
              <strong>{item.value}</strong>
              <span>{item.label}</span>
            </article>
          ))}
        </div>

        <div className="support-card">
          <h2>Designed for hospital workflows</h2>
          <ul>
            {supportItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="auth-panel">
        <header className="panel-header">
          <div>
            <span className="eyebrow">Staff Access</span>
            <h2>{isAuthenticated ? 'Session active' : 'Sign in, enroll, and confirm access'}</h2>
          </div>
          {isAuthenticated ? (
            <button type="button" className="secondary-button" onClick={logout}>
              Sign out
            </button>
          ) : null}
        </header>

        {confirmation.signupMessage ? (
          <div className="banner banner-success">
            <strong>Verification required</strong>
            <p>{confirmation.signupMessage}</p>
            {confirmation.email ? (
              <p>
                Confirmation email sent to: <span>{confirmation.email}</span>
              </p>
            ) : null}
          </div>
        ) : null}

        {confirmation.confirmMessage ? (
          <div className="banner banner-success">
            <strong>Account confirmed</strong>
            <p>{confirmation.confirmMessage}</p>
            <p>Continue with staff sign-in using your approved credentials.</p>
          </div>
        ) : null}

        {error ? (
          <div className="banner banner-error">
            <strong>Sign-in issue</strong>
            <p>{error}</p>
          </div>
        ) : null}

        {confirmation.error ? (
          <div className="banner banner-error">
            <strong>Enrollment issue</strong>
            <p>{confirmation.error}</p>
          </div>
        ) : null}

        {formError ? (
          <div className="banner banner-error">
            <strong>Form issue</strong>
            <p>{formError}</p>
          </div>
        ) : null}

        {isAuthenticated ? (
          <section className="session-card">
            <div>
              <span className="session-label">Authenticated access token</span>
              <p className="session-token">{sessionPreview}</p>
            </div>
            <div className="session-note">
              Login is backed by the existing Cognito `login_handler`. No backend changes were
              made.
            </div>
          </section>
        ) : (
          <>
            <div className="mode-switch" role="tablist" aria-label="Authentication mode">
              <button
                type="button"
                className={mode === 'login' ? 'mode-button active' : 'mode-button'}
                onClick={() => switchMode('login')}
              >
                Staff Sign In
              </button>
              <button
                type="button"
                className={mode === 'signup' ? 'mode-button active' : 'mode-button'}
                onClick={() => switchMode('signup')}
              >
                Create Account
              </button>
              <button
                type="button"
                className={mode === 'confirm' ? 'mode-button active' : 'mode-button'}
                onClick={() => switchMode('confirm')}
              >
                Confirm Email
              </button>
            </div>

            {mode === 'login' ? (
              <form className="auth-form" onSubmit={handleLogin}>
                <label>
                  Work email
                  <input name="email" type="email" placeholder="name@hospital.org" required />
                </label>
                <label>
                  Password
                  <input
                    name="password"
                    type="password"
                    placeholder="Enter your secure password"
                    required
                  />
                </label>
                <button type="submit" className="primary-button" disabled={isLoading}>
                  {isLoading ? 'Signing in...' : 'Access Staff Portal'}
                </button>
              </form>
            ) : null}

            {mode === 'signup' ? (
              <form className="auth-form" onSubmit={handleSignup}>
                <label>
                  Email address
                  <input name="email" type="email" placeholder="new.user@hospital.org" required />
                </label>
                <label>
                  Password
                  <input
                    name="password"
                    type="password"
                    placeholder="Minimum 8 characters"
                    minLength={8}
                    required
                  />
                </label>
                <label>
                  Confirm password
                  <input
                    name="confirmPassword"
                    type="password"
                    placeholder="Re-enter password"
                    minLength={8}
                    required
                  />
                </label>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={confirmation.isSubmitting}
                >
                  {confirmation.isSubmitting ? 'Creating account...' : 'Create Secure Account'}
                </button>
              </form>
            ) : null}

            {mode === 'confirm' ? (
              <form className="auth-form" onSubmit={handleConfirm}>
                <label>
                  Email address
                  <input
                    name="email"
                    type="email"
                    placeholder="name@hospital.org"
                    defaultValue={confirmation.email || ''}
                    required
                  />
                </label>
                <label>
                  Confirmation code
                  <input
                    name="confirmationCode"
                    type="text"
                    inputMode="numeric"
                    placeholder="Enter the code from your email"
                    required
                  />
                </label>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={confirmation.isSubmitting}
                >
                  {confirmation.isSubmitting ? 'Confirming...' : 'Confirm And Return To Login'}
                </button>
              </form>
            ) : null}
          </>
        )}
      </section>
    </main>
  )
}
