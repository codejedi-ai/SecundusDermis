import { useState, useEffect } from 'react'
import { AlertCircle } from 'lucide-react'
import { useAuth } from '../lib/auth-context'
import { getConversation, type StoredMessage } from '../services/fashionApi'
import '../styles/account.css'

/** Account transcripts via ``GET /api/conversations`` (sign-in session). */
export default function ChatLogsPanel() {
  const { session } = useAuth()
  const [messages, setMessages] = useState<StoredMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!session?.session_id) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError('')
    getConversation(session.session_id)
      .then((rows) => {
        if (!cancelled) setMessages(rows)
      })
      .catch(() => {
        if (!cancelled) setError('Could not load chat history.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [session?.session_id])

  return (
    <div className="account-section">
      <h2 className="section-title">Chat logs</h2>
      <p className="account-chat-intro">
        Stylist widget messages synced for this account (<code className="account-inline-code">GET /api/conversations</code>)
        while you are signed in. In-app chat uses your account session and streams through this API.
      </p>
      {loading && <p className="account-chat-status">Loading…</p>}
      {error && (
        <div className="form-message form-message-error">
          <AlertCircle size={16} /> {error}
        </div>
      )}
      {!loading && !error && messages.length === 0 && (
        <p className="account-chat-empty">No saved messages yet. Open stylist chat while signed in to build history here.</p>
      )}
      <ul className="account-chat-log">
        {messages.map((m, i) => (
          <li key={`${m.timestamp}-${i}`} className={`account-chat-turn account-chat-turn--${m.role}`}>
            <div className="account-chat-turn-head">
              <span className="account-chat-role">{m.role}</span>
              <time className="account-chat-time" dateTime={new Date(m.timestamp).toISOString()}>
                {new Date(m.timestamp).toLocaleString()}
              </time>
            </div>
            <div className="account-chat-body">{m.content}</div>
          </li>
        ))}
      </ul>
    </div>
  )
}
