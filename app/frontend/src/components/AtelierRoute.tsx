import { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth-context'
import { isAtelierExperience } from '../lib/experience-mode'

/**
 * Allows children only when the signed-in user has **Atelier** experience enabled.
 * Boutique users are sent to Account → Boutique vs Atelier to opt in.
 */
export default function AtelierRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
        <p>Loading…</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/sign-in" replace />
  }

  if (!isAtelierExperience(user)) {
    return <Navigate to="/account?section=experience" replace />
  }

  return <>{children}</>
}
