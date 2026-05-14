import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Star, MessageCircle } from 'lucide-react'
import * as fashionApi from '../services/fashionApi'
import { SD_CHAT_OPEN_EVENT } from '../lib/convo-context'
import Footer from '../components/Footer'

const FALLBACK_IMG = '/img/placeholder.svg'

function formatGenderLine(genders: string[]): string {
  const labels = genders.map((g) => {
    if (g === 'MEN') return "men's"
    if (g === 'WOMEN') return "women's"
    return g.replace(/_/g, ' ').toLowerCase()
  })
  if (labels.length === 0) return 'Multiple departments'
  if (labels.length === 1) return labels[0]!
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`
  return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`
}

/** Titles and descriptions are derived from GET /catalog/stats (no hardcoded catalog counts). */
function buildHomeFeatures(stats: fashionApi.CatalogStats): { title: string; description: string }[] {
  const titleCatalog = `${stats.total_products.toLocaleString()} pieces`
  const descCatalog = `${formatGenderLine(stats.genders)} — ${stats.categories.length.toLocaleString()} categories in the loaded catalog.`

  const mode = stats.search_mode ?? 'keyword search'
  const titleSearch = mode.replace(/\s*\+\s*/g, ' · ')
  const descSearch = `Server-reported retrieval stack: ${mode}. Text search scans in-memory descriptions; the chat flow can combine this with the configured agent.`

  const ragLine =
    stats.embedding_model && stats.embedding_dim != null
      ? ` Editorial RAG uses ${stats.embedding_model} (${stats.embedding_dim.toLocaleString()}-dim vectors).`
      : ''

  return [
    { title: titleCatalog, description: descCatalog },
    { title: titleSearch, description: `${descSearch}${ragLine}` },
  ]
}

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
  const [catalogStats, setCatalogStats] = useState<fashionApi.CatalogStats | null>(null)

  useEffect(() => {
    fashionApi.getRandomProducts(12).then((r) => setCatalogProducts(r.products)).catch(() => {})
  }, [])

  useEffect(() => {
    fashionApi.getCatalogStats().then(setCatalogStats).catch(() => setCatalogStats(null))
  }, [])

  return (
    <>
    <div className="home">
      {/* Hero - Shopping focused */}
      <section className="hero">
        <div className="hero-image">
          <img
            src="/image-hero.jpeg"
            alt="Woman in elegant outfit"
            onError={(e) => {
              (e.target as HTMLImageElement).src = FALLBACK_IMG
            }}
          />
        </div>
        <div className="hero-content">
          <span className="hero-label">Retail of the Future</span>
          <h1 className="hero-title">Secundus Dermis</h1>
          <p className="hero-subtitle">Find your second skin</p>
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

      {/* Brand Story - Merged with Features */}
      <section className="brand-story">
        <div className="brand-story-inner">
          <div className="brand-story-content">
            <span className="brand-label">Our Approach</span>
            <h2 className="brand-title">Fashion, Understood</h2>
            <p className="brand-text">
              {catalogStats ? (
                <>
                  Secundus Dermis pairs a catalog of {catalogStats.total_products.toLocaleString()} pieces
                  with an AI assistant that routes through this deployment&apos;s search stack — describe what you
                  want, browse filters, or use chat when the agent is enabled.
                </>
              ) : (
                <>
                  Secundus Dermis pairs the loaded catalog with an AI assistant — describe what you want,
                  browse filters, or use chat when the agent is enabled.
                </>
              )}
            </p>
            <p className="brand-text">
              {catalogStats ? (
                <>
                  The shop grid reflects the same in-memory index ({catalogStats.categories.length} categories;
                  {' '}
                  {catalogStats.genders.join(' / ')})
                  embedding calls for catalog rows.
                </>
              ) : (
                <>
                  The shop grid reflects the in-memory catalog; keyword search stays on the API without
                  per-query cloud embedding calls for catalog rows.
                </>
              )}
            </p>
            <div className="brand-story-features">
              {catalogStats ? (
                buildHomeFeatures(catalogStats).map((feature, index) => (
                  <div key={index} className="brand-story-feature">
                    <h3 className="brand-story-feature-title">{feature.title}</h3>
                    <p className="brand-story-feature-desc">{feature.description}</p>
                  </div>
                ))
              ) : (
                <p className="brand-story-feature-desc">Loading catalog facts…</p>
              )}
            </div>
          </div>
          <div className="brand-story-image">
            <img
              src="/image-understand.jpeg"
              alt="Fashion catalog preview"
              onError={(e) => {
                (e.target as HTMLImageElement).src = FALLBACK_IMG
              }}
            />
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
          <div className="newsletter-actions">
            <Link to="/shop" className="newsletter-btn">
              Browse catalog
            </Link>
            <button
              type="button"
              className="newsletter-btn newsletter-btn--outline"
              onClick={() => window.dispatchEvent(new CustomEvent(SD_CHAT_OPEN_EVENT))}
            >
              <MessageCircle size={16} aria-hidden style={{ marginRight: 8, verticalAlign: 'text-bottom' }} />
              Open patron chat
            </button>
          </div>
        </div>
      </section>
    </div>
    <Footer />
    </>
  )
}

export default Home
