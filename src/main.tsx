import { render } from 'preact'
import Router from 'preact-router'
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

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!clerkPubKey) {
  throw new Error('Missing Clerk Publishable Key')
}

function App() {
  return (
    <ClerkProvider publishableKey={clerkPubKey}>
      <div className="app">
        <Header />
        <main>
          <Router>
            <Home path="/" />
            <Product path="/product" />
            <About path="/about" />
            <FAQ path="/faq" />
            <Contact path="/contact" />
            <Blog path="/blog" />
            <BlogPost path="/blog/:id" />
            <Account path="/account" />
            <SignIn path="/sign-in" />
            <SignUp path="/sign-up" />
          </Router>
        </main>
        <Footer />
      </div>
    </ClerkProvider>
  )
}

render(<App />, document.getElementById('root')!)