import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { Calendar, User, Clock, ArrowLeft } from 'lucide-react'
import * as fashionApi from '../services/fashionApi'

export default function BlogPost() {
  const { id } = useParams<{ id: string }>()  // "id" param = slug
  const navigate = useNavigate()
  const [post, setPost] = useState<fashionApi.JournalPost | null>(null)
  const [related, setRelated] = useState<fashionApi.JournalPost[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    window.scrollTo(0, 0)
    setLoading(true)
    fashionApi.getJournalPost(id)
      .then(p => {
        setPost(p)
        return fashionApi.getJournalList()
      })
      .then(list => {
        setRelated(list.posts.filter(p => p.slug !== id).slice(0, 3))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  if (loading) return (
    <div className="blog-post-page">
      <div className="container">
        <div style={{ padding: '4rem 0', textAlign: 'center', color: 'var(--color-gray-400)' }}>
          Loading…
        </div>
      </div>
    </div>
  )

  if (!post) return (
    <div className="blog-post-page">
      <div className="container">
        <div className="post-navigation">
          <Link to="/blog" className="back-link"><ArrowLeft size={20} />Back to Journal</Link>
        </div>
        <div style={{ textAlign: 'center', padding: '4rem 0' }}>
          <h1>Post Not Found</h1>
          <p>The journal entry you're looking for doesn't exist.</p>
          <Link to="/blog" className="btn btn-primary">Return to Journal</Link>
        </div>
      </div>
    </div>
  )

  return (
    <div className="blog-post-page">
      <div className="container">
        {/* Back */}
        <div className="post-navigation">
          <button className="back-link" onClick={() => navigate(-1)}>
            <ArrowLeft size={20} /> Back to Journal
          </button>
        </div>

        {/* Header */}
        <header className="post-header">
          <div className="post-meta">
            <span className="post-category">{post.category}</span>
            <div className="post-details">
              <span className="post-author"><User size={14} />{post.author}</span>
              <span className="post-date"><Calendar size={14} />{fmt(post.date)}</span>
              <span className="post-read-time"><Clock size={14} />{post.read_time}</span>
            </div>
          </div>
          <h1 className="post-title">{post.title}</h1>
        </header>

        {/* Hero image */}
        {post.image && (
          <div className="post-featured-image">
            <img src={post.image} alt={post.title} />
          </div>
        )}

        {/* Body — rendered markdown */}
        <article className="post-content">
          <div className="post-body post-body-markdown">
            <ReactMarkdown>{post.body || ''}</ReactMarkdown>
          </div>

          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="post-tags">
              <h4>Tags:</h4>
              <div className="tags-list">
                {post.tags.map((tag, i) => <span key={i} className="tag">{tag}</span>)}
              </div>
            </div>
          )}
        </article>

        {/* Related posts */}
        {related.length > 0 && (
          <section className="related-posts">
            <h3>You Might Also Like</h3>
            <div className="related-grid">
              {related.map(rp => (
                <article key={rp.slug} className="related-card">
                  <div className="related-image">
                    <img src={rp.image} alt={rp.title} />
                    <div className="related-category">{rp.category}</div>
                  </div>
                  <div className="related-content">
                    <h4><Link to={`/blog/${rp.slug}`}>{rp.title}</Link></h4>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
