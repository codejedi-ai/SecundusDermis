import { useEffect, useRef, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import * as fashionApi from '../services/fashionApi'
import { useShop } from '../lib/shop-context'

const FALLBACK = '/img/photo-6311392.jpg'
const PAGE = 24

export default function Shop() {
  const { gender, category, query, setTotal } = useShop()

  const [products, setProducts] = useState<fashionApi.Product[]>([])
  const [offset, setOffset]     = useState(0)
  const [total, setLocalTotal]  = useState(0)
  const [loading, setLoading]   = useState(false)

  const sentinelRef = useRef<HTMLDivElement>(null)
  const offsetRef   = useRef(0)

  const fetchPage = useCallback(async (off: number) => {
    setLoading(true)
    try {
      const res = await fashionApi.browseCatalog({
        offset: off,
        limit: PAGE,
        gender: gender || undefined,
        category: category || undefined,
        q: query || undefined,
      })
      setLocalTotal(res.total)
      setTotal(res.total)
      const next = off + res.products.length
      offsetRef.current = next
      setOffset(next)
      setProducts(prev => off === 0 ? res.products : [...prev, ...res.products])
    } catch {
      // backend offline — silent
    } finally {
      setLoading(false)
    }
  }, [gender, category, query, setTotal])

  useEffect(() => {
    offsetRef.current = 0
    setOffset(0)
    setProducts([])
    fetchPage(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gender, category, query])

  useEffect(() => {
    if (!sentinelRef.current) return
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading && offsetRef.current < total) {
          fetchPage(offsetRef.current)
        }
      },
      { rootMargin: '300px' },
    )
    obs.observe(sentinelRef.current)
    return () => obs.disconnect()
  }, [loading, total, fetchPage])

  const hasMore = offset < total

  return (
    <>
      {/* ── Product grid ───────────────────────────────────────────────────── */}
      <div className="shop-grid">
        {products.map(p => (
          <Link key={p.product_id} to={`/product/${p.product_id}`} className="shop-card">
            <div className="shop-card-img">
              <img
                src={fashionApi.productImageUrl(p.image_url)}
                alt={p.product_name}
                loading="lazy"
                onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK }}
              />
            </div>
            <div className="shop-card-info">
              <p className="shop-card-name">{p.product_name}</p>
              <p className="shop-card-meta">{p.gender} · {p.category.replace(/_/g, ' ')}</p>
              <p className="shop-card-price">${p.price.toFixed(2)}</p>
            </div>
          </Link>
        ))}
      </div>

      {loading && (
        <div className="shop-loading">
          {[...Array(8)].map((_, i) => <div key={i} className="shop-skeleton" />)}
        </div>
      )}

      {!loading && products.length === 0 && (
        <div className="shop-empty">No products found. Try a different search or category.</div>
      )}

      {hasMore && <div ref={sentinelRef} className="shop-sentinel" />}
      {!hasMore && products.length > 0 && (
        <p className="shop-end">All {total.toLocaleString()} items shown</p>
      )}
    </>
  )
}
