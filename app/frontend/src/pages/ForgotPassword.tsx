import { useState } from 'react';
import { Link } from 'react-router-dom';

const API_BASE = '/api';

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

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const d = data.detail;
        const msg =
          typeof d === 'string'
            ? d
            : Array.isArray(d)
              ? d.map((x: { msg?: string }) => x.msg || '').filter(Boolean).join(' ')
              : 'Failed to request password reset';
        throw new Error(msg || 'Failed to request password reset');
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
                <div className="auth-success">
                  <strong>Reset link sent!</strong>
                  <p>
                    Check your email for the password reset link.
                  </p>
                </div>

                {resetToken && (
                  <div className="auth-info">
                    <strong>Development Mode:</strong>
                    <p style={{ marginBottom: '0.75rem' }}>
                      Reset Token: <code>{resetToken}</code>
                    </p>
                    <Link
                      to={`/reset-password?token=${resetToken}`}
                      className="auth-button-primary" style={{ width: '100%', marginTop: '0.5rem' }}
                    >
                      Go to Reset Password
                    </Link>
                  </div>
                )}

                <div className="auth-footer" style={{ marginTop: '1.5rem' }}>
                  <p>
                    <Link to="/sign-in" className="auth-link">← Back to Sign In</Link>
                  </p>
                </div>
              </div>
            ) : (
              <form className="auth-form" onSubmit={handleSubmit}>
                {error && <div className="auth-error">{error}</div>}

                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                  <label htmlFor="email">Email Address</label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    disabled={isLoading}
                    className="auth-input"
                  />
                </div>

                <button
                  type="submit"
                  className="auth-button-primary" style={{ width: '100%', marginTop: '0.5rem' }}
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
