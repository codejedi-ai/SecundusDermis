import React from 'react'
import { SignIn as ClerkSignIn } from '@clerk/clerk-react'

const SignIn = () => {
  return (
    <div className="auth-page">
      <div className="container">
        <div className="auth-container">
          <div className="auth-header">
            <h1 className="auth-title">Welcome Back</h1>
            <p className="auth-description">
              Sign in to your Secundus Dermis account to access your orders, preferences, and exclusive content.
            </p>
          </div>
          
          <div className="auth-form-container">
            <ClerkSignIn 
              routing="path"
              path="/sign-in"
              signUpUrl="/sign-up"
              redirectUrl="/"
              appearance={{
                elements: {
                  formButtonPrimary: 'auth-button-primary',
                  card: 'auth-card',
                  headerTitle: 'auth-header-title',
                  headerSubtitle: 'auth-header-subtitle',
                  socialButtonsBlockButton: 'auth-social-button',
                  formFieldInput: 'auth-input',
                  footerActionLink: 'auth-link'
                }
              }}
            />
          </div>
          
          <div className="auth-footer">
            <p>
              Don't have an account? <a href="/sign-up" className="auth-link">Sign up here</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SignIn