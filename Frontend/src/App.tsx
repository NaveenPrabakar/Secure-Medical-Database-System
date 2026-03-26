import { useState } from 'react'

type LoginResponse = {
  access_token?: string
  token_type?: string
  detail?: string
}

type Patient = {
  id: number
  name: string
  dob?: string | null
  notes?: string | null
}

type PatientsResponse = {
  items: Patient[]
}

const apiBase = 'http://localhost:8000/api/v1'

export default function App() {
  const [loginResult, setLoginResult] = useState<LoginResponse | null>(null)
  const [patients, setPatients] = useState<Patient[]>([])
  const [loadingPatients, setLoadingPatients] = useState(false)

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    const payload = Object.fromEntries(formData.entries())

    const res = await fetch(`${apiBase}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    const data = (await res.json()) as LoginResponse
    setLoginResult(data)
  }

  async function loadPatients() {
    setLoadingPatients(true)
    try {
      const res = await fetch(`${apiBase}/patients`)
      const data = (await res.json()) as PatientsResponse
      setPatients(data.items || [])
    } finally {
      setLoadingPatients(false)
    }
  }

  return (
    <main className="app">
      <header className="hero">
        <h1>Secure Medical Database</h1>
        <p>React + Vite scaffold wired to the FastAPI backend.</p>
      </header>

      <section className="card">
        <h2>Login</h2>
        <form onSubmit={handleLogin} className="stack">
          <input name="email" type="email" placeholder="email" required />
          <input name="password" type="password" placeholder="password" required />
          <button type="submit">Sign in</button>
        </form>
        <pre className="result">{loginResult ? JSON.stringify(loginResult, null, 2) : '—'}</pre>
      </section>

      <section className="card">
        <div className="row">
          <h2>Patients</h2>
          <button onClick={loadPatients} disabled={loadingPatients}>
            {loadingPatients ? 'Loading...' : 'Load patients'}
          </button>
        </div>
        <pre className="result">{patients.length ? JSON.stringify(patients, null, 2) : '—'}</pre>
      </section>
    </main>
  )
}
