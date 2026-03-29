import { Link } from 'react-router-dom'
import { Bot, Search, ImageIcon, BookOpen, MessageSquare } from 'lucide-react'

const features = [
  {
    icon: <MessageSquare size={22} />,
    title: 'Conversational AI Agent',
    description:
      'A Google ADK + Gemini-powered agent that understands natural language, calls search tools, and returns grounded product recommendations — never hallucinating details it hasn\'t retrieved.',
  },
  {
    icon: <Search size={22} />,
    title: 'Keyword Search',
    description:
      'Instant full-catalog search across 12,278 product descriptions with zero API cost. Every query runs as pure in-memory string matching.',
  },
  {
    icon: <ImageIcon size={22} />,
    title: 'Visual Search',
    description:
      'Upload a photo and the agent uses Gemini VLM to extract clothing keywords, then re-ranks candidates using colour histogram similarity — one API call per image search.',
  },
  {
    icon: <BookOpen size={22} />,
    title: 'Living Journal',
    description:
      'Editorial articles stored as markdown files on the backend. The AI agent can search and surface them in conversation. New posts can be published through the built-in editor at /blog/new.',
  },
  {
    icon: <Bot size={22} />,
    title: 'Simulated Storefront',
    description:
      'The "brand" is a fictional prop. The 12,278 products come from the public DeepFashion Multimodal dataset on Kaggle, downloaded automatically on first server start.',
  },
]

const About = () => {
  return (
    <div className="about-page">
      {/* Hero */}
      <section className="about-hero">
        <div className="about-hero-image">
          <img src="/hero.jpeg" alt="Hero" />
        </div>

        <div className="about-hero-content">
          <span className="about-label">What is this?</span>
          <h1 className="about-title">An AI Agent Playground</h1>
          <p className="about-subtitle">
            Secundus Dermis is not a real clothing brand. It is a demonstration
            environment for exploring how a conversational AI agent handles
            customer support and product discovery in a simulated fashion boutique.
          </p>
        </div>
      </section>

      {/* Purpose */}
      <section className="about-mission">
        <div className="mission-inner">
          <div className="mission-content">
            <span className="mission-label">Purpose</span>
            <h2 className="mission-title">Built to Explore AI-Powered Support</h2>
            <p className="mission-text">
              This project demonstrates how a modern AI agent can handle the full
              surface area of e-commerce customer support: browsing a large catalog,
              answering product questions with grounded facts, searching by image,
              surfacing editorial content, and maintaining conversation context
              across page navigation — all with minimal API spend.
            </p>
            <p className="mission-text">
              The chat widget in the bottom-right corner is the core of the demo.
              Try asking about products, requesting styling advice, or uploading a
              photo to search visually. Every agent response is backed by a real
              tool call — no fabricated details.
            </p>
            <p className="mission-text">
              The site is also designed to be a target environment for external AI
              agents. Agents such as <strong>NanoClaw</strong> and{' '}
              <strong>OpenClaw</strong> can connect via WebSocket, read a machine-readable
              markdown manifest describing available capabilities, and autonomously drive
              browsing, search, and support scenarios — making this a live testbed for
              multi-agent orchestration and automated customer support evaluation.
            </p>
          </div>
        </div>
      </section>

      {/* Feature grid */}
      <section className="about-values">
        <div className="values-inner">
          <div className="values-header">
            <span className="values-label">How it works</span>
            <h2 className="values-title">Under the Hood</h2>
          </div>
          <div className="values-grid">
            {features.map((f, i) => (
              <div key={i} className="value-item">
                <div className="value-icon">{f.icon}</div>
                <h3 className="value-title">{f.title}</h3>
                <p className="value-text">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stack */}
      <section className="about-craft">
        <div className="craft-image" />
        <div className="craft-content">
          <span className="craft-label">Tech Stack</span>
          <h2 className="craft-title">FastAPI · React · Google ADK</h2>
          <p className="craft-text">
            The backend is a FastAPI server that loads the DeepFashion dataset
            from Kaggle on first run, serves the catalog, runs the Gemini agent,
            and hosts the journal API. The frontend is a React + Vite SPA with
            infinite-scroll catalog browsing, a markdown blog, and a persistent
            chat widget that survives page navigation.
          </p>
          <p className="craft-text">
            Gemini API calls are kept to a strict minimum: one call per chat
            message (the agent LLM), and one VLM call per image search. All
            catalog search is zero-cost in-memory keyword matching.
          </p>
          <div className="craft-actions">
            <Link to="/shop" className="craft-link">
              Browse the catalog
            </Link>
            <Link to="/blog" className="craft-link craft-link-secondary">
              Read the journal
            </Link>
          </div>
        </div>
      </section>

      {/* Dataset credit */}
      <section className="about-commitment">
        <div className="commitment-inner">
          <h2 className="commitment-title">Data & Credits</h2>
          <div className="commitment-grid">
            <div className="commitment-item">
              <h3>Dataset</h3>
              <p>
                Product images and descriptions are from the{' '}
                <strong>DeepFashion Multimodal</strong> dataset published by
                silverstone1903 on Kaggle. 12,278 items across men's and women's
                categories.
              </p>
            </div>
            <div className="commitment-item">
              <h3>AI Models</h3>
              <p>
                Conversational agent and visual search powered by Google Gemini
                via the Google ADK (Agent Development Kit). Agent tool-calling
                keeps responses grounded in real catalog data.
              </p>
            </div>
            <div className="commitment-item">
              <h3>No Real Commerce</h3>
              <p>
                No products can be purchased. No orders are placed. No personal
                data is stored. This is purely a technical demonstration of
                AI-assisted customer support patterns.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default About
