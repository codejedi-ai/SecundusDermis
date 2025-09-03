import React from 'react'
import { Star, Shield, Heart, Sparkles, ArrowRight, Check } from 'lucide-react'

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
    </div>
  )
}

export default Home