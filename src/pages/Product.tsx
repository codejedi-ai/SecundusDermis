import { useState } from 'preact/hooks'
import { Plus, Minus, Heart, Share2, Truck, Shield, RotateCcw, Star } from 'lucide-preact'

const Product = () => {
  const [selectedSize, setSelectedSize] = useState('M')
  const [quantity, setQuantity] = useState(1)
  const [activeImageIndex, setActiveImageIndex] = useState(0)

  const sizes = ['XS', 'S', 'M', 'L', 'XL']
  const images = [
    'https://images.pexels.com/photos/7679720/pexels-photo-7679720.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/7679721/pexels-photo-7679721.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/6311392/pexels-photo-6311392.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/7679722/pexels-photo-7679722.jpeg?auto=compress&cs=tinysrgb&w=800'
  ]

  const incrementQuantity = () => setQuantity(prev => prev + 1)
  const decrementQuantity = () => setQuantity(prev => Math.max(1, prev - 1))

  return (
    <div className="product-page">
      <div className="container">
        <div className="product-content">
          {/* Product Images */}
          <div className="product-images">
            <div className="main-image">
              <img 
                src={images[activeImageIndex]} 
                alt="Secundus Dermis Premium White Tee"
                className="main-img"
              />
            </div>
            <div className="image-thumbnails">
              {images.map((image, index) => (
                <button
                  key={index}
                  className={`thumbnail ${index === activeImageIndex ? 'active' : ''}`}
                  onClick={() => setActiveImageIndex(index)}
                >
                  <img src={image} alt={`Product view ${index + 1}`} />
                </button>
              ))}
            </div>
          </div>

          {/* Product Details */}
          <div className="product-details">
            <div className="product-header">
              <h1 className="product-title">Secundus Dermis Premium White Tee</h1>
              <div className="product-rating">
                <div className="stars">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={16} fill="currentColor" />
                  ))}
                </div>
                <span className="rating-text">(127 reviews)</span>
              </div>
              <p className="product-price">$89.00</p>
            </div>

            <div className="product-description">
              <p>
                The foundation of effortless style. Our signature white tee combines luxurious 
                silk and cotton-spandex blend with innovative design features for the modern woman 
                who values both comfort and functionality.
              </p>
            </div>

            {/* Key Features */}
            <div className="key-features">
              <h3>Key Features</h3>
              <ul>
                <li><strong>Premium Fabric:</strong> Luxurious silk and cotton-spandex-ice-cotton blend</li>
                <li><strong>Silver Infusion:</strong> Natural odor reduction technology</li>
                <li><strong>Integrated Support:</strong> Seamless built-in bra for all-day comfort</li>
                <li><strong>Slim Fit:</strong> Body-hugging silhouette that's invisible under clothes</li>
                <li><strong>Long Sleeve Design:</strong> Tapered cuffs with elegant ribbing details</li>
                <li><strong>Innovative Functionality:</strong> Discreet emergency liner capability</li>
              </ul>
            </div>

            {/* Size Selection */}
            <div className="size-selection">
              <h3>Size</h3>
              <div className="size-options">
                {sizes.map(size => (
                  <button
                    key={size}
                    className={`size-option ${selectedSize === size ? 'selected' : ''}`}
                    onClick={() => setSelectedSize(size)}
                  >
                    {size}
                  </button>
                ))}
              </div>
              <a href="#size-guide" className="size-guide-link">Size Guide</a>
            </div>

            {/* Quantity and Add to Cart */}
            <div className="purchase-section">
              <div className="quantity-selector">
                <label>Quantity</label>
                <div className="quantity-controls">
                  <button onClick={decrementQuantity} className="quantity-btn">
                    <Minus size={16} />
                  </button>
                  <span className="quantity-display">{quantity}</span>
                  <button onClick={incrementQuantity} className="quantity-btn">
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              <div className="action-buttons">
                <button className="btn btn-primary add-to-cart">
                  Add to Cart - ${(89 * quantity).toFixed(2)}
                </button>
                <div className="secondary-actions">
                  <button className="icon-btn" aria-label="Add to wishlist">
                    <Heart size={20} />
                  </button>
                  <button className="icon-btn" aria-label="Share product">
                    <Share2 size={20} />
                  </button>
                </div>
              </div>
            </div>

            {/* Shipping & Returns */}
            <div className="shipping-info">
              <div className="info-item">
                <Truck size={20} />
                <span>Free shipping on orders over $75</span>
              </div>
              <div className="info-item">
                <RotateCcw size={20} />
                <span>30-day returns & exchanges</span>
              </div>
              <div className="info-item">
                <Shield size={20} />
                <span>1-year quality guarantee</span>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Product Information */}
        <div className="product-info-tabs">
          <div className="tab-content">
            <div className="info-section">
              <h2>Product Details</h2>
              <div className="details-grid">
                <div className="detail-item">
                  <h4>Material Composition</h4>
                  <p>
                    Our exclusive blend features premium silk (40%), organic cotton (35%), 
                    spandex (20%), and ice-cotton (5%) for the perfect balance of luxury, 
                    comfort, and performance. Silver ions are infused throughout the fabric 
                    for natural antimicrobial properties.
                  </p>
                </div>
                <div className="detail-item">
                  <h4>Fit & Design</h4>
                  <p>
                    Designed as a slim-fitting compression shirt meant to be worn directly 
                    against the skin. The sleek, body-hugging silhouette creates a smooth 
                    foundation that's completely invisible under your favorite outfits.
                  </p>
                </div>
                <div className="detail-item">
                  <h4>Integrated Support</h4>
                  <p>
                    Features a seamlessly integrated bra design that provides comfortable 
                    support without the need for additional undergarments. The support system 
                    is engineered to maintain its shape and effectiveness wash after wash.
                  </p>
                </div>
                <div className="detail-item">
                  <h4>Innovative Functionality</h4>
                  <p>
                    Thoughtfully designed with a discreet emergency feature. The sleeves can 
                    be carefully folded to create a temporary, hygienic liner solution when 
                    needed, providing peace of mind for unexpected situations while maintaining 
                    comfort and dignity.
                  </p>
                </div>
              </div>
            </div>

            <div className="info-section">
              <h2>Care Instructions</h2>
              <ul className="care-list">
                <li>Machine wash cold with like colors</li>
                <li>Use gentle, sulfate-free detergent</li>
                <li>Avoid fabric softeners to maintain silver infusion</li>
                <li>Tumble dry low or hang dry</li>
                <li>Do not bleach or dry clean</li>
                <li>Iron on low heat if needed</li>
                <li>Store flat or hung to maintain shape</li>
              </ul>
            </div>

            <div className="info-section">
              <h2>Why You'll Love It</h2>
              <div className="benefits-grid">
                <div className="benefit">
                  <h4>Invisible Under Clothes</h4>
                  <p>Seamless design disappears under any outfit</p>
                </div>
                <div className="benefit">
                  <h4>All-Day Comfort</h4>
                  <p>Breathable fabric moves with your body</p>
                </div>
                <div className="benefit">
                  <h4>Long-Lasting Quality</h4>
                  <p>Premium materials maintain shape and color</p>
                </div>
                <div className="benefit">
                  <h4>Versatile Foundation</h4>
                  <p>Perfect base layer for any wardrobe</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Product