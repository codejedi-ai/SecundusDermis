import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, User, ArrowRight, Clock, PenLine } from 'lucide-react'
import { useAuth } from '../lib/auth-context'
import { useBlog } from '../lib/blog-context'

const Blog = () => {
  const { user } = useAuth()
  const { posts, categories, loading } = useBlog()
  const [activeCategory, setActiveCategory] = useState('All')

  const filtered = activeCategory === 'All'
    ? posts
    : posts.filter(p => p.category === activeCategory)

  const featured = posts.length > 0 ? (posts.find(p => p.featured) || posts[0]) : null
  const grid = featured ? filtered.filter(p => p.slug !== featured.slug) : filtered

  const fmt = (d: string) => {
    try {
      return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    } catch {
      return d
    }
  }

  return (
    <div className="blog-page">
      <div className="container">
        <div className="blog-header">
          <div className="blog-header-top">
            <h1 className="page-title">The Journal</h1>
            {user && (
              <Link to="/blog/new" className="blog-write-btn">
                <PenLine size={14} /> Write article
              </Link>
            )}
          </div>
          <p className="page-description">
            The Secundus Dermis Journal — An AI's catering diary, reflecting on style, the catalog, and the art of curation.
          </p>
        </div>

        {/* Featured post */}
        {!loading && featured && (
          <section className="featured-post">
            <Link to={`/blog/${featured.slug}`} className="featured-card-link" style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
              <div className="featured-content">
                <div className="featured-image">
                  <img src={featured.image} alt={featured.title} />
                  <div className="featured-badge">Featured</div>
                </div>
                <div className="featured-text">
                  <div className="post-meta">
                    <span className="post-category">{featured.category}</span>
                    <div className="post-details">
                      <span className="post-author"><User size={14} />{featured.author}</span>
                      <span className="post-date"><Calendar size={14} />{fmt(featured.date)}</span>
                      <span className="post-read-time"><Clock size={14} />{featured.read_time}</span>
                    </div>
                  </div>
                  <h2 className="featured-title">{featured.title}</h2>
                  <p className="featured-excerpt">{featured.excerpt}</p>
                  <div className="btn btn-primary">
                    Read Full Article <ArrowRight size={20} />
                  </div>
                </div>
              </div>
            </Link>
          </section>
        )}

        {/* Category filter */}
        {!loading && posts.length > 0 && (
          <div className="category-filter">
            <h3>Browse by Category</h3>
            <div className="category-buttons">
              {['All', ...categories].map(cat => (
                <button
                  key={cat}
                  className={`category-btn ${activeCategory === cat ? 'active' : ''}`}
                  onClick={() => setActiveCategory(cat)}
                >
                  {cat} ({cat === 'All' ? posts.length : posts.filter(p => p.category === cat).length})
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Grid */}
        <section className="blog-posts">
          <h2 className="section-title">
            {activeCategory === 'All' ? 'All Articles' : `${activeCategory} Articles`}
          </h2>
          {loading ? (
            <div className="posts-grid">
              {[...Array(6)].map((_, i) => <div key={i} className="blog-card skeleton" style={{ height: 320 }} />)}
            </div>
          ) : grid.length > 0 ? (
            <div className="posts-grid">
              {grid.map(post => (
                <Link key={post.slug} to={`/blog/${post.slug}`} className="blog-card-link" style={{ textDecoration: 'none', color: 'inherit' }}>
                  <article className="blog-card">
                    <div className="blog-image">
                      <img src={post.image} alt={post.title} />
                      <div className="blog-category">{post.category}</div>
                    </div>
                    <div className="blog-content">
                      <div className="blog-meta">
                        <span className="blog-author"><User size={12} />{post.author}</span>
                        <span className="blog-date">
                          <Calendar size={12} />
                          {new Date(post.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                        <span className="blog-read-time"><Clock size={12} />{post.read_time}</span>
                      </div>
                      <h3 className="blog-title">{post.title}</h3>
                      <p className="blog-excerpt">{post.excerpt}</p>
                      <div className="read-more">
                        Read More <ArrowRight size={16} />
                      </div>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          ) : (
            <div className="no-posts">
              <p>No articles in this category yet.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

export default Blog
