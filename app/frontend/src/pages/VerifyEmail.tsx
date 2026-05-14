import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { API_BASE } from '../lib/api-base';

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('err');
      setMessage('Missing verification token in the link.');
      return;
    }
    setStatus('loading');
    fetch(`${API_BASE}/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
      credentials: 'include',
    })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          setStatus('err');
          setMessage(typeof data.detail === 'string' ? data.detail : 'Verification failed.');
          return;
        }
        setStatus('ok');
        setMessage(data.status || 'Email verified. You can sign in now.');
      })
      .catch(() => {
        setStatus('err');
        setMessage('Could not reach the server. Try again later.');
      });
  }, [searchParams]);

  return (
    <div className="auth-page">
      <div className="auth-split-container">
        <div className="auth-left">
          <div className="auth-left-content">
            <h1 className="auth-left-title">Email verification</h1>
            <p className="auth-left-text">
              We use this step to confirm you own the email address you signed up with.
            </p>
          </div>
        </div>
        <div className="auth-right">
          <div className="auth-form-wrapper">
            <div className="auth-header">
              <h1 className="auth-title">Verify email</h1>
            </div>
            <div className="auth-form">
              {status === 'loading' && <p>Verifying your link…</p>}
              {status === 'ok' && (
                <div className="auth-success">
                  <strong>Success</strong>
                  <p style={{ marginTop: '0.5rem' }}>{message}</p>
                  <Link to="/sign-in" className="auth-button-primary" style={{ display: 'inline-block', marginTop: '1rem', textAlign: 'center' }}>
                    Sign in
                  </Link>
                </div>
              )}
              {status === 'err' && (
                <div className="auth-error" style={{ marginBottom: '1rem' }}>
                  {message}
                </div>
              )}
              {status === 'err' && (
                <p className="auth-footer">
                  <Link to="/sign-in" className="auth-link">← Back to Sign In</Link>
                  {' · '}
                  <Link to="/sign-up" className="auth-link">Sign up</Link>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;
