import { useState } from 'preact/hooks'
import { Calendar, User, ArrowRight, Clock } from 'lucide-preact'

const Blog = () => {
  const [activeCategory, setActiveCategory] = useState('All')

  const featuredPost = {
    id: 1,
    title: "The Science Behind Perfect Layering: Why Your Foundation Matters",
    excerpt: "Discover how the right underlayer can transform your entire wardrobe and boost your confidence throughout the day.",
    content: "When it comes to creating the perfect outfit, most women focus on the outer layers—the blazer, the dress, the accessories. But what if we told you that the secret to effortless style lies in what's underneath? The foundation layer, that invisible first layer against your skin, is arguably the most important piece in your wardrobe...",
    author: "Sarah Chen",
    date: "2024-01-15",
    readTime: "5 min read",
    category: "Fashion Tips",
    image: "https://images.pexels.com/photos/7679720/pexels-photo-7679720.jpeg?auto=compress&cs=tinysrgb&w=800",
    featured: true
  }

  const allBlogPosts = [
    {
      id: 2,
      title: "Secundus Dermis as an Underwear? Understanding the Versatility",
      excerpt: "Exploring the innovative design that allows our premium tee to function as both a foundation layer and emergency underwear solution.",
      author: "Dr. Rachel Kim",
      date: "2024-01-18",
      readTime: "6 min read",
      category: "Product Guide",
      image: "https://images.pexels.com/photos/6311392/pexels-photo-6311392.jpeg?auto=compress&cs=tinysrgb&w=800"
    },
    {
      id: 3,
      title: "5 Ways to Style Your White Tee for Every Occasion",
      excerpt: "From boardroom to brunch, discover versatile styling tips that make your Secundus Dermis tee work for any setting.",
      author: "Emma Rodriguez",
      date: "2024-01-12",
      readTime: "4 min read",
      category: "Styling",
      image: "https://images.pexels.com/photos/7679721/pexels-photo-7679721.jpeg?auto=compress&cs=tinysrgb&w=800"
    },
    {
      id: 4,
      title: "The Ultimate Guide to Fabric Care: Preserving Your Investment",
      excerpt: "Learn professional tips to maintain the luxurious feel and longevity of your premium silk-cotton blend garments.",
      author: "Dr. Lisa Park",
      date: "2024-01-10",
      readTime: "6 min read",
      category: "Care Guide",
      image: "https://images.pexels.com/photos/6311392/pexels-photo-6311392.jpeg?auto=compress&cs=tinysrgb&w=800"
    },
    {
      id: 5,
      title: "Sustainable Fashion: Why Quality Over Quantity Matters",
      excerpt: "Explore how investing in premium, long-lasting pieces contributes to a more sustainable and mindful wardrobe.",
      author: "Maya Thompson",
      date: "2024-01-08",
      readTime: "7 min read",
      category: "Sustainability",
      image: "https://images.pexels.com/photos/7679722/pexels-photo-7679722.jpeg?auto=compress&cs=tinysrgb&w=800"
    },
    {
      id: 6,
      title: "The Psychology of Comfort: How What You Wear Affects How You Feel",
      excerpt: "Discover the connection between comfortable clothing and confidence, backed by research and real experiences.",
      author: "Dr. Rachel Kim",
      date: "2024-01-05",
      readTime: "5 min read",
      category: "Wellness",
      image: "https://images.pexels.com/photos/7679720/pexels-photo-7679720.jpeg?auto=compress&cs=tinysrgb&w=800"
    },
    {
      id: 7,
      title: "Innovation in Intimate Apparel: The Future of Foundation Wear",
      excerpt: "A look at how technology and thoughtful design are revolutionizing the intimate apparel industry.",
      author: "Tech Team",
      date: "2024-01-03",
      readTime: "8 min read",
      category: "Innovation",
      image: "https://images.pexels.com/photos/6311392/pexels-photo-6311392.jpeg?auto=compress&cs=tinysrgb&w=800"
    },
    {
      id: 8,
      title: "Building a Capsule Wardrobe: Essential Foundation Pieces",
      excerpt: "Learn how to create a versatile, minimalist wardrobe that starts with the perfect foundation layers.",
      author: "Style Team",
      date: "2024-01-01",
      readTime: "6 min read",
      category: "Wardrobe",
      image: "https://images.pexels.com/photos/7679721/pexels-photo-7679721.jpeg?auto=compress&cs=tinysrgb&w=800"
    },
    {
      id: 9,
      title: "The Art of Layering: Mastering Foundation Garments",
      excerpt: "Professional styling secrets for creating flawless layered looks that start with the perfect base.",
      author: "Emma Rodriguez",
      date: "2024-01-20",
      readTime: "5 min read",
      category: "Styling",
      image: "https://images.pexels.com/photos/7679720/pexels-photo-7679720.jpeg?auto=compress&cs=tinysrgb&w=800"
    },
    {
      id: 10,
      title: "Silver-Infused Fabrics: The Science of Odor Control",
      excerpt: "Understanding how silver ions work to keep your garments fresh and why this technology matters for intimate wear.",
      author: "Dr. Lisa Park",
      date: "2024-01-22",
      readTime: "7 min read",
      category: "Innovation",
      image: "https://images.pexels.com/photos/6311392/pexels-photo-6311392.jpeg?auto=compress&cs=tinysrgb&w=800"
    },
    {
      id: 11,
      title: "Traveling Light: Essential Garments for the Modern Woman",
      excerpt: "How versatile foundation pieces can revolutionize your travel wardrobe and reduce packing stress.",
      author: "Maya Thompson",
      date: "2024-01-25",
      readTime: "4 min read",
      category: "Lifestyle",
      image: "https://images.pexels.com/photos/7679722/pexels-photo-7679722.jpeg?auto=compress&cs=tinysrgb&w=800"
    },
    {
      id: 12,
      title: "Understanding Fabric Blends: Why Our Mix is Perfect",
      excerpt: "Deep dive into the science behind our silk, cotton, spandex, and ice-cotton blend and why each component matters.",
      author: "Tech Team",
      date: "2024-01-28",
      readTime: "6 min read",
      category: "Product Guide",
      image: "https://images.pexels.com/photos/6311392/pexels-photo-6311392.jpeg?auto=compress&cs=tinysrgb&w=800"
    }
  ]

  const categories = [
    "All", 
    "Fashion Tips", 
    "Styling", 
    "Care Guide", 
    "Sustainability", 
    "Wellness", 
    "Innovation", 
    "Wardrobe",
    "Product Guide",
    "Lifestyle"
  ]

  // Filter posts based on active category
  const filteredPosts = activeCategory === 'All' 
    ? allBlogPosts 
    : allBlogPosts.filter(post => post.category === activeCategory)

  // Get category counts
  const getCategoryCount = (category: string) => {
    if (category === 'All') return allBlogPosts.length
    return allBlogPosts.filter(post => post.category === category).length
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
                <article key={post.id} className="blog-card">
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