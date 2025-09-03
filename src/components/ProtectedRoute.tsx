import { useUser } from '@clerk/clerk-react'
import { ComponentChildren } from 'preact'

interface ProtectedRouteProps {
  children: ComponentChildren
  fallback?: ComponentChildren
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
    
    window.location.href = '/sign-in'
    return null
  }

  return <>{children}</>
}

export default ProtectedRoute