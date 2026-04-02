import { useState } from 'react'
import { User, Package, Heart, Settings, Lock, FileText, CreditCard, MapPin, Bell, Shield, LogOut } from 'lucide-react'
import '../styles/account.css'

const ACCOUNT_SECTIONS = [
  {
    label: 'Profile',
    icon: User,
    items: [
      { id: 'profile', label: 'Profile Information', icon: User },
      { id: 'addresses', label: 'Addresses', icon: MapPin },
    ],
  },
  {
    label: 'Orders & Activity',
    icon: Package,
    items: [
      { id: 'orders', label: 'My Orders', icon: Package },
      { id: 'wishlist', label: 'Wishlist', icon: Heart },
    ],
  },
  {
    label: 'Security',
    icon: Shield,
    items: [
      { id: 'password', label: 'Change Password', icon: Lock },
      { id: 'sessions', label: 'Active Sessions', icon: FileText },
    ],
  },
  {
    label: 'Settings',
    icon: Settings,
    items: [
      { id: 'notifications', label: 'Notifications', icon: Bell },
      { id: 'payment', label: 'Payment Methods', icon: CreditCard },
    ],
  },
]

interface AccountSidebarProps {
  activeSection: string
  onSectionChange: (section: string) => void
  onSignOut: () => void
  userEmail: string
  userName: string
}

export default function AccountSidebar({
  activeSection,
  onSectionChange,
  onSignOut,
  userEmail,
  userName,
}: AccountSidebarProps) {
  const [expandedGroup, setExpandedGroup] = useState<string | null>('Profile')

  const handleGroupClick = (label: string) => {
    setExpandedGroup(expandedGroup === label ? null : label)
  }

  return (
    <div className="account-sidebar">
      {/* User Info Card */}
      <div className="account-user-card">
        <div className="account-user-avatar">
          <span>{(userName || userEmail)[0]?.toUpperCase()}</span>
        </div>
        <div className="account-user-info">
          <h3>{userName || 'User'}</h3>
          <p>{userEmail}</p>
        </div>
      </div>

      {/* Navigation Groups */}
      <nav className="account-nav-groups">
        {ACCOUNT_SECTIONS.map((group) => {
          const Icon = group.icon
          const isExpanded = expandedGroup === group.label

          return (
            <div key={group.label} className="account-nav-group">
              <button
                className={`account-nav-group-header ${isExpanded ? 'expanded' : ''}`}
                onClick={() => handleGroupClick(group.label)}
              >
                <div className="account-nav-group-title">
                  <Icon size={18} />
                  <span>{group.label}</span>
                </div>
                <span className={`account-nav-group-arrow ${isExpanded ? 'rotated' : ''}`}>
                  ›
                </span>
              </button>

              {isExpanded && (
                <div className="account-nav-items">
                  {group.items.map((item) => {
                    const ItemIcon = item.icon
                    return (
                      <button
                        key={item.id}
                        className={`account-nav-item ${activeSection === item.id ? 'active' : ''}`}
                        onClick={() => onSectionChange(item.id)}
                      >
                        <ItemIcon size={16} />
                        <span>{item.label}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Sign Out */}
      <div className="account-nav-footer">
        <button className="account-nav-item sign-out" onClick={onSignOut}>
          <LogOut size={18} />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  )
}
