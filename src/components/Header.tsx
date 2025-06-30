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

      <style jsx>{`
        .header {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
          border-bottom: 1px solid var(--color-gray-200);
          z-index: 1000;
          transition: all var(--transition-normal);
        }

        .header-content {
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 80px;
        }

        .logo-link {
          display: flex;
          align-items: center;
        }

        .logo-text {
          font-family: var(--font-display);
          font-size: 1.75rem;
          font-weight: 600;
          color: var(--color-primary);
          letter-spacing: -0.02em;
        }

        .nav {
          display: flex;
          align-items: center;
          gap: var(--space-6);
        }

        .nav-link {
          font-weight: 500;
          color: var(--color-gray-700);
          transition: color var(--transition-fast);
          position: relative;
        }

        .nav-link:hover {
          color: var(--color-primary);
        }

        .nav-link::after {
          content: '';
          position: absolute;
          bottom: -4px;
          left: 0;
          width: 0;
          height: 2px;
          background: var(--color-accent);
          transition: width var(--transition-fast);
        }

        .nav-link:hover::after {
          width: 100%;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: var(--space-2);
        }

        .icon-button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 44px;
          height: 44px;
          background: none;
          color: var(--color-gray-700);
          border-radius: var(--radius-full);
          transition: all var(--transition-fast);
        }

        .icon-button:hover {
          background: var(--color-gray-100);
          color: var(--color-primary);
        }

        .cart-button {
          position: relative;
        }

        .cart-count {
          position: absolute;
          top: 8px;
          right: 8px;
          background: var(--color-accent);
          color: var(--color-white);
          font-size: 0.75rem;
          font-weight: 600;
          width: 18px;
          height: 18px;
          border-radius: var(--radius-full);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .menu-toggle {
          display: none;
          align-items: center;
          justify-content: center;
          width: 44px;
          height: 44px;
          background: none;
          color: var(--color-gray-700);
        }

        @media (max-width: 768px) {
          .nav {
            position: fixed;
            top: 80px;
            left: 0;
            right: 0;
            background: var(--color-white);
            flex-direction: column;
            padding: var(--space-4);
            border-bottom: 1px solid var(--color-gray-200);
            transform: translateY(-100%);
            opacity: 0;
            visibility: hidden;
            transition: all var(--transition-normal);
          }

          .nav-open {
            transform: translateY(0);
            opacity: 1;
            visibility: visible;
          }

          .nav-link {
            padding: var(--space-2) 0;
            font-size: 1.125rem;
          }

          .menu-toggle {
            display: flex;
          }
        }
      `}</style>
    </header>
  )
}

export default Header