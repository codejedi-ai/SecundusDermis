import { useState, useEffect, useCallback } from 'react';
import { Key, Trash2, Copy, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../lib/auth-context';
import {
  getPatronAgentChatApiKey,
  setPatronAgentChatApiKey,
} from '../lib/patron-agent-chat-key';
import {
  listAgentApiKeys,
  createAgentApiKey,
  revokeAgentApiKey,
  type AgentApiKeyMeta,
} from '../services/fashionApi';
import '../styles/account.css';

/**
 * Patron agent API keys + in-browser ``sdag_…`` storage (same behavior as the former Account section).
 */
export default function AgentApiKeysPanel() {
  const { session } = useAuth();
  const sessionId = session?.session_id;
  const [keys, setKeys] = useState<AgentApiKeyMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [label, setLabel] = useState('');
  const [newToken, setNewToken] = useState<string | null>(null);
  const [inBrowserKeyDraft, setInBrowserKeyDraft] = useState('');
  const [inBrowserKeyNotice, setInBrowserKeyNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError('');
    setLoading(true);
    if (!sessionId) {
      setKeys([]);
      setLoading(false);
      return;
    }
    try {
      const r = await listAgentApiKeys(sessionId);
      setKeys(r.keys ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load API keys');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    setInBrowserKeyDraft(getPatronAgentChatApiKey() ?? '');
  }, []);

  const handleCreate = async () => {
    if (!sessionId) return;
    setBusy(true);
    setError('');
    try {
      const r = await createAgentApiKey(label.trim(), sessionId);
      setNewToken(r.token);
      setLabel('');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!sessionId) return;
    if (!window.confirm('Revoke this key? Tools using it will stop working.')) return;
    setBusy(true);
    setError('');
    try {
      await revokeAgentApiKey(id, sessionId);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Revoke failed');
    } finally {
      setBusy(false);
    }
  };

  if (!sessionId) {
    return (
      <div className="account-section">
        <h2 className="section-title">AI agent API keys</h2>
        <div className="form-message form-message-error" style={{ marginTop: '1rem' }}>
          <AlertCircle size={16} /> Missing session for API requests. Please sign out and sign in again.
        </div>
      </div>
    );
  }

  return (
    <div className="account-section">
      <h2 className="section-title">AI agent API keys</h2>
      <p style={{ color: 'var(--muted, #64748b)', marginBottom: '1rem', maxWidth: '42rem' }}>
        Managing keys here uses your signed-in browser session only. External agents and scripts never use that session: they call{' '}
        <code style={{ fontSize: '0.85em' }}>GET /api/patron/agent/me</code> and{' '}
        <code style={{ fontSize: '0.85em' }}>GET /api/patron/agent/context</code> with{' '}
        <code style={{ fontSize: '0.85em' }}>Authorization: Bearer &lt;your key&gt;</code> or{' '}
        <code style={{ fontSize: '0.85em' }}>X-Patron-Agent-Api-Key</code>. The full secret is shown only once when you generate a key.
        The floating patron chat panel also calls <code style={{ fontSize: '0.85em' }}>POST /api/patron/agent/chat/stream</code> with the same key.
      </p>

      {newToken && (
        <div className="form-message form-message-success" style={{ marginBottom: '1rem' }}>
          <strong>New key (copy now — it will not be shown again):</strong>
          <pre
            style={{
              marginTop: '0.5rem',
              padding: '0.75rem',
              background: '#0f172a',
              color: '#e2e8f0',
              borderRadius: 6,
              overflow: 'auto',
              fontSize: '0.8rem',
            }}
          >
            {newToken}
          </pre>
          <button
            type="button"
            className="btn btn-primary"
            style={{ marginTop: '0.5rem' }}
            onClick={() => {
              void navigator.clipboard.writeText(newToken);
            }}
          >
            <Copy size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            Copy to clipboard
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ marginLeft: '0.5rem', marginTop: '0.5rem' }}
            onClick={() => {
              setPatronAgentChatApiKey(newToken);
              setInBrowserKeyDraft(newToken);
              setInBrowserKeyNotice('Saved locally for in-browser chat.');
            }}
          >
            Use for in-browser chat
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ marginLeft: '0.5rem', marginTop: '0.5rem' }}
            onClick={() => setNewToken(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      <div style={{ marginBottom: '1.5rem', maxWidth: '42rem' }}>
        <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>In-browser patron chat (this device)</h3>
        <p style={{ color: 'var(--muted, #64748b)', marginBottom: '0.75rem', fontSize: '0.9rem' }}>
          Paste a <code style={{ fontSize: '0.85em' }}>sdag_…</code> key to store it in this browser only (localStorage). Required to send messages from the floating patron chat panel.
        </p>
        <div className="form-group">
          <label htmlFor="in-browser-patron-key-agents">Patron agent API key</label>
          <input
            id="in-browser-patron-key-agents"
            type="password"
            className="form-input"
            autoComplete="off"
            spellCheck={false}
            value={inBrowserKeyDraft}
            onChange={(e) => setInBrowserKeyDraft(e.target.value)}
            placeholder="sdag_…"
          />
        </div>
        <button
          type="button"
          className="btn btn-primary"
          style={{ marginRight: '0.5rem' }}
          onClick={() => {
            setPatronAgentChatApiKey(inBrowserKeyDraft.trim() || null);
            setInBrowserKeyNotice('Saved locally for in-browser chat.');
          }}
        >
          Save for in-browser chat
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            setPatronAgentChatApiKey(null);
            setInBrowserKeyDraft('');
            setInBrowserKeyNotice('Cleared stored key.');
          }}
        >
          Clear stored key
        </button>
        {inBrowserKeyNotice && (
          <div className="form-message form-message-success" style={{ marginTop: '0.75rem' }}>
            <CheckCircle size={16} /> {inBrowserKeyNotice}
          </div>
        )}
      </div>

      <div className="account-form" style={{ marginBottom: '1.5rem' }}>
        <div className="form-group">
          <label htmlFor="agent-key-label-agents">Label (optional)</label>
          <input
            id="agent-key-label-agents"
            type="text"
            className="form-input"
            placeholder="e.g. Home assistant"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={80}
          />
        </div>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || !sessionId}
          onClick={() => void handleCreate()}
        >
          <Key size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
          {busy ? 'Working…' : 'Generate new key'}
        </button>
      </div>

      {error && (
        <div className="form-message form-message-error" style={{ marginBottom: '1rem' }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {loading ? (
        <p>Loading keys…</p>
      ) : keys.length === 0 ? (
        <p style={{ color: 'var(--muted, #64748b)' }}>No keys yet. Generate one to let an agent call the API as you.</p>
      ) : (
        <ul className="session-list" style={{ listStyle: 'none', padding: 0 }}>
          {keys.map((k) => (
            <li key={k.id} className="session-item" style={{ marginBottom: '0.5rem' }}>
              <div className="session-info">
                <strong>{k.label}</strong>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem' }}>
                  <code>{k.prefix}</code>
                  {' · '}
                  {new Date((k.created_at || 0) * 1000).toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={() => void handleRevoke(k.id)}
                title="Revoke key"
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
