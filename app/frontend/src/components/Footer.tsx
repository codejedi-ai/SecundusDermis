import { Link } from 'react-router-dom'
import { Camera, Users, Play } from 'lucide-react'
import { AUTH_ENABLED } from '../lib/auth-config'
import { useAuth } from '../lib/auth-context'
import { isAtelierExperience } from '../lib/experience-mode'

const Footer = () => {
  const { user } = useAuth()
  return (
    <footer className="footer">
      <div className="footer-main">
        <div className="footer-grid">
          <div className="footer-col">
            <h4 className="footer-heading">Shop</h4>
            <ul className="footer-list">
              <li><Link to="/shop" className="footer-link">All Products</Link></li>
              <li><Link to="/shop" className="footer-link">New Arrivals</Link></li>
              <li><Link to="/shop" className="footer-link">Best Sellers</Link></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4 className="footer-heading">Help</h4>
            <ul className="footer-list">
              <li><Link to="/faq" className="footer-link">FAQ</Link></li>
              <li><Link to="/contact" className="footer-link">Contact Us</Link></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4 className="footer-heading">About</h4>
            <ul className="footer-list">
              <li><Link to="/about" className="footer-link">AI Agent Playground</Link></li>
              {AUTH_ENABLED && user && isAtelierExperience(user) && (
                <li><Link to="/agents" className="footer-link">AI agents</Link></li>
              )}
            </ul>
          </div>

          <div className="footer-col footer-col-brand">
            <Link to="/" className="footer-logo">Secundus Dermis</Link>
            <p className="footer-tagline">
              {!user || !isAtelierExperience(user)
                ? 'Curated luxury fashion — browse the catalog and discover your second skin.'
                : 'AI-powered fashion discovery — 12,000+ pieces.'}
            </p>
            <div className="footer-social">
              <a href="#" className="footer-social-link" aria-label="Instagram">
                <Camera size={18} />
              </a>
              <a href="#" className="footer-social-link" aria-label="Facebook">
                <Users size={18} />
              </a>
              <a href="#" className="footer-social-link" aria-label="YouTube">
                <Play size={18} />
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <div className="footer-bottom-inner">
          <p className="footer-copyright">2024 Secundus Dermis. All rights reserved.</p>
          <div className="footer-locale">
            <span>United States (USD $)</span>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer
