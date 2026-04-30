import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, type RegisterResult } from '../lib/auth-context';

const SignUp = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [done, setDone] = useState<RegisterResult | null>(null);
  const [resendBusy, setResendBusy] = useState(false);
  const [resendNote, setResendNote] = useState('');
  const { signUp } = useAuth();

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

    setIsLoading(true);

    try {
      const result = await signUp(email, password, name || undefined);
      setDone(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign up');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email.trim()) return;
    setResendBusy(true);
    setResendNote('');
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      setResendNote(data.status || 'Request sent.');
      if (data.verify_url) {
        setDone((d) =>
          d
            ? { ...d, verifyUrl: data.verify_url, verificationToken: data.verification_token }
            : null
        );
      }
    } catch {
      setResendNote('Could not reach the server. Try again later.');
    } finally {
      setResendBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-split-container">
        <div className="auth-left">
          <div className="auth-left-content">
            <h1 className="auth-left-title">Join Secundus Dermis</h1>
            <p className="auth-left-text">
              Create your account to access the AI-powered fashion shopping experience.
              Get personalized recommendations, save your preferences, and discover
              your perfect style with our intelligent assistant.
            </p>
            <div className="auth-features">
              <div className="auth-feature">
                <div className="auth-feature-icon">🤖</div>
                <div className="auth-feature-text">
                  <strong>AI Fashion Agent</strong>
                  <span>Chat naturally to find your style</span>
                </div>
              </div>
              <div className="auth-feature">
                <div className="auth-feature-icon">🔍</div>
                <div className="auth-feature-text">
                  <strong>Visual Search</strong>
                  <span>Upload photos to find similar items</span>
                </div>
              </div>
              <div className="auth-feature">
                <div className="auth-feature-icon">📦</div>
                <div className="auth-feature-text">
                  <strong>12,000+ Products</strong>
                  <span>Explore our curated catalog</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="auth-right">
          <div className="auth-form-wrapper">
            <div className="auth-header">
              <h1 className="auth-title">Create Account</h1>
              <p className="auth-description">
                Fill in your details to get started
              </p>
            </div>

            {done ? (
              <div className="auth-form">
                <div className="auth-success">
                  <strong>Almost there</strong>
                  <p style={{ marginTop: '0.5rem' }}>{done.message}</p>
                  <p style={{ marginTop: '0.75rem', fontSize: '0.9rem' }}>
                    We sent a link to <strong>{done.email}</strong>. After you verify, you can sign in.
                  </p>
                </div>
                {done.verifyUrl && (
                  <div className="auth-info" style={{ marginTop: '1rem' }}>
                    <strong>Development</strong>
                    <p style={{ marginTop: '0.35rem', fontSize: '0.875rem' }}>
                      <a href={done.verifyUrl} className="auth-link">Open verification link</a>
                    </p>
                  </div>
                )}
                <div style={{ marginTop: '1rem' }}>
                  <button
                    type="button"
                    className="auth-button-primary"
                    disabled={resendBusy}
                    onClick={handleResend}
                    style={{ width: '100%' }}
                  >
                    {resendBusy ? 'Sending…' : 'Resend verification email'}
                  </button>
                  {resendNote && (
                    <p style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>{resendNote}</p>
                  )}
                </div>
                <div className="auth-footer" style={{ marginTop: '1.25rem' }}>
                  <p>
                    <Link to="/sign-in" className="auth-link">← Sign in</Link>
                  </p>
                </div>
              </div>
            ) : (
            <form onSubmit={handleSubmit} className="auth-form">
              {error && <div className="auth-error">{error}</div>}

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="name">Name (optional)</label>
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="auth-input"
                  />
                </div>
              </div>

              <div className="form-row">
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
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="password">Password</label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    required
                    className="auth-input"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="confirm-password">Confirm Password</label>
                  <input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    required
                    className="auth-input"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="auth-button-primary"
              >
                {isLoading ? 'Creating account...' : 'Create Account'}
              </button>
            </form>
            )}

            {!done && (
            <div className="auth-footer">
              <p>
                Already have an account? <Link to="/sign-in" className="auth-link">Sign in here</Link>
              </p>
            </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignUp;