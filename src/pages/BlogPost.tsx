
import { useParams } from 'react-router-dom'
import { Calendar, User, Clock, ArrowLeft, Share2, Heart } from 'lucide-react'
import { getPostById, getRecentPosts } from '../data/posts'
import { blogAuthors } from '../data/blogPosts'

const BlogPost = () => {
  const { id } = useParams<{ id: string }>()
  const postId = parseInt(id || '1')
  const post = getPostById(postId)
  
  // Fallback to first post if not found
  if (!post) {
    return (
      <div className="blog-post-page">
        <div className="container">
          <div className="post-navigation">
            <a href="/blog" className="back-link">
              <ArrowLeft size={20} />
              Back to Journal
            </a>
          </div>
          <div style={{ textAlign: 'center', padding: '4rem 0' }}>
            <h1>Post Not Found</h1>
            <p>The blog post you're looking for doesn't exist.</p>
            <a href="/blog" className="btn btn-primary">Return to Blog</a>
          </div>
        </div>
      </div>
    )
  }

  const relatedPosts = getRecentPosts(4).filter(p => p.id !== post.id).slice(0, 3)
  const authorInfo = blogAuthors[post.author]

  return (
    <div className="blog-post-page">
      <div className="container">
        {/* Back Navigation */}
        <div className="post-navigation">
          <a href="/blog" className="back-link">
            <ArrowLeft size={20} />
            Back to Journal
          </a>
        </div>

        {/* Post Header */}
        <header className="post-header">
          <div className="post-meta">
            <span className="post-category">{post.category}</span>
            <div className="post-details">
              <span className="post-author">
                <User size={14} />
                {post.author}
              </span>
              <span className="post-date">
                <Calendar size={14} />
                {new Date(post.date).toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </span>
              <span className="post-read-time">
                <Clock size={14} />
                {post.readTime}
              </span>
            </div>
          </div>
          <h1 className="post-title">{post.title}</h1>
          <div className="post-actions">
            <button className="action-btn" aria-label="Share post">
              <Share2 size={20} />
              Share
            </button>
            <button className="action-btn" aria-label="Save post">
              <Heart size={20} />
              Save
            </button>
          </div>
        </header>

        {/* Featured Image */}
        <div className="post-featured-image">
          <img src={post.image} alt={post.title} />
        </div>

        {/* Post Content */}
        <article className="post-content">
          <div className="post-body" dangerouslySetInnerHTML={{ __html: post.content }} />
          
          {/* Tags */}
          <div className="post-tags">
            <h4>Tags:</h4>
            <div className="tags-list">
              {post.tags.map((tag, index) => (
                <span key={index} className="tag">{tag}</span>
              ))}
            </div>
          </div>
        </article>

        {/* Author Bio */}
        {authorInfo && (
          <div className="author-bio">
            <div className="author-avatar">
              <div className="avatar-placeholder">
                {post.author.split(' ').map(name => name[0]).join('')}
              </div>
            </div>
            <div className="author-info">
              <h4>{authorInfo.name}</h4>
              <p>{authorInfo.bio}</p>
            </div>
          </div>
        )}

        {/* Related Posts */}
        {relatedPosts.length > 0 && (
          <section className="related-posts">
            <h3>You Might Also Like</h3>
            <div className="related-grid">
              {relatedPosts.map((relatedPost) => (
                <article key={relatedPost.id} className="related-card">
                  <div className="related-image">
                    <img src={relatedPost.image} alt={relatedPost.title} />
                    <div className="related-category">{relatedPost.category}</div>
                  </div>
                  <div className="related-content">
                    <h4>
                      <a href={`/blog/${relatedPost.id}`}>{relatedPost.title}</a>
                    </h4>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* Newsletter CTA */}
        <section className="post-newsletter">
          <div className="newsletter-content">
            <h3>Stay in the Loop</h3>
            <p>Get more insights like this delivered to your inbox.</p>
            <form className="newsletter-form">
              <input 
                type="email" 
                placeholder="Your email address" 
                className="newsletter-input"
                required
              />
              <button type="submit" className="btn btn-primary">
                Subscribe
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  )
}

export default BlogPost