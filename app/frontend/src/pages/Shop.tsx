import { useEffect, useRef, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import ProgressiveImage from '../components/ProgressiveImage'
import * as fashionApi from '../services/fashionApi'
import { useShop } from '../lib/shop-context'

const FALLBACK = '/img/photo-6311392.jpg'
const PAGE = 24

export default function Shop() {
  const { gender, category, query, setTotal } = useShop()

  const [families, setFamilies] = useState<fashionApi.CatalogFamily[]>([])
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
      const next = off + res.families.length
      offsetRef.current = next
      setOffset(next)
      setFamilies(prev => {
        const merged = off === 0 ? res.families : [...prev, ...res.families]
        const seen = new Set<string>()
        return merged.filter(f => seen.has(f.family_id) ? false : (seen.add(f.family_id), true))
      })
    } catch {
      // backend offline — silent
    } finally {
      setLoading(false)
    }
  }, [gender, category, query, setTotal])

  useEffect(() => {
    offsetRef.current = 0
    setOffset(0)
    setFamilies([])
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
      <div className="shop-grid">
        {families.map(f => (
          <Link
            key={f.family_key || f.family_id}
            to={fashionApi.familyProductPath(f)}
            className="shop-card"
          >
            <div className="shop-card-img">
              <ProgressiveImage
                src={fashionApi.productImageUrl(f.image_url)}
                alt={f.product_name}
                fallbackSrc={FALLBACK}
                loading="lazy"
              />
            </div>
            <div className="shop-card-info">
              <p className="shop-card-name">{f.product_name}</p>
              <p className="shop-card-family-id">{f.family_id}</p>
              <p className="shop-card-meta">
                {f.gender} · {f.category.replace(/_/g, ' ')}
                {f.variant_count > 1 ? ` · ${f.variant_count} looks` : ''}
              </p>
              <p className="shop-card-price">${f.price.toFixed(2)}</p>
            </div>
          </Link>
        ))}
      </div>

      {loading && (
        <div className="shop-loading">
          {[...Array(8)].map((_, i) => <div key={i} className="shop-skeleton" />)}
        </div>
      )}

      {!loading && families.length === 0 && (
        <div className="shop-empty">No products found. Try a different search or category.</div>
      )}

      {hasMore && <div ref={sentinelRef} className="shop-sentinel" />}
      {!hasMore && families.length > 0 && (
        <p className="shop-end">{total.toLocaleString()} product families shown</p>
      )}
    </>
  )
}
