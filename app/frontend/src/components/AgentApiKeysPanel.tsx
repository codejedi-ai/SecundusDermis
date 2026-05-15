import { useState, useEffect, useCallback } from 'react';
import { Key, Trash2, Copy, AlertCircle } from 'lucide-react';
import { useAuth } from '../lib/auth-context';
import {
  createAgentInvite,
  listRegisteredAgents,
  revokeAgentApiKey,
  type AgentApiKeyMeta,
  type PendingAgentInvite,
} from '../services/fashionApi';
import '../styles/account.css';

/** Lists onboarded agents and pending invites for this account. */
export default function AgentApiKeysPanel({ onKeysMutated }: { onKeysMutated?: () => void }) {
  const { session } = useAuth();
  const sessionId = session?.session_id;
  const [agents, setAgents] = useState<AgentApiKeyMeta[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingAgentInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [inviteLabel, setInviteLabel] = useState('');
  const [newRegistrationCode, setNewRegistrationCode] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError('');
    setLoading(true);
    if (!sessionId) {
      setAgents([]);
      setPendingInvites([]);
      setLoading(false);
      return;
    }
    try {
      const r = await listRegisteredAgents(sessionId);
      setAgents(r.agents ?? []);
      setPendingInvites(r.pending_invites ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load list.');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleCreateInvite = async () => {
    if (!sessionId) return;
    setBusy(true);
    setError('');
    try {
      const r = await createAgentInvite(inviteLabel.trim(), sessionId);
      setNewRegistrationCode(r.registration_code);
      setInviteLabel('');
      await refresh();
      onKeysMutated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create invite.');
    } finally {
      setBusy(false);
    }
  };

  const handleRevokeAgent = async (id: string) => {
    if (!sessionId) return;
    if (!window.confirm('Remove this agent from your account? It will lose access immediately.')) return;
    setBusy(true);
    setError('');
    try {
      await revokeAgentApiKey(id, sessionId);
      await refresh();
      onKeysMutated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Remove failed.');
    } finally {
      setBusy(false);
    }
  };

  if (!sessionId) {
    return (
      <div className="account-section">
        <h2 className="section-title">Onboarded agents</h2>
        <div className="form-message form-message-error" style={{ marginTop: '1rem' }}>
          <AlertCircle size={16} /> Please sign in again to view this list.
        </div>
      </div>
    );
  }

  return (
    <div className="account-section">
      <h2 className="section-title">Onboarded agents</h2>
      <p style={{ color: 'var(--muted, #64748b)', marginBottom: '1.25rem', maxWidth: '40rem' }}>
        Everyone connected to your account shows here. Pending rows are waiting for a new system to finish setup.
      </p>

      {newRegistrationCode && (
        <div className="form-message form-message-success" style={{ marginBottom: '1.25rem', maxWidth: '40rem' }}>
          <p style={{ margin: '0 0 0.75rem' }}>
            <strong>Invite ready.</strong> Copy it into the system you are adding. It works once, then disappears from
            this list when that system finishes onboarding.
          </p>
          <label className="account-chat-intro" htmlFor="agent-invite-copy-field" style={{ display: 'block', marginBottom: '0.35rem' }}>
            Invite
          </label>
          <input
            id="agent-invite-copy-field"
            type="text"
            readOnly
            className="form-input"
            value={newRegistrationCode}
            onFocus={(e) => e.target.select()}
            style={{ fontFamily: 'inherit', marginBottom: '0.75rem' }}
          />
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              void navigator.clipboard.writeText(newRegistrationCode);
            }}
          >
            <Copy size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            Copy invite
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ marginLeft: '0.5rem' }}
            onClick={() => setNewRegistrationCode(null)}
          >
            Done
          </button>
        </div>
      )}

      <div className="account-form" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Add another agent</h3>
        <div className="form-group">
          <label htmlFor="agent-invite-label-agents">Name (optional)</label>
          <input
            id="agent-invite-label-agents"
            type="text"
            className="form-input"
            placeholder="e.g. Studio Mac"
            value={inviteLabel}
            onChange={(e) => setInviteLabel(e.target.value)}
            maxLength={80}
          />
        </div>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || !sessionId}
          onClick={() => void handleCreateInvite()}
        >
          <Key size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
          {busy ? 'Working…' : 'Create invite'}
        </button>
      </div>

      {error && (
        <div className="form-message form-message-error" style={{ marginBottom: '1rem' }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {loading ? (
        <p>Loading…</p>
      ) : (
        <>
          {pendingInvites.length > 0 && (
            <div style={{ marginBottom: '1.5rem', maxWidth: '40rem' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Pending</h3>
              <p style={{ color: 'var(--muted, #64748b)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
                These invites are not onboarded yet.
              </p>
              <ul className="session-list" style={{ listStyle: 'none', padding: 0 }}>
                {pendingInvites.map((inv) => (
                  <li key={inv.id} className="session-item" style={{ marginBottom: '0.5rem' }}>
                    <strong>{inv.label}</strong>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--muted, #64748b)' }}>
                      Added {new Date((inv.created_at || 0) * 1000).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ maxWidth: '40rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Onboarded</h3>
            {agents.length === 0 ? (
              <p style={{ color: 'var(--muted, #64748b)' }}>No agents onboarded yet.</p>
            ) : (
              <ul className="session-list" style={{ listStyle: 'none', padding: 0 }}>
                {agents.map((k) => (
                  <li key={k.id} className="session-item" style={{ marginBottom: '0.5rem' }}>
                    <div className="session-info">
                      <strong>{k.label}</strong>
                      <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--muted, #64748b)' }}>
                        Onboarded {new Date((k.created_at || 0) * 1000).toLocaleString()}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={busy}
                      onClick={() => void handleRevokeAgent(k.id)}
                      title="Remove agent"
                    >
                      <Trash2 size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
