import { useState } from 'react'
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
          question: "How does the AI fashion assistant work?",
          answer: "Our AI assistant uses Google's Gemini model to understand your natural language queries. Describe what you're looking for — like 'floral summer dress under $80' — and the AI will search our 12,000+ item catalog to find matching products. It can also analyze uploaded photos to find visually similar items."
        },
        {
          question: "Can I search using images?",
          answer: "Yes! Click the image icon in the chat widget to upload a photo. The AI will analyze the image to identify clothing attributes like color, style, and pattern, then find similar items in our catalog using visual similarity matching."
        },
        {
          question: "Is the AI recommendations trustworthy?",
          answer: "Absolutely. The AI never makes up product details — it only recommends items that actually exist in our catalog. Every recommendation is grounded in real product data, and you can see full details before making any decisions."
        },
        {
          question: "What can I ask the AI assistant?",
          answer: "You can ask about specific products ('show me black leather jackets'), get styling advice ('what goes well with navy pants?'), find items by price range ('dresses under $50'), or ask how to use patron API keys and chat history from the AI agents hub."
        }
      ]
    },
    {
      category: "Sizing & Fit",
      questions: [
        {
          question: "How do I know what size to order?",
          answer: "Each product page includes detailed size charts with measurements. The AI assistant can also help recommend sizes based on your preferences — just ask something like 'I usually wear medium in tops, what size should I get for this dress?'"
        },
        {
          question: "What if the size doesn't fit perfectly?",
          answer: "We offer free exchanges within 30 days of purchase. Simply contact our customer service team through the chat widget or contact page, and we'll help you find the perfect fit. Our goal is to ensure you're completely satisfied."
        },
        {
          question: "Do items shrink after washing?",
          answer: "Most items are pre-shrunk and designed to maintain their shape when cared for according to the care instructions on each product page. Following the care guidelines will ensure your items retain their fit wash after wash."
        }
      ]
    },
    {
      category: "Materials & Care",
      questions: [
        {
          question: "What materials are used in the products?",
          answer: "Our catalog features items made from various materials including cotton, polyester, linen, silk, denim, and blends. Each product page lists the specific material composition and care instructions for that item."
        },
        {
          question: "How should I care for my purchases?",
          answer: "Care instructions vary by item and are listed on each product page. Generally, we recommend washing cold with like colors, using gentle detergent, and avoiding bleach. Check the specific care label for your item."
        },
        {
          question: "How long will my purchases last?",
          answer: "With proper care, quality clothing can last for years. We recommend following care instructions, storing items properly, and handling delicate fabrics with care. The AI assistant can provide specific care tips for any item."
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
            Find answers to common questions about our AI fashion assistant, sizing, care, and more.
            Can't find what you're looking for? <a href="/contact" className="contact-link">Contact us</a> or ask the AI chat widget.
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