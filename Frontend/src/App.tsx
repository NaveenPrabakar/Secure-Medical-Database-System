import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react'
import { useAuth } from './AuthContext'
import { useConfirmation } from './ConfirmContext'

type AuthMode = 'login' | 'signup' | 'confirm'

type PatientFormState = Record<(typeof patientFieldLabels)[number], string>

type PatientApiRecord = {
  Patients?: {
    age?: string
    gender?: string
  }
  Vitals?: {
    glucose?: string
    blood_pressure?: string
    bmi?: string
    oxygen_saturation?: string
  }
  LabResults?: {
    cholesterol?: string
    triglycerides?: string
    hba1c?: string
  }
  Lifestyle?: {
    smoking?: string
    alcohol?: string
    physical_activity?: string
    diet_score?: string
    sleep_hours?: string
    stress_level?: string
  }
  FamilyHistory?: {
    has_family_history?: string
  }
  Hospitalization?: {
    length_of_stay?: string
  }
  error?: string
  message?: string
}

type ImageItem = {
  key: string
  url: string
}

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

const authModes: Array<{ id: AuthMode; label: string }> = [
  { id: 'login', label: 'Staff Sign In' },
  { id: 'signup', label: 'Create Account' },
  { id: 'confirm', label: 'Confirm Email' }
]

const patientFieldLabels = [
  'Age',
  'Gender',
  'Medical Condition',
  'Glucose',
  'Blood Pressure',
  'BMI',
  'Oxygen Saturation',
  'Cholesterol',
  'Triglycerides',
  'HbA1c',
  'Smoking',
  'Alcohol',
  'Physical Activity',
  'Diet Score',
  'Sleep Hours',
  'Stress Level',
  'Family History',
  'LengthOfStay'
] as const

const patientFieldGroups = [
  { title: 'Patient', fields: ['Age', 'Gender', 'Medical Condition'] as const },
  { title: 'Vitals', fields: ['Glucose', 'Blood Pressure', 'BMI', 'Oxygen Saturation'] as const },
  { title: 'Labs', fields: ['Cholesterol', 'Triglycerides', 'HbA1c'] as const },
  {
    title: 'Lifestyle',
    fields: [
      'Smoking',
      'Alcohol',
      'Physical Activity',
      'Diet Score',
      'Sleep Hours',
      'Stress Level'
    ] as const
  },
  { title: 'History', fields: ['Family History', 'LengthOfStay'] as const }
]

const apiBase = 'https://58rcz6xwc9.execute-api.us-east-2.amazonaws.com/Prod'

const routes = {
  patients: `${apiBase}/patients`,
  patientById: `${apiBase}/patients/{id}`,
  images: `${apiBase}/images/{patientId}`,
  upload: `${apiBase}/images/upload?patient_id={patientId}`
}

const emptyPatientForm = patientFieldLabels.reduce((acc, field) => {
  acc[field] = ''
  return acc
}, {} as PatientFormState)

function fillTemplate(template: string, values: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? '')
}

async function parseApiResponse(response: Response) {
  const text = await response.text()
  if (!text) {
    return {}
  }

  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    return { message: text }
  }
}

function getErrorMessage(payload: Record<string, unknown>, fallback: string) {
  const error = payload.error
  const message = payload.message
  if (typeof error === 'string' && error.trim()) {
    return error
  }
  if (typeof message === 'string' && message.trim()) {
    return message
  }
  return fallback
}

function normalizePatientRecord(data: PatientApiRecord): PatientFormState {
  return {
    Age: data.Patients?.age ? String(data.Patients.age) : '',
    Gender: data.Patients?.gender ? String(data.Patients.gender) : '',
    'Medical Condition': '',
    Glucose: data.Vitals?.glucose ? String(data.Vitals.glucose) : '',
    'Blood Pressure': data.Vitals?.blood_pressure ? String(data.Vitals.blood_pressure) : '',
    BMI: data.Vitals?.bmi ? String(data.Vitals.bmi) : '',
    'Oxygen Saturation': data.Vitals?.oxygen_saturation
      ? String(data.Vitals.oxygen_saturation)
      : '',
    Cholesterol: data.LabResults?.cholesterol ? String(data.LabResults.cholesterol) : '',
    Triglycerides: data.LabResults?.triglycerides ? String(data.LabResults.triglycerides) : '',
    HbA1c: data.LabResults?.hba1c ? String(data.LabResults.hba1c) : '',
    Smoking: data.Lifestyle?.smoking ? String(data.Lifestyle.smoking) : '',
    Alcohol: data.Lifestyle?.alcohol ? String(data.Lifestyle.alcohol) : '',
    'Physical Activity': data.Lifestyle?.physical_activity
      ? String(data.Lifestyle.physical_activity)
      : '',
    'Diet Score': data.Lifestyle?.diet_score ? String(data.Lifestyle.diet_score) : '',
    'Sleep Hours': data.Lifestyle?.sleep_hours ? String(data.Lifestyle.sleep_hours) : '',
    'Stress Level': data.Lifestyle?.stress_level ? String(data.Lifestyle.stress_level) : '',
    'Family History': data.FamilyHistory?.has_family_history
      ? String(data.FamilyHistory.has_family_history)
      : '',
    LengthOfStay: data.Hospitalization?.length_of_stay
      ? String(data.Hospitalization.length_of_stay)
      : ''
  }
}

export default function App() {
  const { token, login, logout, isLoading, error, clearError } = useAuth()
  const { confirmation, signup, confirmSignup, clearConfirmation } = useConfirmation()
  const [mode, setMode] = useState<AuthMode>('login')
  const [formError, setFormError] = useState<string | null>(null)
  const [patientLookupId, setPatientLookupId] = useState('')
  const [activePatientId, setActivePatientId] = useState<string | null>(null)
  const [patientForm, setPatientForm] = useState<PatientFormState>(emptyPatientForm)
  const [patientMessage, setPatientMessage] = useState<string | null>(null)
  const [patientError, setPatientError] = useState<string | null>(null)
  const [recordStatus, setRecordStatus] = useState<'idle' | 'loading' | 'saving' | 'deleting'>(
    'idle'
  )
  const [images, setImages] = useState<ImageItem[]>([])
  const [imageStatus, setImageStatus] = useState<'idle' | 'loading' | 'uploading'>('idle')
  const [imageMessage, setImageMessage] = useState<string | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)
  const [selectedFileName, setSelectedFileName] = useState('No file selected')

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

  function resetClinicalWorkspace() {
    setPatientLookupId('')
    setActivePatientId(null)
    setPatientForm(emptyPatientForm)
    setPatientMessage(null)
    setPatientError(null)
    setImages([])
    setImageError(null)
    setImageMessage(null)
    setSelectedFileName('No file selected')
  }

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode)
    clearError()
    clearConfirmation()
    setFormError(null)
  }

  function getAuthHeaders(): HeadersInit {
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

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
      return
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
      return
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
      return
    }
  }

  function handleFieldChange(field: (typeof patientFieldLabels)[number], value: string) {
    setPatientForm((current) => ({
      ...current,
      [field]: value
    }))
  }

  async function loadImages(patientId: string) {
    setImageStatus('loading')
    setImageError(null)

    try {
      const response = await fetch(fillTemplate(routes.images, { patientId }), {
        headers: {
          Accept: 'application/json',
          ...getAuthHeaders()
        }
      })
      const payload = (await parseApiResponse(response)) as {
        images?: ImageItem[]
        error?: string
        message?: string
      }

      if (!response.ok) {
        throw new Error(getErrorMessage(payload, 'Unable to load images'))
      }

      setImages(Array.isArray(payload.images) ? payload.images : [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load images'
      setImages([])
      setImageError(message)
    } finally {
      setImageStatus('idle')
    }
  }

  async function loadPatient(patientId: string) {
    setRecordStatus('loading')
    setPatientError(null)
    setPatientMessage(null)

    try {
      const response = await fetch(fillTemplate(routes.patientById, { id: patientId }), {
        headers: {
          Accept: 'application/json',
          ...getAuthHeaders()
        }
      })
      const payload = (await parseApiResponse(response)) as PatientApiRecord

      if (!response.ok) {
        throw new Error(getErrorMessage(payload, 'Unable to load patient'))
      }

      setPatientForm(normalizePatientRecord(payload))
      setActivePatientId(patientId)
      setPatientLookupId(patientId)
      setPatientMessage(`Loaded patient ${patientId}.`)
      await loadImages(patientId)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load patient'
      setPatientError(message)
      setImages([])
    } finally {
      setRecordStatus('idle')
    }
  }

  async function handlePatientLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const patientId = patientLookupId.trim()

    if (!patientId) {
      setPatientError('Enter a patient ID.')
      return
    }

    await loadPatient(patientId)
  }

  async function handlePatientSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setRecordStatus('saving')
    setPatientError(null)
    setPatientMessage(null)

    const method = activePatientId ? 'PUT' : 'POST'
    const url = activePatientId
      ? fillTemplate(routes.patientById, { id: activePatientId })
      : routes.patients

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(patientForm)
      })

      const payload = (await parseApiResponse(response)) as {
        patient_id?: string | number
        error?: string
        message?: string
      }

      if (!response.ok) {
        throw new Error(getErrorMessage(payload, 'Unable to save patient'))
      }

      const nextId =
        payload.patient_id !== undefined ? String(payload.patient_id) : activePatientId

      if (nextId) {
        setActivePatientId(nextId)
        setPatientLookupId(nextId)
      }

      setPatientMessage(activePatientId ? 'Patient updated.' : `Patient created: ${nextId}.`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to save patient'
      setPatientError(message)
    } finally {
      setRecordStatus('idle')
    }
  }

  async function handleDeletePatient() {
    if (!activePatientId) {
      setPatientError('Load a patient first.')
      return
    }

    setRecordStatus('deleting')
    setPatientError(null)
    setPatientMessage(null)

    try {
      const response = await fetch(fillTemplate(routes.patientById, { id: activePatientId }), {
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
          ...getAuthHeaders()
        }
      })
      const payload = (await parseApiResponse(response)) as { error?: string; message?: string }

      if (!response.ok) {
        throw new Error(getErrorMessage(payload, 'Unable to delete patient'))
      }

      const deletedId = activePatientId
      resetClinicalWorkspace()
      setPatientMessage(`Patient ${deletedId} deleted.`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to delete patient'
      setPatientError(message)
    } finally {
      setRecordStatus('idle')
    }
  }

  async function handleImageUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!activePatientId) {
      setImageError('Load or create a patient first.')
      return
    }

    const formData = new FormData(event.currentTarget)
    const file = formData.get('mriFile')

    if (!(file instanceof File) || !file.size) {
      setImageError('Choose an image file first.')
      return
    }

    setImageStatus('uploading')
    setImageError(null)
    setImageMessage(null)

    try {
      const response = await fetch(fillTemplate(routes.upload, { patientId: activePatientId }), {
        method: 'POST',
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
          ...getAuthHeaders()
        },
        body: await file.arrayBuffer()
      })
      const payload = (await parseApiResponse(response)) as { error?: string; message?: string }

      if (!response.ok) {
        throw new Error(getErrorMessage(payload, 'Unable to upload image'))
      }

      setImageMessage('Image uploaded.')
      event.currentTarget.reset()
      setSelectedFileName('No file selected')
      await loadImages(activePatientId)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to upload image'
      setImageError(message)
    } finally {
      setImageStatus('idle')
    }
  }

  function handleImageSelection(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    setSelectedFileName(file?.name || 'No file selected')
  }

  if (!isAuthenticated) {
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
              <h2>Sign in, enroll, and confirm access</h2>
            </div>
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

          <div className="mode-switch" role="tablist" aria-label="Authentication mode">
            {authModes.map((item) => (
              <button
                key={item.id}
                type="button"
                className={mode === item.id ? 'mode-button active' : 'mode-button'}
                onClick={() => switchMode(item.id)}
              >
                {item.label}
              </button>
            ))}
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
        </section>
      </main>
    )
  }

  return (
    <main className="dashboard-shell">
      <section className="dashboard-panel">
        <header className="panel-header">
          <div>
            <span className="eyebrow">Staff Workspace</span>
            <h2>Patient dashboard</h2>
          </div>
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              logout()
              resetClinicalWorkspace()
            }}
          >
            Sign out
          </button>
        </header>

        <section className="session-card">
          <span className="session-label">Authenticated access token</span>
          <p className="session-token">{sessionPreview}</p>
        </section>

        <div className="dashboard-grid">
          <div className="panel-card">
            <div className="card-header">
              <h3>Patients</h3>
              <span>{activePatientId ? `ID ${activePatientId}` : 'New record'}</span>
            </div>

            {patientMessage ? (
              <div className="banner banner-success compact-banner">
                <p>{patientMessage}</p>
              </div>
            ) : null}

            {patientError ? (
              <div className="banner banner-error compact-banner">
                <p>{patientError}</p>
              </div>
            ) : null}

            <form className="lookup-form" onSubmit={handlePatientLookup}>
              <label>
                Patient ID
                <input
                  type="text"
                  value={patientLookupId}
                  onChange={(event) => setPatientLookupId(event.target.value)}
                  placeholder="Enter patient id"
                />
              </label>
              <button
                type="submit"
                className="secondary-button"
                disabled={recordStatus === 'loading'}
              >
                {recordStatus === 'loading' ? 'Loading...' : 'Load'}
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  resetClinicalWorkspace()
                  setPatientMessage('Ready for a new patient.')
                }}
              >
                New
              </button>
            </form>

            <form className="patient-form" onSubmit={handlePatientSave}>
              {patientFieldGroups.map((group) => (
                <fieldset key={group.title} className="field-group">
                  <legend>{group.title}</legend>
                  <div className="field-grid">
                    {group.fields.map((field) => (
                      <label key={field}>
                        {field}
                        <input
                          type="text"
                          value={patientForm[field]}
                          onChange={(event) => handleFieldChange(field, event.target.value)}
                        />
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}

              <div className="action-row">
                <button
                  type="submit"
                  className="primary-button"
                  disabled={recordStatus === 'saving'}
                >
                  {recordStatus === 'saving'
                    ? activePatientId
                      ? 'Updating...'
                      : 'Creating...'
                    : activePatientId
                      ? 'Update patient'
                      : 'Create patient'}
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleDeletePatient}
                  disabled={!activePatientId || recordStatus === 'deleting'}
                >
                  {recordStatus === 'deleting' ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </form>
          </div>

          <div className="panel-card side-card">
            <div className="card-header">
              <h3>Images</h3>
              <span>{images.length} files</span>
            </div>

            {imageMessage ? (
              <div className="banner banner-success compact-banner">
                <p>{imageMessage}</p>
              </div>
            ) : null}

            {imageError ? (
              <div className="banner banner-error compact-banner">
                <p>{imageError}</p>
              </div>
            ) : null}

            <div className="image-toolbar">
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  if (activePatientId) {
                    void loadImages(activePatientId)
                  } else {
                    setImageError('Load or create a patient first.')
                  }
                }}
                disabled={imageStatus === 'loading'}
              >
                {imageStatus === 'loading' ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>

            <form className="upload-form" onSubmit={handleImageUpload}>
              <label className="file-picker">
                <span>Select image</span>
                <input
                  name="mriFile"
                  type="file"
                  accept=".png,.jpg,.jpeg"
                  onChange={handleImageSelection}
                />
                <strong>{selectedFileName}</strong>
              </label>
              <button
                type="submit"
                className="primary-button"
                disabled={imageStatus === 'uploading'}
              >
                {imageStatus === 'uploading' ? 'Uploading...' : 'Upload'}
              </button>
            </form>

            <div className="images-list">
              {images.length ? (
                images.map((image) => (
                  <article key={image.key} className="image-card">
                    <div>
                      <strong>{image.key.split('/').pop()}</strong>
                      <p>{image.key}</p>
                    </div>
                    <a href={image.url} target="_blank" rel="noreferrer">
                      Open
                    </a>
                  </article>
                ))
              ) : (
                <div className="empty-state">
                  <strong>No images yet</strong>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
