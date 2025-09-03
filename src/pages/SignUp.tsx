import { SignUp as ClerkSignUp } from '@clerk/clerk-react'

const SignUp = () => {
  return (
    <div className="auth-page">
      <div className="container">
        <div className="auth-container">
          <div className="auth-header">
            <h1 className="auth-title">Join Secundus Dermis</h1>
            <p className="auth-description">
              Create your account to access exclusive content, track orders, and join our community of confident women.
            </p>
          </div>
          
          <div className="auth-form-container">
            <ClerkSignUp 
              routing="path"
              path="/sign-up"
              signInUrl="/sign-in"
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
              Already have an account? <a href="/sign-in" className="auth-link">Sign in here</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SignUp