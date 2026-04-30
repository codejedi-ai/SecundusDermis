# Secundus Dermis — Frontend

React + Vite SPA for an AI-powered fashion storefront. Features infinite-scroll catalog, persistent AI chat widget, markdown blog, and resizable filter sidebar.

---

## Quick Start

### Prerequisites

- **Node.js 18+**
- **npm** or **bun**

### Installation

```bash
cd frontend
npm install
npm run dev                   # Starts on http://localhost:5173
```

The Vite dev server proxies `/api/*` → `http://localhost:8000` (backend).

### Build for Production

```bash
npm run build                 # Output to ./dist
npm run preview               # Preview production build
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `/api` | Backend API base URL (production) |
| `VITE_IMAGE_URL` | `` | Backend image base URL (production) |

Create `.env` or `.env.local`:

```env
VITE_API_URL=https://your-backend.com
VITE_IMAGE_URL=https://your-backend.com/images
```

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  React SPA (Vite)                                        │
│                                                          │
│  main.tsx                                                │
│    │                                                     │
│    ├─ RouterProvider (React Router)                      │
│    │                                                     │
│    ├─ ShopProvider (Context)                             │
│    │   └─ gender, category, query, sidebarWidth          │
│    │                                                     │
│    ├─ AuthProvider (Context)                             │
│    │   └─ user, session_id, login/logout                 │
│    │                                                     │
│    └─ ConvoProvider (Context)                            │
│        └─ conversations, sendMessage, session management │
│                                                          │
│  ShopLayout (nested routes parent)                       │
│    ├─ Header (navbar with AI search)                     │
│    ├─ ShopSidebar (resizable filters)                    │
│    ├─ Outlet (nested routes)                             │
│    │   ├─ /shop → Shop.tsx                               │
│    │   └─ /product/:id → Product.tsx                     │
│    └─ ChatWidget (floating, persists across pages)       │
│                                                          │
│  Other Routes                                            │
│    ├─ / → Home.tsx                                       │
│    ├─ /about → About.tsx                                 │
│    ├─ /blog → Blog.tsx                                   │
│    ├─ /blog/:slug → BlogPost.tsx                         │
│    ├─ /blog/new → NewBlog.tsx (protected)                │
│    ├─ /faq → FAQ.tsx                                     │
│    ├─ /contact → Contact.tsx                             │
│    ├─ /signin → SignIn.tsx                               │
│    ├─ /signup → SignUp.tsx                               │
│    ├─ /account → Account.tsx (protected)                 │
│    └─ /cart → Cart.tsx                                   │
└──────────────────────────────────────────────────────────┘
```

---

## Pages

| Page | Route | Description |
|------|-------|-------------|
| `Home.tsx` | `/` | Landing page with hero, catalog preview, testimonials |
| `About.tsx` | `/about` | Project description — AI agent playground explanation |
| `Shop.tsx` | `/shop` | Infinite-scroll product grid with sidebar filters |
| `Product.tsx` | `/product/:id` | Product detail page |
| `Blog.tsx` | `/blog` | Journal article listing with category filter |
| `BlogPost.tsx` | `/blog/:slug` | Single article view (renders markdown) |
| `NewBlog.tsx` | `/blog/new` | Create new journal article (authenticated only) |
| `SignIn.tsx` | `/signin` | User login |
| `SignUp.tsx` | `/signup` | User registration |
| `Account.tsx` | `/account` | User account management (protected) |
| `Cart.tsx` | `/cart` | Shopping cart view |
| `FAQ.tsx` | `/faq` | Frequently asked questions |
| `Contact.tsx` | `/contact` | Contact form |

---

## Components

| Component | Description |
|-----------|-------------|
| `Header.tsx` | Navbar with logo, navigation links, live AI-controlled search input, cart count, user menu |
| `ShopSidebar.tsx` | Resizable filter sidebar (gender, category) — defined once in `ShopLayout`, shared across `/shop` and `/product/:id` |
| `ChatWidget.tsx` | Floating AI chat panel (bottom-right) — text + image upload, persists across page navigation |
| `Footer.tsx` | Site footer with links |
| `ProtectedRoute.tsx` | Auth guard wrapper for protected pages |
| `ScrollToTop.tsx` | Scroll-to-top on route change |

---

## State Management

### ShopContext

Global filter and search state shared across all routes:

```tsx
interface ShopContextType {
  // Active filters
  gender: string | null;
  category: string | null;
  query: string;
  
  // Search input state (debounced)
  inputValue: string;
  setInputValue: (v: string) => void;
  
  // Sidebar
  sidebarWidth: number;
  setSidebarWidth: (w: number) => void;
  
  // Actions
  setFilter: (f: { gender?: string; category?: string; query?: string }) => void;
  clearFilters: () => void;
}
```

**Usage:**
```tsx
const { gender, category, query, setFilter, clearFilters } = useShop();
```

### AuthProvider

User session management:

```tsx
interface AuthContextType {
  user: User | null;
  session_id: string;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}
```

Session ID persisted in `localStorage` for anonymous users.

### ConvoProvider

Chat conversation history:

```tsx
interface ConvoContextType {
  conversations: Map<string, Message[]>;
  sessionId: string;
  sendMessage: (message: string, image?: File) => Promise<void>;
  clearConversation: () => void;
}
```

Syncs to backend for authenticated users, `localStorage` for anonymous.

---

## API Service Layer

**File:** `src/services/fashionApi.ts`

Typed API client:

```typescript
// Chat with AI agent
export function chat(
  message: string,
  history: Message[],
  sessionId: string
): Promise<ChatResponse>

// Direct keyword search
export function searchText(
  query: string,
  opts: SearchOptions
): Promise<SearchResponse>

// Visual image search
export function searchImage(
  file: File,
  opts: SearchOptions
): Promise<SearchResponse>

// Catalog browsing
export function browseCatalog(
  opts: { offset?: number; limit?: number; gender?: string; category?: string; q?: string }
): Promise<{ products: Product[]; offset: number; limit: number; total: number }>

// Single product
export function getProduct(productId: string): Promise<Product>

// Journal
export function getJournalList(opts: { category?: string; featured?: boolean }): Promise<{ posts: JournalPost[]; total: number }>
export function getJournalPost(slug: string): Promise<JournalPost>
export function createJournalPost(post: JournalPost, adminKey: string): Promise<{ slug: string; message: string }>

// Auth
export function register(name: string, email: string, password: string): Promise<void>
export function login(email: string, password: string): Promise<{ session_id: string }>
export function logout(): Promise<void>
export function getMe(): Promise<User>

// Cart
export function getCart(): Promise<CartItem[]>
export function addToCart(productId: string, quantity: number): Promise<void>
export function updateCartItem(productId: string, quantity: number): Promise<void>
export function removeFromCart(productId: string): Promise<void>

// Conversations
export function getConversations(sessionId: string): Promise<Message[]>
export function saveConversation(sessionId: string, messages: Message[]): Promise<void>
export function deleteConversations(sessionId: string): Promise<void>
```

---

## Styling Approach

### CSS Variables (Design Tokens)

**File:** `src/styles/global.css`

```css
:root {
  /* Brand colors */
  --color-primary: #1a1a1a;
  --color-accent: #c4a574;
  --color-accent-dark: #8b7355;
  --color-rose: #b86b6b;
  
  /* Neutrals */
  --color-white: #ffffff;
  --color-cream: #f9f8f6;
  --color-gray-50: #f5f5f5;
  --color-gray-100: #e5e5e5;
  --color-gray-300: #a3a3a3;
  --color-gray-600: #525252;
  --color-gray-700: #404040;
  --color-charcoal: #262626;
  
  /* Typography */
  --font-primary: 'Inter', sans-serif;
  --font-display: 'Playfair Display', serif;
  
  /* Spacing scale */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
  --space-20: 80px;
  
  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-normal: 250ms ease;
  --transition-slow: 400ms ease;
  
  /* Header height (for padding-top calculations) */
  --header-height: 64px;
}
```

### Component CSS

One CSS file per component/feature:

```
src/styles/
├── global.css          # Design tokens + base styles
├── header.css
├── footer.css
├── home.css
├── shop.css
├── product.css
├── about.css
├── blog.css
├── chat.css
├── cart.css
├── auth.css
└── ...
```

**No CSS framework** — full control over editorial boutique aesthetic.

---

## Routing

### Nested Routes Pattern

`ShopLayout` defines the sidebar once; `/shop` and `/product/:id` are nested inside:

```tsx
// src/main.tsx
<Route element={<ShopLayout />}>
  <Route path="/shop" element={<Shop />} />
  <Route path="/product/:id" element={<Product />} />
</Route>
```

This ensures the sidebar never unmounts or re-renders on navigation between shop and product pages.

### Protected Routes

```tsx
<Route
  path="/blog/new"
  element={
    <ProtectedRoute>
      <NewBlog />
    </ProtectedRoute>
  }
/>
```

---

## Build & Deployment

### Vite Configuration

**File:** `vite.config.ts`

```typescript
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        rewrite: path => path.replace(/^\/api/, ''),
      },
      '/images': {
        target: 'http://localhost:8000',
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
```

### Docker

```dockerfile
# Build stage
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Runtime stage
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

### Netlify

**File:** `netlify.toml`

```toml
[build]
  publish = "dist"
  command = "npm run build"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### Nginx (Production)

**File:** `nginx.conf`

```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API to backend
    location /api/ {
        proxy_pass http://backend:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Proxy images to backend
    location /images/ {
        proxy_pass http://backend:8000/images/;
    }
}
```

---

## Dependencies

### Production

```json
{
  "react": "^19.2.4",
  "react-dom": "^19.2.4",
  "react-router-dom": "^7.13.2",
  "react-markdown": "^10.1.0",
  "lucide-react": "^1.7.0"
}
```

### Development

```json
{
  "@vitejs/plugin-react": "^6.0.1",
  "typescript": "^6.0.2",
  "vite": "^8.0.3",
  "eslint": "^9.39.4",
  "@types/react": "^19.2.14",
  "@types/react-dom": "^19.2.3"
}
```

---

## Project Structure

```
frontend/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── Dockerfile
├── nginx.conf
├── netlify.toml
│
├── public/
│   ├── favicon.svg
│   ├── image-hero.jpeg
│   ├── image-blog.jpeg
│   └── image-understand.jpeg
│
└── src/
    ├── main.tsx                  # App root — Router, providers
    ├── App.tsx                   # Route definitions
    │
    ├── lib/
    │   ├── shop-context.tsx      # Global filter + search state
    │   ├── auth-context.tsx      # Authentication context
    │   └── convo-context.tsx     # Chat conversation context
    │
    ├── components/
    │   ├── Header.tsx
    │   ├── Footer.tsx
    │   ├── ShopSidebar.tsx
    │   ├── ChatWidget.tsx
    │   ├── ProtectedRoute.tsx
    │   └── ScrollToTop.tsx
    │
    ├── pages/
    │   ├── Home.tsx
    │   ├── About.tsx
    │   ├── Shop.tsx
    │   ├── Product.tsx
    │   ├── Blog.tsx
    │   ├── BlogPost.tsx
    │   ├── NewBlog.tsx
    │   ├── SignIn.tsx
    │   ├── SignUp.tsx
    │   ├── Account.tsx
    │   ├── Cart.tsx
    │   ├── FAQ.tsx
    │   └── Contact.tsx
    │
    ├── services/
    │   └── fashionApi.ts         # Typed API client
    │
    └── styles/
        ├── global.css            # Design tokens
        ├── header.css
        ├── footer.css
        ├── home.css
        ├── shop.css
        ├── product.css
        ├── about.css
        ├── blog.css
        ├── chat.css
        └── ...
```

---

## Development Commands

```bash
npm run dev           # Start dev server (Vite)
npm run build         # Build for production
npm run preview       # Preview production build
npm run lint          # ESLint check
npm run lint:fix      # ESLint auto-fix
```

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **React Context for state** | Sidebar filters and search query shared across all routes without prop drilling |
| **Nested routes + `<Outlet>`** | `ShopLayout` defines sidebar once; `/shop` and `/product/:id` nested inside — sidebar never unmounts |
| **Plain CSS (no framework)** | Full control over editorial boutique aesthetic; no framework purge config |
| **Vite** | HMR for fast iteration; fast builds; simple config |
| **TypeScript** | Catches API contract mismatches early; better IDE support |
| **react-markdown** | Render journal articles from markdown; no CMS dependency |
| **Lucide React** | Consistent, lightweight icon set |

---

## Browser Support

- Chrome/Edge (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)

---

## License

MIT
