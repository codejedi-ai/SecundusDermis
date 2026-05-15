import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { ImagePlus, Loader2, MessageCircle, Send, X, Trash2, Sparkles, Wrench, ChevronDown, ChevronRight } from 'lucide-react';
import * as chatApi from '../services/chatApi';
import { shopContextForChatRequest } from '../lib/shopBridge';
import { useShop } from '../lib/shop-context';
import { useConvo, SD_CHAT_OPEN_EVENT } from '../lib/convo-context';
import { useAuth } from '../lib/auth-context';
import { useSocket } from '../lib/socket-context';
import {
  fingerprintProductIds,
  fingerprintStylistReply,
  shouldSkipDuplicateFoundProducts,
  shouldSkipDuplicateStylistReply,
} from '../lib/stylistSocketDedupe';
import { userFacingChatSendError } from '../lib/chat-copy';

const FALLBACK_IMAGE = '/img/placeholder.svg';

interface PendingImage {
  file: File;
  previewUrl: string;
}

interface ThinkingStep {
  kind: 'thinking' | 'tool_call' | 'tool_result';
  content: string;
  tool?: string;
}


export type ChatWidgetVariant = 'floating' | 'embedded';

export default function ChatWidget({ variant = 'floating' }: { variant?: ChatWidgetVariant }) {
  const { messages, chatSessionId, addMessage } = useConvo();
  const { session } = useAuth();
  const authSessionId = session?.session_id;
  const [sendBlockedHint, setSendBlockedHint] = useState<string | null>(null);
  const sendHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const embedded = variant === 'embedded';
  const [open, setOpen] = useState(embedded);
  const [input, setInput] = useState('');
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const [loading, setLoading] = useState(false);
  const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([]);
  const [showThinking, setShowThinking] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const { gender, category, query, setGender, setCategory } = useShop();
  const {
    connected,
    lastStylistCatalog,
    clearStylistCatalog,
    lastStylistFound,
    clearStylistFound,
    lastStylistReply,
    clearStylistReply,
  } = useSocket();

  const sseFinalFingerprintRef = useRef<string | null>(null);
  const seenFoundProductFingerprintsRef = useRef<Set<string>>(new Set());

  // Live catalog line in the thinking panel while the stream is in flight.
  useEffect(() => {
    if (!loading || !lastStylistCatalog) return;
    const n = lastStylistCatalog.products.length;
    const hint = `Live catalog (${n} items, ${lastStylistCatalog.mode})`;
    setThinkingSteps((prev) => {
      if (prev.some((s) => s.content === hint)) return prev;
      return [...prev, { kind: 'thinking', content: hint }];
    });
  }, [loading, lastStylistCatalog]);

  useEffect(() => {
    if (loading) return;
    if (lastStylistCatalog) clearStylistCatalog();
  }, [loading, lastStylistCatalog, clearStylistCatalog]);

  // Mid-turn product cards from Socket.IO (dedupe vs SSE found_products by product ids).
  useEffect(() => {
    if (!lastStylistFound) return;
    const products = lastStylistFound.products;
    if (
      shouldSkipDuplicateFoundProducts({
        socketProducts: products,
        seenFingerprints: seenFoundProductFingerprintsRef.current,
      })
    ) {
      clearStylistFound();
      return;
    }
    seenFoundProductFingerprintsRef.current.add(fingerprintProductIds(products));
    addMessage({
      role: 'assistant',
      content: lastStylistFound.content,
      products,
    });
    clearStylistFound();
  }, [lastStylistFound, addMessage, clearStylistFound]);

  // Final assistant message from Socket.IO when SSE is absent (e.g. other tab) or skip if duplicate of SSE final.
  useEffect(() => {
    if (!lastStylistReply || loading) return;
    const { reply, products } = lastStylistReply;
    const list = products ?? [];
    if (
      shouldSkipDuplicateStylistReply({
        socketReply: reply,
        socketProducts: list,
        sseFinalFingerprint: sseFinalFingerprintRef.current,
      })
    ) {
      clearStylistReply();
      return;
    }
    addMessage({ role: 'assistant', content: reply, products: list });
    clearStylistReply();
  }, [lastStylistReply, loading, addMessage, clearStylistReply]);

  useEffect(() => {
    if (embedded) setOpen(true);
  }, [embedded]);

  useEffect(() => {
    const open = () => setOpen(true);
    window.addEventListener(SD_CHAT_OPEN_EVENT, open);
    return () => window.removeEventListener(SD_CHAT_OPEN_EVENT, open);
  }, []);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, loading, pendingImage]);

  // ── Send message (text + optional image) ─────────────────────────────────

  async function handleSend() {
    const text = input.trim();
    const hasImage = !!pendingImage;

    // Require at least text or image
    if ((!text && !hasImage) || loading) return;

    if (!authSessionId) {
      if (sendHintTimerRef.current) clearTimeout(sendHintTimerRef.current);
      setSendBlockedHint('Sign in to send messages.');
      sendHintTimerRef.current = setTimeout(() => {
        setSendBlockedHint(null);
        sendHintTimerRef.current = null;
      }, 5000);
      return;
    }

    sseFinalFingerprintRef.current = null;
    seenFoundProductFingerprintsRef.current.clear();

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
      const historyForApi: chatApi.ChatMessage[] = messages
        .filter((m) => m.id !== 'init')
        .map((m) => ({ role: m.role, content: m.content }));

      // Use streaming to show thinking process
      const imageId = hasImage
        ? await chatApi.uploadImageBrowserSession(imageToSend!.file, authSessionId).then((r) => r.image_id)
        : undefined;

      const stream = chatApi.chatStreamBrowserSession(
        text || (hasImage ? 'Find items similar to this image' : ''),
        imageId,
        chatSessionId,
        authSessionId,
        shopContextForChatRequest({ gender, category, query }),
        authSessionId,
        historyForApi,
      );

      let finalReply = '';
      let products: chatApi.Product[] = [];
      let sections: chatApi.ProductSection[] = [];
      let shopFilter: chatApi.ShopFilter | undefined;
      let sawFinalEvent = false;

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
            // If individual products are sent mid-stream (via show_product tool), add them as a message
            if (event.products && event.products.length > 0) {
              const fp = fingerprintProductIds(event.products);
              if (!seenFoundProductFingerprintsRef.current.has(fp)) {
                seenFoundProductFingerprintsRef.current.add(fp);
                addMessage({
                  role: 'assistant',
                  content: event.content,
                  products: event.products,
                });
              }
            }
          }
        } else if (event.type === 'final') {
          sawFinalEvent = true;
          finalReply = event.reply || '';
          products = event.products || [];
          sections = event.sections || [];
          shopFilter = event.filter;

          // Agent may still apply gender/category filter to help the shop page
          // but never writes into the search bar — that belongs to the human.
          if (shopFilter) {
            if ('gender' in shopFilter) setGender(shopFilter.gender ?? '');
            if ('category' in shopFilter) setCategory(shopFilter.category ?? '');
            const hasSidebar =
              !!(shopFilter.gender && String(shopFilter.gender).trim()) ||
              !!(shopFilter.category && String(shopFilter.category).trim());
            if (hasSidebar && location.pathname !== '/shop') {
              navigate('/shop');
            }
          }
        }
      }

      const trimmed = finalReply.trim();
      const hasFinalPayload =
        trimmed.length > 0 ||
        (products?.length ?? 0) > 0 ||
        (sections?.length ?? 0) > 0;

      if (hasFinalPayload) {
        addMessage({
          role: 'assistant',
          content: trimmed || 'Pieces from the archive:',
          products,
          sections,
        });
        sseFinalFingerprintRef.current = fingerprintStylistReply(trimmed || '(products)', products);
      } else if (sawFinalEvent) {
        sseFinalFingerprintRef.current = null;
        addMessage({
          role: 'assistant',
          content: 'No default agent selected.',
        });
      } else {
        sseFinalFingerprintRef.current = null;
      }
    } catch (err) {
      console.error('Chat error:', err);
      addMessage({
        role: 'assistant',
        content: userFacingChatSendError(err),
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
    <div className={`chat-widget${embedded ? ' chat-widget--embedded' : ''}`}>
      {open && (
        <div className={`chat-panel${embedded ? ' chat-panel--embedded' : ''}`}>
          {/* Header */}
          <div className="chat-header">
            <div className="chat-header-info">
              <span className="chat-title">Stylist</span>
              <span className={`chat-status ${connected ? 'online' : 'offline'}`}>
                {connected ? 'Live' : 'Offline'}
              </span>
            </div>
            {!embedded && (
              <button className="chat-close" onClick={() => setOpen(false)} aria-label="Close chat">
                <X size={18} />
              </button>
            )}
          </div>

          <p className="chat-realtime-caption" role="status">
            {connected
              ? 'Live WebSocket is up for this chat session — stylist replies and product cards can update here in real time.'
              : 'Live WebSocket disconnected — reconnecting… Real-time updates in this panel will resume when the link is back.'}
          </p>

          {!session && (
            <div className="chat-patron-hint" role="note">
              <Link to="/sign-in">Sign in</Link>
              <span> to send messages. Your session sends each turn to the API; the live WebSocket on this chat session delivers stylist updates into the thread in real time.</span>
            </div>
          )}

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
            {sendBlockedHint && (
              <div className="chat-send-block-hint" role="status">
                {sendBlockedHint}
              </div>
            )}
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

      {!embedded && (
        <button
          className="chat-toggle"
          onClick={() => setOpen((prev) => !prev)}
          aria-label={open ? 'Close chat' : 'Open AI fashion assistant'}
        >
          {open ? <X size={22} /> : <MessageCircle size={22} />}
        </button>
      )}
    </div>
  );
}
