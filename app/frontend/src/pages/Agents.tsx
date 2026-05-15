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
import ChatLogsPanel from '../components/ChatLogsPanel'
import '../styles/agents.css'

const PRESET_ID_SET = new Set(STYLIST_AGENT_OPTIONS.map((o) => o.id))

const SESSION_PREFIX = 'session-' as const

const INFRA_AGENTS = [{ id: 'agent-socket', label: 'WebSocket agents', icon: Radio }] as const

function normalizePanel(raw: string | null): string {
  if (!raw || raw === 'overview') return 'overview'
  if (raw === 'chat-logs') return 'chat-logs'
  if (raw === 'api-keys' || raw === 'agents') return 'api-keys'
  if (raw === 'patron-gemini' || raw === 'socket-duplex' || raw === 'agent-socket') return 'agent-socket'
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
        Chat session for stylist / shop stream
      </h2>
      <p className="agents-default-agent-lead">
        This id groups stylist chat and live shop updates for this browser. It is separate from your sign-in account
        history. Pick a preset or set your own label below.
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
  patronSocketConnected,
  registeredAgents,
  registeredAgentsLoading,
}: {
  patronSocketConnected: boolean
  registeredAgents: fashionApi.AgentApiKeyMeta[]
  registeredAgentsLoading: boolean
}) {
  const browserRow = (
    <li className="agents-live-status-row">
      <span
        className={`agents-live-status-dot ${patronSocketConnected ? 'agents-live-status-dot--on' : 'agents-live-status-dot--off'}`}
        aria-hidden
      />
      <div>
        <strong className="agents-live-status-name">Browser (shop session)</strong>
        <span
          className={`agents-live-status-badge ${
            patronSocketConnected ? 'agents-live-status-badge--on' : ''
          }`}
        >
          {patronSocketConnected ? 'Connected' : 'Disconnected'}
        </span>
        <p className="agents-live-status-desc">
          Live shop and catalog hints from this site while you use the app.
        </p>
      </div>
    </li>
  )

  const agentRows = registeredAgents.map((k) => {
    const on = Boolean(k.agent_socket_online)
    return (
      <li key={k.id} className="agents-live-status-row">
        <span className={`agents-live-status-dot ${on ? 'agents-live-status-dot--on' : 'agents-live-status-dot--off'}`} aria-hidden />
        <div>
          <strong className="agents-live-status-name">Onboarded agent — {k.label || 'Unlabeled'}</strong>
          <span className={`agents-live-status-badge ${on ? 'agents-live-status-badge--on' : ''}`}>
            {on ? 'Connected' : 'Disconnected'}
          </span>
          <p className="agents-live-status-desc">
            {on ? 'Live link to the platform for this agent.' : 'Not connected right now.'}
          </p>
        </div>
      </li>
    )
  })

  const agentsSection =
    registeredAgentsLoading ? (
      <li className="agents-live-status-row">
        <span className="agents-live-status-dot agents-live-status-dot--off" aria-hidden />
        <div>
          <strong className="agents-live-status-name">Your onboarded agents</strong>
          <span className="agents-live-status-badge">Loading…</span>
          <p className="agents-live-status-desc">Fetching connection state…</p>
        </div>
      </li>
    ) : registeredAgents.length === 0 ? (
      <li className="agents-live-status-row">
        <span className="agents-live-status-dot agents-live-status-dot--off" aria-hidden />
        <div>
          <strong className="agents-live-status-name">Your onboarded agents</strong>
          <span className="agents-live-status-badge">None</span>
          <p className="agents-live-status-desc">
            No agents onboarded yet. Use <strong>Onboarded agents</strong> in the sidebar to create an invite and add
            one.
          </p>
        </div>
      </li>
    ) : (
      agentRows
    )

  return (
    <div className="agents-live-status" role="status" aria-live="polite">
      <h2 className="agents-live-status-heading">WebSocket agents</h2>
      <p className="agents-live-status-intro">
        <strong>Green</strong> means that connection is live. Each onboarded agent can have one active link at a time.
      </p>
      <ul className="agents-live-status-list">
        {browserRow}
        {agentsSection}
      </ul>
    </div>
  )
}

function AgentsHubCards({
  onOpenRegisterAgents,
  onOpenChatLogs,
}: {
  onOpenRegisterAgents: () => void
  onOpenChatLogs: () => void
}) {
  return (
    <div className="agents-hub-grid agents-hub-grid--workspace">
      <article className="agents-hub-card">
        <div className="agents-hub-card-icon" aria-hidden>
          <Bot size={22} strokeWidth={1.75} />
        </div>
        <h3 className="agents-hub-card-title">Stylist chat</h3>
        <p className="agents-hub-card-desc">
          While signed in, each message goes through this site to the stylist. The same live WebSocket session keeps the
          chat panel updated in real time with replies, product highlights, and shop hints.
        </p>
        <div className="agents-hub-card-actions">
          <button
            type="button"
            className="agents-hub-card-link agents-hub-card-link--as-button"
            onClick={() => window.dispatchEvent(new CustomEvent(SD_CHAT_OPEN_EVENT))}
          >
            Open stylist chat <MessageCircle size={14} aria-hidden />
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
          Same <code className="agents-hub-code">session_id</code> as stylist chat. When the browser WebSocket row is green, this tab is receiving events on{' '}
          <code className="agents-hub-code">/socket.io</code>. Stylist duplex (<code className="agents-hub-code">sd_agent_service</code>) is a separate agent-side connection.
        </p>
        <span className="agents-hub-card-meta">
          Path: <code className="agents-hub-code">/socket.io</code>
        </span>
      </article>
      <article className="agents-hub-card">
        <div className="agents-hub-card-icon" aria-hidden>
          <Key size={22} strokeWidth={1.75} />
        </div>
        <h3 className="agents-hub-card-title">Onboarded agents</h3>
        <p className="agents-hub-card-desc">
          See who is connected to your account, send invites, and remove access when you need to.
        </p>
        <button type="button" className="agents-hub-card-link agents-hub-card-link--as-button" onClick={onOpenRegisterAgents}>
          Open list <ArrowRight size={14} aria-hidden />
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
        <button type="button" className="agents-hub-card-link agents-hub-card-link--as-button" onClick={onOpenChatLogs}>
          View chat logs <ArrowRight size={14} aria-hidden />
        </button>
      </article>
    </div>
  )
}

const Agents = () => {
  const { user, session } = useAuth()
  const { chatSessionId, setStylistSessionId } = useConvo()
  const { connected, emit, lastDeploymentStats } = useSocket()
  const [searchParams, setSearchParams] = useSearchParams()
  const panel = useMemo(() => normalizePanel(searchParams.get('panel')), [searchParams])

  const [registeredAgents, setRegisteredAgents] = useState<fashionApi.AgentApiKeyMeta[]>([])
  const [registeredAgentsLoading, setRegisteredAgentsLoading] = useState(false)

  const sessionId = session?.session_id

  const refreshRegisteredAgents = useCallback(() => {
    if (!sessionId) {
      setRegisteredAgents([])
      setRegisteredAgentsLoading(false)
      return
    }
    setRegisteredAgentsLoading(true)
    fashionApi
      .listRegisteredAgents(sessionId)
      .then((r) => setRegisteredAgents(r.agents ?? []))
      .catch(() => setRegisteredAgents([]))
      .finally(() => setRegisteredAgentsLoading(false))
  }, [sessionId])

  useEffect(() => {
    refreshRegisteredAgents()
  }, [refreshRegisteredAgents, lastDeploymentStats])

  const setPanel = useCallback(
    (id: string) => {
      const next = normalizePanel(id)
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev)
          if (next === 'overview') p.delete('panel')
          else if (next === 'api-keys') p.set('panel', 'agents')
          else p.set('panel', next)
          return p
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

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
      Private hub for <strong>{user?.email ?? 'your account'}</strong>. Check live connections under WebSocket agents, manage onboarded agents, pick your stylist chat session, and open stylist chat when you want.
    </p>
  )

  let workspaceBody: ReactNode = (
    <>
      <AgentsOnlineStatus
        patronSocketConnected={connected}
        registeredAgents={registeredAgents}
        registeredAgentsLoading={registeredAgentsLoading}
      />
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
          <AgentsHubCards onOpenRegisterAgents={() => setPanel('agents')} onOpenChatLogs={() => setPanel('chat-logs')} />
        </div>
      </section>
    </>
  )

  if (panel === 'api-keys') {
    workspaceTitle = 'Onboarded agents'
    workspaceLead = (
      <p className="agents-workspace-lead">
        Track everyone connected to your account. Pending rows are invites that have not finished setup yet.
      </p>
    )
    workspaceBody = <AgentApiKeysPanel onKeysMutated={refreshRegisteredAgents} />
  } else if (panel === 'chat-logs') {
    workspaceTitle = 'Chat logs'
    workspaceLead = (
      <p className="agents-workspace-lead">
        Messages saved for your account via <code className="agents-hub-code">GET /api/conversations</code> when you use stylist chat while signed in.
      </p>
    )
    workspaceBody = (
      <div className="agents-workspace-section agents-workspace-section--chat-logs">
        <ChatLogsPanel />
      </div>
    )
  } else if (panel === 'agent-socket') {
    workspaceTitle = 'WebSocket agents'
    workspaceLead = (
      <p className="agents-workspace-lead">
        <strong>Green</strong> dot and <strong>Connected</strong> mean that path is up. The first row is this browser; other rows are onboarded agents using the platform link.
      </p>
    )
    workspaceBody = (
      <AgentsOnlineStatus
        patronSocketConnected={connected}
        registeredAgents={registeredAgents}
        registeredAgentsLoading={registeredAgentsLoading}
      />
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
                  onClick={() => setPanel('agents')}
                >
                  <Key size={16} aria-hidden />
                  <span>Onboarded agents</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className={`agents-panel-item ${panel === 'chat-logs' ? 'agents-panel-item--active' : ''}`}
                  onClick={() => setPanel('chat-logs')}
                >
                  <MessageSquare size={16} aria-hidden />
                  <span>Chat logs</span>
                </button>
              </li>
            </ul>

            <p className="agents-panel-nav-heading">WebSocket agents</p>
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
              Open stylist chat
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
