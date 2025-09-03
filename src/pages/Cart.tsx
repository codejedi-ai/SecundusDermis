import React from 'react'
import { ShoppingBag, Plus, Minus, Trash2, ArrowLeft } from 'lucide-react'
import ProtectedRoute from '../components/ProtectedRoute'

const Cart = () => {
  // Mock cart data - in a real app, this would come from state management
  const cartItems = [
    {
      id: 1,
      name: 'Secundus Dermis Premium White Tee',
      price: 89.00,
      quantity: 2,
      size: 'M',
      image: 'https://images.pexels.com/photos/7679720/pexels-photo-7679720.jpeg?auto=compress&cs=tinysrgb&w=400'
    }
  ]

  const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)
  const shipping = subtotal > 75 ? 0 : 8.95
  const total = subtotal + shipping

  const updateQuantity = (id: number, newQuantity: number) => {
    // Handle quantity update
    console.log(`Update item ${id} to quantity ${newQuantity}`)
  }

  const removeItem = (id: number) => {
    // Handle item removal
    console.log(`Remove item ${id}`)
  }

  return (
    <ProtectedRoute>
      <div className="cart-page">
        <div className="container">
          <div className="cart-header">
            <a href="/" className="back-link">
              <ArrowLeft size={20} />
              Continue Shopping
            </a>
            <h1 className="page-title">Shopping Cart</h1>
            <p className="page-description">
              Review your items and proceed to checkout when ready.
            </p>
          </div>

          {cartItems.length > 0 ? (
            <div className="cart-content">
              <div className="cart-items">
                <h2 className="section-title">Your Items</h2>
                {cartItems.map((item) => (
                  <div key={item.id} className="cart-item">
                    <div className="item-image">
                      <img src={item.image} alt={item.name} />
                    </div>
                    <div className="item-details">
                      <h3 className="item-name">{item.name}</h3>
                      <p className="item-size">Size: {item.size}</p>
                      <p className="item-price">${item.price.toFixed(2)}</p>
                    </div>
                    <div className="item-quantity">
                      <label>Quantity</label>
                      <div className="quantity-controls">
                        <button 
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="quantity-btn"
                          disabled={item.quantity <= 1}
                        >
                          <Minus size={16} />
                        </button>
                        <span className="quantity-display">{item.quantity}</span>
                        <button 
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="quantity-btn"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="item-total">
                      <p className="total-price">${(item.price * item.quantity).toFixed(2)}</p>
                      <button 
                        onClick={() => removeItem(item.id)}
                        className="remove-btn"
                        aria-label="Remove item"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="cart-summary">
                <h2 className="section-title">Order Summary</h2>
                <div className="summary-details">
                  <div className="summary-row">
                    <span>Subtotal</span>
                    <span>${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="summary-row">
                    <span>Shipping</span>
                    <span>{shipping === 0 ? 'Free' : `$${shipping.toFixed(2)}`}</span>
                  </div>
                  {shipping === 0 && (
                    <p className="free-shipping-note">
                      🎉 You qualify for free shipping!
                    </p>
                  )}
                  <div className="summary-row total-row">
                    <span>Total</span>
                    <span>${total.toFixed(2)}</span>
                  </div>
                </div>
                <button className="btn btn-primary checkout-btn">
                  Proceed to Checkout
                </button>
                <p className="secure-checkout">
                  🔒 Secure checkout with SSL encryption
                </p>
              </div>
            </div>
          ) : (
            <div className="empty-cart">
              <ShoppingBag size={64} />
              <h2>Your cart is empty</h2>
              <p>Add some items to your cart to get started.</p>
              <a href="/product" className="btn btn-primary">
                Shop Now
              </a>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  )
}

export default Cart