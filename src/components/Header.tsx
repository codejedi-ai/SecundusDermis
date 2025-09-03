import React, { useState } from 'react'
import { Menu, X, ShoppingBag, User } from 'lucide-react'
import { useUser, useClerk } from '@clerk/clerk-react'

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const { isSignedIn, user } = useUser()
  const { signOut } = useClerk()

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen)

  const handleSignOut = async () => {
    await signOut()
    window.location.href = '/'
  }

  return (
    <header className="header">
      <div className="container">
        <div className="header-content">
          <div className="logo">
            <a href="/" className="logo-link">
              <img 
                src="/Secundus_Dermis.webp" 
                alt="Secundus Dermis Logo" 
                className="logo-image"
              />
              <span className="logo-text">Secundus Dermis</span>
            </a>
          </div>

          <nav className={`nav ${isMenuOpen ? 'nav-open' : ''}`}>
            <a href="/" className="nav-link">Home</a>
            <a href="/product" className="nav-link">Product</a>
            <a href="/about" className="nav-link">About</a>
            <a href="/blog" className="nav-link">Journal</a>
            <a href="/faq" className="nav-link">FAQ</a>
            <a href="/contact" className="nav-link">Contact</a>
          </nav>

          <div className="header-actions">
            {isSignedIn ? (
              <div className="user-menu">
                <a href="/account" className="icon-button" aria-label="Account">
                  <User size={20} />
                </a>
                <div className="user-dropdown">
                  <div className="user-info">
                    <span className="user-name">{user?.firstName || 'Account'}</span>
                    <span className="user-email">{user?.primaryEmailAddress?.emailAddress}</span>
                  </div>
                  <div className="dropdown-actions">
                    <a href="/account" className="dropdown-link">My Account</a>
                    <button onClick={handleSignOut} className="dropdown-link">Sign Out</button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="auth-buttons">
                <a href="/sign-in" className="btn btn-secondary">Sign In</a>
                <a href="/sign-up" className="btn btn-primary">Sign Up</a>
              </div>
            )}
            <button className="icon-button cart-button" aria-label="Shopping cart">
              <ShoppingBag size={20} />
              <span className="cart-count">0</span>
            </button>
            <button 
              className="menu-toggle"
              onClick={toggleMenu}
              aria-label="Toggle menu"
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header