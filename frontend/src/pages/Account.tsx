import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';
import { Package, Heart, Settings, Lock, User, MapPin, Bell, CreditCard, FileText, Shield } from 'lucide-react';
import AccountSidebar from '../components/AccountSidebar';
import './account.css';

const Account = () => {
  const { user, signOut, isLoading } = useAuth();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('profile');

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  if (isLoading) {
    return (
      <div className="account-page">
        <div className="account-layout">
          <div className="account-loading">
            <div className="loading-spinner"></div>
            <p>Loading account...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="account-page">
        <div className="account-layout">
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

  const renderSection = () => {
    switch (activeSection) {
      case 'profile':
        return (
          <div className="account-section">
            <h2 className="section-title">Profile Information</h2>
            <div className="account-form">
              <div className="form-group">
                <label>Full Name</label>
                <input type="text" defaultValue={user.name || ''} className="form-input" />
              </div>
              <div className="form-group">
                <label>Email Address</label>
                <input type="email" defaultValue={user.email} className="form-input" disabled />
              </div>
              <button className="btn btn-primary">Save Changes</button>
            </div>
          </div>
        );

      case 'orders':
        return (
          <div className="account-section">
            <h2 className="section-title">My Orders</h2>
            <div className="empty-state">
              <Package size={48} />
              <h3>No orders yet</h3>
              <p>When you place your first order, it will appear here.</p>
              <button onClick={() => navigate('/shop')} className="btn btn-primary">
                Start Shopping
              </button>
            </div>
          </div>
        );

      case 'wishlist':
        return (
          <div className="account-section">
            <h2 className="section-title">Wishlist</h2>
            <div className="empty-state">
              <Heart size={48} />
              <h3>Your wishlist is empty</h3>
              <p>Save items you love to your wishlist.</p>
              <button onClick={() => navigate('/shop')} className="btn btn-primary">
                Browse Products
              </button>
            </div>
          </div>
        );

      case 'password':
        return (
          <div className="account-section">
            <h2 className="section-title">Change Password</h2>
            <div className="account-form">
              <div className="form-group">
                <label>Current Password</label>
                <input type="password" className="form-input" placeholder="Enter current password" />
              </div>
              <div className="form-group">
                <label>New Password</label>
                <input type="password" className="form-input" placeholder="Enter new password" />
              </div>
              <div className="form-group">
                <label>Confirm New Password</label>
                <input type="password" className="form-input" placeholder="Confirm new password" />
              </div>
              <button className="btn btn-primary">Update Password</button>
            </div>
          </div>
        );

      case 'addresses':
        return (
          <div className="account-section">
            <h2 className="section-title">Saved Addresses</h2>
            <div className="empty-state">
              <MapPin size={48} />
              <h3>No addresses saved</h3>
              <p>Add your first shipping address.</p>
              <button className="btn btn-primary">Add Address</button>
            </div>
          </div>
        );

      case 'sessions':
        return (
          <div className="account-section">
            <h2 className="section-title">Active Sessions</h2>
            <div className="session-list">
              <div className="session-item active">
                <div className="session-info">
                  <strong>Current Session</strong>
                  <p>This device • Just now</p>
                </div>
                <span className="badge badge-success">Active</span>
              </div>
            </div>
          </div>
        );

      case 'notifications':
        return (
          <div className="account-section">
            <h2 className="section-title">Notification Preferences</h2>
            <div className="settings-list">
              <div className="setting-item">
                <div className="setting-info">
                  <strong>Email Notifications</strong>
                  <p>Receive order updates and promotions</p>
                </div>
                <input type="checkbox" defaultChecked className="toggle" />
              </div>
              <div className="setting-item">
                <div className="setting-info">
                  <strong>Order Updates</strong>
                  <p>Get notified about your orders</p>
                </div>
                <input type="checkbox" defaultChecked className="toggle" />
              </div>
            </div>
          </div>
        );

      case 'payment':
        return (
          <div className="account-section">
            <h2 className="section-title">Payment Methods</h2>
            <div className="empty-state">
              <CreditCard size={48} />
              <h3>No payment methods saved</h3>
              <p>Add a payment method for faster checkout.</p>
              <button className="btn btn-primary">Add Payment Method</button>
            </div>
          </div>
        );

      default:
        return (
          <div className="account-section">
            <h2 className="section-title">Settings</h2>
            <div className="empty-state">
              <Settings size={48} />
              <h3>Coming Soon</h3>
              <p>This section is under development.</p>
            </div>
          </div>
        );
    }
  }

  return (
    <div className="account-page">
      <div className="account-layout">
        <AccountSidebar
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          onSignOut={handleSignOut}
          userEmail={user.email}
          userName={user.name}
        />
        <main className="account-main">
          {renderSection()}
        </main>
      </div>
    </div>
  );
};

export default Account;
