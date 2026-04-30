"""
Simple in-memory cart for SecundusDermis demo.
Cart stored per user session.
"""

from typing import Dict, List, Optional
from pydantic import BaseModel


class CartItem(BaseModel):
    product_id: str
    product_name: str
    price: float
    image_url: str
    quantity: int = 1


class CartResponse(BaseModel):
    items: List[CartItem]
    total: float


# In-memory cart store: session_id -> {product_id -> CartItem}
_carts: Dict[str, Dict[str, CartItem]] = {}


def get_cart(session_id: str) -> CartResponse:
    """Get cart for a user session."""
    items_dict = _carts.get(session_id, {})
    items = list(items_dict.values())
    total = sum(item.price * item.quantity for item in items)
    return CartResponse(items=items, total=round(total, 2))


def add_to_cart(session_id: str, product_id: str, product_name: str, 
                price: float, image_url: str, quantity: int = 1) -> CartResponse:
    """Add item to cart or update quantity if exists."""
    if session_id not in _carts:
        _carts[session_id] = {}
    
    cart = _carts[session_id]
    if product_id in cart:
        cart[product_id].quantity += quantity
    else:
        cart[product_id] = CartItem(
            product_id=product_id,
            product_name=product_name,
            price=price,
            image_url=image_url,
            quantity=quantity,
        )
    return get_cart(session_id)


def update_cart_item(session_id: str, product_id: str, quantity: int) -> CartResponse:
    """Update item quantity. Remove if quantity <= 0."""
    if session_id not in _carts:
        return CartResponse(items=[], total=0.0)
    
    cart = _carts[session_id]
    if product_id not in cart:
        return get_cart(session_id)
    
    if quantity <= 0:
        del cart[product_id]
    else:
        cart[product_id].quantity = quantity
    
    return get_cart(session_id)


def remove_from_cart(session_id: str, product_id: str) -> CartResponse:
    """Remove item from cart."""
    return update_cart_item(session_id, product_id, 0)


def clear_cart(session_id: str) -> CartResponse:
    """Clear entire cart."""
    if session_id in _carts:
        _carts[session_id] = {}
    return CartResponse(items=[], total=0.0)
