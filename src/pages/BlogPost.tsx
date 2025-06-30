import { Calendar, User, Clock, ArrowLeft, Share2, Heart } from 'lucide-preact'

const BlogPost = ({ id }: { id?: string }) => {
  // In a real application, you would fetch the post data based on the ID
  const post = {
    id: 1,
    title: "The Science Behind Perfect Layering: Why Your Foundation Matters",
    content: `
      <p>When it comes to creating the perfect outfit, most women focus on the outer layers—the blazer, the dress, the accessories. But what if we told you that the secret to effortless style lies in what's underneath?</p>
      
      <p>The foundation layer, that invisible first layer against your skin, is arguably the most important piece in your wardrobe. It's the difference between feeling confident and comfortable all day, or constantly adjusting and fidgeting with your clothes.</p>
      
      <h2>The Psychology of Comfort</h2>
      
      <p>Research in fashion psychology shows that when we feel physically comfortable in our clothing, our confidence levels increase significantly. This isn't just about vanity—it's about performance. When you're not thinking about your undergarments, you can focus on what truly matters: your work, your relationships, your goals.</p>
      
      <p>At Secundus Dermis, we understand that comfort isn't just a luxury—it's a necessity. Our premium white tees are designed to be that perfect foundation layer that you never have to think about once you put it on.</p>
      
      <h2>The Technical Side: Why Materials Matter</h2>
      
      <p>Not all fabrics are created equal. Our exclusive blend of silk, organic cotton, spandex, and ice-cotton creates a unique combination of properties:</p>
      
      <ul>
        <li><strong>Silk (40%)</strong> - Provides natural temperature regulation and a luxurious feel against the skin</li>
        <li><strong>Organic Cotton (35%)</strong> - Offers breathability and softness while being gentle on sensitive skin</li>
        <li><strong>Spandex (20%)</strong> - Ensures the perfect fit that moves with your body throughout the day</li>
        <li><strong>Ice-Cotton (5%)</strong> - Adds a cooling effect that keeps you comfortable in any climate</li>
      </ul>
      
      <p>But what truly sets our fabric apart is the silver infusion. Silver ions naturally resist bacteria and odors, meaning your foundation layer stays fresh longer—even during the most demanding days.</p>
      
      <h2>The Innovation: Integrated Support</h2>
      
      <p>Traditional undergarments often create visible lines, uncomfortable pressure points, or simply don't provide adequate support. Our integrated bra design eliminates these issues entirely.</p>
      
      <p>The seamless support system is engineered directly into the fabric structure, providing lift and comfort without the bulk of traditional bras. This isn't just about convenience—it's about creating a smooth, confident silhouette that enhances whatever you wear on top.</p>
      
      <h2>Thoughtful Design for Real Life</h2>
      
      <p>We believe that truly innovative design anticipates real-world needs. That's why our tees include thoughtful features like the discreet emergency functionality—because life is unpredictable, and your clothing should be prepared for anything.</p>
      
      <p>This feature allows the sleeves to be carefully configured into a temporary, hygienic solution when unexpected situations arise. It's the kind of thoughtful innovation that you hope you'll never need, but are grateful to have when you do.</p>
      
      <h2>The Investment in Quality</h2>
      
      <p>When you choose Secundus Dermis, you're not just buying a piece of clothing—you're investing in your daily comfort and confidence. Our tees are designed to maintain their shape, support, and luxurious feel wash after wash, year after year.</p>
      
      <p>In a world of fast fashion and disposable clothing, we believe in creating pieces that last. It's better for your wardrobe, better for your budget, and better for the environment.</p>
      
      <h2>The Perfect Foundation</h2>
      
      <p>Your foundation layer should be invisible, comfortable, and reliable. It should enhance your confidence, not detract from it. It should be the piece you reach for every morning without thinking, knowing it will perform flawlessly throughout your day.</p>
      
      <p>That's the promise of Secundus Dermis—to be the perfect foundation for whatever your day brings.</p>
    `,
    author: "Sarah Chen",
    date: "2024-01-15",
    readTime: "5 min read",
    category: "Fashion Tips",
    image: "https://images.pexels.com/photos/7679720/pexels-photo-7679720.jpeg?auto=compress&cs=tinysrgb&w=800",
    tags: ["Foundation Wear", "Comfort", "Innovation", "Quality"]
  }

  const relatedPosts = [
    {
      id: 2,
      title: "5 Ways to Style Your White Tee for Every Occasion",
      image: "https://images.pexels.com/photos/7679721/pexels-photo-7679721.jpeg?auto=compress&cs=tinysrgb&w=400",
      category: "Styling"
    },
    {
      id: 3,
      title: "The Ultimate Guide to Fabric Care",
      image: "https://images.pexels.com/photos/6311392/pexels-photo-6311392.jpeg?auto=compress&cs=tinysrgb&w=400",
      category: "Care Guide"
    },
    {
      id: 4,
      title: "Sustainable Fashion: Quality Over Quantity",
      image: "https://images.pexels.com/photos/7679722/pexels-photo-7679722.jpeg?auto=compress&cs=tinysrgb&w=400",
      category: "Sustainability"
    }
  ]

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
        <div className="author-bio">
          <div className="author-avatar">
            <div className="avatar-placeholder">
              {post.author.split(' ').map(name => name[0]).join('')}
            </div>
          </div>
          <div className="author-info">
            <h4>{post.author}</h4>
            <p>
              Sarah is a fashion industry expert with over 10 years of experience in luxury 
              apparel design and consumer psychology. She specializes in the intersection 
              of comfort, style, and innovative textile technology.
            </p>
          </div>
        </div>

        {/* Related Posts */}
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