// crypto.randomUUID is only available in secure contexts (HTTPS/localhost).
// Polyfill for plain HTTP deployments.
if (!crypto.randomUUID) {
  crypto.randomUUID = () => {
    const bytes = new Uint8Array(16)
    crypto.getRandomValues(bytes)
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    return [...bytes].map((b, i) =>
      ([4, 6, 8, 10].includes(i) ? '-' : '') + b.toString(16).padStart(2, '0')
    ).join('') as `${string}-${string}-${string}-${string}-${string}`
  }
}

import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter as Router, Routes, Route, Outlet, useNavigate, useLocation } from 'react-router-dom'
import './index.css'
import { ShopProvider, useShop } from './lib/shop-context'
import { AuthProvider } from './lib/auth-context'
import { ConvoProvider, useConvo } from './lib/convo-context'
import { CartProvider } from './lib/cart-context'
import { BlogProvider } from './lib/blog-context'
import { MonitorProvider } from './lib/monitor-context'
import { SocketProvider, useSocket } from './lib/socket-context'
import Header from './components/Header'

import ShopSidebar from './components/ShopSidebar'
import ScrollToTop from './components/ScrollToTop'
import Product from './pages/Product'
import Shop from './pages/Shop'
import Home from './pages/Home'
import About from './pages/About'
import Contact from './pages/Contact'
import FAQ from './pages/FAQ'
import Blog from './pages/Blog'
import BlogPost from './pages/BlogPost'
import NewBlog from './pages/NewBlog'
import SignIn from './pages/SignIn'
import SignUp from './pages/SignUp'
import Account from './pages/Account'
import Cart from './pages/Cart'
import ChatWidget from './components/ChatWidget'
import './styles/shop.css'

/**
 * SocketBridge — lives inside ConvoProvider so it can read chatSessionId,
 * then wraps children with SocketProvider scoped to that session.
 */
function SocketBridge({ children }: { children: React.ReactNode }) {
  const { chatSessionId } = useConvo();
  return <SocketProvider sessionId={chatSessionId}>{children}</SocketProvider>;
}

/**
 * UiActionExecutor — consumes ui_action events from the Socket.IO context
 * and executes them against the React router / shop state.
 */
function UiActionExecutor() {
  const { lastUiAction, clearUiAction } = useSocket();
  const { setGender, setCategory, setQuery, setInputValue } = useShop();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!lastUiAction) return;

    const { action, payload = {} } = lastUiAction;
    console.info('[UiActionExecutor] executing:', action, payload);

    switch (action) {
      case 'navigate':
        if (typeof payload.path === 'string') navigate(payload.path);
        break;
      case 'apply_filter':
      case 'select_sidebar':
      case 'select_category': {
        // Agent sets sidebar tags; empty string clears (must use `in` — falsy values still apply).
        const f = payload as { gender?: string; category?: string };
        if ('gender' in f) setGender(f.gender ?? '');
        if ('category' in f) setCategory(f.category ?? '');
        if (location.pathname !== '/shop') navigate('/shop');
        break;
      }
      case 'open_product':
        if (typeof payload.product_id === 'string')
          navigate(`/product/${payload.product_id}`);
        break;
      case 'scroll_to_shop':
        navigate('/shop');
        break;
      case 'set_search_hint':
        // Agent writes into the search bar AND triggers the keyword search.
        if (typeof payload.query === 'string') {
          setInputValue(payload.query);
          setQuery(payload.query);   // fires the keyword search on the shop page
          if (location.pathname !== '/shop') navigate('/shop');
        }
        break;
      case 'clear_filters':
        setGender('');
        setCategory('');
        setQuery('');
        setInputValue('');
        break;
    }

    clearUiAction();
  }, [lastUiAction]);

  return null;
}

// Layout shared by /shop and /product/:id — sidebar rendered once here
function ShopLayout() {
  return (
    <div className="shop-layout">
      <div className="shop-body">
        <ShopSidebar />
        <div className="shop-main">
          <Outlet />
        </div>
      </div>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <ConvoProvider>
      <SocketBridge>
      <CartProvider>
      <ShopProvider>
      <BlogProvider>
        <Router>
          <MonitorProvider>
          <UiActionExecutor />
          <ScrollToTop />
          <div className="app">
            <Header />
            <main>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/about" element={<About />} />
                <Route path="/sign-in" element={<SignIn />} />
                <Route path="/sign-up" element={<SignUp />} />
                <Route path="/account" element={<Account />} />
                <Route path="/cart" element={<Cart />} />

                {/* Shop area — sidebar lives here, not in individual pages */}
                <Route element={<ShopLayout />}>
                  <Route path="/shop" element={<Shop />} />
                  <Route path="/product/:id" element={<Product />} />
                </Route>

                <Route path="/faq" element={<FAQ />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/blog" element={<Blog />} />
                <Route path="/blog/new" element={<NewBlog />} />
                <Route path="/blog/:id" element={<BlogPost />} />
              </Routes>
            </main>
            <ChatWidget />
          </div>
          </MonitorProvider>
        </Router>
      </BlogProvider>
      </ShopProvider>
      </CartProvider>
      </SocketBridge>
      </ConvoProvider>
    </AuthProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
