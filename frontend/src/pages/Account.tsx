import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';
import { Package, Heart, Settings, LogOut } from 'lucide-react';
import { useEffect, useState } from 'react';

const Account = () => {
  const { user, signOut, isLoading } = useAuth();
  const navigate = useNavigate();
  const [localUser, setLocalUser] = useState<{ email: string; name: string } | null>(null);

  useEffect(() => {
    const sessionId = localStorage.getItem('sd_session_id');
    if (sessionId && !user) {
      // Fetch user if not loaded by context
      fetch(`${API_BASE}/auth/me`, { headers: { 'session_id': sessionId } })
        .then(r => r.ok ? r.json() : null)
        .then(u => { if (u) setLocalUser(u); })
        .catch(() => {});
    } else if (user) {
      setLocalUser(user);
    }
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    setLocalUser(null);
    navigate('/');
  };

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:7860';
  const displayUser = localUser || user;

  if (isLoading) {
    return (
      <div className="account-page">
        <div className="container">
          <p>Loading account...</p>
        </div>
      </div>
    );
  }

  if (!displayUser) {
    return (
      <div className="account-page">
        <div className="container">
          <div className="auth-container">
            <div className="auth-header">
              <h1 className="auth-title">Sign In Required</h1>
              <p className="auth-description">Please sign in to view your account.</p>
            </div>
            <div className="auth-actions">
              <button onClick={() => navigate('/sign-in')} className="auth-button-primary">
                Sign In
              </button>
              <button onClick={() => navigate('/sign-up')} className="auth-button-secondary">
                Create Account
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="account-page">
      <div className="container">
        <div className="account-header">
          <h1 className="page-title">My Account</h1>
          <p className="page-description">
            Welcome back, {displayUser.name || displayUser.email}!
          </p>
        </div>

        <div className="account-content">
          <div className="account-sidebar">
            <div className="user-info">
              <div className="user-avatar">
                <div className="avatar-placeholder">
                  {(displayUser.name || displayUser.email)[0]?.toUpperCase()}
                </div>
              </div>
              <div className="user-details">
                <h3>{displayUser.name || 'User'}</h3>
                <p>{displayUser.email}</p>
              </div>
            </div>

            <nav className="account-nav">
              <a href="#orders" className="account-nav-link active">
                <Package size={20} />
                Orders
              </a>
              <a href="#wishlist" className="account-nav-link">
                <Heart size={20} />
                Wishlist
              </a>
              <a href="#settings" className="account-nav-link">
                <Settings size={20} />
                Settings
              </a>
              <button onClick={handleSignOut} className="account-nav-link sign-out">
                <LogOut size={20} />
                Sign Out
              </button>
            </nav>
          </div>

          <div className="account-main">
            <div className="account-section">
              <h2>Recent Orders</h2>
              <div className="orders-list">
                <div className="empty-state">
                  <Package size={48} />
                  <h3>No orders yet</h3>
                  <p>When you place your first order, it will appear here.</p>
                  <a href="/product" className="btn btn-primary">Shop Now</a>
                </div>
              </div>
            </div>

            <div className="account-section">
              <h2>Account Settings</h2>
              <div className="settings-container">
                <div className="settings-item">
                  <h3>Email Address</h3>
                  <p>{displayUser.email}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Account