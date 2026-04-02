import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';
import { Package, LogOut } from 'lucide-react';
import { useEffect } from 'react';

const Account = () => {
  const { user, signOut, signIn, isLoading } = useAuth();
  const navigate = useNavigate();

  // Clear any stale localStorage on mount
  useEffect(() => {
    try {
      const oldSessionKey = 'sd_session_id';
      const oldSession = localStorage.getItem(oldSessionKey);
      if (oldSession) {
        console.log('[Account] Clearing stale localStorage session');
        localStorage.removeItem(oldSessionKey);
      }
    } catch {
      // Ignore
    }
  }, []);

  // Redirect to Auth0 if not logged in
  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      console.log('[Account] No user, redirecting to Auth0');
      signIn().catch(console.error);
    }
  }, [isLoading, user, signIn]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  if (isLoading) {
    return (
      <div className="account-page">
        <div className="container">
          <p>Loading account...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="account-page">
        <div className="container">
          <div className="auth-container">
            <div className="auth-header">
              <h1 className="auth-title">Redirecting to Auth0…</h1>
              <p className="auth-description">Please wait while we redirect you to sign in.</p>
            </div>
            <div className="loading-spinner"></div>
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