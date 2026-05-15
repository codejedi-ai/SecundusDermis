import { ReactNode } from 'react'
import { useAuth } from '../lib/auth-context'
import { Navigate, useLocation } from 'react-router-dom'

interface ProtectedRouteProps {
  children: ReactNode
  fallback?: ReactNode
}

/** Requires a signed-in user. Parent ``PatronAuthOutlet`` disables the whole tree when auth is off. */
const ProtectedRoute = ({ children, fallback }: ProtectedRouteProps) => {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    )
  }

  if (!user) {
    if (fallback) {
      return <>{fallback}</>
    }

    return <Navigate to="/sign-in" replace state={{ from: location }} />
  }

  return <>{children}</>
}

export default ProtectedRoute