import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';
import './auth.css';

const SignUp = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();

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
      await signUp(email, password, name || undefined);
      navigate('/sign-in');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign up');
    } finally {
      setIsLoading(false);
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

            <div className="auth-footer">
              <p>
                Already have an account? <a href="/sign-in" className="auth-link">Sign in here</a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignUp;