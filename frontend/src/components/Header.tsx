import { useEffect, useRef, useState } from 'react' // useEffect kept for scroll + search flash
import { Link, useNavigate } from 'react-router-dom'
import { Menu, Search, X, ShoppingCart, User } from 'lucide-react'
import { useShop } from '../lib/shop-context'
import { useAuth } from '../lib/auth-context'
import { useCart } from '../lib/cart-context'

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)

  const { user } = useAuth()
  const { cartCount } = useCart()
  const { inputValue, setInputValue, setQuery } = useShop()
  const navigate = useNavigate()
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevInputRef = useRef(inputValue)
  const [aiFlash, setAiFlash] = useState(false)

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
            {user && (
              <Link to="/blog/new" className="nav-link nav-link-write">
                Write
              </Link>
            )}
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
          {user && (
            <Link to="/blog/new" className="mobile-nav-link mobile-nav-write" onClick={() => setIsMenuOpen(false)}>
              ✏️ Write
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}

export default Header
