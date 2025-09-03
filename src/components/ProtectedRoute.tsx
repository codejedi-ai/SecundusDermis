import React, { ReactNode } from 'react'
import { useUser } from '@clerk/clerk-react'

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
    
    window.location.href = '/sign-in'
    return null
  }

  return <>{children}</>
}

export default ProtectedRoute