import { Star, Shield, Heart, Sparkles, ArrowRight, Check } from 'lucide-preact'

const Home = () => {
  const features = [
    {
      icon: <Sparkles size={24} />,
      title: "Luxurious Fabric",
      description: "Premium silk and cotton-spandex blend with silver infusion for natural odor resistance"
    },
    {
      icon: <Heart size={24} />,
      title: "Seamless Support",
      description: "Integrated bra design provides comfortable, invisible support throughout your day"
    },
    {
      icon: <Shield size={24} />,
      title: "Sleek Silhouette",
      description: "Slim-fitting compression design creates a smooth, flattering foundation layer"
    },
    {
      icon: <Star size={24} />,
      title: "Innovative Versatility",
      description: "Thoughtfully designed with discreet emergency functionality for peace of mind"
    }
  ]

  const testimonials = [
    {
      name: "Sarah M.",
      rating: 5,
      text: "This tee has revolutionized my wardrobe. The comfort and quality are unmatched, and I love how it makes everything look better."
    },
    {
      name: "Emma L.",
      rating: 5,
      text: "Finally, an underlayer that actually works! The built-in support is perfect, and the fabric feels incredibly luxurious."
    },
    {
      name: "Jessica R.",
      rating: 5,
      text: "I've been searching for the perfect white tee for years. This is it - the fit, comfort, and innovative features are amazing."
    }
  ]

  return (
    <div className="home">
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-content">
          <div className="hero-text">
            <h1 className="hero-title">
              The Foundation of
              <span className="accent-text"> Effortless Style</span>
            </h1>
            <p className="hero-description">
              Discover the perfect white underlayer tee that combines luxurious comfort, 
              seamless support, and innovative design. Crafted for the discerning woman 
              who values quality and thoughtful functionality.
            </p>
            <div className="hero-actions">
              <a href="/product" className="btn btn-primary">
                Shop Now
                <ArrowRight size={20} />
              </a>
              <button className="btn btn-secondary">Learn More</button>
            </div>
          </div>
          <div className="hero-image">
            <img 
              src="https://images.pexels.com/photos/7679720/pexels-photo-7679720.jpeg?auto=compress&cs=tinysrgb&w=800" 
              alt="Elegant woman wearing white underlayer tee"
              className="hero-img"
            />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Why You'll Love Secundus Dermis</h2>
            <p className="section-description">
              Every detail has been carefully considered to create the ultimate foundation piece
            </p>
          </div>
          <div className="features-grid">
            {features.map((feature, index) => (
              <div key={index} className="feature-card">
                <div className="feature-icon">
                  {feature.icon}
                </div>
                <h3 className="feature-title">{feature.title}</h3>
                <p className="feature-description">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Product Highlight */}
      <section className="product-highlight">
        <div className="container">
          <div className="highlight-content">
            <div className="highlight-image">
              <img 
                src="https://images.pexels.com/photos/7679721/pexels-photo-7679721.jpeg?auto=compress&cs=tinysrgb&w=800" 
                alt="Close-up of premium white fabric texture"
                className="highlight-img"
              />
            </div>
            <div className="highlight-text">
              <h2 className="highlight-title">Pure Comfort. Perfect Layer.</h2>
              <p className="highlight-description">
                Our signature white tee is more than just an underlayer—it's a carefully 
                engineered foundation piece that enhances your entire wardrobe. Made with 
                premium materials and innovative design features.
              </p>
              <ul className="highlight-features">
                <li className="highlight-feature">
                  <Check size={16} />
                  <span>100% pure white, never see-through</span>
                </li>
                <li className="highlight-feature">
                  <Check size={16} />
                  <span>Integrated seamless bra support</span>
                </li>
                <li className="highlight-feature">
                  <Check size={16} />
                  <span>Silver-infused odor resistance</span>
                </li>
                <li className="highlight-feature">
                  <Check size={16} />
                  <span>Thoughtful emergency functionality</span>
                </li>
              </ul>
              <a href="/product" className="btn btn-primary">
                View Product Details
                <ArrowRight size={20} />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="testimonials">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">What Our Customers Say</h2>
            <p className="section-description">
              Join thousands of women who have discovered their perfect foundation layer
            </p>
          </div>
          <div className="testimonials-grid">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="testimonial-card">
                <div className="testimonial-rating">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} size={16} fill="currentColor" />
                  ))}
                </div>
                <p className="testimonial-text">"{testimonial.text}"</p>
                <p className="testimonial-author">— {testimonial.name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <style jsx>{`
        .home {
          padding-top: 80px;
        }

        .hero {
          min-height: 90vh;
          display: flex;
          align-items: center;
          background: linear-gradient(135deg, var(--color-off-white) 0%, var(--color-gray-50) 100%);
        }

        .hero-content {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 var(--space-4);
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--space-8);
          align-items: center;
        }

        .hero-title {
          font-size: clamp(2.5rem, 5vw, 4rem);
          font-weight: 600;
          line-height: 1.1;
          margin-bottom: var(--space-4);
          color: var(--color-primary);
        }

        .accent-text {
          color: var(--color-accent);
        }

        .hero-description {
          font-size: 1.125rem;
          color: var(--color-gray-600);
          line-height: 1.7;
          margin-bottom: var(--space-6);
        }

        .hero-actions {
          display: flex;
          gap: var(--space-3);
          flex-wrap: wrap;
        }

        .btn {
          display: inline-flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-3) var(--space-5);
          font-weight: 600;
          border-radius: var(--radius-lg);
          transition: all var(--transition-normal);
          text-decoration: none;
          border: 2px solid transparent;
        }

        .btn-primary {
          background: var(--color-primary);
          color: var(--color-white);
        }

        .btn-primary:hover {
          background: var(--color-primary-light);
          transform: translateY(-2px);
          box-shadow: var(--shadow-lg);
        }

        .btn-secondary {
          background: transparent;
          color: var(--color-primary);
          border-color: var(--color-primary);
        }

        .btn-secondary:hover {
          background: var(--color-primary);
          color: var(--color-white);
        }

        .hero-image {
          position: relative;
        }

        .hero-img {
          width: 100%;
          height: 600px;
          object-fit: cover;
          border-radius: var(--radius-xl);
          box-shadow: var(--shadow-xl);
        }

        .features {
          padding: var(--space-16) 0;
        }

        .section-header {
          text-align: center;
          margin-bottom: var(--space-12);
        }

        .section-title {
          font-size: clamp(2rem, 4vw, 3rem);
          font-weight: 600;
          margin-bottom: var(--space-3);
          color: var(--color-primary);
        }

        .section-description {
          font-size: 1.125rem;
          color: var(--color-gray-600);
          max-width: 600px;
          margin: 0 auto;
        }

        .features-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: var(--space-6);
        }

        .feature-card {
          text-align: center;
          padding: var(--space-6);
          background: var(--color-white);
          border-radius: var(--radius-xl);
          box-shadow: var(--shadow-md);
          transition: all var(--transition-normal);
        }

        .feature-card:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-xl);
        }

        .feature-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 64px;
          height: 64px;
          background: var(--color-accent);
          color: var(--color-white);
          border-radius: var(--radius-full);
          margin-bottom: var(--space-4);
        }

        .feature-title {
          font-size: 1.25rem;
          font-weight: 600;
          margin-bottom: var(--space-2);
          color: var(--color-primary);
        }

        .feature-description {
          color: var(--color-gray-600);
          line-height: 1.6;
        }

        .product-highlight {
          padding: var(--space-16) 0;
          background: var(--color-gray-50);
        }

        .highlight-content {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--space-8);
          align-items: center;
        }

        .highlight-img {
          width: 100%;
          height: 500px;
          object-fit: cover;
          border-radius: var(--radius-xl);
        }

        .highlight-title {
          font-size: clamp(1.75rem, 3vw, 2.5rem);
          font-weight: 600;
          margin-bottom: var(--space-4);
          color: var(--color-primary);
        }

        .highlight-description {
          font-size: 1.125rem;
          color: var(--color-gray-600);
          line-height: 1.7;
          margin-bottom: var(--space-6);
        }

        .highlight-features {
          list-style: none;
          margin-bottom: var(--space-6);
        }

        .highlight-feature {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          margin-bottom: var(--space-2);
          color: var(--color-gray-700);
        }

        .highlight-feature svg {
          color: var(--color-success);
          flex-shrink: 0;
        }

        .testimonials {
          padding: var(--space-16) 0;
        }

        .testimonials-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: var(--space-6);
        }

        .testimonial-card {
          background: var(--color-white);
          padding: var(--space-6);
          border-radius: var(--radius-xl);
          box-shadow: var(--shadow-md);
          transition: all var(--transition-normal);
        }

        .testimonial-card:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-lg);
        }

        .testimonial-rating {
          display: flex;
          gap: 2px;
          color: var(--color-accent);
          margin-bottom: var(--space-3);
        }

        .testimonial-text {
          font-style: italic;
          color: var(--color-gray-700);
          margin-bottom: var(--space-3);
          line-height: 1.6;
        }

        .testimonial-author {
          font-weight: 600;
          color: var(--color-primary);
        }

        @media (max-width: 768px) {
          .hero-content,
          .highlight-content {
            grid-template-columns: 1fr;
            gap: var(--space-6);
          }

          .hero-image {
            order: -1;
          }

          .hero-img {
            height: 400px;
          }

          .highlight-img {
            height: 300px;
          }

          .hero-actions {
            justify-content: center;
          }

          .btn {
            flex: 1;
            justify-content: center;
            min-width: 140px;
          }
        }
      `}</style>
    </div>
  )
}

export default Home