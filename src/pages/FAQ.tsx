import { useState } from 'preact/hooks'
import { ChevronDown, ChevronUp } from 'lucide-preact'

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

      <style jsx>{`
        .faq-page {
          padding-top: 100px;
          padding-bottom: var(--space-8);
        }

        .faq-header {
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

        .contact-link {
          color: var(--color-accent);
          font-weight: 500;
          text-decoration: underline;
        }

        .contact-link:hover {
          color: var(--color-accent-light);
        }

        .faq-content {
          max-width: 800px;
          margin: 0 auto;
        }

        .faq-category {
          margin-bottom: var(--space-10);
        }

        .category-title {
          font-size: 1.5rem;
          font-weight: 600;
          margin-bottom: var(--space-6);
          color: var(--color-primary);
          padding-bottom: var(--space-2);
          border-bottom: 2px solid var(--color-accent);
        }

        .questions-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .faq-item {
          background: var(--color-white);
          border: 1px solid var(--color-gray-200);
          border-radius: var(--radius-lg);
          overflow: hidden;
          transition: all var(--transition-fast);
        }

        .faq-item:hover {
          box-shadow: var(--shadow-md);
        }

        .faq-question {
          width: 100%;
          padding: var(--space-4) var(--space-5);
          background: none;
          border: none;
          text-align: left;
          font-size: 1rem;
          font-weight: 600;
          color: var(--color-primary);
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: var(--space-3);
          transition: all var(--transition-fast);
        }

        .faq-question:hover {
          background: var(--color-gray-50);
        }

        .faq-question[aria-expanded="true"] {
          background: var(--color-gray-50);
          border-bottom: 1px solid var(--color-gray-200);
        }

        .faq-answer {
          padding: var(--space-4) var(--space-5);
          background: var(--color-gray-50);
          animation: slideDown 0.3s ease-out;
        }

        .faq-answer p {
          color: var(--color-gray-700);
          line-height: 1.7;
          margin: 0;
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .faq-footer {
          margin-top: var(--space-16);
          text-align: center;
        }

        .contact-section {
          background: var(--color-gray-50);
          padding: var(--space-8);
          border-radius: var(--radius-xl);
          max-width: 600px;
          margin: 0 auto;
        }

        .contact-section h3 {
          font-size: 1.5rem;
          font-weight: 600;
          margin-bottom: var(--space-3);
          color: var(--color-primary);
        }

        .contact-section p {
          color: var(--color-gray-600);
          line-height: 1.7;
          margin-bottom: var(--space-4);
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

        @media (max-width: 768px) {
          .faq-question {
            padding: var(--space-3) var(--space-4);
            font-size: 0.9rem;
          }

          .faq-answer {
            padding: var(--space-3) var(--space-4);
          }

          .contact-section {
            padding: var(--space-6);
          }
        }
      `}</style>
    </div>
  )
}

export default FAQ