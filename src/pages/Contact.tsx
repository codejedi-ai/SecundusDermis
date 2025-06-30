import { useState } from 'preact/hooks'
import { Mail, Phone, MapPin, Clock, Send } from 'lucide-preact'

const Contact = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  })

  const handleInputChange = (e: Event) => {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    setFormData(prev => ({
      ...prev,
      [target.name]: target.value
    }))
  }

  const handleSubmit = (e: Event) => {
    e.preventDefault()
    // Handle form submission here
    console.log('Form submitted:', formData)
    // Reset form
    setFormData({ name: '', email: '', subject: '', message: '' })
    alert('Thank you for your message! We\'ll get back to you soon.')
  }

  return (
    <div className="contact-page">
      <div className="container">
        <div className="contact-header">
          <h1 className="page-title">Get in Touch</h1>
          <p className="page-description">
            We'd love to hear from you. Send us a message and we'll respond as soon as possible.
          </p>
        </div>

        <div className="contact-content">
          {/* Contact Form */}
          <div className="contact-form-section">
            <h2 className="section-title">Send us a Message</h2>
            <form className="contact-form" onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="name" className="form-label">Name *</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="form-input"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="email" className="form-label">Email *</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="form-input"
                    required
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label htmlFor="subject" className="form-label">Subject *</label>
                <select
                  id="subject"
                  name="subject"
                  value={formData.subject}
                  onChange={handleInputChange}
                  className="form-select"
                  required
                >
                  <option value="">Select a subject</option>
                  <option value="product-inquiry">Product Inquiry</option>
                  <option value="sizing-help">Sizing Help</option>
                  <option value="order-support">Order Support</option>
                  <option value="care-instructions">Care Instructions</option>
                  <option value="returns-exchanges">Returns & Exchanges</option>
                  <option value="wholesale-inquiry">Wholesale Inquiry</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="message" className="form-label">Message *</label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleInputChange}
                  className="form-textarea"
                  rows={6}
                  placeholder="Tell us how we can help you..."
                  required
                ></textarea>
              </div>

              <button type="submit" className="btn btn-primary">
                <Send size={20} />
                Send Message
              </button>
            </form>
          </div>

          {/* Contact Information */}
          <div className="contact-info-section">
            <h2 className="section-title">Contact Information</h2>
            
            <div className="contact-methods">
              <div className="contact-method">
                <div className="contact-icon">
                  <Mail size={24} />
                </div>
                <div className="contact-details">
                  <h3>Email Us</h3>
                  <p>hello@secundusdermis.com</p>
                  <span className="contact-note">We typically respond within 24 hours</span>
                </div>
              </div>

              <div className="contact-method">
                <div className="contact-icon">
                  <Phone size={24} />
                </div>
                <div className="contact-details">
                  <h3>Call Us</h3>
                  <p>1-800-SECUNDUS</p>
                  <span className="contact-note">Monday - Friday, 9 AM - 6 PM EST</span>
                </div>
              </div>

              <div className="contact-method">
                <div className="contact-icon">
                  <MapPin size={24} />
                </div>
                <div className="contact-details">
                  <h3>Visit Us</h3>
                  <p>New York, NY</p>
                  <span className="contact-note">By appointment only</span>
                </div>
              </div>

              <div className="contact-method">
                <div className="contact-icon">
                  <Clock size={24} />
                </div>
                <div className="contact-details">
                  <h3>Business Hours</h3>
                  <p>Monday - Friday: 9 AM - 6 PM EST</p>
                  <p>Saturday: 10 AM - 4 PM EST</p>
                  <p>Sunday: Closed</p>
                </div>
              </div>
            </div>

            <div className="faq-callout">
              <h3>Quick Answers</h3>
              <p>
                Looking for sizing help, care instructions, or information about our return policy? 
                Check out our <a href="/faq" className="faq-link">FAQ page</a> for instant answers 
                to common questions.
              </p>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .contact-page {
          padding-top: 100px;
          padding-bottom: var(--space-8);
        }

        .contact-header {
          text-align: center;
          margin-bottom: var(--space-12);
        }

        .page-title {
          font-size: clamp(2.5rem, 5vw, 4rem);
          font-weight: 600;
          margin-bottom: var(--space-4);
          color: var(--color-primary);
        }

        .page-description {
          font-size: 1.125rem;
          color: var(--color-gray-600);
          line-height: 1.7;
          max-width: 600px;
          margin: 0 auto;
        }

        .contact-content {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--space-10);
          max-width: 1000px;
          margin: 0 auto;
        }

        .section-title {
          font-size: 1.5rem;
          font-weight: 600;
          margin-bottom: var(--space-6);
          color: var(--color-primary);
        }

        .contact-form {
          background: var(--color-white);
          padding: var(--space-6);
          border-radius: var(--radius-xl);
          box-shadow: var(--shadow-lg);
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--space-4);
        }

        .form-group {
          margin-bottom: var(--space-4);
        }

        .form-label {
          display: block;
          font-weight: 600;
          margin-bottom: var(--space-2);
          color: var(--color-primary);
        }

        .form-input,
        .form-select,
        .form-textarea {
          width: 100%;
          padding: var(--space-3);
          border: 2px solid var(--color-gray-300);
          border-radius: var(--radius-md);
          font-family: inherit;
          font-size: 1rem;
          transition: all var(--transition-fast);
        }

        .form-input:focus,
        .form-select:focus,
        .form-textarea:focus {
          outline: none;
          border-color: var(--color-accent);
          box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.1);
        }

        .form-textarea {
          resize: vertical;
          min-height: 120px;
        }

        .btn {
          display: inline-flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-3) var(--space-5);
          font-weight: 600;
          border-radius: var(--radius-lg);
          transition: all var(--transition-normal);
          text-decoration: none;
          border: none;
          cursor: pointer;
          font-family: inherit;
        }

        .btn-primary {
          background: var(--color-primary);
          color: var(--color-white);
        }

        .btn-primary:hover {
          background: var(--color-primary-light);
          transform: translateY(-2px);
          box-shadow: var(--shadow-lg);
        }

        .contact-methods {
          display: flex;
          flex-direction: column;
          gap: var(--space-6);
          margin-bottom: var(--space-8);
        }

        .contact-method {
          display: flex;
          gap: var(--space-4);
          padding: var(--space-4);
          background: var(--color-gray-50);
          border-radius: var(--radius-lg);
        }

        .contact-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 48px;
          height: 48px;
          background: var(--color-accent);
          color: var(--color-white);
          border-radius: var(--radius-full);
          flex-shrink: 0;
        }

        .contact-details h3 {
          font-size: 1.125rem;
          font-weight: 600;
          margin-bottom: var(--space-1);
          color: var(--color-primary);
        }

        .contact-details p {
          color: var(--color-gray-700);
          margin-bottom: var(--space-1);
        }

        .contact-note {
          font-size: 0.875rem;
          color: var(--color-gray-500);
        }

        .faq-callout {
          background: var(--color-white);
          padding: var(--space-5);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-md);
        }

        .faq-callout h3 {
          font-size: 1.125rem;
          font-weight: 600;
          margin-bottom: var(--space-2);
          color: var(--color-primary);
        }

        .faq-callout p {
          color: var(--color-gray-600);
          line-height: 1.6;
        }

        .faq-link {
          color: var(--color-accent);
          font-weight: 500;
          text-decoration: underline;
        }

        .faq-link:hover {
          color: var(--color-accent-light);
        }

        @media (max-width: 768px) {
          .contact-content {
            grid-template-columns: 1fr;
            gap: var(--space-8);
          }

          .form-row {
            grid-template-columns: 1fr;
          }

          .contact-form {
            padding: var(--space-4);
          }

          .contact-method {
            flex-direction: column;
            text-align: center;
          }

          .contact-icon {
            align-self: center;
          }
        }
      `}</style>
    </div>
  )
}

export default Contact