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

import ReactDOM from 'react-dom/client'
import { BrowserRouter as Router, Routes, Route, Outlet } from 'react-router-dom'
import './index.css'
import { ShopProvider } from './lib/shop-context'
import Header from './components/Header'
import Footer from './components/Footer'
import ShopSidebar from './components/ShopSidebar'
import Product from './pages/Product'
import Shop from './pages/Shop'
import Home from './pages/Home'
import Contact from './pages/Contact'
import FAQ from './pages/FAQ'
import Blog from './pages/Blog'
import BlogPost from './pages/BlogPost'
import NewBlog from './pages/NewBlog'
import ChatWidget from './components/ChatWidget'
import './styles/shop.css'

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
    <ShopProvider>
      <Router>
        <div className="app">
          <Header />
          <main>
            <Routes>
              <Route path="/" element={<Home />} />

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
          <Footer />
          <ChatWidget />
        </div>
      </Router>
    </ShopProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
