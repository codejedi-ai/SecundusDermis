import { useState } from 'preact/hooks'
import { Menu, X, ShoppingBag, User } from 'lucide-preact'

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen)

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
            <a href="/faq" className="nav-link">FAQ</a>
            <a href="/contact" className="nav-link">Contact</a>
          </nav>

          <div className="header-actions">
            <button className="icon-button" aria-label="Account">
              <User size={20} />
            </button>
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