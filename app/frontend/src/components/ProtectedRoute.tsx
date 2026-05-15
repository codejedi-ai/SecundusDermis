import { ReactNode } from 'react'
import { AUTH_ENABLED } from '../lib/auth-config'
import { useAuth } from '../lib/auth-context'
import { Navigate, useLocation } from 'react-router-dom'

interface ProtectedRouteProps {
  children: ReactNode
  fallback?: ReactNode
}

const ProtectedRoute = ({ children, fallback }: ProtectedRouteProps) => {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  if (!AUTH_ENABLED) {
    return <>{children}</>
  }

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