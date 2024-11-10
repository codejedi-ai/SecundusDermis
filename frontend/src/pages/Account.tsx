import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';
import { Package, Heart, Settings, LogOut } from 'lucide-react';

const Account = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="account-page">
      <div className="container">
        <div className="account-header">
          <h1 className="page-title">My Account</h1>
          <p className="page-description">
            {user ? `Welcome back, ${user.email}! Manage your account, orders, and preferences.` : 'Loading...'}
          </p>
        </div>

        <div className="account-content">
          <div className="account-sidebar">
            <div className="user-info">
              <div className="user-avatar">
                <div className="avatar-placeholder">
                  {user?.email?.[0]?.toUpperCase()}
                </div>
              </div>
              <div className="user-details">
                <h3>{user?.email || 'User'}</h3>
                <p>{user?.email}</p>
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
                  <p>{user?.email}</p>
                </div>
                <div className="settings-item">
                  <h3>Account Created</h3>
                  <p>{user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}</p>
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