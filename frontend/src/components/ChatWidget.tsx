import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { ImagePlus, Loader2, MessageCircle, Send, X } from 'lucide-react';
import * as fashionApi from '../services/fashionApi';
import { useShop } from '../lib/shop-context';
import { useConvo } from '../lib/convo-context';
import { useAuth } from '../lib/auth-context';

// ── Types ──────────────────────────────────────────────────────────────────

const FALLBACK_IMAGE = '/img/photo-6311392.jpg';

// ── Component ──────────────────────────────────────────────────────────────

export default function ChatWidget() {
  const { messages, chatSessionId, addMessage } = useConvo();
  const { session } = useAuth();
  const authSessionId = session?.session_id;

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [online, setOnline] = useState<boolean | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { setGender, setCategory, setQuery, setInputValue } = useShop();
  const navigate = useNavigate();

  // Return the value that appears in >= threshold fraction of the array, or null
  function dominant(arr: string[], threshold = 0.8): string | null {
    if (!arr.length) return null;
    const counts: Record<string, number> = {};
    for (const v of arr) if (v && v !== 'unknown') counts[v] = (counts[v] || 0) + 1;
    const [top, count] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] ?? [];
    return top && count / arr.length >= threshold ? top : null;
  }

  // Check backend availability once on mount
  useEffect(() => {
    fashionApi.checkHealth().then(setOnline);
  }, []);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // ── Text send ────────────────────────────────────────────────────────────

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    addMessage({ role: 'user', content: text });
    setLoading(true);
    try {
      const res = await fashionApi.chat(text, [], chatSessionId, authSessionId);
      addMessage({ role: 'assistant', content: res.reply, products: res.products });

      // If the AI returned products, mirror its filters into the sidebar
      if (res.products && res.products.length > 0) {
        const newGender   = res.filter?.gender   || dominant(res.products.map(p => p.gender));
        const newCategory = res.filter?.category || dominant(res.products.map(p => p.category));
        const newQuery    = res.filter?.query    || '';

        if (newGender)   setGender(newGender);
        if (newCategory) setCategory(newCategory);
        if (newQuery)  { setQuery(newQuery); setInputValue(newQuery); }
        navigate('/shop');
      }
    } catch {
      addMessage({
        role: 'assistant',
        content: 'Could not reach the server. Make sure the backend is running.',
      });
    } finally {
      setLoading(false);
    }
  }

  // ── Image send ───────────────────────────────────────────────────────────

  async function handleImageFile(file: File) {
    if (loading) return;
    const previewUrl = URL.createObjectURL(file);
    addMessage({ role: 'user', content: `Searching by image: ${file.name}`, previewUrl });
    setLoading(true);
    try {
      const res = await fashionApi.searchImage(file);
      const reply =
        res.total > 0
          ? `Found ${res.total} visually similar items!`
          : "Couldn't find similar items. Try a clearer photo or describe what you're looking for.";
      addMessage({ role: 'assistant', content: reply, products: res.results });
    } catch {
      addMessage({ role: 'assistant', content: 'Image search failed. Please try again.' });
    } finally {
      setLoading(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="chat-widget">
      {open && (
        <div className="chat-panel">
          {/* Header */}
          <div className="chat-header">
            <div className="chat-header-info">
              <span className="chat-title">Fashion AI</span>
              <span className={`chat-status ${online === false ? 'offline' : 'online'}`}>
                {online === false ? 'Offline' : 'Online'}
              </span>
            </div>
            <button className="chat-close" onClick={() => setOpen(false)} aria-label="Close chat">
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div className="chat-messages">
            {messages.map((msg) => (
              <div key={msg.id} className={`chat-message ${msg.role}`}>
                {msg.previewUrl && (
                  <img
                    src={msg.previewUrl}
                    alt="Uploaded"
                    className="chat-uploaded-image"
                  />
                )}
                <div className="chat-bubble">
                  {msg.role === 'assistant'
                    ? <ReactMarkdown>{msg.content}</ReactMarkdown>
                    : msg.content}
                </div>
                {msg.products && msg.products.length > 0 && (
                  <div className="chat-products">
                    {msg.products.slice(0, 6).map((p) => (
                      <Link key={p.product_id} to={`/product/${p.product_id}`} className="chat-product-card">
                        <div className="chat-product-img">
                          <img
                            src={fashionApi.productImageUrl(p.image_url)}
                            alt={p.product_name}
                            loading="lazy"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = FALLBACK_IMAGE;
                            }}
                          />
                        </div>
                        <div className="chat-product-info">
                          <p className="chat-product-name">{p.product_name}</p>
                          <p className="chat-product-price">${p.price.toFixed(2)}</p>
                          {p.similarity > 0 && p.similarity < 1 && (
                            <p className="chat-product-match">
                              {Math.round(p.similarity * 100)}% match
                            </p>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="chat-message assistant">
                <div className="chat-bubble chat-loading">
                  <Loader2 size={14} className="spin" />
                  <span>Searching…</span>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input row */}
          <div className="chat-input-row">
            <button
              className="chat-img-btn"
              onClick={() => fileRef.current?.click()}
              disabled={loading}
              title="Upload image for visual search"
            >
              <ImagePlus size={17} />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImageFile(file);
                e.target.value = '';
              }}
            />
            <input
              className="chat-text-input"
              type="text"
              value={input}
              placeholder="Describe what you're looking for…"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              disabled={loading}
            />
            <button
              className="chat-send-btn"
              onClick={handleSend}
              disabled={!input.trim() || loading}
              aria-label="Send"
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      )}

      <button
        className="chat-toggle"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={open ? 'Close chat' : 'Open AI fashion assistant'}
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>
    </div>
  );
}
