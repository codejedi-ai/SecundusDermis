import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, ShoppingBag, Check } from 'lucide-react'
import * as fashionApi from '../services/fashionApi'
import { useCart } from '../lib/cart-context'
import { AUTH_ENABLED } from '../lib/auth-config'
import { useAuth } from '../lib/auth-context'

const FALLBACK = '/img/photo-6311392.jpg'

export default function Product() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { session } = useAuth()
  const { addToCart, cart } = useCart()

  const [product, setProduct] = useState<fashionApi.Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState(false)

  const alreadyInCart = product
    ? cart.items.some(i => i.product_id === product.product_id)
    : false

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [id])

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setAdded(false)
    fashionApi.getProduct(id)
      .then(p => {
        setProduct(p as fashionApi.Product)
        // Set document title so monitor-context can capture the product name
        document.title = (p as fashionApi.Product).product_name
      })
      .catch(() => setError('Product not found.'))
      .finally(() => setLoading(false))
  }, [id])

  const handleAddToCart = async () => {
    if (!product || !session) return
    setAdding(true)
    try {
      await addToCart({
        product_id:   product.product_id,
        product_name: product.product_name,
        price:        product.price,
        image_url:    product.image_url,
      })
      setAdded(true)
      // Force a refresh to ensure cart count updates everywhere
      setTimeout(() => setAdded(false), 3000)
    } catch (err) {
      console.error('Failed to add to cart:', err)
      alert('Failed to add to cart. Please try again.')
    } finally {
      setAdding(false)
    }
  }

  if (loading) return (
    <div className="product-loading">
      <div className="product-loading-img skeleton" />
      <div className="product-loading-info">
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-line short" />
      </div>
    </div>
  )

  if (error || !product) return (
    <div className="product-error">
      <p>{error || 'Product not found.'}</p>
      <button className="back-btn" onClick={() => navigate(-1)}>
        <ArrowLeft size={16} /> Back
      </button>
    </div>
  )

  return (
    <div className="product-layout">

      {/* ── Image ──────────────────────────────────────────────── */}
      <div className="product-gallery">
        <div className="gallery-main">
          <img
            src={fashionApi.productImageUrl(product.image_url)}
            alt={product.product_name}
            onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK }}
          />
        </div>
      </div>

      {/* ── Info ───────────────────────────────────────────────── */}
      <div className="product-info">
        <button className="back-btn" onClick={() => navigate(-1)}>
          <ArrowLeft size={15} /> Back
        </button>

        <div className="product-meta-tags">
          <span className="product-tag">
            {product.gender === 'MEN' ? "Men's" : product.gender === 'WOMEN' ? "Women's" : product.gender}
          </span>
          <span className="product-tag">{product.category.replace(/_/g, ' ')}</span>
          <span className="product-tag product-tag-id">ID: {product.product_id}</span>
        </div>

        <h1 className="product-title">{product.product_name}</h1>
        <p className="product-price">${product.price.toFixed(2)}</p>

        <p className="product-description">{product.description || 'No description available.'}</p>

        {/* ── Add to Cart (requires sign-in when auth is enabled) ─ */}
        {AUTH_ENABLED && (session ? (
          alreadyInCart || added ? (
            <div className="product-cart-actions">
              <button className="product-add-btn product-add-btn--done" disabled>
                <Check size={16} />
                Reserved
              </button>
              <Link to="/cart" className="product-view-cart-link">
                View your portfolio →
              </Link>
            </div>
          ) : (
            <button
              className="product-add-btn"
              onClick={handleAddToCart}
              disabled={adding}
            >
              <ShoppingBag size={16} />
              {adding ? 'Reserving…' : 'Reserve this Piece'}
            </button>
          )
        ) : (
          <p className="product-signin-hint">
            <Link to="/sign-in">Sign in</Link> to reserve this piece.
          </p>
        ))}
      </div>
    </div>
  )
}
