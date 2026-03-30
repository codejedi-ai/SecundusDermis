import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { ImagePlus, Loader2, MessageCircle, Send, X, Trash2, Sparkles, Wrench, ChevronDown, ChevronRight } from 'lucide-react';
import * as chatApi from '../services/chatApi';
import { useShop } from '../lib/shop-context';
import { useConvo } from '../lib/convo-context';
import { useAuth } from '../lib/auth-context';

// ── Types ──────────────────────────────────────────────────────────────────

const FALLBACK_IMAGE = '/img/photo-6311392.jpg';

interface PendingImage {
  file: File;
  previewUrl: string;
}

interface ThinkingStep {
  kind: 'thinking' | 'tool_call' | 'tool_result';
  content: string;
  tool?: string;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function ChatWidget() {
  const { messages, chatSessionId, addMessage } = useConvo();
  const { session } = useAuth();
  const authSessionId = session?.session_id;

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const [loading, setLoading] = useState(false);
  const [online, setOnline] = useState<boolean | null>(null);
  const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([]);
  const [showThinking, setShowThinking] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { gender, category, query, setGender, setCategory } = useShop();

  // Check backend availability once on mount
  useEffect(() => {
    chatApi.checkHealth().then(setOnline);
  }, []);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, pendingImage]);

  // ── Send message (text + optional image) ─────────────────────────────────

  async function handleSend() {
    const text = input.trim();
    const hasImage = !!pendingImage;

    // Require at least text or image
    if ((!text && !hasImage) || loading) return;

    // Capture and clear state
    const imageToSend = pendingImage;
    setPendingImage(null);
    setInput('');
    setThinkingSteps([]);
    setShowThinking(true);

    // Build user message content
    let userMessageContent: string;
    if (hasImage && text) {
      userMessageContent = text;
    } else if (hasImage) {
      userMessageContent = `Searching by image: ${imageToSend?.file.name}`;
    } else {
      userMessageContent = text;
    }

    // Add user message to context FIRST (saves to localStorage + backend if logged in)
    addMessage({ 
      role: 'user', 
      content: userMessageContent, 
      previewUrl: hasImage ? imageToSend?.previewUrl : undefined 
    });

    setLoading(true);

    try {
      // Use streaming to show thinking process
      const imageId = hasImage ? await chatApi.uploadImage(imageToSend!.file).then(r => r.image_id) : undefined;
      
      const stream = chatApi.chatStream(
        text || (hasImage ? 'Find items similar to this image' : ''),
        imageId,
        chatSessionId,
        authSessionId,
        { gender: gender || undefined, category: category || undefined, query: query || undefined },
      );

      let finalReply = '';
      let products: chatApi.Product[] = [];
      let sections: chatApi.ProductSection[] = [];
      let shopFilter: chatApi.ShopFilter | undefined;

      for await (const event of stream) {
        if (event.type === 'thinking_start' || event.type === 'thinking') {
          if (event.content) {
            setThinkingSteps(prev => [...prev, { kind: 'thinking', content: event.content! }]);
          }
        } else if (event.type === 'tool_call') {
          if (event.content) {
            setThinkingSteps(prev => [...prev, { kind: 'tool_call', content: event.content!, tool: event.tool }]);
          }
        } else if (event.type === 'tool_result') {
          if (event.content) {
            setThinkingSteps(prev => [...prev, { kind: 'tool_result', content: event.content!, tool: event.tool }]);
          }
        } else if (event.type === 'found_products') {
          if (event.content) {
            setThinkingSteps(prev => [...prev, { kind: 'tool_result', content: event.content! }]);
          }
        } else if (event.type === 'final') {
          finalReply = event.reply || '';
          products = event.products || [];
          sections = event.sections || [];
          shopFilter = event.filter;

          // Agent may still apply gender/category filter to help the shop page
          // but never writes into the search bar — that belongs to the human.
          if (shopFilter) {
            if (shopFilter.gender) setGender(shopFilter.gender);
            if (shopFilter.category) setCategory(shopFilter.category);
          }
        }
      }

      if (finalReply) {
        addMessage({ role: 'assistant', content: finalReply, products, sections });
      }
    } catch (err) {
      console.error('Chat error:', err);
      addMessage({
        role: 'assistant',
        content: 'Could not reach the server. Make sure the backend is running.',
      });
    } finally {
      setLoading(false);
      setTimeout(() => setShowThinking(false), 2000);
    }
  }

  // ── Handle image file selection (preview only, don't send) ───────────────

  function handleImageFile(file: File) {
    if (loading) return;
    const previewUrl = URL.createObjectURL(file);
    setPendingImage({ file, previewUrl });
  }

  // ── Remove pending image ─────────────────────────────────────────────────

  function removePendingImage() {
    if (pendingImage) {
      URL.revokeObjectURL(pendingImage.previewUrl);
      setPendingImage(null);
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
                {/* Sectioned product results */}
                {msg.sections && msg.sections.length > 0 ? (
                  <div className="chat-sections">
                    {msg.sections.map((section) => {
                      const isOpen = expandedSections.has(`${msg.id}-${section.id}`);
                      const toggle = () => setExpandedSections(prev => {
                        const next = new Set(prev);
                        const key = `${msg.id}-${section.id}`;
                        next.has(key) ? next.delete(key) : next.add(key);
                        return next;
                      });
                      return (
                        <div key={section.id} className="chat-section">
                          <button className="chat-section-header" onClick={toggle}>
                            <span className="chat-section-label">{section.label}</span>
                            <span className="chat-section-meta">
                              {section.products.length > 0
                                ? `${section.products.length} pieces`
                                : 'not in archive'}
                            </span>
                            {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          </button>
                          {isOpen && (
                            <div className="chat-section-body">
                              {section.products.length === 0 ? (
                                <p className="chat-section-empty">
                                  This category is not currently represented in our archive.
                                </p>
                              ) : (
                                <div className="chat-products">
                                  {section.products.map((p) => (
                                    <Link key={p.product_id} to={`/product/${p.product_id}`} className="chat-product-card">
                                      <div className="chat-product-img">
                                        <img
                                          src={chatApi.productImageUrl(p.image_url)}
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
                                      </div>
                                    </Link>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : msg.products && msg.products.length > 0 ? (
                  <div className="chat-products">
                    {msg.products.map((p) => (
                      <Link key={p.product_id} to={`/product/${p.product_id}`} className="chat-product-card">
                        <div className="chat-product-img">
                          <img
                            src={chatApi.productImageUrl(p.image_url)}
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
                          {p.similarity !== undefined && p.similarity > 0 && p.similarity < 1 && (
                            <p className="chat-product-match">
                              {Math.round(p.similarity * 100)}% match
                            </p>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}

            {/* Live thought process — visible for the full duration of loading */}
            {(loading || showThinking) && (
              <div className="chat-message assistant">
                <div className="chat-thinking-bubble">
                  <div className="chat-thinking-header">
                    {loading
                      ? <Loader2 size={12} className="spin" />
                      : <Sparkles size={12} />}
                    <span>{loading ? 'Thinking…' : 'Done'}</span>
                  </div>
                  <div className="chat-thinking-steps">
                    {thinkingSteps.length === 0 && loading && (
                      <div className="chat-thinking-step chat-thinking-step--thinking">
                        <span className="chat-thinking-arrow">→</span>
                        <span className="chat-thinking-pulse">Reading your request…</span>
                      </div>
                    )}
                    {thinkingSteps.map((step, i) => (
                      <div key={i} className={`chat-thinking-step chat-thinking-step--${step.kind} chat-thinking-step--in`}>
                        {step.kind === 'tool_call'   && <Wrench size={10} className="chat-thinking-icon" />}
                        {step.kind === 'tool_result' && <span className="chat-thinking-check">✓</span>}
                        {step.kind === 'thinking'    && <span className="chat-thinking-arrow">→</span>}
                        <span>{step.content}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Pending image preview */}
          {pendingImage && (
            <div className="chat-pending-image">
              <img src={pendingImage.previewUrl} alt="Pending upload" />
              <button
                className="chat-remove-image"
                onClick={removePendingImage}
                disabled={loading}
                aria-label="Remove image"
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}

          {/* Input row */}
          <div className="chat-input-row">
            <button
              className="chat-img-btn"
              onClick={() => fileRef.current?.click()}
              disabled={loading || !!pendingImage}
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
              placeholder={pendingImage ? "Add a description (optional)…" : "Describe what you're looking for…"}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              disabled={loading}
            />
            <button
              className="chat-send-btn"
              onClick={handleSend}
              disabled={loading || (!input.trim() && !pendingImage)}
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
