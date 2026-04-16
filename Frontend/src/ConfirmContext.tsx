import React, { createContext, useContext, useState } from 'react'

type SignupApiResponse = {
  message?: string
  error?: string
}

type ConfirmApiResponse = {
  message?: string
  error?: string
}

type ConfirmationState = {
  email: string | null
  signupMessage: string | null
  confirmMessage: string | null
  error: string | null
  isSubmitting: boolean
}

type ConfirmContextType = {
  confirmation: ConfirmationState
  signup: (email: string, password: string) => Promise<string | undefined>
  confirmSignup: (email: string, confirmationCode: string) => Promise<string | undefined>
  clearConfirmation: () => void
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined)

const apiBase = 'https://58rcz6xwc9.execute-api.us-east-2.amazonaws.com/Prod'

const initialState: ConfirmationState = {
  email: null,
  signupMessage: null,
  confirmMessage: null,
  error: null,
  isSubmitting: false
}

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [confirmation, setConfirmationState] = useState<ConfirmationState>(initialState)

  const clearConfirmation = () => {
    setConfirmationState(initialState)
  }

  const signup = async (email: string, password: string) => {
    setConfirmationState({
      email,
      signupMessage: null,
      confirmMessage: null,
      error: null,
      isSubmitting: true
    })

    try {
      const res = await fetch(`${apiBase}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })

      const data = (await res.json()) as SignupApiResponse

      if (!res.ok) {
        throw new Error(data.error || 'Account creation failed')
      }

      setConfirmationState({
        email,
        signupMessage: data.message || 'Account request submitted. Check email for your code.',
        confirmMessage: null,
        error: null,
        isSubmitting: false
      })

      return data.message
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'An unexpected registration error occurred'

      setConfirmationState({
        email,
        signupMessage: null,
        confirmMessage: null,
        error: message,
        isSubmitting: false
      })

      throw err
    }
  }

  const confirmSignup = async (email: string, confirmationCode: string) => {
    setConfirmationState((current) => ({
      ...current,
      email,
      confirmMessage: null,
      error: null,
      isSubmitting: true
    }))

    try {
      const res = await fetch(`${apiBase}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, confirmation_code: confirmationCode })
      })

      const data = (await res.json()) as ConfirmApiResponse

      if (!res.ok) {
        throw new Error(data.error || 'Confirmation failed')
      }

      setConfirmationState({
        email,
        signupMessage: null,
        confirmMessage: data.message || 'Signup confirmed. You may now log in.',
        error: null,
        isSubmitting: false
      })

      return data.message
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'An unexpected confirmation error occurred'

      setConfirmationState((current) => ({
        ...current,
        email,
        confirmMessage: null,
        error: message,
        isSubmitting: false
      }))

      throw err
    }
  }

  return (
    <ConfirmContext.Provider value={{ confirmation, signup, confirmSignup, clearConfirmation }}>
      {children}
    </ConfirmContext.Provider>
  )
}

export const useConfirmation = () => {
  const context = useContext(ConfirmContext)
  if (context === undefined) {
    throw new Error('useConfirmation must be used within a ConfirmProvider')
  }
  return context
}
