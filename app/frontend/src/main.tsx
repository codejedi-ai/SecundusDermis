// crypto.randomUUID is only available in secure contexts (HTTPS/localhost).
// Polyfill for plain HTTP deployments.
if (!crypto.randomUUID) {
  crypto.randomUUID = () => {
    const bytes = new Uint8Array(16)
    crypto.getRandomValues(bytes)
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    return [...bytes].map((b, i) =>
      ([4, 6, 8, 10].includes(i) ? '-' : '') + b.toString(16).padStart(2, '0')
    ).join('') as `${string}-${string}-${string}-${string}-${string}`
  }
}

import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter as Router, Routes, Route, Outlet, useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import './index.css'
import { ShopProvider, useShop } from './lib/shop-context'
import { AuthProvider, useAuth } from './lib/auth-context'
import { ConvoProvider, useConvo } from './lib/convo-context'
import { CartProvider } from './lib/cart-context'
import { MonitorProvider } from './lib/monitor-context'
import { SocketProvider, useSocket } from './lib/socket-context'
import { mergeShopSyncPayload } from './lib/shopBridge'
import Header from './components/Header'
import ChatWidget from './components/ChatWidget'

import ShopSidebar from './components/ShopSidebar'
import AccountSidebar, { ACCOUNT_SECTION_IDS } from './components/AccountSidebar'
import ResizableSidebar from './components/ResizableSidebar'
import ProtectedRoute from './components/ProtectedRoute'
import AtelierRoute from './components/AtelierRoute'
import ScrollToTop from './components/ScrollToTop'
import Product from './pages/Product'
import Shop from './pages/Shop'
import Home from './pages/Home'
import About from './pages/About'
import Contact from './pages/Contact'
import FAQ from './pages/FAQ'
import Agents from './pages/Agents'
import SignIn from './pages/SignIn'
import SignUp from './pages/SignUp'
import VerifyEmail from './pages/VerifyEmail'
import Account from './pages/Account'
import Cart from './pages/Cart'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import './styles/shop.css'

/**
 * SocketBridge — reads persisted chat ``session_id`` (same as ``POST /api/browser/agent/chat/stream``)
 * and scopes Socket.IO ``join_session`` / room ``sd_<id>`` for live agent pushes.
 */
function SocketBridge({ children }: { children: React.ReactNode }) {
  const { chatSessionId } = useConvo()
  return <SocketProvider sessionId={chatSessionId}>{children}</SocketProvider>
}

/**
 * UiActionExecutor — consumes ui_action events from the Socket.IO context
 * and executes them against the React router / shop state.
 */
function UiActionExecutor() {
  const { lastUiAction, clearUiAction } = useSocket();
  const { setGender, setCategory, setQuery, setInputValue } = useShop();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!lastUiAction) return;

    const { action, payload = {} } = lastUiAction;
    console.info('[UiActionExecutor] executing:', action, payload);

    switch (action) {
      case 'navigate':
        if (typeof payload.path === 'string') navigate(payload.path);
        break;
      case 'apply_filter':
      case 'select_sidebar':
      case 'select_category': {
        // Agent sets sidebar tags; empty string clears (must use `in` — falsy values still apply).
        const f = payload as { gender?: string; category?: string };
        if ('gender' in f) setGender(f.gender ?? '');
        if ('category' in f) setCategory(f.category ?? '');
        if (location.pathname !== '/shop') navigate('/shop');
        break;
      }
      case 'open_product':
        if (typeof payload.product_id === 'string')
          navigate(`/product/${payload.product_id}`);
        break;
      case 'scroll_to_shop':
        navigate('/shop');
        break;
      case 'set_search_hint':
        // Agent writes into the search bar AND triggers the keyword search.
        if (typeof payload.query === 'string') {
          setInputValue(payload.query);
          setQuery(payload.query);   // fires the keyword search on the shop page
          if (location.pathname !== '/shop') navigate('/shop');
        }
        break;
      case 'clear_filters':
        setGender('');
        setCategory('');
        setQuery('');
        setInputValue('');
        break;
    }

    clearUiAction();
  }, [lastUiAction]);

  return null;
}

/**
 * ShopSocketSync — applies ``sd_stylist_message`` (action ``shop_sync``) from the stylist agent so React shop state
 * matches backend shop_state whenever manage_sidebar / keyword_search runs.
 */
function ShopSocketSync() {
  const { lastShopSync, clearShopSync } = useSocket();
  const { gender, category, query, inputValue, setGender, setCategory, setQuery, setInputValue } = useShop();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!lastShopSync) return;

    const merged = mergeShopSyncPayload(
      { gender, category, query, inputValue },
      lastShopSync,
    );
    setGender(merged.gender);
    setCategory(merged.category);
    setQuery(merged.query);
    setInputValue(merged.inputValue);

    const has =
      !!(lastShopSync.gender?.trim() || lastShopSync.category?.trim() || lastShopSync.query?.trim());
    if (has && location.pathname !== '/shop') navigate('/shop');

    clearShopSync();
  }, [lastShopSync]);

  return null;
}

/**
 * Floating stylist chat — **Boutique and Atelier** (only omitted on ``/about``).
 * Uses the generic signed-in browser session. Do **not** gate on ``isAtelierExperience``.
 */
function AppChatWidget() {
  const { pathname } = useLocation()
  if (pathname === '/about') return null
  return <ChatWidget />
}

// Layout shared by pages that need the resizable sidebar
function ShopLayout() {
  return (
    <div className="shop-layout">
      <div className="shop-body">
        <ResizableSidebar>
          <ShopSidebar />
        </ResizableSidebar>
        <div className="shop-main">
          <Outlet />
        </div>
      </div>
    </div>
  )
}

// Layout for account pages — uses AccountSidebar instead of ShopSidebar
function AccountLayout() {
  const [activeSection, setActiveSection] = useState('profile');
  const [searchParams, setSearchParams] = useSearchParams();
  const { signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const s = searchParams.get('section');
    if (s === 'agent-api-keys') {
      navigate('/agents?panel=api-keys', { replace: true });
      return;
    }
    if (s === 'chat-logs') {
      navigate('/agents?panel=chat-logs', { replace: true });
      return;
    }
    if (s && ACCOUNT_SECTION_IDS.includes(s)) {
      setActiveSection(s);
    }
  }, [searchParams, navigate]);

  const handleSectionChange = (id: string) => {
    setActiveSection(id);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (id === 'profile') {
        next.delete('section');
      } else {
        next.set('section', id);
      }
      return next;
    });
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="shop-layout">
      <div className="shop-body">
        <ResizableSidebar>
          <AccountSidebar
            activeSection={activeSection}
            onSectionChange={handleSectionChange}
            onSignOut={handleSignOut}
          />
        </ResizableSidebar>
        <div className="shop-main">
          <Outlet context={{ activeSection, setActiveSection: handleSectionChange }} />
        </div>
      </div>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <ConvoProvider>
      <SocketBridge>
      <CartProvider>
      <ShopProvider>
        <Router>
          <MonitorProvider>
          <UiActionExecutor />
          <ShopSocketSync />
          <ScrollToTop />
          <div className="app">
            <Header />
            <main>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/about" element={<About />} />
                <Route path="/sign-in" element={<SignIn />} />
                <Route path="/sign-up" element={<SignUp />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/verify-email" element={<VerifyEmail />} />

                {/* Shop area — sidebar lives here, not in individual pages */}
                <Route element={<ShopLayout />}>
                  <Route path="/shop" element={<Shop />} />
                  <Route path="/product/:id" element={<Product />} />
                </Route>

                {/* Account area — uses AccountSidebar, not ShopSidebar */}
                <Route element={<AccountLayout />}>
                  <Route path="/account" element={<ProtectedRoute><Account /></ProtectedRoute>} />
                </Route>

                {/* Cart — no sidebar needed */}
                <Route path="/cart" element={<ProtectedRoute><Cart /></ProtectedRoute>} />

                <Route path="/faq" element={<FAQ />} />
                <Route path="/contact" element={<Contact />} />
                <Route
                  path="/agents"
                  element={
                    <ProtectedRoute>
                      <AtelierRoute>
                        <Agents />
                      </AtelierRoute>
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </main>
            <AppChatWidget />
          </div>
          </MonitorProvider>
        </Router>
      </ShopProvider>
      </CartProvider>
      </SocketBridge>
      </ConvoProvider>
    </AuthProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
