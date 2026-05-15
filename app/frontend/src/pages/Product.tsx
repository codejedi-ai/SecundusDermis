import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import { ArrowLeft, ShoppingBag, Check } from 'lucide-react'
import ProgressiveImage from '../components/ProgressiveImage'
import * as fashionApi from '../services/fashionApi'
import { useCart } from '../lib/cart-context'
import { AUTH_ENABLED } from '../lib/auth-config'
import { useAuth } from '../lib/auth-context'

const FALLBACK = '/img/photo-6311392.jpg'

function findView(
  detail: fashionApi.CatalogFamilyDetail,
  variant: string,
  view: string,
): fashionApi.FamilyVariantView | undefined {
  const v = detail.variants.find(x => x.variant === variant)
  return v?.views.find(x => x.view === view) ?? v?.views[0]
}

export default function Product() {
  const { id, familyId: familyIdParam } = useParams<{ id?: string; familyId?: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { session } = useAuth()
  const { addToCart, cart } = useCart()

  const [family, setFamily] = useState<fashionApi.CatalogFamilyDetail | null>(null)
  const [selectedVariant, setSelectedVariant] = useState('')
  const [selectedView, setSelectedView] = useState('front')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState(false)

  const activeSku = useMemo(() => {
    if (!family) return null
    return findView(family, selectedVariant, selectedView)
  }, [family, selectedVariant, selectedView])

  const availableViews = useMemo(() => {
    if (!family || !selectedVariant) return [] as string[]
    const v = family.variants.find(x => x.variant === selectedVariant)
    return v?.views.map(x => x.view) ?? []
  }, [family, selectedVariant])

  const alreadyInCart = activeSku
    ? cart.items.some(i => i.product_id === activeSku.product_id)
    : false

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [id, familyIdParam, searchParams])

  useEffect(() => {
    setAdded(false)
    setLoading(true)
    setError('')

    const load = async () => {
      try {
        if (familyIdParam) {
          const gender = searchParams.get('gender') ?? ''
          const category = searchParams.get('category') ?? ''
          if (!gender || !category) {
            setError('Product family not found.')
            return
          }
          const detail = await fashionApi.getCatalogFamily(familyIdParam, { gender, category })
          setFamily(detail)
          const first = detail.variants[0]
          setSelectedVariant(first?.variant ?? '')
          setSelectedView(first?.views[0]?.view ?? 'front')
          document.title = detail.product_name
          return
        }

        if (!id) {
          setError('Product not found.')
          return
        }

        const sku = await fashionApi.getProduct(id)
        const fid = sku.family_id
        if (!fid) {
          setError('Product not found.')
          return
        }
        const detail = await fashionApi.getCatalogFamily(fid, {
          gender: sku.gender,
          category: sku.category,
        })
        setFamily(detail)
        setSelectedVariant(sku.look_variant || detail.variants[0]?.variant || '')
        setSelectedView(sku.image_view || 'front')
        document.title = detail.product_name
      } catch {
        setError('Product not found.')
        setFamily(null)
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [id, familyIdParam, searchParams])

  const handleAddToCart = async () => {
    if (!activeSku || !family || !session) return
    setAdding(true)
    try {
      await addToCart({
        product_id:   activeSku.product_id,
        product_name: family.product_name,
        price:        activeSku.price,
        image_url:    activeSku.image_url,
      })
      setAdded(true)
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

  if (error || !family || !activeSku) return (
    <div className="product-error">
      <p>{error || 'Product not found.'}</p>
      <button type="button" className="back-btn" onClick={() => navigate('/shop')}>
        <ArrowLeft size={16} /> Back to shop
      </button>
    </div>
  )

  const hasBack = family.variants.some(v => v.views.some(x => x.view === 'back'))

  return (
    <div className="product-layout">

      <div className="product-gallery">
        <div className="gallery-main">
          <ProgressiveImage
            src={fashionApi.productImageUrl(activeSku.image_url)}
            alt={family.product_name}
            fallbackSrc={FALLBACK}
            fit="contain"
            loading="eager"
          />
        </div>
      </div>

      <div className="product-info">
        <button type="button" className="back-btn" onClick={() => navigate('/shop')}>
          <ArrowLeft size={15} /> Back to shop
        </button>

        <div className="product-meta-tags">
          <span className="product-tag">
            {family.gender === 'MEN' ? "Men's" : family.gender === 'WOMEN' ? "Women's" : family.gender}
          </span>
          <span className="product-tag">{family.category.replace(/_/g, ' ')}</span>
          <span className="product-tag product-tag-id">ID: {family.family_id}</span>
        </div>

        <h1 className="product-title">{family.product_name}</h1>
        <p className="product-price">${activeSku.price.toFixed(2)}</p>

        <p className="product-description">{family.description || 'No description available.'}</p>

        <div className="product-options">
          {family.variants.length > 1 && (
            <div className="option-group">
              <span className="option-label">Look variant</span>
              <div className="size-buttons">
                {family.variants.map(v => (
                  <button
                    key={v.variant}
                    type="button"
                    className={`size-btn${selectedVariant === v.variant ? ' active' : ''}`}
                    onClick={() => {
                      setSelectedVariant(v.variant)
                      const views = v.views.map(x => x.view)
                      if (!views.includes(selectedView)) {
                        setSelectedView(views[0] ?? 'front')
                      }
                    }}
                  >
                    {v.variant}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="option-group">
            <span className="option-label">View</span>
            <div className="size-buttons">
              {availableViews.map(view => (
                <button
                  key={view}
                  type="button"
                  className={`size-btn${selectedView === view ? ' active' : ''}`}
                  onClick={() => setSelectedView(view)}
                  disabled={view === 'back' && !hasBack}
                >
                  {view === 'front' ? 'Front' : 'Back'}
                </button>
              ))}
            </div>
            {!hasBack && availableViews.length <= 1 && (
              <p className="product-view-hint">Only front view is available in this catalog.</p>
            )}
          </div>
        </div>

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
