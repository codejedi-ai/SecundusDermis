import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Menu, Search, X, ShoppingCart, User } from 'lucide-react'
import { useShop } from '../lib/shop-context'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:7860'

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const [user, setUser] = useState<{ email: string; name: string } | null>(null)
  const [cartCount, setCartCount] = useState(0)

  const { inputValue, setInputValue, setQuery } = useShop()
  const navigate = useNavigate()
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevInputRef = useRef(inputValue)
  const [aiFlash, setAiFlash] = useState(false)

  // Load user and cart on mount
  useEffect(() => {
    const sessionId = localStorage.getItem('session_id')
    if (sessionId) {
      fetch(`${API_BASE}/auth/me`, {
        headers: { 'session_id': sessionId }
      })
        .then(r => r.ok ? r.json() : null)
        .then(u => { if (u) setUser(u) })
        .catch(() => {})
      
      fetch(`${API_BASE}/cart`, {
        headers: { 'session_id': sessionId }
      })
        .then(r => r.ok ? r.json() : { items: [] })
        .then(c => setCartCount(c.items.reduce((n: number, i: any) => n + i.quantity, 0)))
        .catch(() => {})
    }
  }, [])

  // Flash the search bar when the AI updates inputValue externally
  useEffect(() => {
    if (inputValue !== prevInputRef.current && inputValue) {
      setAiFlash(true)
      const t = setTimeout(() => setAiFlash(false), 1200)
      prevInputRef.current = inputValue
      return () => clearTimeout(t)
    }
    prevInputRef.current = inputValue
  }, [inputValue])

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleSearch = (val: string) => {
    setInputValue(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setQuery(val.trim())
      if (val.trim()) navigate('/shop')
    }, 300)
  }

  const clearSearch = () => {
    setInputValue('')
    setQuery('')
  }

  return (
    <header className={`header ${isScrolled ? 'header-scrolled' : ''}`}>
      <div className="header-inner">

        {/* ── Left: nav ───────────────────────────────────────────────── */}
        <div className="header-left">
          <button
            className="header-menu-btn"
            onClick={() => setIsMenuOpen(o => !o)}
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <nav className={`nav-main ${isMenuOpen ? 'nav-open' : ''}`}>
            <Link to="/" className="nav-link">Home</Link>
            <Link to="/about" className="nav-link">About</Link>
            <Link to="/shop" className="nav-link">Shop</Link>
            <Link to="/blog" className="nav-link">Journal</Link>
          </nav>
        </div>

        {/* ── Center: logo ────────────────────────────────────────────── */}
        <div className="logo">
          <Link to="/" className="logo-link">
            <span className="logo-text">Secundus Dermis</span>
          </Link>
        </div>

        {/* ── Right: search + secondary nav ───────────────────────────── */}
        <div className="header-right">
          <div className="header-search">
            <Search size={14} className="header-search-icon" />
            <input
              className={`header-search-input${aiFlash ? ' ai-active' : ''}`}
              type="text"
              placeholder="Search…"
              value={inputValue}
              onChange={e => handleSearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && inputValue.trim()) navigate('/shop') }}
            />
            {inputValue && (
              <button className="header-search-clear" onClick={clearSearch} aria-label="Clear">
                <X size={12} />
              </button>
            )}
          </div>

          <nav className="nav-secondary nav-icons">
            <Link to="/cart" className="nav-icon-link">
              <ShoppingCart size={20} />
              {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
            </Link>
            <Link to={user ? "/account" : "/sign-in"} className="nav-icon-link">
              <User size={20} />
            </Link>
          </nav>
        </div>

      </div>

      {/* ── Mobile menu ─────────────────────────────────────────────────── */}
      <div className={`mobile-menu ${isMenuOpen ? 'mobile-menu-open' : ''}`}>
        <nav className="mobile-nav">
          {([['/', 'Home'], ['/about', 'About'], ['/shop', 'Shop'], ['/blog', 'Journal'], ['/faq', 'FAQ'], ['/contact', 'Contact'], ['/cart', 'Cart'], [user ? '/account' : '/sign-in', user ? 'Account' : 'Sign In']] as [string, string][]).map(([to, label]) => (
            <Link key={to} to={to} className="mobile-nav-link" onClick={() => setIsMenuOpen(false)}>
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}

export default Header
