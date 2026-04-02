import { useState } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE } from '../lib/api-base';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE}/auth/request-password-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
        credentials: 'include',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || 'Failed to request password reset');
      }

      setSubmitted(true);
      // For testing purposes, show the token
      if (data.token) {
        setResetToken(data.token);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request password reset');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-split-container">
        <div className="auth-left">
          <div className="auth-left-content">
            <h1 className="auth-left-title">Forgot Password</h1>
            <p className="auth-left-text">
              No worries! Enter your email address and we'll send you a link to reset your password.
            </p>
          </div>
        </div>
        <div className="auth-right">
          <div className="auth-form-wrapper">
            <div className="auth-header">
              <h1 className="auth-title">Reset Your Password</h1>
              <p className="auth-description">
                Enter your email to receive a reset link
              </p>
            </div>

            {submitted ? (
              <div className="auth-form">
                <div className="auth-success" style={{ padding: '1rem', background: '#d4edda', border: '1px solid #c3e6cb', borderRadius: '0.375rem', color: '#155724', marginBottom: '1rem' }}>
                  <strong>Reset link sent!</strong>
                  <p style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
                    Check your email for the password reset link.
                  </p>
                </div>

                {resetToken && (
                  <div className="auth-info" style={{ padding: '1rem', background: '#fff3cd', border: '1px solid #ffeeba', borderRadius: '0.375rem', color: '#856404', marginBottom: '1rem' }}>
                    <strong>Development Mode:</strong>
                    <p style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
                      Reset Token: <code style={{ background: '#fff', padding: '0.25rem 0.5rem', borderRadius: '0.25rem' }}>{resetToken}</code>
                    </p>
                    <Link 
                      to={`/reset-password?token=${resetToken}`}
                      className="auth-button-primary"
                      style={{ display: 'inline-block', marginTop: '0.5rem', textDecoration: 'none' }}
                    >
                      Go to Reset Password
                    </Link>
                  </div>
                )}

                <Link to="/sign-in" className="auth-link">
                  ← Back to Sign In
                </Link>
              </div>
            ) : (
              <form className="auth-form" onSubmit={handleSubmit}>
                {error && <div className="auth-error">{error}</div>}

                <div className="auth-input-group">
                  <label htmlFor="email">Email Address</label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    disabled={isLoading}
                  />
                </div>

                <button
                  type="submit"
                  className="auth-button-primary"
                  disabled={isLoading}
                >
                  {isLoading ? 'Sending...' : 'Send Reset Link'}
                </button>

                <div className="auth-footer">
                  <p>
                    Remember your password?{' '}
                    <Link to="/sign-in" className="auth-link">Sign In</Link>
                  </p>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
