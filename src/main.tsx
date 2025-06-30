import { render } from 'preact'
import Router from 'preact-router'
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

function App() {
  return (
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
        </Router>
      </main>
      <Footer />
    </div>
  )
}

render(<App />, document.getElementById('root')!)