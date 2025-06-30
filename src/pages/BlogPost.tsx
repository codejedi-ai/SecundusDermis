import { Calendar, User, Clock, ArrowLeft, Share2, Heart } from 'lucide-preact'

const BlogPost = ({ id }: { id?: string }) => {
  // In a real application, you would fetch the post data based on the ID
  const blogPosts = {
    1: {
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
    },
    2: {
      id: 2,
      title: "Secundus Dermis as an Underwear? Understanding the Versatility",
      content: `
        <p>One of the most frequently asked questions we receive is: "Can Secundus Dermis really function as underwear?" The answer is both nuanced and fascinating, reflecting the innovative design philosophy behind our premium foundation tee.</p>
        
        <h2>Understanding the Design Intent</h2>
        
        <p>Secundus Dermis was primarily designed as a premium foundation layer—a sophisticated underlayer tee that provides seamless support, luxurious comfort, and a perfect base for your wardrobe. However, our design team recognized that modern women need versatile solutions for unexpected situations.</p>
        
        <p>The emergency functionality isn't about replacing traditional underwear in your daily routine. Instead, it's about providing a discreet, hygienic solution when life throws you a curveball.</p>
        
        <h2>How the Emergency Feature Works</h2>
        
        <p>The innovative design allows the sleeves to be carefully folded and configured into a temporary liner solution. Here's how it works:</p>
        
        <ul>
          <li><strong>Step 1:</strong> Remove the tee and lay it flat</li>
          <li><strong>Step 2:</strong> Fold each sleeve inward to create a rectangular shape</li>
          <li><strong>Step 3:</strong> Make 4 vertical folds to create a long, thin pad</li>
          <li><strong>Step 4:</strong> Position between your body and existing undergarments as a protective liner</li>
        </ul>
        
        <p>This creates a clean, absorbent barrier that can provide temporary protection and peace of mind during unexpected situations—whether it's a sudden onset of your menstrual cycle, minor incontinence, or other intimate health needs.</p>
        
        <h2>The Hygiene Factor</h2>
        
        <p>We understand that hygiene is paramount when it comes to intimate wear. That's why every aspect of our design considers cleanliness and safety:</p>
        
        <ul>
          <li><strong>Silver Infusion:</strong> Our fabric is infused with silver ions, which naturally resist bacteria and odors</li>
          <li><strong>Premium Materials:</strong> The silk and organic cotton blend is naturally antimicrobial</li>
          <li><strong>Easy Care:</strong> The garment can be easily washed and sanitized after use</li>
          <li><strong>Barrier Protection:</strong> The folded configuration creates multiple layers of protection</li>
        </ul>
        
        <h2>When Would You Use This Feature?</h2>
        
        <p>The emergency functionality is designed for specific situations where traditional options aren't available:</p>
        
        <ul>
          <li>Unexpected menstrual onset when you're away from home</li>
          <li>Travel situations where you've run out of supplies</li>
          <li>Emergency situations requiring additional protection</li>
          <li>Temporary backup during heavy flow days</li>
          <li>Peace of mind during important meetings or events</li>
        </ul>
        
        <h2>What It's NOT Designed For</h2>
        
        <p>It's important to understand the limitations of this feature:</p>
        
        <ul>
          <li>It's not a replacement for regular underwear in daily wear</li>
          <li>It's not designed for extended use (maximum 2-3 hours)</li>
          <li>It's not suitable for heavy flow without additional protection</li>
          <li>It's not a substitute for proper menstrual products</li>
        </ul>
        
        <h2>The Psychology of Preparedness</h2>
        
        <p>Beyond the practical functionality, there's a psychological benefit to knowing you have options. Many of our customers report feeling more confident and less anxious about unexpected situations, simply knowing they have a backup plan.</p>
        
        <p>This peace of mind allows you to focus on what matters—your work, your relationships, your goals—rather than worrying about "what if" scenarios.</p>
        
        <h2>Customer Experiences</h2>
        
        <p>We've received countless testimonials from women who've found this feature invaluable:</p>
        
        <blockquote>
          <p>"I was in a crucial board meeting when I realized my period had started unexpectedly. Having the Secundus Dermis emergency feature gave me the confidence to finish the presentation without worry." - Sarah M., Executive</p>
        </blockquote>
        
        <blockquote>
          <p>"During a long international flight, this feature was a lifesaver. It's not something you think about until you need it, but when you do, you're so grateful it's there." - Emma L., Consultant</p>
        </blockquote>
        
        <h2>The Bigger Picture: Versatile Design</h2>
        
        <p>The emergency functionality represents our broader philosophy of thoughtful, versatile design. We believe that premium clothing should adapt to your life, not the other way around.</p>
        
        <p>This feature is just one example of how we're reimagining what foundation wear can be—not just comfortable and luxurious, but truly functional for the realities of modern life.</p>
        
        <h2>Care and Maintenance After Use</h2>
        
        <p>If you do use the emergency feature, proper care is essential:</p>
        
        <ul>
          <li>Rinse with cold water immediately if possible</li>
          <li>Wash separately in cold water with gentle detergent</li>
          <li>Avoid fabric softeners to maintain the silver infusion</li>
          <li>Air dry or tumble dry on low heat</li>
          <li>The garment will return to its original condition and functionality</li>
        </ul>
        
        <h2>Innovation Meets Practicality</h2>
        
        <p>The question "Is Secundus Dermis underwear?" reveals a fundamental misunderstanding of what we've created. It's not underwear—it's something more sophisticated: a foundation garment that can adapt to serve multiple functions when needed.</p>
        
        <p>This represents the future of intimate apparel: thoughtful, versatile, and designed for the complex realities of women's lives. It's about having options, feeling prepared, and never having to compromise on comfort or confidence.</p>
        
        <p>So while Secundus Dermis isn't underwear in the traditional sense, it's something perhaps more valuable: a versatile foundation piece that's always ready to adapt to whatever your day brings.</p>
      `,
      author: "Dr. Rachel Kim",
      date: "2024-01-18",
      readTime: "6 min read",
      category: "Product Guide",
      image: "https://images.pexels.com/photos/6311392/pexels-photo-6311392.jpeg?auto=compress&cs=tinysrgb&w=800",
      tags: ["Product Guide", "Emergency Feature", "Versatility", "Hygiene", "Innovation"]
    }
  }

  const postId = parseInt(id || '1')
  const post = blogPosts[postId as keyof typeof blogPosts] || blogPosts[1]

  const relatedPosts = [
    {
      id: 3,
      title: "5 Ways to Style Your White Tee for Every Occasion",
      image: "https://images.pexels.com/photos/7679721/pexels-photo-7679721.jpeg?auto=compress&cs=tinysrgb&w=400",
      category: "Styling"
    },
    {
      id: 4,
      title: "The Ultimate Guide to Fabric Care",
      image: "https://images.pexels.com/photos/6311392/pexels-photo-6311392.jpeg?auto=compress&cs=tinysrgb&w=400",
      category: "Care Guide"
    },
    {
      id: 5,
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
              {post.author === 'Dr. Rachel Kim' 
                ? 'Dr. Rachel Kim is a textile engineer and women\'s health advocate with over 15 years of experience in innovative fabric design. She specializes in creating functional solutions for women\'s intimate apparel and foundation wear.'
                : 'Sarah is a fashion industry expert with over 10 years of experience in luxury apparel design and consumer psychology. She specializes in the intersection of comfort, style, and innovative textile technology.'
              }
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