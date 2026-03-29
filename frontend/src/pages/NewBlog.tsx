import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import '../styles/newblog.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:7860'

const CATEGORIES = [
  'Fashion Tips', 'Care Guide', 'Product Guide', 'Innovation',
  'Styling', 'Technology', 'Wellness',
]

const today = new Date().toISOString().slice(0, 10)

export default function NewBlog() {
  const navigate = useNavigate()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const [form, setForm] = useState({
    title: '',
    excerpt: '',
    author: '',
    date: today,
    read_time: '5 min read',
    category: 'Fashion Tips',
    tags: '',
    featured: false,
    image: '/img/photo-6311392.jpg',
    body: '',
  })
  const [adminKey, setAdminKey] = useState('')
  const [preview, setPreview]   = useState(false)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  // Check if user is logged in on mount
  useEffect(() => {
    const sessionId = localStorage.getItem('sd_session_id')
    if (sessionId) {
      fetch(`${API_BASE}/auth/me`, { headers: { 'session_id': sessionId } })
        .then(r => { if (r.ok) setIsAuthenticated(true) })
        .catch(() => {})
    }
    setIsLoading(false)
  }, [])

  const set = (field: string, value: string | boolean) =>
    setForm(f => ({ ...f, [field]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.title.trim() || !form.body.trim()) {
      setError('Title and body are required.')
      return
    }
    
    // Get session_id for authenticated users
    const sessionId = localStorage.getItem('sd_session_id')
    if (!sessionId && !adminKey.trim()) {
      setError('You must be logged in or provide an admin key.')
      return
    }
    
    setSaving(true)
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (sessionId) {
        headers['session_id'] = sessionId
      } else {
        headers['X-Admin-Key'] = adminKey
      }
      
      const res = await fetch(`${API_BASE}/journal`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...form,
          tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
        }),
      })
      
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Failed to save post' }))
        throw new Error(err.detail || 'Failed to save post')
      }
      
      const data = await res.json()
      navigate(`/blog/${data.slug}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save post.')
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="newblog">
        <div className="container">
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated && !adminKey) {
    return (
      <div className="newblog">
        <div className="container">
          <div className="auth-container">
            <div className="auth-header">
              <h1 className="auth-title">Sign In Required</h1>
              <p className="auth-description">Only logged-in users can create blog posts.</p>
            </div>
            <div className="auth-actions">
              <button onClick={() => navigate('/sign-in')} className="auth-button-primary">
                Sign In
              </button>
              <button onClick={() => navigate('/sign-up')} className="auth-button-secondary">
                Create Account
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="newblog">
      <div className="newblog-header">
        <h1>New Journal Entry</h1>
        <button
          className={`newblog-preview-btn ${preview ? 'active' : ''}`}
          type="button"
          onClick={() => setPreview(p => !p)}
        >
          {preview ? 'Edit' : 'Preview'}
        </button>
      </div>

      {preview ? (
        <div className="newblog-preview">
          <h2>{form.title || 'Untitled'}</h2>
          <p className="newblog-preview-meta">
            {form.author} · {form.date} · {form.category}
          </p>
          <p className="newblog-preview-excerpt">{form.excerpt}</p>
          <div className="newblog-preview-body">
            <ReactMarkdown>{form.body}</ReactMarkdown>
          </div>
        </div>
      ) : (
        <form className="newblog-form" onSubmit={handleSubmit}>
          <div className="newblog-row">
            <label className="newblog-label">Title *</label>
            <input
              className="newblog-input"
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="Article title"
            />
          </div>

          <div className="newblog-row">
            <label className="newblog-label">Excerpt</label>
            <input
              className="newblog-input"
              value={form.excerpt}
              onChange={e => set('excerpt', e.target.value)}
              placeholder="One-sentence summary shown in the blog listing"
            />
          </div>

          <div className="newblog-cols">
            <div className="newblog-row">
              <label className="newblog-label">Author</label>
              <input
                className="newblog-input"
                value={form.author}
                onChange={e => set('author', e.target.value)}
                placeholder="Dr. Jane Smith"
              />
            </div>
            <div className="newblog-row">
              <label className="newblog-label">Date</label>
              <input
                className="newblog-input"
                type="date"
                value={form.date}
                onChange={e => set('date', e.target.value)}
              />
            </div>
            <div className="newblog-row">
              <label className="newblog-label">Read time</label>
              <input
                className="newblog-input"
                value={form.read_time}
                onChange={e => set('read_time', e.target.value)}
                placeholder="5 min read"
              />
            </div>
          </div>

          <div className="newblog-cols">
            <div className="newblog-row">
              <label className="newblog-label">Category</label>
              <select
                className="newblog-input"
                value={form.category}
                onChange={e => set('category', e.target.value)}
              >
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="newblog-row">
              <label className="newblog-label">Tags (comma-separated)</label>
              <input
                className="newblog-input"
                value={form.tags}
                onChange={e => set('tags', e.target.value)}
                placeholder="Styling, Wardrobe, Tips"
              />
            </div>
          </div>

          <div className="newblog-cols">
            <div className="newblog-row">
              <label className="newblog-label">Hero image path</label>
              <input
                className="newblog-input"
                value={form.image}
                onChange={e => set('image', e.target.value)}
                placeholder="/img/photo-1234567.jpg"
              />
            </div>
            <div className="newblog-row newblog-row-check">
              <label className="newblog-check-label">
                <input
                  type="checkbox"
                  checked={form.featured}
                  onChange={e => set('featured', e.target.checked)}
                />
                Featured post
              </label>
            </div>
          </div>

          <div className="newblog-row">
            <label className="newblog-label">Body * (Markdown)</label>
            <textarea
              className="newblog-textarea"
              value={form.body}
              onChange={e => set('body', e.target.value)}
              placeholder="Write your article in Markdown…"
              rows={20}
            />
          </div>

          <div className="newblog-row">
            <label className="newblog-label">Admin key *</label>
            <input
              className="newblog-input newblog-key"
              type="password"
              value={adminKey}
              onChange={e => setAdminKey(e.target.value)}
              placeholder="Enter ADMIN_KEY from backend .env"
            />
          </div>

          {error && <p className="newblog-error">{error}</p>}

          <div className="newblog-actions">
            <button type="submit" className="newblog-submit" disabled={saving}>
              {saving ? 'Saving…' : 'Publish'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
