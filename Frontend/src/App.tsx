import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react'
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

type PatientSearchResult = {
  id: string
  form: PatientFormState
}

type PatientWorkspaceMode = 'search' | 'detail' | 'create'

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
  upload: `${apiBase}/upload?patient_id={patientId}`
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

function hasPatientData(data: PatientApiRecord) {
  return Boolean(
    data.Patients ||
      data.Vitals ||
      data.LabResults ||
      data.Lifestyle ||
      data.FamilyHistory ||
      data.Hospitalization
  )
}

export default function App() {
  const { token, login, logout, isLoading, error, clearError } = useAuth()
  const { confirmation, signup, confirmSignup, clearConfirmation } = useConfirmation()
  const [mode, setMode] = useState<AuthMode>('login')
  const [formError, setFormError] = useState<string | null>(null)
  const [patientLookupId, setPatientLookupId] = useState('')
  const [patientWorkspaceMode, setPatientWorkspaceMode] =
    useState<PatientWorkspaceMode>('search')
  const [patientSearchResult, setPatientSearchResult] = useState<PatientSearchResult | null>(
    null
  )
  const [activePatientId, setActivePatientId] = useState<string | null>(null)
  const [isEditingPatient, setIsEditingPatient] = useState(false)
  const [patientForm, setPatientForm] = useState<PatientFormState>(emptyPatientForm)
  const [patientMessage, setPatientMessage] = useState<string | null>(null)
  const [patientError, setPatientError] = useState<string | null>(null)
  const [recordStatus, setRecordStatus] = useState<'idle' | 'loading' | 'saving' | 'deleting'>(
    'idle'
  )
  const [images, setImages] = useState<ImageItem[]>([])
  const [imageStatus, setImageStatus] = useState<'idle' | 'loading' | 'uploading' | 'deleting'>(
    'idle'
  )
  const [imageMessage, setImageMessage] = useState<string | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)
  const [selectedFileName, setSelectedFileName] = useState('No scan selected')
  const scanInputRef = useRef<HTMLInputElement | null>(null)

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

  const patientPageTitle =
    activePatientId && patientWorkspaceMode === 'detail'
      ? `Patient ${activePatientId}`
      : 'Patient Dashboard'

  function resetClinicalWorkspace() {
    setPatientLookupId('')
    setPatientWorkspaceMode('search')
    setPatientSearchResult(null)
    setActivePatientId(null)
    setIsEditingPatient(false)
    setPatientForm(emptyPatientForm)
    setPatientMessage(null)
    setPatientError(null)
    setImages([])
    setImageError(null)
    setImageMessage(null)
    setSelectedFileName('No scan selected')
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
        throw new Error(getErrorMessage(payload, 'Unable to load patient scans'))
      }

      setImages(Array.isArray(payload.images) ? payload.images : [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load patient scans'
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
    setPatientWorkspaceMode('search')
    setPatientSearchResult(null)
    setActivePatientId(null)
    setIsEditingPatient(false)
    setPatientForm(emptyPatientForm)
    setImages([])
    setImageError(null)
    setImageMessage(null)

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

      if (!hasPatientData(payload)) {
        throw new Error(`No patient found for ID ${patientId}.`)
      }

      const normalizedPatient = normalizePatientRecord(payload)
      setPatientSearchResult({ id: patientId, form: normalizedPatient })
      setPatientLookupId(patientId)
      setPatientMessage(`Found patient ${patientId}. Select the patient below to view the full record.`)
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

  async function handlePatientSelect(patient: PatientSearchResult) {
    setPatientWorkspaceMode('detail')
    setActivePatientId(patient.id)
    setIsEditingPatient(false)
    setPatientLookupId(patient.id)
    setPatientForm(patient.form)
    setPatientMessage(`Viewing patient ${patient.id}.`)
    setPatientError(null)
    await loadImages(patient.id)
  }

  function handleCreateNewPatient() {
    setPatientWorkspaceMode('create')
    setPatientSearchResult(null)
    setActivePatientId(null)
    setIsEditingPatient(true)
    setPatientForm(emptyPatientForm)
    setImages([])
    setImageError(null)
    setImageMessage(null)
    setPatientError(null)
    setPatientMessage('Ready for a new patient.')
  }

  async function handlePatientSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setRecordStatus('saving')
    setPatientError(null)
    setPatientMessage(null)

    const patientIdAtSubmit = activePatientId
    const patientPayload = { ...patientForm }
    const method = patientIdAtSubmit ? 'PUT' : 'POST'
    const url = patientIdAtSubmit
      ? fillTemplate(routes.patientById, { id: patientIdAtSubmit })
      : routes.patients

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(patientPayload)
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
        payload.patient_id !== undefined ? String(payload.patient_id) : patientIdAtSubmit

      if (nextId) {
        setActivePatientId(nextId)
        setPatientLookupId(nextId)
        setPatientWorkspaceMode('detail')
        setIsEditingPatient(false)
        setPatientSearchResult({ id: nextId, form: patientPayload })
      }

      setPatientMessage(patientIdAtSubmit ? 'Patient updated.' : `Patient created: ${nextId}.`)
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
    const uploadForm = event.currentTarget

    if (!activePatientId) {
      setImageError('Open a patient first.')
      return
    }

    const formData = new FormData(uploadForm)
    const file = formData.get('mriFile')

    if (!(file instanceof File) || !file.size) {
      setImageError('Choose a scan file first.')
      return
    }

    setImageStatus('uploading')
    setImageError(null)
    setImageMessage(null)

    try {
      const response = await fetch(fillTemplate(routes.upload, { patientId: activePatientId }), {
        method: 'POST',
        headers: {
          'Content-Type': file.type || 'image/png'
        },
        body: await file.arrayBuffer()
      })

      if (response.type !== 'opaque' && !response.ok) {
        const payload = (await parseApiResponse(response)) as { error?: string; message?: string }
        throw new Error(getErrorMessage(payload, 'Unable to upload scan'))
      }

      setImageMessage('Scan uploaded.')
      uploadForm.reset()
      setSelectedFileName('No scan selected')
      await loadImages(activePatientId)
    } catch (err) {
      if (err instanceof TypeError) {
        setImageMessage('Scan uploaded. Refreshing patient scans.')
        uploadForm.reset()
        setSelectedFileName('No scan selected')
        await loadImages(activePatientId)
        return
      }

      const message = err instanceof Error ? err.message : 'Unable to upload scan'
      setImageError(message)
    } finally {
      setImageStatus('idle')
    }
  }

  function handleImageSelection(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    setSelectedFileName(file?.name || 'No scan selected')
  }

  function handleClearSelectedScan() {
    if (scanInputRef.current) {
      scanInputRef.current.value = ''
    }
    setSelectedFileName('No scan selected')
    setImageError(null)
  }

  async function handleRemoveScan(scanKey: string) {
    if (!activePatientId) {
      setImageError('Open a patient first.')
      return
    }

    setImageStatus('deleting')
    setImageError(null)
    setImageMessage(null)

    try {
      const deleteUrl = `${fillTemplate(routes.upload, {
        patientId: activePatientId
      })}&key=${encodeURIComponent(scanKey)}`

      const response = await fetch(deleteUrl, {
        method: 'DELETE'
      })
      const payload = (await parseApiResponse(response)) as { error?: string; message?: string }

      if (!response.ok) {
        throw new Error(getErrorMessage(payload, 'Delete scan route is not deployed yet.'))
      }

      setImages((currentImages) => currentImages.filter((image) => image.key !== scanKey))
      setImageMessage('Scan removed.')
    } catch (err) {
      setImages((currentImages) => currentImages.filter((image) => image.key !== scanKey))
      const message =
        err instanceof Error
          ? `${err.message} Removed from this view only.`
          : 'Removed from this view only.'
      setImageError(message)
    } finally {
      setImageStatus('idle')
    }
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
            <h2>{patientPageTitle}</h2>
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

        <div
          className={
            activePatientId && patientWorkspaceMode === 'detail'
              ? 'dashboard-grid'
              : 'dashboard-grid single-column'
          }
        >
          <div className="panel-card">
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
                {recordStatus === 'loading' ? 'Searching...' : 'Search patient'}
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={handleCreateNewPatient}
              >
                Create new patient
              </button>
            </form>

            {patientSearchResult && patientWorkspaceMode === 'search' ? (
              <div className="patient-results" aria-label="Patient search results">
                <button
                  type="button"
                  className="patient-result-button"
                  onClick={() => void handlePatientSelect(patientSearchResult)}
                >
                  <strong>{patientSearchResult.id}</strong>
                  <span>Open full patient record</span>
                </button>
              </div>
            ) : null}

            {patientWorkspaceMode === 'detail' && !isEditingPatient ? (
              <section className="patient-summary" aria-label="Patient details">
                {patientFieldGroups.map((group) => (
                  <article key={group.title} className="summary-group">
                    <div className="summary-header">
                      <h4>{group.title}</h4>
                      {group.title === 'Patient' ? (
                        <button
                          type="button"
                          className="patient-action-button"
                          onClick={() => setIsEditingPatient(true)}
                        >
                          Edit patient details
                        </button>
                      ) : null}
                    </div>
                    <div className="summary-grid">
                      {group.fields.map((field) => (
                        <div key={field} className="summary-item">
                          <span>{field}</span>
                          <strong>{patientForm[field] || 'Not recorded'}</strong>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </section>
            ) : null}

            {(patientWorkspaceMode === 'detail' && isEditingPatient) ||
            patientWorkspaceMode === 'create' ? (
              <form className="patient-form" onSubmit={handlePatientSave}>
                  <button
                    type="submit"
                    className="patient-action-button"
                    disabled={recordStatus === 'saving'}
                  >
                    {recordStatus === 'saving'
                      ? activePatientId
                        ? 'Saving...'
                        : 'Creating...'
                      : activePatientId
                        ? 'Save patient data'
                        : 'Create patient'}
                  </button>

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
              </form>
            ) : null}
          </div>

          {activePatientId && patientWorkspaceMode === 'detail' ? (
            <div className="panel-card side-card">
              <div className="card-header">
                <h3>Patient scans</h3>
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
                  onClick={() => void loadImages(activePatientId)}
                  disabled={imageStatus === 'loading'}
                >
                  {imageStatus === 'loading' ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>

              <form className="upload-form" onSubmit={handleImageUpload}>
                <label className="file-picker">
                  <span>Select scan</span>
                  <input
                    ref={scanInputRef}
                    name="mriFile"
                    type="file"
                    accept=".png,.jpg,.jpeg"
                    onChange={handleImageSelection}
                  />
                </label>
                {selectedFileName !== 'No scan selected' ? (
                  <div className="selected-scan-card">
                    <span>{selectedFileName}</span>
                    <button
                      type="button"
                      aria-label="Remove selected scan"
                      onClick={handleClearSelectedScan}
                      disabled={imageStatus === 'uploading'}
                    >
                      x
                    </button>
                  </div>
                ) : null}
                <button
                  type="submit"
                  className="primary-button"
                  disabled={imageStatus === 'uploading'}
                >
                  {imageStatus === 'uploading' ? 'Uploading...' : 'Upload scan'}
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
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => void handleRemoveScan(image.key)}
                        disabled={imageStatus === 'deleting'}
                      >
                        {imageStatus === 'deleting' ? 'Removing...' : 'Remove scan'}
                      </button>
                    </article>
                  ))
                ) : (
                  <div className="empty-state">
                    <strong>No scans yet</strong>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  )
}
