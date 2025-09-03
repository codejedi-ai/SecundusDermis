
import ReactDOM from 'react-dom/client'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { ClerkProvider } from '@clerk/clerk-react'
import './index.css'
import Header from './components/Header'
import Footer from './components/Footer'
import Home from './pages/Home'
import Product from './pages/Product'
import About from './pages/About'
import Contact from './pages/Contact'
import FAQ from './pages/FAQ'
import Blog from './pages/Blog'
import BlogPost from './pages/BlogPost'
import Account from './pages/Account'
import SignIn from './pages/SignIn'
import SignUp from './pages/SignUp'
import Cart from './pages/Cart'
import ProtectedRoute from './components/ProtectedRoute'

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!clerkPubKey) {
  throw new Error('Missing Clerk Publishable Key')
}

function App() {
  return (
    <ClerkProvider publishableKey={clerkPubKey}>
      <Router>
        <div className="app">
          <Header />
          <main>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/product" element={<Product />} />
              <Route path="/about" element={<About />} />
              <Route path="/faq" element={<FAQ />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/blog" element={<Blog />} />
              <Route path="/blog/:id" element={<BlogPost />} />
              <Route path="/account" element={
                <ProtectedRoute fallback={<SignIn />}>
                  <Account />
                </ProtectedRoute>
              } />
              <Route path="/sign-in" element={<SignIn />} />
              <Route path="/sign-up" element={<SignUp />} />
              <Route path="/cart" element={<Cart />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </Router>
    </ClerkProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />)