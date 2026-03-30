"""
gemini_client.py
================
Direct Gemini SDK client for VLA (Vision-Language-Action) model.
No ADK - just pure Gemini API calls.
"""

import logging
import re
import json
from typing import Optional, List, Dict, Any

from google import genai
from google.genai import types as genai_types

logger = logging.getLogger(__name__)


class GeminiFashionAgent:
    """Direct Gemini SDK agent for fashion recommendations."""
    
    def __init__(self, gemini_client: genai.Client, catalog: List[dict]):
        self.client = gemini_client
        self.catalog = catalog
        self.model = "gemini-3.1-pro-preview-customtools"
        
        # System instruction for the agent
        self.system_instruction = """
You are the personal attache of Secundus Dermis — an exclusive fashion atelier.
You are a luxury concierge and stylist: perceptive, unhurried, and devoted to 
honoring each patron's unique silhouette and aesthetic.

## Your Capabilities

1. **Text Search**: Use keyword matching to find products in the catalog
2. **Image Analysis**: When shown an image, identify ALL garments (shirt, pants, shoes, accessories)
3. **Multi-Item Search**: For full-body images, search for EACH item separately

## How to Respond

- For text queries: Search the catalog and present 4-8 matching items
- For image queries: 
  1. Identify each garment (upper body, lower body, footwear, accessories)
  2. Search for similar items for EACH garment
  3. Organize results by body area
- Always be elegant, concise, and helpful
- Never fabricate product details — only present items from search results

## Catalog Structure

Products have: product_id, product_name, description, gender, category, price, image_url

Categories: Denim, Jackets_Vests, Pants, Shirts_Polos, Shorts, Sweaters, 
            Tees_Tanks, Dresses, Blouses_Shirts, Skirts, etc.

Genders: MEN, WOMEN, unknown
"""

    def _keyword_search(self, keywords: str, gender: Optional[str] = None, 
                        category: Optional[str] = None, n_results: int = 8) -> List[dict]:
        """Simple keyword search on catalog."""
        kw = keywords.lower().strip()
        results = []
        
        for item in self.catalog:
            # Keyword filter
            if kw and kw not in item.get("description", "").lower():
                continue
            # Gender filter
            if gender and item.get("gender", "").upper() != gender.upper():
                continue
            # Category filter
            if category and item.get("category", "") != category:
                continue
            
            results.append({
                "product_id": item.get("product_id", ""),
                "product_name": item.get("product_name", ""),
                "description": item.get("description", ""),
                "gender": item.get("gender", ""),
                "category": item.get("category", ""),
                "price": float(item.get("price", 0.0)),
                "image_url": item.get("image_url", ""),
            })
            
            if len(results) >= n_results:
                break
        
        return results

    def _parse_vlm_response(self, text: str) -> Dict[str, Any]:
        """Parse VLM response to extract garment items."""
        try:
            # Try to find JSON in response
            json_match = re.search(r'\{[^{}]*"items"[^{}]*\}', text, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group())
                return result
        except:
            pass
        
        # Fallback: treat as single item
        return {
            "items": [{"description": text, "body_area": "unknown", "keywords": []}],
            "overall_style": "unknown"
        }

    async def chat(self, message: str, image_bytes: Optional[bytes] = None, 
                   mime_type: str = "image/jpeg") -> Dict[str, Any]:
        """
        Process a chat message with optional image using Gemini VLA.
        
        Args:
            message: Text message from user
            image_bytes: Optional image bytes for VLA processing
            mime_type: Image MIME type
        
        Returns:
            dict with reply, products, and metadata
        """
        logger.info(f"[GEMINI] Chat: {message[:100]}... (image={image_bytes is not None})")
        
        # Build message parts for VLA
        parts = []
        
        if image_bytes:
            # Add image first (VLA processes image + text together)
            parts.append(genai_types.Part.from_bytes(data=image_bytes, mime_type=mime_type))
            logger.info("[GEMINI] Added image to VLA request")
        
        # Add text
        parts.append(genai_types.Part(text=message))
        
        # Configure for fast responses (prevent looping)
        config = genai_types.GenerateContentConfig(
            thinking_config=genai_types.ThinkingConfig(thinking_level="low"),
            temperature=1.0,
        )
        
        try:
            # Call Gemini with VLA
            logger.info("[GEMINI] Calling Gemini VLA model...")
            response = self.client.models.generate_content(
                model=self.model,
                contents=parts,
                config=config,
            )
            
            reply_text = response.text or ""
            logger.info(f"[GEMINI] Response: {reply_text[:200]}...")
            
            # If image was provided, parse and search
            products = []
            if image_bytes:
                # Parse VLM output for garment items
                vlm_data = self._parse_vlm_response(reply_text)
                items = vlm_data.get("items", [])
                
                logger.info(f"[GEMINI] Found {len(items)} items in image")
                
                # Search for each item
                for item in items:
                    keywords = item.get("keywords", [])
                    garment_type = item.get("garment_type", "")
                    body_area = item.get("body_area", "unknown")
                    
                    # Build search query from keywords
                    search_terms = " ".join(keywords[:5]) if keywords else garment_type
                    
                    if search_terms:
                        search_results = self._keyword_search(
                            keywords=search_terms,
                            n_results=4,
                        )
                        
                        # Add body_area metadata to results
                        for prod in search_results:
                            prod["body_area"] = body_area
                        
                        products.extend(search_results)
                        logger.info(f"[GEMINI] Searched for '{search_terms}' → {len(search_results)} results")
            
            # If no image, do text search
            elif message.lower().strip():
                products = self._keyword_search(keywords=message, n_results=8)
                logger.info(f"[GEMINI] Text search → {len(products)} results")
            
            return {
                "reply": reply_text,
                "products": products[:16],  # Limit total products
                "intent": "text_search" if products else "chitchat",
            }
            
        except Exception as e:
            logger.exception(f"[GEMINI] Error: {e}")
            return {
                "reply": f"I apologize, but I encountered an error: {str(e)[:100]}",
                "products": [],
                "intent": "error",
            }

    async def chat_stream(self, message: str, image_bytes: Optional[bytes] = None,
                          mime_type: str = "image/jpeg"):
        """
        Stream chat response with thinking process.
        
        Yields:
            dict with type and content
        """
        logger.info(f"[GEMINI STREAM] Chat: {message[:100]}... (image={image_bytes is not None})")
        
        # Yield initial thinking
        yield {
            "type": "thinking_start",
            "content": "Understanding your request..."
        }
        
        if image_bytes:
            yield {
                "type": "thinking",
                "content": "👁️ Processing image with VLA model..."
            }
        
        # Build message parts
        parts = []
        if image_bytes:
            parts.append(genai_types.Part.from_bytes(data=image_bytes, mime_type=mime_type))
        parts.append(genai_types.Part(text=message))
        
        config = genai_types.GenerateContentConfig(
            thinking_config=genai_types.ThinkingConfig(thinking_level="low"),
            temperature=1.0,
        )
        
        products = []
        reply_text = ""
        
        try:
            # Stream the response
            logger.info("[GEMINI STREAM] Starting stream...")
            
            response = self.client.models.generate_content_stream(
                model=self.model,
                contents=parts,
                config=config,
            )
            
            chunk_count = 0
            for chunk in response:
                chunk_count += 1
                if chunk.text:
                    reply_text += chunk.text
                    
                    # Yield thinking updates for tool-like actions
                    if chunk_count == 1:
                        yield {
                            "type": "thinking",
                            "content": "🔎 Analyzing request..."
                        }
            
            logger.info(f"[GEMINI STREAM] Complete response ({len(reply_text)} chars)")
            
            # Process results
            if image_bytes:
                yield {
                    "type": "thinking",
                    "content": "📝 Identifying garments in image..."
                }
                
                vlm_data = self._parse_vlm_response(reply_text)
                items = vlm_data.get("items", [])
                
                for i, item in enumerate(items):
                    keywords = item.get("keywords", [])
                    garment_type = item.get("garment_type", "")
                    body_area = item.get("body_area", "unknown")
                    
                    search_terms = " ".join(keywords[:5]) if keywords else garment_type
                    
                    if search_terms:
                        yield {
                            "type": "thinking",
                            "content": f"🔎 Searching: \"{search_terms}\" ({body_area})..."
                        }
                        
                        search_results = self._keyword_search(keywords=search_terms, n_results=4)
                        
                        for prod in search_results:
                            prod["body_area"] = body_area
                        
                        products.extend(search_results)
                        
                        yield {
                            "type": "found_products",
                            "count": len(search_results),
                            "content": f"✅ Found {len(search_results)} {body_area} items"
                        }
                        
            elif message.lower().strip():
                yield {
                    "type": "thinking",
                    "content": f"🔎 Searching catalog: \"{message[:30]}...\""
                }
                
                products = self._keyword_search(keywords=message, n_results=8)
                
                yield {
                    "type": "found_products",
                    "count": len(products),
                    "content": f"✅ Found {len(products)} items"
                }
            
            # Final response
            yield {
                "type": "final",
                "reply": reply_text,
                "products": products[:16],
                "intent": "text_search" if products else "chitchat",
            }
            
        except Exception as e:
            logger.exception(f"[GEMINI STREAM] Error: {e}")
            yield {
                "type": "thinking",
                "content": f"❌ Error: {str(e)[:100]}"
            }
            yield {
                "type": "final",
                "reply": f"I apologize, but I encountered an error: {str(e)[:200]}",
                "products": [],
                "intent": "error",
            }
