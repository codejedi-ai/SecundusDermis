import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';

const SignIn = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo =
    (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await signIn(email, password);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-split-container">
        <div className="auth-left">
          <div className="auth-left-content">
            <h1 className="auth-left-title">Welcome Back</h1>
            <p className="auth-left-text">
              Sign in to access your AI fashion assistant. Continue your conversations,
              review product recommendations, and explore the 12,000+ item catalog
              with personalized suggestions.
            </p>
            <div className="auth-features">
              <div className="auth-feature">
                <div className="auth-feature-icon">🤖</div>
                <div className="auth-feature-text">
                  <strong>AI Shopping Agent</strong>
                  <span>Get personalized recommendations</span>
                </div>
              </div>
              <div className="auth-feature">
                <div className="auth-feature-icon">🛍️</div>
                <div className="auth-feature-text">
                  <strong>12,000+ Products</strong>
                  <span>Browse the full catalog</span>
                </div>
              </div>
              <div className="auth-feature">
                <div className="auth-feature-icon">💬</div>
                <div className="auth-feature-text">
                  <strong>Chat History</strong>
                  <span>Pick up where you left off</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="auth-right">
          <div className="auth-form-wrapper">
            <div className="auth-header">
              <h1 className="auth-title">Sign In</h1>
              <p className="auth-description">
                Enter your credentials to continue
              </p>
            </div>

            <form onSubmit={handleSubmit} className="auth-form">
              {error && (
                <div className="auth-error" role="alert" aria-live="assertive">
                  {error}
                  {/verify|verification/i.test(error) && (
                    <p style={{ marginTop: '0.75rem', fontSize: '0.9rem', opacity: 0.95 }}>
                      Use the link in your email, or open{' '}
                      <Link to="/verify-email" className="auth-link">
                        the verification page
                      </Link>{' '}
                      if you have a token from your inbox.
                    </p>
                  )}
                </div>
              )}

              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="auth-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="auth-input"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="auth-button-primary"
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <div className="auth-footer">
              <p>
                <Link to="/forgot-password" className="auth-link">Forgot Password?</Link>
              </p>
              <p style={{ marginTop: '0.5rem' }}>
                Don&apos;t have an account? <Link to="/sign-up" className="auth-link">Sign up</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignIn;