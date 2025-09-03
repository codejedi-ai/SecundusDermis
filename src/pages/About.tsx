import React from 'react'
import { Heart, Award, Users, Leaf } from 'lucide-react'

const About = () => {
  const values = [
    {
      icon: <Heart size={32} />,
      title: "Thoughtful Design",
      description: "Every detail is carefully considered to enhance your daily comfort and confidence."
    },
    {
      icon: <Award size={32} />,
      title: "Premium Quality",
      description: "We use only the finest materials and craftsmanship to create lasting luxury."
    },
    {
      icon: <Users size={32} />,
      title: "Women-Centered",
      description: "Designed by women, for women, understanding real needs and challenges."
    },
    {
      icon: <Leaf size={32} />,
      title: "Sustainable Luxury",
      description: "Committed to responsible sourcing and creating pieces that last."
    }
  ]

  return (
    <div className="about-page">
      {/* Hero Section */}
      <section className="about-hero">
        <div className="container">
          <div className="hero-content">
            <div className="hero-text">
              <h1 className="hero-title">Our Story</h1>
              <p className="hero-description">
                Secundus Dermis was born from a simple belief: every woman deserves foundational 
                wear that combines luxury, comfort, and thoughtful innovation. We're not just 
                creating clothing—we're crafting confidence.
              </p>
            </div>
            <div className="hero-image">
              <img 
                src="https://images.pexels.com/photos/7679720/pexels-photo-7679720.jpeg?auto=compress&cs=tinysrgb&w=800" 
                alt="Secundus Dermis founder and team"
                className="hero-img"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="mission-section">
        <div className="container">
          <div className="mission-content">
            <h2 className="section-title">Our Mission</h2>
            <p className="mission-text">
              To revolutionize women's foundational wear by creating the perfect white tee—one 
              that serves as an invisible foundation, providing seamless support, luxurious comfort, 
              and innovative functionality that empowers women to feel confident in any situation.
            </p>
            <p className="mission-text">
              We believe that the best foundation pieces are the ones you never have to think about. 
              They simply work, allowing you to focus on what matters most in your day.
            </p>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="values-section">
        <div className="container">
          <h2 className="section-title text-center">Our Values</h2>
          <div className="values-grid">
            {values.map((value, index) => (
              <div key={index} className="value-card">
                <div className="value-icon">
                  {value.icon}
                </div>
                <h3 className="value-title">{value.title}</h3>
                <p className="value-description">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Innovation Section */}
      <section className="innovation-section">
        <div className="container">
          <div className="innovation-content">
            <div className="innovation-text">
              <h2 className="section-title">Innovation Meets Elegance</h2>
              <p>
                Our signature white tee represents years of research, development, and testing. 
                We've carefully selected premium materials—silk, organic cotton, and performance 
                spandex—and infused them with silver for natural antimicrobial properties.
              </p>
              <p>
                The integrated bra design eliminates the need for additional undergarments while 
                providing comfortable, all-day support. But what truly sets us apart is our 
                thoughtful approach to unexpected situations—our discreet emergency functionality 
                provides peace of mind without compromising style or comfort.
              </p>
              <div className="innovation-features">
                <div className="feature-item">
                  <h4>Premium Materials</h4>
                  <p>Luxurious silk and cotton blend with silver infusion</p>
                </div>
                <div className="feature-item">
                  <h4>Seamless Integration</h4>
                  <p>Built-in support that moves with your body</p>
                </div>
                <div className="feature-item">
                  <h4>Thoughtful Functionality</h4>
                  <p>Innovative features for real-world needs</p>
                </div>
              </div>
            </div>
            <div className="innovation-image">
              <img 
                src="https://images.pexels.com/photos/6311392/pexels-photo-6311392.jpeg?auto=compress&cs=tinysrgb&w=800" 
                alt="Close-up of premium fabric texture and craftsmanship"
                className="innovation-img"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Commitment Section */}
      <section className="commitment-section">
        <div className="container">
          <div className="commitment-content">
            <h2 className="section-title text-center">Our Commitment to You</h2>
            <div className="commitment-grid">
              <div className="commitment-item">
                <h3>Quality Guarantee</h3>
                <p>
                  Every Secundus Dermis tee comes with our 1-year quality guarantee. We stand 
                  behind our craftsmanship and materials.
                </p>
              </div>
              <div className="commitment-item">
                <h3>Perfect Fit Promise</h3>
                <p>
                  Not satisfied with the fit? We offer free exchanges within 30 days 
                  to ensure you find your perfect size.
                </p>
              </div>
              <div className="commitment-item">
                <h3>Sustainable Practices</h3>
                <p>
                  We're committed to responsible sourcing and sustainable manufacturing 
                  practices that respect both people and planet.
                </p>
              </div>
              <div className="commitment-item">
                <h3>Customer Care</h3>
                <p>
                  Our dedicated customer care team is here to help with any questions 
                  or concerns about your Secundus Dermis experience.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default About