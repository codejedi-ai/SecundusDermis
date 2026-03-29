import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Star, Bot, Search, ImageIcon, BookOpen, MessageSquare } from 'lucide-react'
import * as fashionApi from '../services/fashionApi'

const FALLBACK_IMG = '/img/photo-6311392.jpg'

const features = [
  {
    title: "12,000+ Pieces",
    description: "Men's and women's clothing across every category"
  },
  {
    title: "Keyword & Image Search",
    description: "Describe it in words or upload a photo to find your match"
  },
  {
    title: "AI Shopping Agent",
    description: "Ask naturally — the agent finds, filters, and recommends"
  }
]

const techFeatures = [
  {
    icon: <MessageSquare size={22} />,
    title: 'Conversational AI Agent',
    description:
      'A Google ADK + Gemini-powered agent that understands natural language, calls search tools, and returns grounded product recommendations — never hallucinating details it hasn\'t retrieved.',
  },
  {
    icon: <Search size={22} />,
    title: 'Keyword Search',
    description:
      'Instant full-catalog search across 12,278 product descriptions with zero API cost. Every query runs as pure in-memory string matching.',
  },
  {
    icon: <ImageIcon size={22} />,
    title: 'Visual Search',
    description:
      'Upload a photo and the agent uses Gemini VLM to extract clothing keywords, then re-ranks candidates using colour histogram similarity — one API call per image search.',
  },
  {
    icon: <BookOpen size={22} />,
    title: 'Living Journal',
    description:
      'Editorial articles stored as markdown files on the backend. The AI agent can search and surface them in conversation. New posts can be published through the built-in editor at /blog/new.',
  },
  {
    icon: <Bot size={22} />,
    title: 'Simulated Storefront',
    description:
      'The "brand" is a fictional prop. The 12,278 products come from the public DeepFashion Multimodal dataset on Kaggle, downloaded automatically on first server start.',
  },
]

const testimonials = [
  {
    name: "Sarah M.",
    location: "New York",
    rating: 5,
    text: "The AI assistant understood exactly what I was looking for. Found the perfect outfit in minutes!"
  },
  {
    name: "Emma L.",
    location: "Los Angeles",
    rating: 5,
    text: "The AI assistant found exactly what I was looking for in seconds. So convenient!"
  },
  {
    name: "Jessica R.",
    location: "Chicago",
    rating: 5,
    text: "Image search is incredible - uploaded a photo from Pinterest and it found similar items instantly."
  }
]

const Home = () => {
  const [catalogProducts, setCatalogProducts] = useState<fashionApi.Product[]>([])

  useEffect(() => {
    fashionApi.getRandomProducts(12).then((r) => setCatalogProducts(r.products)).catch(() => {})
  }, [])

  return (
    <div className="home">
      {/* Hero - Shopping focused */}
      <section className="hero">
        <div className="hero-image">
          <img
            src="/image-hero.jpeg"
            alt="Woman in elegant outfit"
          />
        </div>
        <div className="hero-content">
          <span className="hero-label">AI-Powered Fashion Discovery</span>
          <h1 className="hero-title">Your AI Fashion Assistant</h1>
          <p className="hero-subtitle">Tell the AI what you're looking for — or upload a photo to find your match</p>
          <Link to="/shop" className="hero-cta">
            <span>Shop Now</span>
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* Catalog Preview */}
      {catalogProducts.length > 0 && (
        <section className="catalog-discovery">
          <div className="catalog-discovery-header">
            <h2 className="catalog-discovery-title">Discover the Catalog</h2>
            <p className="catalog-discovery-sub">Ask the AI assistant below to find exactly what you need</p>
          </div>
          <div className="catalog-grid">
            {catalogProducts.map((p) => (
              <Link key={p.product_id} to={`/product/${p.product_id}`} className="catalog-card">
                <div className="catalog-card-img">
                  <img
                    src={fashionApi.productImageUrl(p.image_url)}
                    alt={p.product_name}
                    loading="lazy"
                    onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMG }}
                  />
                </div>
                <div className="catalog-card-info">
                  <p className="catalog-card-name">{p.product_name}</p>
                  <p className="catalog-card-cat">{p.gender} · {p.category.replace(/_/g, ' ')}</p>
                  <p className="catalog-card-price">${p.price.toFixed(2)}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Brand Story */}
      <section className="brand-story">
        <div className="brand-story-inner">
          <div className="brand-story-content">
            <span className="brand-label">Our Approach</span>
            <h2 className="brand-title">Fashion, Understood</h2>
            <p className="brand-text">
              Secundus Dermis pairs a curated catalog of over 12,000 pieces with an AI assistant
              that actually understands what you want — describe it, upload a photo, or just browse.
            </p>
            <p className="brand-text">
              No filters to fiddle with. Just tell the agent what you're looking for and it will
              find the closest match across the entire collection instantly.
            </p>
          </div>
          <div className="brand-story-image">
            <img
              src="/image-craft.jpeg"
              alt="Fashion catalog preview"
            />
          </div>
        </div>
      </section>

      {/* Features Strip */}
      <section className="features-strip">
        <div className="features-strip-inner">
          {features.map((feature, index) => (
            <div key={index} className="feature-item">
              <h3 className="feature-item-title">{feature.title}</h3>
              <p className="feature-item-text">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Tech Features - Under the Hood */}
      <section className="about-values">
        <div className="values-inner">
          <div className="values-header">
            <span className="values-label">How it works</span>
            <h2 className="values-title">Under the Hood</h2>
          </div>
          <div className="values-grid">
            {techFeatures.map((f, i) => (
              <div key={i} className="value-item">
                <div className="value-icon">{f.icon}</div>
                <h3 className="value-title">{f.title}</h3>
                <p className="value-text">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech Stack */}
      <section className="about-craft">
        <div className="craft-image">
          <img src="/image-craft.jpeg" alt="Craft" />
        </div>
        <div className="craft-content">
          <span className="craft-label">Tech Stack</span>
          <h2 className="craft-title">FastAPI · React · Google ADK</h2>
          <p className="craft-text">
            The backend is a FastAPI server that loads the DeepFashion dataset
            from Kaggle on first run, serves the catalog, runs the Gemini agent,
            and hosts the journal API. The frontend is a React + Vite SPA with
            infinite-scroll catalog browsing, a markdown blog, and a persistent
            chat widget that survives page navigation.
          </p>
          <p className="craft-text">
            Gemini API calls are kept to a strict minimum: one call per chat
            message (the agent LLM), and one VLM call per image search. All
            catalog search is zero-cost in-memory keyword matching.
          </p>
          <div className="craft-actions">
            <Link to="/shop" className="craft-link">
              Browse the catalog
            </Link>
            <Link to="/blog" className="craft-link craft-link-secondary">
              Read the journal
            </Link>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="testimonials">
        <div className="testimonials-header">
          <h2 className="testimonials-title">What Our Customers Say</h2>
        </div>
        <div className="testimonials-grid">
          {testimonials.map((testimonial, index) => (
            <div key={index} className="testimonial-card">
              <div className="testimonial-rating">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} size={14} fill="currentColor" />
                ))}
              </div>
              <p className="testimonial-text">"{testimonial.text}"</p>
              <div className="testimonial-author">
                <span className="testimonial-name">{testimonial.name}</span>
                <span className="testimonial-location">{testimonial.location}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Newsletter / CTA */}
      <section className="newsletter">
        <div className="newsletter-inner">
          <h2 className="newsletter-title">Try the AI Assistant</h2>
          <p className="newsletter-text">
            Click the chat icon in the bottom right corner to start chatting with our AI fashion assistant.
            Describe what you're looking for or upload a photo to find similar styles.
          </p>
          <Link to="/shop" className="newsletter-btn">Browse Catalog</Link>
        </div>
      </section>
    </div>
  )
}

export default Home
