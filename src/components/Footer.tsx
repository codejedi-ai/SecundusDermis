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

      <style jsx>{`
        .footer {
          background: var(--color-gray-50);
          border-top: 1px solid var(--color-gray-200);
          padding: var(--space-12) 0 var(--space-6);
          margin-top: var(--space-16);
        }

        .footer-content {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: var(--space-8);
          margin-bottom: var(--space-8);
        }

        .footer-section {
          display: flex;
          flex-direction: column;
        }

        .footer-title {
          font-family: var(--font-display);
          font-size: 1.5rem;
          font-weight: 600;
          color: var(--color-primary);
          margin-bottom: var(--space-3);
        }

        .footer-subtitle {
          font-size: 1rem;
          font-weight: 600;
          color: var(--color-primary);
          margin-bottom: var(--space-3);
        }

        .footer-description {
          color: var(--color-gray-600);
          line-height: 1.6;
          margin-bottom: var(--space-4);
        }

        .social-links {
          display: flex;
          gap: var(--space-2);
        }

        .social-link {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          background: var(--color-white);
          color: var(--color-gray-600);
          border-radius: var(--radius-full);
          transition: all var(--transition-fast);
          box-shadow: var(--shadow-sm);
        }

        .social-link:hover {
          background: var(--color-accent);
          color: var(--color-white);
          transform: translateY(-2px);
        }

        .footer-links {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .footer-link {
          color: var(--color-gray-600);
          transition: color var(--transition-fast);
        }

        .footer-link:hover {
          color: var(--color-primary);
        }

        .contact-info {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .contact-item {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          color: var(--color-gray-600);
        }

        .footer-bottom {
          border-top: 1px solid var(--color-gray-200);
          padding-top: var(--space-6);
          text-align: center;
          color: var(--color-gray-500);
          font-size: 0.875rem;
        }

        .footer-bottom p:first-child {
          margin-bottom: var(--space-1);
        }

        @media (max-width: 768px) {
          .footer-content {
            grid-template-columns: 1fr;
            gap: var(--space-6);
          }
        }
      `}</style>
    </footer>
  )
}

export default Footer