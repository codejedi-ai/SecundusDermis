import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import * as fashionApi from '../services/fashionApi'

const FALLBACK = '/img/photo-6311392.jpg'

export default function Product() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [product, setProduct] = useState<fashionApi.Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [id])

  useEffect(() => {
    if (!id) return
    setLoading(true)
    fashionApi.getProduct(id)
      .then(p => setProduct(p as fashionApi.Product))
      .catch(() => setError('Product not found.'))
      .finally(() => setLoading(false))
  }, [id])

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
      </div>
    </div>
  )
}
