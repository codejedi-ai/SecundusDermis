import { useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { X } from 'lucide-react'
import { useShop } from '../lib/shop-context'
import '../styles/shop.css'

const CAT_GROUPS_MEN = [
  { label: 'Tops',    cats: ['Tees_Tanks','Shirts_Polos','Sweaters','Sweatshirts_Hoodies','Suiting'] },
  { label: 'Bottoms', cats: ['Denim','Pants','Shorts'] },
  { label: 'Layers',  cats: ['Jackets_Vests'] },
]
const CAT_GROUPS_WOMEN = [
  { label: 'Tops',    cats: ['Tees_Tanks','Graphic_Tees','Blouses_Shirts','Cardigans'] },
  { label: 'Bottoms', cats: ['Denim','Pants','Shorts','Skirts','Leggings'] },
  { label: 'Dresses & Sets', cats: ['Dresses','Rompers_Jumpsuits'] },
  { label: 'Layers',  cats: ['Jackets_Coats'] },
]
const CAT_GROUPS_ALL = [
  { label: 'Tops',    cats: ['Tees_Tanks','Graphic_Tees','Blouses_Shirts','Shirts_Polos','Sweaters','Sweatshirts_Hoodies','Cardigans','Suiting'] },
  { label: 'Bottoms', cats: ['Denim','Pants','Shorts','Skirts','Leggings'] },
  { label: 'Dresses & Sets', cats: ['Dresses','Rompers_Jumpsuits'] },
  { label: 'Layers',  cats: ['Jackets_Vests','Jackets_Coats'] },
]

export default function ShopSidebar() {
  const {
    gender, setGender,
    category, setCategory,
    query,
    total,
    sidebarWidth, setSidebarWidth,
  } = useShop()

  const navigate = useNavigate()
  const location = useLocation()
  const isShop   = location.pathname === '/shop'

  const goShop = () => { if (!isShop) navigate('/shop') }

  const isDragging = useRef(false)
  const dragStartX = useRef(0)
  const dragStartW = useRef(0)

  const onDragStart = (e: React.MouseEvent) => {
    isDragging.current = true
    dragStartX.current = e.clientX
    dragStartW.current = sidebarWidth
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      const delta = e.clientX - dragStartX.current
      setSidebarWidth(Math.min(400, Math.max(160, dragStartW.current + delta)))
    }
    const onUp = () => {
      isDragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [setSidebarWidth])

  const catGroups = gender === 'MEN' ? CAT_GROUPS_MEN
    : gender === 'WOMEN' ? CAT_GROUPS_WOMEN
    : CAT_GROUPS_ALL

  const handleGender = (g: string) => {
    setGender(gender === g ? '' : g)
    setCategory('')
    goShop()
  }

  const handleCategory = (c: string) => {
    setCategory(category === c ? '' : c)
    goShop()
  }

  const clearAll = () => {
    setGender('')
    setCategory('')
  }

  const hasFilters = !!(gender || category || query)

  return (
    <div className="shop-sidebar-wrap" style={{ width: sidebarWidth }}>
      <div className="sidebar-resizer" onMouseDown={onDragStart} />
      <aside className="shop-sidebar">

        <div className="sidebar-header">
          <h1 className="shop-title">Shop</h1>
          {isShop && total > 0 && (
            <span className="shop-count">{total.toLocaleString()} items</span>
          )}
        </div>

        <div className="sidebar-section">
          <span className="sidebar-label">Gender</span>
          <ul className="sidebar-list">
            {['MEN', 'WOMEN'].map(g => (
              <li key={g}>
                <button
                  className={`sidebar-item ${gender === g ? 'active' : ''}`}
                  onClick={() => handleGender(g)}
                >
                  {g === 'MEN' ? 'Men' : 'Women'}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {catGroups.map(group => (
          <div className="sidebar-section" key={group.label}>
            <span className="sidebar-label">{group.label}</span>
            <ul className="sidebar-list">
              {group.cats.map(c => (
                <li key={c}>
                  <button
                    className={`sidebar-item ${category === c ? 'active' : ''}`}
                    onClick={() => handleCategory(c)}
                  >
                    {c.replace(/_/g, ' ')}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {hasFilters && (
          <button className="sidebar-clear" onClick={clearAll}>
            <X size={12} /> Clear all
          </button>
        )}

      </aside>
    </div>
  )
}
