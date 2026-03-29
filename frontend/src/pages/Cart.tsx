import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ShoppingBag, Plus, Minus, Trash2, ArrowLeft } from 'lucide-react'
import './auth.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:7860'

interface CartItem {
  product_id: string
  product_name: string
  price: number
  image_url: string
  quantity: number
}

interface CartResponse {
  items: CartItem[]
  total: number
}

const Cart = () => {
  const [cart, setCart] = useState<CartResponse>({ items: [], total: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState<string | null>(null)

  const getSessionId = () => localStorage.getItem('sd_session_id')

  useEffect(() => {
    fetchCart()
  }, [])

  const fetchCart = async () => {
    const sessionId = getSessionId()
    if (!sessionId) {
      setCart({ items: [], total: 0 })
      setIsLoading(false)
      return
    }
    try {
      const res = await fetch(`${API_BASE}/cart`, {
        headers: { 'session_id': sessionId }
      })
      if (res.ok) {
        const data = await res.json()
        setCart(data)
      }
    } catch (e) {
      console.error('Failed to fetch cart', e)
    }
    setIsLoading(false)
  }

  const updateQuantity = async (productId: string, quantity: number) => {
    const sessionId = getSessionId()
    if (!sessionId) return
    
    setIsUpdating(productId)
    try {
      const res = await fetch(`${API_BASE}/cart/${productId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'session_id': sessionId
        },
        body: JSON.stringify({ quantity })
      })
      if (res.ok) {
        const data = await res.json()
        setCart(data)
      }
    } catch (e) {
      console.error('Failed to update cart', e)
    }
    setIsUpdating(null)
  }

  const removeItem = async (productId: string) => {
    const sessionId = getSessionId()
    if (!sessionId) return
    
    try {
      const res = await fetch(`${API_BASE}/cart/${productId}`, {
        method: 'DELETE',
        headers: { 'session_id': sessionId }
      })
      if (res.ok) {
        const data = await res.json()
        setCart(data)
      }
    } catch (e) {
      console.error('Failed to remove item', e)
    }
  }

  const shipping = cart.total > 75 ? 0 : 8.95
  const grandTotal = cart.total + shipping

  if (isLoading) {
    return (
      <div className="cart-page">
        <div className="container">
          <p>Loading cart...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="cart-page">
      <div className="container">
        <div className="cart-header">
          <Link to="/shop" className="back-link">
            <ArrowLeft size={20} />
            Continue Shopping
          </Link>
          <h1 className="page-title">Shopping Cart</h1>
          <p className="page-description">
            Review your items and proceed to checkout when ready.
          </p>
        </div>

        {cart.items.length > 0 ? (
          <div className="cart-content">
            <div className="cart-items">
              <h2 className="section-title">Your Items ({cart.items.length})</h2>
              {cart.items.map((item) => (
                <div key={item.product_id} className="cart-item">
                  <div className="cart-item-image">
                    <img src={item.image_url} alt={item.product_name} />
                  </div>
                  <div className="cart-item-details">
                    <h3 className="cart-item-name">{item.product_name}</h3>
                    <p className="cart-item-price">${item.price.toFixed(2)}</p>
                  </div>
                  <div className="cart-item-quantity">
                    <button
                      className="qty-btn"
                      onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                      disabled={isUpdating === item.product_id || item.quantity <= 1}
                    >
                      <Minus size={16} />
                    </button>
                    <span className="qty-value">{item.quantity}</span>
                    <button
                      className="qty-btn"
                      onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                      disabled={isUpdating === item.product_id}
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                  <div className="cart-item-total">
                    ${(item.price * item.quantity).toFixed(2)}
                  </div>
                  <button
                    className="cart-item-remove"
                    onClick={() => removeItem(item.product_id)}
                    disabled={isUpdating === item.product_id}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>

            <div className="cart-summary">
              <h2 className="summary-title">Order Summary</h2>
              <div className="summary-row">
                <span>Subtotal</span>
                <span>${cart.total.toFixed(2)}</span>
              </div>
              <div className="summary-row">
                <span>Shipping</span>
                <span>{shipping === 0 ? 'FREE' : `$${shipping.toFixed(2)}`}</span>
              </div>
              {shipping > 0 && (
                <p className="free-shipping-hint">
                  Add ${(75 - cart.total).toFixed(2)} more for free shipping!
                </p>
              )}
              <div className="summary-row summary-total">
                <span>Total</span>
                <span>${grandTotal.toFixed(2)}</span>
              </div>
              <button className="checkout-btn" disabled={!getSessionId()}>
                <ShoppingBag size={18} />
                Checkout
              </button>
              {!getSessionId() && (
                <p className="login-hint">
                  <Link to="/sign-in">Sign in</Link> to checkout
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="cart-empty">
            <ShoppingBag size={64} strokeWidth={1} />
            <h2>Your cart is empty</h2>
            <p>Looks like you haven't added anything to your cart yet.</p>
            <Link to="/shop" className="shop-now-btn">
              Start Shopping
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

export default Cart
