import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Star } from 'lucide-react'
import * as fashionApi from '../services/fashionApi'

const FALLBACK_IMG = '/img/photo-6311392.jpg'

const Home = () => {
  const [catalogProducts, setCatalogProducts] = useState<fashionApi.Product[]>([])

  useEffect(() => {
    fashionApi.getRandomProducts(12).then((r) => setCatalogProducts(r.products)).catch(() => {})
  }, [])

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

  const testimonials = [
    {
      name: "Sarah M.",
      location: "New York",
      rating: 5,
      text: "The most comfortable underlayer I've ever worn. The quality is exceptional."
    },
    {
      name: "Emma L.",
      location: "Los Angeles",
      rating: 5,
      text: "Finally found the perfect white tee. The built-in support is a game changer."
    },
    {
      name: "Jessica R.",
      location: "Chicago",
      rating: 5,
      text: "Luxurious feel, perfect fit. I've ordered three more."
    }
  ]

  return (
    <div className="home">
      <section className="hero">
        <div className="hero-image">
          <img
            src="/img/photo-6311387.jpg"
            alt="Woman in elegant white underlayer"
          />
        </div>
        <div className="hero-content">
          <span className="hero-label">AI-Powered Fashion Discovery</span>
          <h1 className="hero-title">Your Second Skin</h1>
          <p className="hero-subtitle">Tell the AI what you're looking for — or upload a photo to find your match</p>
          <Link to="/shop" className="hero-cta">
            <span>Shop Now</span>
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>

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
            <Link to="/about" className="brand-link">
              <span>Our Story</span>
              <ArrowRight size={14} />
            </Link>
          </div>
          <div className="brand-story-image">
            <img
              src="/img/photo-6311475.jpg"
              alt="Premium fabric detail"
            />
          </div>
        </div>
      </section>

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

      <section className="newsletter">
        <div className="newsletter-inner">
          <h2 className="newsletter-title">Join the Community</h2>
          <p className="newsletter-text">
            Subscribe to receive updates on new arrivals, exclusive offers, and styling inspiration.
          </p>
          <form className="newsletter-form" onSubmit={(e) => e.preventDefault()}>
            <input
              type="email"
              placeholder="Enter your email"
              className="newsletter-input"
            />
            <button type="submit" className="newsletter-btn">Subscribe</button>
          </form>
        </div>
      </section>
    </div>
  )
}

export default Home
