import { useState } from 'preact/hooks'
import { Calendar, User, ArrowRight, Clock } from 'lucide-preact'
import { allBlogPosts, getFeaturedPosts, getPostsByCategory } from '../data/posts'
import { blogCategories } from '../data/blogPosts'

const Blog = () => {
  const [activeCategory, setActiveCategory] = useState('All')

  const featuredPosts = getFeaturedPosts()
  const featuredPost = featuredPosts[0] || allBlogPosts[0]

  const categories = ['All', ...blogCategories]

  // Filter posts based on active category
  const filteredPosts = getPostsByCategory(activeCategory).filter(post => !post.featured)

  // Get category counts
  const getCategoryCount = (category: string) => {
    if (category === 'All') return allBlogPosts.length
    return allBlogPosts.filter(post => post.category === category).length
  }

  // Handle blog card click
  const handleBlogCardClick = (postId: number) => {
    window.location.href = `/blog/${postId}`
  }

  return (
    <div className="blog-page">
      <div className="container">
        {/* Blog Header */}
        <div className="blog-header">
          <h1 className="page-title">The Secundus Dermis Journal</h1>
          <p className="page-description">
            Insights, tips, and stories about comfort, style, and the art of foundational fashion. 
            Discover how thoughtful design meets everyday elegance.
          </p>
        </div>

        {/* Featured Post */}
        {featuredPost && (
          <section className="featured-post">
            <div className="featured-content">
              <div className="featured-image">
                <img src={featuredPost.image} alt={featuredPost.title} />
                <div className="featured-badge">Featured</div>
              </div>
              <div className="featured-text">
                <div className="post-meta">
                  <span className="post-category">{featuredPost.category}</span>
                  <div className="post-details">
                    <span className="post-author">
                      <User size={14} />
                      {featuredPost.author}
                    </span>
                    <span className="post-date">
                      <Calendar size={14} />
                      {new Date(featuredPost.date).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </span>
                    <span className="post-read-time">
                      <Clock size={14} />
                      {featuredPost.readTime}
                    </span>
                  </div>
                </div>
                <h2 className="featured-title">{featuredPost.title}</h2>
                <p className="featured-excerpt">{featuredPost.excerpt}</p>
                <a href={`/blog/${featuredPost.id}`} className="btn btn-primary">
                  Read Full Article
                  <ArrowRight size={20} />
                </a>
              </div>
            </div>
          </section>
        )}

        {/* Category Filter */}
        <div className="category-filter">
          <h3>Browse by Category</h3>
          <div className="category-buttons">
            {categories.map((category) => (
              <button 
                key={category} 
                className={`category-btn ${activeCategory === category ? 'active' : ''}`}
                onClick={() => setActiveCategory(category)}
              >
                {category} ({getCategoryCount(category)})
              </button>
            ))}
          </div>
        </div>

        {/* Blog Posts Grid */}
        <section className="blog-posts">
          <h2 className="section-title">
            {activeCategory === 'All' ? 'Latest Articles' : `${activeCategory} Articles`}
          </h2>
          {filteredPosts.length > 0 ? (
            <div className="posts-grid">
              {filteredPosts.map((post) => (
                <article 
                  key={post.id} 
                  className="blog-card"
                  onClick={() => handleBlogCardClick(post.id)}
                >
                  <div className="blog-image">
                    <img src={post.image} alt={post.title} />
                    <div className="blog-category">{post.category}</div>
                  </div>
                  <div className="blog-content">
                    <div className="blog-meta">
                      <span className="blog-author">
                        <User size={12} />
                        {post.author}
                      </span>
                      <span className="blog-date">
                        <Calendar size={12} />
                        {new Date(post.date).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric' 
                        })}
                      </span>
                      <span className="blog-read-time">
                        <Clock size={12} />
                        {post.readTime}
                      </span>
                    </div>
                    <h3 className="blog-title">
                      <a href={`/blog/${post.id}`}>{post.title}</a>
                    </h3>
                    <p className="blog-excerpt">{post.excerpt}</p>
                    <a href={`/blog/${post.id}`} className="read-more">
                      Read More
                      <ArrowRight size={16} />
                    </a>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="no-posts">
              <p>No articles found in this category yet. Check back soon for new content!</p>
            </div>
          )}
        </section>

        {/* Newsletter Signup */}
        <section className="newsletter-signup">
          <div className="newsletter-content">
            <h3>Stay Updated</h3>
            <p>
              Get the latest insights on comfort, style, and innovation delivered to your inbox. 
              Plus, be the first to know about new products and exclusive offers.
            </p>
            <form className="newsletter-form">
              <input 
                type="email" 
                placeholder="Enter your email address" 
                className="newsletter-input"
                required
              />
              <button type="submit" className="btn btn-primary">
                Subscribe
              </button>
            </form>
            <p className="newsletter-note">
              We respect your privacy. Unsubscribe at any time.
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}

export default Blog