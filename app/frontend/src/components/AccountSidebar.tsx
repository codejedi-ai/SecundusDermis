import { User, Package, Heart, Settings, Lock, FileText, CreditCard, MapPin, Bell, Shield, LogOut, Sparkles } from 'lucide-react'
import '../styles/shop.css'

const ACCOUNT_SECTIONS = [
  {
    label: 'Profile',
    icon: User,
    items: [
      { id: 'profile', label: 'Profile Information', icon: User },
      { id: 'experience', label: 'Boutique vs Atelier', icon: Sparkles },
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

export const ACCOUNT_SECTION_IDS: readonly string[] = ACCOUNT_SECTIONS.flatMap((g) =>
  g.items.map((item) => item.id),
)

interface AccountSidebarProps {
  activeSection: string
  onSectionChange: (section: string) => void
  onSignOut: () => void
}

export default function AccountSidebar({
  activeSection,
  onSectionChange,
  onSignOut,
}: AccountSidebarProps) {
  return (
    <>
      <div className="sidebar-header">
        <h1 className="shop-title">Account</h1>
      </div>

      {ACCOUNT_SECTIONS.map((group) => (
        <div className="sidebar-section" key={group.label}>
          <span className="sidebar-label">{group.label}</span>
          <ul className="sidebar-list">
            {group.items.map((item) => {
              const ItemIcon = item.icon
              return (
                <li key={item.id}>
                  <button
                    className={`sidebar-item ${activeSection === item.id ? 'active' : ''}`}
                    onClick={() => onSectionChange(item.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <ItemIcon size={14} />
                    <span>{item.label}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ))}

      <div className="sidebar-section sidebar-section-bottom">
        <ul className="sidebar-list">
          <li>
            <button
              className="sidebar-item"
              onClick={onSignOut}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#dc2626' }}
            >
              <LogOut size={14} />
              <span>Sign Out</span>
            </button>
          </li>
        </ul>
      </div>
    </>
  )
}
