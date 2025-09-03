import { ReactNode } from 'react'
import { useUser } from '@clerk/clerk-react'
import { Navigate } from 'react-router-dom'

interface ProtectedRouteProps {
  children: ReactNode
  fallback?: ReactNode
}

const ProtectedRoute = ({ children, fallback }: ProtectedRouteProps) => {
  const { isSignedIn, isLoaded } = useUser()

  if (!isLoaded) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    )
  }

  if (!isSignedIn) {
    if (fallback) {
      return <>{fallback}</>
    }
    
    return <Navigate to="/sign-in" replace />
  }

  return <>{children}</>
}

export default ProtectedRoute