import { Mail, Phone, MapPin, Instagram, Facebook, Twitter } from 'lucide-preact'

const Footer = () => {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-content">
          <div className="footer-section">
            <h3 className="footer-title">Secundus Dermis</h3>
            <p className="footer-description">
              Crafting the perfect foundation for your wardrobe with luxurious comfort, 
              innovative design, and thoughtful functionality.
            </p>
            <div className="social-links">
              <a href="#" className="social-link" aria-label="Instagram">
                <Instagram size={20} />
              </a>
              <a href="#" className="social-link" aria-label="Facebook">
                <Facebook size={20} />
              </a>
              <a href="#" className="social-link" aria-label="Twitter">
                <Twitter size={20} />
              </a>
            </div>
          </div>

          <div className="footer-section">
            <h4 className="footer-subtitle">Quick Links</h4>
            <ul className="footer-links">
              <li><a href="/" className="footer-link">Home</a></li>
              <li><a href="/product" className="footer-link">Product</a></li>
              <li><a href="/about" className="footer-link">About Us</a></li>
              <li><a href="/blog" className="footer-link">Journal</a></li>
              <li><a href="/faq" className="footer-link">FAQ</a></li>
              <li><a href="/contact" className="footer-link">Contact</a></li>
            </ul>
          </div>

          <div className="footer-section">
            <h4 className="footer-subtitle">Customer Care</h4>
            <ul className="footer-links">
              <li><a href="#" className="footer-link">Size Guide</a></li>
              <li><a href="#" className="footer-link">Care Instructions</a></li>
              <li><a href="#" className="footer-link">Shipping & Returns</a></li>
              <li><a href="#" className="footer-link">Privacy Policy</a></li>
              <li><a href="#" className="footer-link">Terms of Service</a></li>
            </ul>
          </div>

          <div className="footer-section">
            <h4 className="footer-subtitle">Contact Info</h4>
            <div className="contact-info">
              <div className="contact-item">
                <Mail size={16} />
                <span>hello@secundusdermis.com</span>
              </div>
              <div className="contact-item">
                <Phone size={16} />
                <span>1-800-SECUNDUS</span>
              </div>
              <div className="contact-item">
                <MapPin size={16} />
                <span>New York, NY</span>
              </div>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <p>&copy; 2024 Secundus Dermis. All rights reserved.</p>
          <p>Designed with care for the modern woman.</p>
        </div>
      </div>
    </footer>
  )
}

export default Footer