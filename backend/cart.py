"""
Simple in-memory cart for SecundusDermis demo.
Cart stored per user email (not session_id) to share data across login methods.
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


# In-memory cart store: email -> {product_id -> CartItem}
_carts: Dict[str, Dict[str, CartItem]] = {}


def get_cart(email: str) -> CartResponse:
    """Get cart for a user by email."""
    email = email.lower().strip()
    items_dict = _carts.get(email, {})
    items = list(items_dict.values())
    total = sum(item.price * item.quantity for item in items)
    return CartResponse(items=items, total=round(total, 2))


def add_to_cart(email: str, product_id: str, product_name: str,
                price: float, image_url: str, quantity: int = 1) -> CartResponse:
    """Add item to cart or update quantity if exists."""
    email = email.lower().strip()
    if email not in _carts:
        _carts[email] = {}

    cart = _carts[email]
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
    return get_cart(email)


def update_cart_item(email: str, product_id: str, quantity: int) -> CartResponse:
    """Update item quantity. Remove if quantity <= 0."""
    email = email.lower().strip()
    if email not in _carts:
        return CartResponse(items=[], total=0.0)

    cart = _carts[email]
    if product_id not in cart:
        return get_cart(email)

    if quantity <= 0:
        del cart[product_id]
    else:
        cart[product_id].quantity = quantity

    return get_cart(email)


def remove_from_cart(email: str, product_id: str) -> CartResponse:
    """Remove item from cart."""
    return update_cart_item(email, product_id, 0)


def clear_cart(email: str) -> CartResponse:
    """Clear entire cart."""
    email = email.lower().strip()
    if email in _carts:
        _carts[email] = {}
    return CartResponse(items=[], total=0.0)
