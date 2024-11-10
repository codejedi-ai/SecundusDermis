import { Link } from 'react-router-dom'
import { Camera, Users, Play } from 'lucide-react'

const Footer = () => {
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
              <li><Link to="/about" className="footer-link">Our Story</Link></li>
              <li><Link to="/blog" className="footer-link">Journal</Link></li>
            </ul>
          </div>

          <div className="footer-col footer-col-brand">
            <Link to="/" className="footer-logo">Secundus Dermis</Link>
            <p className="footer-tagline">
              AI-powered fashion discovery — 12,000+ pieces.
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
