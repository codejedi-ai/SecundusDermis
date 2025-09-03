import { useUser, useClerk } from '@clerk/clerk-react'
import { UserProfile } from '@clerk/clerk-react'
import { Package, Heart, Settings, LogOut } from 'lucide-preact'

const Account = () => {
  const { isSignedIn, user } = useUser()
  const { signOut } = useClerk()

  if (!isSignedIn) {
    window.location.href = '/sign-in'
    return null
  }

  const handleSignOut = async () => {
    await signOut()
    window.location.href = '/'
  }

  return (
    <div className="account-page">
      <div className="container">
        <div className="account-header">
          <h1 className="page-title">My Account</h1>
          <p className="page-description">
            Welcome back, {user?.firstName}! Manage your account, orders, and preferences.
          </p>
        </div>

        <div className="account-content">
          <div className="account-sidebar">
            <div className="user-info">
              <div className="user-avatar">
                {user?.imageUrl ? (
                  <img src={user.imageUrl} alt={user.firstName || 'User'} />
                ) : (
                  <div className="avatar-placeholder">
                    {user?.firstName?.[0]}{user?.lastName?.[0]}
                  </div>
                )}
              </div>
              <div className="user-details">
                <h3>{user?.firstName} {user?.lastName}</h3>
                <p>{user?.primaryEmailAddress?.emailAddress}</p>
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
                <UserProfile 
                  appearance={{
                    elements: {
                      card: 'clerk-card',
                      headerTitle: 'clerk-header-title',
                      headerSubtitle: 'clerk-header-subtitle',
                      formButtonPrimary: 'clerk-button-primary'
                    }
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Account