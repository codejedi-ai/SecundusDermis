import { ReactNode } from 'react'
import { useAuth } from '../lib/auth-context'
import { Navigate } from 'react-router-dom'

interface ProtectedRouteProps {
  children: ReactNode
  fallback?: ReactNode
}

const ProtectedRoute = ({ children, fallback }: ProtectedRouteProps) => {
  const { user, isLoading } = useAuth()

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

    return <Navigate to="/account" replace />
  }

  return <>{children}</>
}

export default ProtectedRoute