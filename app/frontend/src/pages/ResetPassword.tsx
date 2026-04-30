import { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Copy, Check } from 'lucide-react';

const API_BASE = '/api';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const tokenFromUrl = searchParams.get('token');
    if (tokenFromUrl) {
      setToken(tokenFromUrl);
    }
  }, [searchParams]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
                <div className="auth-success" style={{ marginBottom: '1.5rem' }}>
                  <strong>Password reset successful!</strong>
                  <p style={{ marginTop: '0.5rem' }}>
                    Redirecting to sign in...
                  </p>
                </div>

                <Link to="/sign-in" className="auth-button-primary">
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

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
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
                  className="auth-input"
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label htmlFor="confirmPassword">Confirm Password</label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  required
                  disabled={isLoading || !token}
                  className="auth-input"
                />
              </div>

              {!token && (
                <div className="auth-error" style={{ marginBottom: '1.25rem' }}>
                  No reset token provided. Please use the link from your email.
                </div>
              )}

              <div className="copy-link-section" style={{ 
                marginBottom: '1.5rem', 
                padding: '1rem', 
                background: '#f9f9f9', 
                border: '1px solid #eee',
                fontSize: '0.85rem'
              }}>
                <p style={{ margin: '0 0 0.5rem 0', color: '#666' }}>If you need to copy this reset link:</p>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input 
                    type="text" 
                    readOnly 
                    value={window.location.href} 
                    style={{ 
                      flex: 1, 
                      padding: '0.4rem', 
                      border: '1px solid #ddd', 
                      fontSize: '0.75rem',
                      background: '#fff'
                    }}
                  />
                  <button 
                    type="button" 
                    onClick={handleCopyLink}
                    style={{
                      padding: '0.4rem',
                      background: '#111',
                      color: '#fff',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title="Copy link"
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="auth-button-primary"
                disabled={isLoading || !token}
                style={{ width: '100%', marginTop: '0.5rem' }}
              >
                {isLoading ? 'Resetting...' : 'Reset Password'}
              </button>

              <div className="auth-footer" style={{ marginTop: '1.5rem' }}>
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
