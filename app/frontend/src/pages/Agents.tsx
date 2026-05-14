import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowRight,
  Bot,
  Cpu,
  Key,
  LayoutDashboard,
  MessageCircle,
  MessageSquare,
  Radio,
} from 'lucide-react'
import { useAuth } from '../lib/auth-context'
import { useSocket } from '../lib/socket-context'
import * as fashionApi from '../services/fashionApi'
import { SD_CHAT_OPEN_EVENT, useConvo } from '../lib/convo-context'
import {
  STYLIST_AGENT_OPTIONS,
  sanitizeStylistSessionId,
} from '../lib/stylist-session'
import AgentApiKeysPanel from '../components/AgentApiKeysPanel'
import '../styles/agents.css'

const PRESET_ID_SET = new Set(STYLIST_AGENT_OPTIONS.map((o) => o.id))

const SESSION_PREFIX = 'session-' as const

const INFRA_AGENTS = [
  { id: 'patron-gemini', label: 'Patron agent (Gemini)', icon: Bot },
  { id: 'socket-duplex', label: 'Agent duplex (Socket.IO)', icon: Radio },
] as const

function normalizePanel(raw: string | null): string {
  if (!raw || raw === 'overview') return 'overview'
  if (raw === 'api-keys') return 'api-keys'
  if (raw === 'patron-gemini' || raw === 'socket-duplex') return raw
  if (raw.startsWith(SESSION_PREFIX)) {
    const sid = raw.slice(SESSION_PREFIX.length)
    if (PRESET_ID_SET.has(sid)) return raw
  }
  return 'overview'
}

function AgentsDefaultStylistPicker() {
  const { chatSessionId, setStylistSessionId } = useConvo()
  const isPreset = PRESET_ID_SET.has(chatSessionId)
  const [customDraft, setCustomDraft] = useState(chatSessionId)

  useEffect(() => {
    if (!PRESET_ID_SET.has(chatSessionId)) setCustomDraft(chatSessionId)
  }, [chatSessionId])

  return (
    <section className="agents-default-agent" aria-labelledby="agents-default-agent-heading">
      <h2 id="agents-default-agent-heading" className="agents-default-agent-title">
        Chat session for patron stream
      </h2>
      <p className="agents-default-agent-lead">
        This browser sends the chosen id as <code className="agents-hub-code">session_id</code> on{' '}
        <code className="agents-hub-code">POST /api/patron/agent/chat/stream</code> (with your <code className="agents-hub-code">sdag_…</code> key) and joins Socket.IO room{' '}
        <code className="agents-hub-code">sd_&lt;session_id&gt;</code>. Account transcripts still use{' '}
        <code className="agents-hub-code">GET /api/conversations</code> (sign-in session), not this id.
      </p>

      <div className="agents-default-agent-row">
        <label htmlFor="agents-stylist-preset" className="agents-default-agent-label">
          Preset
        </label>
        <select
          id="agents-stylist-preset"
          className="agents-default-agent-select"
          value={isPreset ? chatSessionId : ''}
          onChange={(e) => {
            const v = e.target.value
            if (v) setStylistSessionId(v)
          }}
        >
          <option value="">Custom id (below)</option>
          {STYLIST_AGENT_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <ul className="agents-default-agent-hints">
        {STYLIST_AGENT_OPTIONS.map((o) => (
          <li key={o.id}>
            <strong>{o.label}</strong> — {o.hint}
          </li>
        ))}
      </ul>

      <div className="agents-default-agent-row agents-default-agent-row--custom">
        <label htmlFor="agents-stylist-custom" className="agents-default-agent-label">
          Custom session id
        </label>
        <div className="agents-default-agent-custom">
          <input
            id="agents-stylist-custom"
            type="text"
            className="agents-default-agent-input"
            placeholder="e.g. my_eval_run"
            maxLength={64}
            value={customDraft}
            onChange={(e) => setCustomDraft(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            className="btn btn-secondary agents-default-agent-apply"
            onClick={() => setStylistSessionId(sanitizeStylistSessionId(customDraft))}
          >
            Apply custom
          </button>
        </div>
      </div>

      <p className="agents-default-agent-active">
        Active session id: <code className="agents-hub-code">{chatSessionId}</code>
        {!isPreset ? ' (custom)' : null}
      </p>
    </section>
  )
}

function AgentsOnlineStatus({
  stats,
  filter,
}: {
  stats: fashionApi.CatalogStats
  filter?: 'patron-gemini' | 'socket-duplex' | null
}) {
  const socketCount = stats.agent_socket_online_count ?? 0
  const socketOnline = socketCount > 0

  const stylistHttpOk = stats.agent_proxy === true && stats.stylist_agent_http_reachable === true
  const stylistHttpWarn = stats.agent_proxy === true && stats.stylist_agent_http_reachable === false
  const stylistDotClass = stylistHttpOk ? 'on' : stylistHttpWarn ? 'warn' : 'off'

  let stylistLabel: string
  let stylistDetail: string
  if (!stats.agent_proxy) {
    stylistLabel = 'Offline'
    stylistDetail = 'Patron agent process is not configured on this API (no AGENT_SERVICE_URL).'
  } else if (stats.stylist_agent_http_reachable === true) {
    stylistLabel = 'Online'
    stylistDetail = 'Standalone patron agent is responding on its HTTP /health endpoint.'
  } else if (stats.stylist_agent_http_reachable === false) {
    stylistLabel = 'Unreachable'
    stylistDetail = 'AGENT_SERVICE_URL is set but the patron agent process did not respond to /health.'
  } else {
    stylistLabel = 'Unknown'
    stylistDetail = 'Patron agent HTTP client is not active in this API process.'
  }

  let socketLabel: string
  let socketDetail: string
  if (socketOnline) {
    socketLabel = socketCount === 1 ? '1 connection online' : `${socketCount} connections online`
    socketDetail =
      'Trusted agent client(s) joined the Socket.IO duplex room (sd_agent_service). Optional; HTTP-only agent still works.'
  } else {
    socketLabel = 'None online'
    socketDetail =
      'No trusted Socket.IO agent clients in sd_agent_service. Enable SD_AGENT_SOCKET / SD_SOCKETIO_EMIT on the agent if you use the duplex bridge.'
  }

  const patronRow = (
    <li className="agents-live-status-row">
      <span className={`agents-live-status-dot agents-live-status-dot--${stylistDotClass}`} aria-hidden />
      <div>
        <strong className="agents-live-status-name">Patron agent (Gemini)</strong>
        <span
          className={`agents-live-status-badge ${
            stylistHttpOk ? 'agents-live-status-badge--on' : stylistHttpWarn ? 'agents-live-status-badge--warn' : ''
          }`}
        >
          {stylistLabel}
        </span>
        <p className="agents-live-status-desc">{stylistDetail}</p>
      </div>
    </li>
  )

  const socketRow = (
    <li className="agents-live-status-row">
      <span
        className={`agents-live-status-dot ${socketOnline ? 'agents-live-status-dot--on' : 'agents-live-status-dot--off'}`}
        aria-hidden
      />
      <div>
        <strong className="agents-live-status-name">Agent duplex (Socket.IO)</strong>
        <span className={`agents-live-status-badge ${socketOnline ? 'agents-live-status-badge--on' : ''}`}>{socketLabel}</span>
        <p className="agents-live-status-desc">{socketDetail}</p>
      </div>
    </li>
  )

  return (
    <div className="agents-live-status" role="status" aria-live="polite">
      <h2 className="agents-live-status-heading">Deployment status</h2>
      <p className="agents-live-status-intro">
        From this API host (not your personal <code className="agents-hub-code">sdag_…</code> keys). Updates when trusted agent
        sockets connect or disconnect; initial load probes patron agent HTTP /health.
      </p>
      <ul className="agents-live-status-list">
        {filter === 'socket-duplex' ? socketRow : filter === 'patron-gemini' ? patronRow : (
          <>
            {patronRow}
            {socketRow}
          </>
        )}
      </ul>
    </div>
  )
}

function AgentsHubCards({
  catalogStats,
  onOpenApiKeys,
}: {
  catalogStats: fashionApi.CatalogStats | null
  onOpenApiKeys: () => void
}) {
  return (
    <div className="agents-hub-grid agents-hub-grid--workspace">
      <article className="agents-hub-card">
        <div className="agents-hub-card-icon" aria-hidden>
          <Bot size={22} strokeWidth={1.75} />
        </div>
        <h3 className="agents-hub-card-title">Patron chat (Gemini)</h3>
        <p className="agents-hub-card-desc">
          {catalogStats?.agent_proxy === true
            ? 'This deployment proxies patron chat to the standalone Gemini process — open the panel with your sdag_… key saved locally.'
            : 'When the API is configured with AGENT_SERVICE_URL, patron chat runs on the dedicated process. Until then, catalog search still works from the shop.'}
        </p>
        <div className="agents-hub-card-actions">
          <button
            type="button"
            className="agents-hub-card-link agents-hub-card-link--as-button"
            onClick={() => window.dispatchEvent(new CustomEvent(SD_CHAT_OPEN_EVENT))}
          >
            Open patron chat <MessageCircle size={14} aria-hidden />
          </button>
          <Link to="/shop" className="agents-hub-card-link">
            Open shop <ArrowRight size={14} aria-hidden />
          </Link>
        </div>
      </article>
      <article className="agents-hub-card">
        <div className="agents-hub-card-icon" aria-hidden>
          <Radio size={22} strokeWidth={1.75} />
        </div>
        <h3 className="agents-hub-card-title">Live channel</h3>
        <p className="agents-hub-card-desc">
          Patron chat can receive <code className="agents-hub-code">shop_sync</code>, product highlights, and navigation hints over Socket.IO — same{' '}
          <code className="agents-hub-code">session_id</code> as the stream request when connected.
        </p>
        <span className="agents-hub-card-meta">
          Path: <code className="agents-hub-code">/socket.io</code>
        </span>
      </article>
      <article className="agents-hub-card">
        <div className="agents-hub-card-icon" aria-hidden>
          <Key size={22} strokeWidth={1.75} />
        </div>
        <h3 className="agents-hub-card-title">Patron API keys</h3>
        <p className="agents-hub-card-desc">
          Mint and revoke <code className="agents-hub-code">sdag_…</code> keys for scripts and in-browser patron chat — use the control panel → API keys.
        </p>
        <button type="button" className="agents-hub-card-link agents-hub-card-link--as-button" onClick={onOpenApiKeys}>
          Open API keys <ArrowRight size={14} aria-hidden />
        </button>
      </article>
      <article className="agents-hub-card">
        <div className="agents-hub-card-icon" aria-hidden>
          <MessageSquare size={22} strokeWidth={1.75} />
        </div>
        <h3 className="agents-hub-card-title">Chat logs</h3>
        <p className="agents-hub-card-desc">
          When signed in, widget messages sync under <code className="agents-hub-code">GET /api/conversations</code>.
        </p>
        <Link to="/account?section=chat-logs" className="agents-hub-card-link">
          View chat logs <ArrowRight size={14} aria-hidden />
        </Link>
      </article>
    </div>
  )
}

const Agents = () => {
  const { user } = useAuth()
  const { chatSessionId, setStylistSessionId } = useConvo()
  const { connected, emit, lastDeploymentStats } = useSocket()
  const [searchParams, setSearchParams] = useSearchParams()
  const panel = useMemo(() => normalizePanel(searchParams.get('panel')), [searchParams])

  const setPanel = useCallback(
    (id: string) => {
      const next = normalizePanel(id)
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev)
          if (next === 'overview') p.delete('panel')
          else p.set('panel', next)
          return p
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const [catalogStats, setCatalogStats] = useState<fashionApi.CatalogStats | null>(null)

  useEffect(() => {
    fashionApi.getCatalogStats().then(setCatalogStats).catch(() => setCatalogStats(null))
  }, [])

  useEffect(() => {
    if (lastDeploymentStats) setCatalogStats(lastDeploymentStats)
  }, [lastDeploymentStats])

  useEffect(() => {
    if (!connected) return
    emit('join_deployment_stats', {})
    return () => {
      emit('leave_deployment_stats', {})
    }
  }, [connected, emit])

  const threadStatus = (presetId: string) => {
    if (chatSessionId === presetId) return 'active'
    return 'idle'
  }

  let workspaceTitle = 'Overview'
  let workspaceLead: ReactNode = (
    <p className="agents-workspace-lead">
      Private hub for <strong>{user?.email ?? 'your account'}</strong>. Pick an agent or thread in the control panel, manage{' '}
      <strong>API keys</strong>, and open patron chat when the deployment is online.
    </p>
  )

  let workspaceBody: ReactNode = (
    <>
      {catalogStats ? (
        <AgentsOnlineStatus stats={catalogStats} />
      ) : (
        <p className="agents-live-status-loading" role="status">
          Checking deployment status…
        </p>
      )}
      <div className="agents-workspace-section">
        <AgentsDefaultStylistPicker />
      </div>
      <section className="agents-hub agents-hub--embedded" aria-labelledby="agents-hub-heading">
        <div className="agents-hub-inner">
          <div className="agents-hub-header agents-hub-header--left">
            <span className="brand-label">Shortcuts</span>
            <h2 id="agents-hub-heading" className="agents-hub-title">
              Actions
            </h2>
          </div>
          <AgentsHubCards catalogStats={catalogStats} onOpenApiKeys={() => setPanel('api-keys')} />
        </div>
      </section>
    </>
  )

  if (panel === 'api-keys') {
    workspaceTitle = 'AI agent API keys'
    workspaceLead = <p className="agents-workspace-lead">Generate, revoke, and store keys for patron HTTP and in-browser chat.</p>
    workspaceBody = <AgentApiKeysPanel />
  } else if (panel === 'patron-gemini') {
    workspaceTitle = 'Patron agent (Gemini)'
    workspaceLead = (
      <p className="agents-workspace-lead">
        Standalone process that runs Gemini tool calls. Proxied from <code className="agents-hub-code">POST /api/patron/agent/chat/stream</code>.
      </p>
    )
    workspaceBody = catalogStats ? (
      <AgentsOnlineStatus stats={catalogStats} filter="patron-gemini" />
    ) : (
      <p className="agents-live-status-loading" role="status">
        Loading…
      </p>
    )
  } else if (panel === 'socket-duplex') {
    workspaceTitle = 'Agent duplex (Socket.IO)'
    workspaceLead = (
      <p className="agents-workspace-lead">
        Optional trusted bridge in <code className="agents-hub-code">sd_agent_service</code> for live catalog hints and agent emits.
      </p>
    )
    workspaceBody = catalogStats ? (
      <AgentsOnlineStatus stats={catalogStats} filter="socket-duplex" />
    ) : (
      <p className="agents-live-status-loading" role="status">
        Loading…
      </p>
    )
  } else if (panel.startsWith(SESSION_PREFIX)) {
    const presetId = panel.slice(SESSION_PREFIX.length)
    const opt = STYLIST_AGENT_OPTIONS.find((o) => o.id === presetId)
    if (opt) {
      workspaceTitle = opt.label
      workspaceLead = <p className="agents-workspace-lead">{opt.hint}</p>
      const isActive = chatSessionId === presetId
      workspaceBody = (
        <div className="agents-thread-detail">
          <p>
            Socket.IO room: <code className="agents-hub-code">sd_{presetId}</code>
          </p>
          <p>
            Preset id: <code className="agents-hub-code">{presetId}</code>
            {isActive ? <span className="agents-thread-active-badge"> Active for this browser</span> : null}
          </p>
          <button type="button" className="btn btn-primary" onClick={() => setStylistSessionId(presetId)}>
            Use this chat session
          </button>
          <div className="agents-workspace-section">
            <AgentsDefaultStylistPicker />
          </div>
        </div>
      )
    }
  }

  return (
    <div className="agents-page">
      <div className="agents-shell">
        <aside className="agents-control-panel" aria-label="Agents control panel">
          <div className="agents-control-panel-head">
            <Cpu size={20} aria-hidden />
            <div>
              <h1 className="agents-control-panel-title">Control panel</h1>
              <p className="agents-control-panel-sub">Private · {user?.email ?? 'Account'}</p>
            </div>
          </div>

          <nav className="agents-panel-nav" aria-label="Primary">
            <p className="agents-panel-nav-heading">Workspace</p>
            <ul className="agents-panel-nav-list">
              <li>
                <button
                  type="button"
                  className={`agents-panel-item ${panel === 'overview' ? 'agents-panel-item--active' : ''}`}
                  onClick={() => setPanel('overview')}
                >
                  <LayoutDashboard size={16} aria-hidden />
                  <span>Overview</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className={`agents-panel-item ${panel === 'api-keys' ? 'agents-panel-item--active' : ''}`}
                  onClick={() => setPanel('api-keys')}
                >
                  <Key size={16} aria-hidden />
                  <span>API keys</span>
                </button>
              </li>
              <li>
                <Link
                  to="/account?section=chat-logs"
                  className="agents-panel-item agents-panel-item--link"
                >
                  <MessageSquare size={16} aria-hidden />
                  <span>Chat logs</span>
                  <ArrowRight size={14} className="agents-panel-item-chevron" aria-hidden />
                </Link>
              </li>
            </ul>

            <p className="agents-panel-nav-heading">Deployment agents</p>
            <ul className="agents-panel-nav-list">
              {INFRA_AGENTS.map((a) => {
                const Icon = a.icon
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      className={`agents-panel-item ${panel === a.id ? 'agents-panel-item--active' : ''}`}
                      onClick={() => setPanel(a.id)}
                    >
                      <Icon size={16} aria-hidden />
                      <span>{a.label}</span>
                    </button>
                  </li>
                )
              })}
            </ul>

            <p className="agents-panel-nav-heading">Chat threads</p>
            <ul className="agents-panel-nav-list">
              {STYLIST_AGENT_OPTIONS.map((o) => {
                const id = `${SESSION_PREFIX}${o.id}`
                const st = threadStatus(o.id)
                return (
                  <li key={o.id}>
                    <button
                      type="button"
                      className={`agents-panel-item agents-panel-item--thread ${panel === id ? 'agents-panel-item--active' : ''}`}
                      onClick={() => setPanel(id)}
                    >
                      <span className={`agents-thread-dot agents-thread-dot--${st}`} title={st === 'active' ? 'Active session' : ''} aria-hidden />
                      <span className="agents-panel-item-text">{o.label}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </nav>

          <div className="agents-control-panel-footer">
            <button
              type="button"
              className="btn btn-secondary agents-panel-open-chat"
              onClick={() => window.dispatchEvent(new CustomEvent(SD_CHAT_OPEN_EVENT))}
            >
              <MessageCircle size={16} aria-hidden />
              Open patron chat
            </button>
          </div>
        </aside>

        <div className="agents-workspace">
          <header className="agents-workspace-header">
            <h2 className="agents-workspace-title">{workspaceTitle}</h2>
            {workspaceLead}
          </header>
          <div className="agents-workspace-body">{workspaceBody}</div>
        </div>
      </div>
    </div>
  )
}

export default Agents
