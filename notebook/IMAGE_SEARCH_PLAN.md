# Image Search — Design & Improvement Plan

> **Status:** Current implementation is working correctly. This document clarifies the intended architecture and planned improvements.

---

## Current Implementation (Working)

### Flow
```
User uploads image
        │
        ▼
┌─────────────────────────────────────────────────────┐
│  Step 1 — Gemini VLM  (PRIMARY SIGNAL)              │
│                                                     │
│  Image bytes → Gemini VLM →                        │
│  "dress, floral, blue, cotton, short-sleeve, casual"│
│                                                     │
│  Extracts: garment type, colours, patterns,         │
│  fabric, style descriptors                          │
└───────────────────┬─────────────────────────────────┘
                    │  keywords
                    ▼
┌─────────────────────────────────────────────────────┐
│  Step 2 — Keyword Search  (PRIMARY RETRIEVAL)       │
│                                                     │
│  keyword_search("dress") → candidates               │
│  keyword_search("floral") → more candidates         │
│  keyword_search("blue") → more candidates           │
│  ... (up to 8 terms, union of results)              │
│                                                     │
│  In-memory scan of 12,278 descriptions.             │
│  Zero API cost.                                     │
└───────────────────┬─────────────────────────────────┘
                    │  ~200 candidate products
                    ▼
┌─────────────────────────────────────────────────────┐
│  Step 3 — Colour Histogram  (SECONDARY ORDERING)    │
│                                                     │
│  Compute 96-dim RGB histogram of uploaded image.    │
│  Score each candidate against query histogram       │
│  (cosine similarity).                               │
│  Sort candidates: most colour-similar first.        │
│                                                     │
│  Histograms are cached lazily (computed once per    │
│  product, reused on subsequent searches).           │
└───────────────────┬─────────────────────────────────┘
                    │  top N results, sorted by visual similarity
                    ▼
              Return to frontend
```

### Key design principle
The **histogram does not find products** — it only **orders** them. If VLM produces no useful keywords, the histogram alone would return visually similar but possibly irrelevant items. VLM keyword search is always the gate.

---

## Planned Improvements

### P1 — Structured VLM Output

**Problem:** VLM currently returns a free-text comma-separated string. Parsing is fragile (split on commas and spaces, filter short words).

**Solution:** Change the VLM prompt to return a JSON object:

```
Prompt:
  Analyse this fashion image. Return a JSON object with these fields:
  {
    "garment_type": "dress",        // single primary garment
    "gender": "WOMEN",              // "MEN", "WOMEN", or null
    "category": "Dresses",          // one of the catalog categories or null
    "colors": ["blue", "white"],    // up to 3 dominant colours
    "patterns": ["floral"],         // patterns if visible
    "fabrics": ["cotton"],          // fabrics if visible
    "style_keywords": ["casual", "short-sleeve"]  // other descriptors
  }
  Only include fields you are confident about. Return valid JSON only.
```

**Benefits:**
- Gender + category can be passed directly to `keyword_search` as filters (more precise results)
- No parsing ambiguity
- Colours separated from garment keywords → better search term construction

**Estimated effort:** Small — change the prompt and update the parsing code in `vlm_describe_image`.

---

### P2 — Agent-Integrated Image Search

**Problem:** Image search currently bypasses the conversational agent entirely. Results appear in the chat but the agent cannot follow up ("show me more like #2") because image search state is not in the ADK session.

**Solution:** Add a `describe_image` tool to the agent:

```python
def describe_image(image_id: str) -> dict:
    """
    Returns VLM-extracted keywords for a previously uploaded image.
    Call this when the user has uploaded an image and wants product matches.

    Args:
        image_id: The ID returned when the image was uploaded.
    Returns:
        dict with 'keywords', 'gender', 'category' fields.
    """
```

**Flow:**
1. Frontend uploads image to `POST /image/upload` → gets `image_id`
2. Frontend sends message to agent: "Find items similar to image {image_id}"
3. Agent calls `describe_image(image_id)` → gets structured keywords
4. Agent calls `search_by_keywords(...)` as normal
5. Results are in conversation context — agent can refine on follow-up

**Benefits:**
- Multi-turn image conversations ("show more like this but in red")
- Agent can explain what it saw in the image
- Consistent experience with text search

**Estimated effort:** Medium — requires new upload endpoint, new tool, frontend changes.

---

### P3 — Broader Histogram Candidate Pool

**Problem:** Histogram re-ranking only scores the ~200 candidates found by keyword search. If the uploaded image has unusual colouring not reflected in description text, visually similar items may not be in the candidate pool at all.

**Solution:** Two-pass retrieval:

```
Pass 1 — Broad keyword search (up to 500 candidates from VLM keywords)
Pass 2 — Add a colour-bucket pre-filter:
         - Classify image dominant hue into 8 buckets (red, orange, yellow, green, blue, purple, neutral, multicolour)
         - Pre-filter catalog to same hue bucket (~1,500 items)
         - Take union with keyword candidates
Pass 3 — Histogram score all candidates, return top N
```

**Estimated effort:** Medium — requires pre-computing dominant hue for all catalog images (can be done in the existing lazy histogram cache step).

---

### P4 — Client-Side Image Preview & Crop

**Problem:** Users upload full photos (often including background, people, etc.). The VLM works on the full image, which can confuse it with background elements.

**Solution:**
- Add a crop step in the frontend: after upload, show the image with a draggable crop rectangle
- User crops to just the garment before sending
- Smaller, cleaner image → better VLM output → better keyword matches

**Estimated effort:** Medium-Large (frontend crop UI is non-trivial).

---

## Current Limitations & Known Issues

| Issue | Severity | Notes |
|-------|----------|-------|
| VLM produces generic keywords for complex patterns | Low | Structured JSON output (P1) will help |
| Histogram cache not persisted across restarts | Low | All ~10k histograms must be recomputed cold |
| No image in agent conversation context | Medium | Addressed by P2 |
| Candidate pool may miss visually similar but keyword-dissimilar items | Medium | Addressed by P3 |
| Full image sent to VLM (not cropped to garment) | Low | Addressed by P4 |

---

## Testing Image Search Quality

Once P1 (structured VLM output) is done, add automated tests:

```python
# eval/test_image_search.py
TEST_CASES = [
    { "image": "test_images/blue_floral_dress.jpg", "expected_category": "Dresses", "expected_color": "blue" },
    { "image": "test_images/mens_denim_jacket.jpg", "expected_gender": "MEN", "expected_category": "Jackets_Vests" },
]

for case in TEST_CASES:
    result = search_image(open(case["image"], "rb"))
    assert result.results[0].category == case["expected_category"]
    # ...
```

Run as part of the CI regression suite described in `NEXT_STEPS.md`.
