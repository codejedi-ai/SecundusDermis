import { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { API_BASE } from '../lib/api-base';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const tokenFromUrl = searchParams.get('token');
    if (tokenFromUrl) {
      setToken(tokenFromUrl);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (!token) {
      setError('Missing reset token');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: password }),
        credentials: 'include',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || 'Failed to reset password');
      }

      setSuccess(true);
      
      // Redirect to sign in after 3 seconds
      setTimeout(() => {
        navigate('/sign-in');
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="auth-page">
        <div className="auth-split-container">
          <div className="auth-left">
            <div className="auth-left-content">
              <h1 className="auth-left-title">Password Reset Successful</h1>
              <p className="auth-left-text">
                Your password has been reset successfully. You will be redirected to the sign in page shortly.
              </p>
            </div>
          </div>
          <div className="auth-right">
            <div className="auth-form-wrapper">
              <div className="auth-header">
                <h1 className="auth-title">Success!</h1>
                <p className="auth-description">
                  Your password has been reset
                </p>
              </div>

              <div className="auth-form">
                <div className="auth-success" style={{ padding: '1rem', background: '#d4edda', border: '1px solid #c3e6cb', borderRadius: '0.375rem', color: '#155724', marginBottom: '1rem' }}>
                  <strong>Password reset successful!</strong>
                  <p style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
                    Redirecting to sign in...
                  </p>
                </div>

                <Link to="/sign-in" className="auth-button-primary" style={{ display: 'inline-block', textDecoration: 'none' }}>
                  Sign In Now
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-split-container">
        <div className="auth-left">
          <div className="auth-left-content">
            <h1 className="auth-left-title">Reset Password</h1>
            <p className="auth-left-text">
              Enter your new password below.
            </p>
          </div>
        </div>
        <div className="auth-right">
          <div className="auth-form-wrapper">
            <div className="auth-header">
              <h1 className="auth-title">Set New Password</h1>
              <p className="auth-description">
                Enter your new password
              </p>
            </div>

            <form className="auth-form" onSubmit={handleSubmit}>
              {error && <div className="auth-error">{error}</div>}

              <div className="auth-input-group">
                <label htmlFor="password">New Password</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter new password"
                  required
                  disabled={isLoading || !token}
                  minLength={6}
                />
              </div>

              <div className="auth-input-group">
                <label htmlFor="confirmPassword">Confirm Password</label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  required
                  disabled={isLoading || !token}
                />
              </div>

              {!token && (
                <div className="auth-error" style={{ marginBottom: '1rem' }}>
                  No reset token provided. Please use the link from your email.
                </div>
              )}

              <button
                type="submit"
                className="auth-button-primary"
                disabled={isLoading || !token}
              >
                {isLoading ? 'Resetting...' : 'Reset Password'}
              </button>

              <div className="auth-footer">
                <p>
                  Remember your password?{' '}
                  <Link to="/sign-in" className="auth-link">Sign In</Link>
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
