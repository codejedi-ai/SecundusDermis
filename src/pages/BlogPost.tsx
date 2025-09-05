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

        {/* Comments Section */}
        <section className="comments-section">
          <h3>Join the Conversation</h3>
          <div className="comments-container">
            {/* Comment Form */}
            <div className="comment-form-section">
              <h4>Leave a Comment</h4>
              <form className="comment-form">
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="comment-name" className="form-label">Name *</label>
                    <input
                      type="text"
                      id="comment-name"
                      name="name"
                      className="form-input"
                      placeholder="Your name"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="comment-email" className="form-label">Email *</label>
                    <input
                      type="email"
                      id="comment-email"
                      name="email"
                      className="form-input"
                      placeholder="your@email.com"
                      required
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="comment-message" className="form-label">Comment *</label>
                  <textarea
                    id="comment-message"
                    name="message"
                    className="form-textarea"
                    rows={4}
                    placeholder="Share your thoughts..."
                    required
                  ></textarea>
                </div>
                <button type="submit" className="btn btn-primary">
                  Post Comment
                </button>
              </form>
            </div>

            {/* Comments List */}
            <div className="comments-list">
              <h4>Comments (3)</h4>
              
              <div className="comment">
                <div className="comment-avatar">
                  <div className="avatar-placeholder">SJ</div>
                </div>
                <div className="comment-content">
                  <div className="comment-header">
                    <h5 className="comment-author">Sarah Johnson</h5>
                    <span className="comment-date">2 days ago</span>
                  </div>
                  <p className="comment-text">
                    This article really opened my eyes to the importance of foundation layers. 
                    I never realized how much the right underlayer could impact my confidence 
                    throughout the day. Thank you for sharing these insights!
                  </p>
                  <button className="comment-reply">Reply</button>
                </div>
              </div>

              <div className="comment">
                <div className="comment-avatar">
                  <div className="avatar-placeholder">MR</div>
                </div>
                <div className="comment-content">
                  <div className="comment-header">
                    <h5 className="comment-author">Maria Rodriguez</h5>
                    <span className="comment-date">1 week ago</span>
                  </div>
                  <p className="comment-text">
                    As someone who works in a professional environment, I can't stress enough 
                    how important it is to have reliable foundation wear. The silver infusion 
                    technology sounds fascinating - I'd love to try it!
                  </p>
                  <button className="comment-reply">Reply</button>
                </div>
              </div>

              <div className="comment">
                <div className="comment-avatar">
                  <div className="avatar-placeholder">EL</div>
                </div>
                <div className="comment-content">
                  <div className="comment-header">
                    <h5 className="comment-author">Emily Liu</h5>
                    <span className="comment-date">2 weeks ago</span>
                  </div>
                  <p className="comment-text">
                    The psychology aspect of wearing white is something I never considered. 
                    It makes so much sense now why I feel more confident in my white foundation pieces. 
                    Great article!
                  </p>
                  <button className="comment-reply">Reply</button>
                </div>
              </div>
            </div>
          </div>
        </section>

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