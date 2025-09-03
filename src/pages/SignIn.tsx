import { SignIn as ClerkSignIn } from '@clerk/clerk-react';
import './auth.css'; // Assuming your CSS file is named auth.css

const SignIn = () => {
  return (
    <div className="auth-page">
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
  );
};

export default SignIn;