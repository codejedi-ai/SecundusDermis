import React, { useState } from 'react'
import { Mail, Phone, MapPin, Clock, Send } from 'lucide-react'

const Contact = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  })

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
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
    </div>
  )
}

export default Contact