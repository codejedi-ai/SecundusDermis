import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ShoppingBag, Plus, Minus, Trash2, ArrowLeft } from 'lucide-react'
import { useCart } from '../lib/cart-context'
import { useAuth } from '../lib/auth-context'
import { productImageUrl } from '../lib/api-base'
import ProgressiveImage from '../components/ProgressiveImage'

const FALLBACK_IMG = '/img/placeholder.svg'

const Cart = () => {
  const { cart, removeFromCart, updateQuantity } = useCart()
  const { session } = useAuth()
  const [updating, setUpdating] = useState<string | null>(null)

  const handleUpdate = async (productId: string, quantity: number) => {
    setUpdating(productId)
    try {
      await updateQuantity(productId, quantity)
    } finally {
      setUpdating(null)
    }
  }

  const shipping   = cart.total > 75 ? 0 : 8.95
  const grandTotal = cart.total + shipping

  return (
    <div className="cart-container" style={{ padding: '40px' }}>
      <div className="cart-header">
        <Link to="/shop" className="back-link">
          <ArrowLeft size={20} />
          Continue Browsing
        </Link>
        <h1 className="page-title">Your Portfolio</h1>
        <p className="page-description">
          Review your reserved pieces and finalise your commission.
        </p>
      </div>

      {!session ? (
          <div className="cart-empty">
            <ShoppingBag size={64} strokeWidth={1} />
            <h2>Sign in to view your portfolio</h2>
            <p>Your reserved pieces are saved to your patron account.</p>
            <Link to="/sign-in" className="shop-now-btn">Sign In</Link>
          </div>
        ) : cart.items.length > 0 ? (
          <div className="cart-content">
            <div className="cart-items">
              <h2 className="section-title">Reserved Pieces ({cart.items.length})</h2>
              {cart.items.map((item) => (
                <div key={item.product_id} className="cart-item">
                  <div className="cart-item-image">
                    <ProgressiveImage
                      src={productImageUrl(item.image_url)}
                      alt={item.product_name}
                      fallbackSrc={FALLBACK_IMG}
                    />
                  </div>
                  <div className="cart-item-details">
                    <h3 className="cart-item-name">{item.product_name}</h3>
                    <p className="cart-item-price">${item.price.toFixed(2)}</p>
                  </div>
                  <div className="cart-item-quantity">
                    <button
                      className="qty-btn"
                      onClick={() => handleUpdate(item.product_id, item.quantity - 1)}
                      disabled={updating === item.product_id || item.quantity <= 1}
                    >
                      <Minus size={16} />
                    </button>
                    <span className="qty-value">{item.quantity}</span>
                    <button
                      className="qty-btn"
                      onClick={() => handleUpdate(item.product_id, item.quantity + 1)}
                      disabled={updating === item.product_id}
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                  <div className="cart-item-total">
                    ${(item.price * item.quantity).toFixed(2)}
                  </div>
                  <button
                    className="cart-item-remove"
                    onClick={() => removeFromCart(item.product_id)}
                    disabled={updating === item.product_id}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>

            <div className="cart-summary">
              <h2 className="summary-title">Commission Summary</h2>
              <div className="summary-row">
                <span>Subtotal</span>
                <span>${cart.total.toFixed(2)}</span>
              </div>
              <div className="summary-row">
                <span>Delivery</span>
                <span>{shipping === 0 ? 'Complimentary' : `$${shipping.toFixed(2)}`}</span>
              </div>
              {shipping > 0 && (
                <p className="free-shipping-hint">
                  Add ${(75 - cart.total).toFixed(2)} more for complimentary delivery.
                </p>
              )}
              <div className="summary-row summary-total">
                <span>Total Investment</span>
                <span>${grandTotal.toFixed(2)}</span>
              </div>
              <button className="checkout-btn">
                <ShoppingBag size={18} />
                Finalise Commission
              </button>
            </div>
          </div>
        ) : (
          <div className="cart-empty">
            <ShoppingBag size={64} strokeWidth={1} />
            <h2>Your portfolio is empty</h2>
            <p>Allow me to curate a selection for you.</p>
            <Link to="/shop" className="shop-now-btn">
              Explore the Archive
            </Link>
          </div>
        )}
    </div>
  )
}

export default Cart
