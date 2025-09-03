import React, { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

const FAQ = () => {
  const [openItems, setOpenItems] = useState<number[]>([])

  const toggleItem = (index: number) => {
    setOpenItems(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index)
        : [...prev, index]
    )
  }

  const faqs = [
    {
      category: "Product & Features",
      questions: [
        {
          question: "What makes Secundus Dermis tees different from regular white tees?",
          answer: "Our tees feature a premium silk and cotton-spandex blend with silver infusion for odor resistance, an integrated seamless bra for support, and innovative emergency functionality. The slim-fitting design creates a perfect foundation layer that's invisible under clothes."
        },
        {
          question: "How does the integrated bra work?",
          answer: "The seamless built-in bra is engineered into the fabric structure, providing comfortable support without the bulk or visibility of traditional undergarments. It maintains its shape and effectiveness wash after wash, eliminating the need for additional bras."
        },
        {
          question: "What is the emergency functionality feature?",
          answer: "Our tee includes a thoughtfully designed emergency feature where the sleeves can be carefully folded to create a temporary, hygienic liner solution. This provides peace of mind for unexpected situations while maintaining comfort and dignity. The feature is completely discreet and doesn't affect the garment's primary function."
        },
        {
          question: "Is the emergency feature hygienic and safe to use?",
          answer: "Yes, absolutely. The feature is designed with hygiene in mind, using the same premium, silver-infused fabric that naturally resists bacteria and odors. The folding method creates a clean barrier, and the garment can be easily washed afterward using our standard care instructions."
        }
      ]
    },
    {
      category: "Sizing & Fit",
      questions: [
        {
          question: "How do I choose the right size?",
          answer: "Our tees are designed to fit snugly as a compression layer. We recommend referring to our detailed size guide and measuring yourself for the most accurate fit. If you're between sizes, we suggest sizing up for comfort. We offer free exchanges within 30 days."
        },
        {
          question: "What if the size doesn't fit perfectly?",
          answer: "We offer free exchanges within 30 days of purchase. Simply contact our customer service team, and we'll help you find the perfect fit. Our goal is to ensure you're completely satisfied with your Secundus Dermis experience."
        },
        {
          question: "Do the tees shrink after washing?",
          answer: "Our premium fabric blend is pre-shrunk and designed to maintain its shape and size when cared for according to our instructions. Following our care guidelines will ensure your tee retains its perfect fit wash after wash."
        }
      ]
    },
    {
      category: "Materials & Care",
      questions: [
        {
          question: "What materials are used in Secundus Dermis tees?",
          answer: "Our exclusive blend features premium silk (40%), organic cotton (35%), spandex (20%), and ice-cotton (5%). The fabric is infused with silver ions for natural antimicrobial properties, providing luxury, comfort, and performance."
        },
        {
          question: "How should I care for my Secundus Dermis tee?",
          answer: "Machine wash cold with like colors using gentle, sulfate-free detergent. Avoid fabric softeners to maintain the silver infusion. Tumble dry low or hang dry. Do not bleach or dry clean. Iron on low heat if needed, and store flat or hung to maintain shape."
        },
        {
          question: "How long will my Secundus Dermis tee last?",
          answer: "With proper care, your Secundus Dermis tee is designed to maintain its quality, shape, and functionality for years. We're so confident in our craftsmanship that we offer a 1-year quality guarantee on all our products."
        }
      ]
    },
    {
      category: "Ordering & Shipping",
      questions: [
        {
          question: "Do you offer free shipping?",
          answer: "Yes! We offer free shipping on all orders over $75 within the United States. Orders under $75 have a flat shipping rate of $8.95. We also offer expedited shipping options at checkout."
        },
        {
          question: "How long does shipping take?",
          answer: "Standard shipping typically takes 3-5 business days within the United States. Expedited shipping options (2-day and overnight) are available at checkout. You'll receive tracking information once your order ships."
        },
        {
          question: "What is your return policy?",
          answer: "We offer a 30-day return and exchange policy. Items must be in original condition with tags attached. We provide free return shipping labels for exchanges. Refunds are processed within 5-7 business days of receiving your return."
        }
      ]
    }
  ]

  return (
    <div className="faq-page">
      <div className="container">
        <div className="faq-header">
          <h1 className="page-title">Frequently Asked Questions</h1>
          <p className="page-description">
            Find answers to common questions about Secundus Dermis tees, sizing, care, and more. 
            Can't find what you're looking for? <a href="/contact" className="contact-link">Contact us</a> directly.
          </p>
        </div>

        <div className="faq-content">
          {faqs.map((category, categoryIndex) => (
            <div key={categoryIndex} className="faq-category">
              <h2 className="category-title">{category.category}</h2>
              <div className="questions-list">
                {category.questions.map((faq, questionIndex) => {
                  const itemIndex = categoryIndex * 100 + questionIndex
                  const isOpen = openItems.includes(itemIndex)
                  
                  return (
                    <div key={questionIndex} className="faq-item">
                      <button 
                        className="faq-question"
                        onClick={() => toggleItem(itemIndex)}
                        aria-expanded={isOpen}
                      >
                        <span>{faq.question}</span>
                        {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </button>
                      {isOpen && (
                        <div className="faq-answer">
                          <p>{faq.answer}</p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="faq-footer">
          <div className="contact-section">
            <h3>Still have questions?</h3>
            <p>
              Our customer care team is here to help. Reach out to us at{' '}
              <a href="mailto:hello@secundusdermis.com" className="contact-link">hello@secundusdermis.com</a>{' '}
              or call <a href="tel:1-800-SECUNDUS" className="contact-link">1-800-SECUNDUS</a>.
            </p>
            <a href="/contact" className="btn btn-primary">Contact Us</a>
          </div>
        </div>
      </div>
    </div>
  )
}

export default FAQ