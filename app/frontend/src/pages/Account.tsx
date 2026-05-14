import { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';
import { Package, Heart, Settings, MapPin, CreditCard, CheckCircle, AlertCircle } from 'lucide-react';
import { API_BASE } from '../lib/api-base';
import { getConversation, type StoredMessage } from '../services/fashionApi';
import '../styles/account.css';

interface AccountContext {
  activeSection: string;
  setActiveSection: (section: string) => void;
}

/** Profile section with editable name field, validation, and save feedback. */
function ProfileSection({ user }: { user: { name: string | null; email: string } }) {
  const [name, setName] = useState(user.name || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Name cannot be empty');
      return;
    }
    if (trimmed.length > 100) {
      setError('Name must be under 100 characters');
      return;
    }
    setError('');
    setSaving(true);
    setSaved(false);
    try {
      const sessionId = document.cookie
        .split('; ')
        .find(r => r.startsWith('sd_session_id='))
        ?.split('=')[1];

      const res = await fetch(`${API_BASE}/auth/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'session-id': sessionId || '',
        },
        body: JSON.stringify({ name: trimmed }),
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Failed to update profile');
      }

      // Update the auth context user so header/account reflect new name
      const updated = await res.json();
      const event = new CustomEvent('sd:user:updated', { detail: updated });
      window.dispatchEvent(event);

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="account-section">
      <h2 className="section-title">Profile Information</h2>
      <div className="account-profile-card">
        <div className="account-profile-avatar">
          {(name.trim() || user.email).charAt(0).toUpperCase()}
        </div>
        <div className="account-profile-info">
          <h3 className="account-profile-name">{name.trim() || '—'}</h3>
          <p className="account-profile-email">{user.email}</p>
        </div>
      </div>
      <div className="account-form">
        <div className="form-group">
          <label htmlFor="profile-name">Full Name</label>
          <input
            id="profile-name"
            type="text"
            value={name}
            onChange={e => { setName(e.target.value); setError(''); }}
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
            className="form-input"
            placeholder="Enter your name"
            maxLength={100}
          />
        </div>
        <div className="form-group">
          <label>Email Address</label>
          <input type="email" value={user.email} className="form-input" disabled />
        </div>
        <div className="profile-actions">
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
        {saved && (
          <div className="form-message form-message-success">
            <CheckCircle size={16} /> Profile updated successfully
          </div>
        )}
        {error && (
          <div className="form-message form-message-error">
            <AlertCircle size={16} /> {error}
          </div>
        )}
      </div>
    </div>
  );
}

function ChatLogsSection() {
  const { session } = useAuth();
  const [messages, setMessages] = useState<StoredMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!session?.session_id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    getConversation(session.session_id)
      .then((rows) => {
        if (!cancelled) setMessages(rows);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load chat history.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session?.session_id]);

  return (
    <div className="account-section">
      <h2 className="section-title">Chat logs</h2>
      <p className="account-chat-intro">
        Stylist widget messages synced for this account (<code className="account-inline-code">GET /api/conversations</code>).
        Streaming requests use your patron <code className="account-inline-code">sdag_…</code> key from this browser.
      </p>
      {loading && <p className="account-chat-status">Loading…</p>}
      {error && (
        <div className="form-message form-message-error">
          <AlertCircle size={16} /> {error}
        </div>
      )}
      {!loading && !error && messages.length === 0 && (
        <p className="account-chat-empty">No saved messages yet. Save a patron key and open patron chat while signed in.</p>
      )}
      <ul className="account-chat-log">
        {messages.map((m, i) => (
          <li key={`${m.timestamp}-${i}`} className={`account-chat-turn account-chat-turn--${m.role}`}>
            <div className="account-chat-turn-head">
              <span className="account-chat-role">{m.role}</span>
              <time className="account-chat-time" dateTime={new Date(m.timestamp).toISOString()}>
                {new Date(m.timestamp).toLocaleString()}
              </time>
            </div>
            <div className="account-chat-body">{m.content}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

const Account = () => {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const { activeSection } = useOutletContext<AccountContext>();

  if (isLoading) {
    return (
      <div className="account-loading-full">
        <div className="loading-spinner"></div>
        <p>Loading account...</p>
      </div>
    );
  }

  if (!user) {
    return (
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
    );
  }

  const renderSection = () => {
    switch (activeSection) {
      case 'profile':
        return <ProfileSection user={user} />;

      case 'chat-logs':
        return <ChatLogsSection />;

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

  return renderSection();
};

export default Account;
