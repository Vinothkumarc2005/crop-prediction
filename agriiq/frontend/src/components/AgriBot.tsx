import { useState, useRef, useEffect, useCallback } from 'react'
import { agribotApi } from '../api/client'
import { useAuthStore } from '../store/authStore'
import {
  Bot, X, Send, Sparkles, Leaf, CloudRain,
  Droplets, FlaskConical, TrendingUp, Satellite,
  ChevronDown, Mic, RotateCcw, ExternalLink,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Message {
  id: string
  role: 'user' | 'bot'
  content: string
  category?: string
  suggestions?: string[]
  sources?: string[]
  confidence?: number
  timestamp: Date
  typing?: boolean
}

interface AgriContext {
  fieldName?: string | null
  cropName?: string | null
  district?: string | null
  state?: string | null
  areaAcres?: number | null
  growthStage?: string | null
  soilPh?: number | null
  soilNitrogen?: number | null
  soilPhosphorus?: number | null
  soilPotassium?: number | null
  soilTexture?: string | null
  ndviMean?: number | null
  ndviTrend?: string | null
  ndviHealth?: string | null
  tempMaxC?: number | null
  tempMinC?: number | null
  rainfallMm?: number | null
  humidityPct?: number | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeId() {
  return Math.random().toString(36).slice(2)
}

function categoryIcon(cat?: string) {
  switch (cat) {
    case 'diagnosis':  return <Leaf size={12} style={{ color: 'var(--color-primary)' }} />
    case 'weather':    return <CloudRain size={12} style={{ color: 'var(--color-info)' }} />
    case 'irrigation': return <Droplets size={12} style={{ color: '#60a5fa' }} />
    case 'fertilizer': return <FlaskConical size={12} style={{ color: 'var(--color-accent)' }} />
    case 'market':     return <TrendingUp size={12} style={{ color: '#a78bfa' }} />
    default:           return <Sparkles size={12} style={{ color: 'var(--color-primary)' }} />
  }
}

// ── Markdown renderer (lightweight) ──────────────────────────────────────────
function renderMarkdown(text: string) {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let key = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Table rows
    if (line.trim().startsWith('|')) {
      const cells = line.split('|').filter((c, idx) => idx > 0 && idx < line.split('|').length - 1)
      const isHeader = lines[i + 1]?.includes('---')
      if (isHeader) {
        elements.push(
          <tr key={key++} style={{ borderBottom: '1px solid var(--border)' }}>
            {cells.map((c, j) => (
              <th key={j} style={{ padding: '4px 8px', textAlign: 'left', color: 'var(--color-primary)', fontSize: '0.75rem', fontWeight: 600 }}>{c.trim()}</th>
            ))}
          </tr>
        )
        i++ // skip separator row
        continue
      }
      if (!line.includes('---')) {
        elements.push(
          <tr key={key++} style={{ borderBottom: '1px solid rgba(34,197,94,0.08)' }}>
            {cells.map((c, j) => (
              <td key={j} style={{ padding: '4px 8px', fontSize: '0.78rem', color: 'var(--text-primary)' }}>{c.trim()}</td>
            ))}
          </tr>
        )
        continue
      }
    }

    // Bold headings with **text**
    const parseBold = (s: string) => {
      const parts = s.split(/\*\*(.*?)\*\*/)
      return parts.map((p, idx) =>
        idx % 2 === 1
          ? <strong key={idx} style={{ color: 'var(--color-primary-light)', fontWeight: 600 }}>{p}</strong>
          : p
      )
    }

    if (line.startsWith('### ')) {
      elements.push(<p key={key++} style={{ fontWeight: 700, color: 'var(--text-primary)', margin: '8px 0 2px', fontSize: '0.88rem' }}>{parseBold(line.slice(4))}</p>)
    } else if (line.startsWith('## ')) {
      elements.push(<p key={key++} style={{ fontWeight: 700, color: 'var(--color-primary-light)', margin: '10px 0 4px', fontSize: '0.92rem' }}>{parseBold(line.slice(3))}</p>)
    } else if (line.startsWith('# ')) {
      elements.push(<p key={key++} style={{ fontWeight: 800, color: 'var(--color-primary)', margin: '10px 0 4px', fontSize: '0.95rem' }}>{parseBold(line.slice(2))}</p>)
    } else if (line.match(/^  - |^- /)) {
      elements.push(
        <li key={key++} style={{ color: 'var(--text-primary)', marginBottom: 2, fontSize: '0.82rem', listStyleType: 'none', paddingLeft: 0 }}>
          <span style={{ color: 'var(--color-primary)', marginRight: 6 }}>›</span>
          {parseBold(line.replace(/^  - |^- /, ''))}
        </li>
      )
    } else if (line === '') {
      elements.push(<br key={key++} />)
    } else {
      elements.push(<p key={key++} style={{ margin: '2px 0', fontSize: '0.83rem', color: 'var(--text-primary)', lineHeight: 1.55 }}>{parseBold(line)}</p>)
    }
  }

  // Wrap consecutive <tr> in a table
  const result: React.ReactNode[] = []
  let tableRows: React.ReactNode[] = []
  for (const el of elements) {
    if ((el as any)?.type === 'tr') {
      tableRows.push(el)
    } else {
      if (tableRows.length > 0) {
        result.push(
          <div key={makeId()} style={{ overflowX: 'auto', margin: '6px 0' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', border: '1px solid var(--border)', borderRadius: 8 }}>
              <tbody>{tableRows}</tbody>
            </table>
          </div>
        )
        tableRows = []
      }
      result.push(el)
    }
  }
  if (tableRows.length > 0) {
    result.push(
      <div key={makeId()} style={{ overflowX: 'auto', margin: '6px 0' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <tbody>{tableRows}</tbody>
        </table>
      </div>
    )
  }

  return <>{result}</>
}

// ── Quick Prompt Chips ────────────────────────────────────────────────────────
const QUICK_PROMPTS = [
  { icon: <Leaf size={13} />, label: 'Diagnose leaf spots', color: 'var(--color-primary)' },
  { icon: <CloudRain size={13} />, label: 'Can I spray today?', color: 'var(--color-info)' },
  { icon: <Droplets size={13} />, label: 'Irrigation schedule', color: '#60a5fa' },
  { icon: <FlaskConical size={13} />, label: 'Fertilizer dosage', color: 'var(--color-accent)' },
  { icon: <TrendingUp size={13} />, label: 'Should I sell now?', color: '#a78bfa' },
  { icon: <Satellite size={13} />, label: 'Explain my NDVI', color: '#34d399' },
]

// ── Typing indicator ──────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '8px 12px' }}>
      {[0, 1, 2].map(i => (
        <span
          key={i}
          style={{
            width: 7, height: 7,
            borderRadius: '50%',
            background: 'var(--color-primary)',
            opacity: 0.7,
            animation: `agribot-bounce 1.2s ${i * 0.2}s infinite`,
          }}
        />
      ))}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function AgriBot({ context }: { context?: AgriContext }) {
  const { token, user } = useAuthStore()
  const [open, setOpen] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [unread, setUnread] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [hasOpened, setHasOpened] = useState(false)

  const scrollToBottom = useCallback(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }, [])

  // Greet on first open
  useEffect(() => {
    if (open && !hasOpened) {
      setHasOpened(true)
      setUnread(0)
      const greeting: Message = {
        id: makeId(),
        role: 'bot',
        content: `🌾 **Welcome to AgriBot — Your AI Agronomist!**\n\nI'm connected to your farm data${context?.cropName ? ` for **${context.cropName}**` : ''}${context?.district ? ` in **${context.district}**` : ''}. I can help you with:\n\n- 🌿 **Pest & Disease Diagnosis**\n- 🌦️ **Weather & Spray Timing**\n- 💧 **Irrigation Scheduling**\n- 🌾 **Fertilizer Dosage**\n- 📊 **Market Timing**\n- 🛰️ **NDVI Health Analysis**\n\nAsk me anything about your farm!`,
        suggestions: ['Diagnose leaf spots', 'Is it safe to spray today?', 'Fertilizer plan for my crop'],
        category: 'general',
        confidence: 1,
        sources: [],
        timestamp: new Date(),
      }
      setMessages([greeting])
    }
    if (open) {
      scrollToBottom()
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  useEffect(() => {
    if (open) scrollToBottom()
  }, [messages])

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || loading) return

    const userMsg: Message = {
      id: makeId(),
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    }

    const typingMsg: Message = {
      id: makeId(),
      role: 'bot',
      content: '',
      typing: true,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMsg, typingMsg])
    setInput('')
    setLoading(true)
    scrollToBottom()

    try {
      // Build history (last 5 turns, excluding typing indicator)
      const history = messages
        .filter(m => !m.typing)
        .slice(-10)
        .map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }))

      const res = await agribotApi.chat({
        message: trimmed,
        context: context || null,
        history,
      })

      const botMsg: Message = {
        id: makeId(),
        role: 'bot',
        content: res.reply,
        category: res.category,
        suggestions: res.suggestions,
        sources: res.sources,
        confidence: res.confidence,
        timestamp: new Date(),
      }

      setMessages(prev => prev.filter(m => !m.typing).concat(botMsg))

      if (!open) setUnread(u => u + 1)
    } catch (err: any) {
      const errMsg: Message = {
        id: makeId(),
        role: 'bot',
        content: '⚠️ I encountered an error connecting to the AgriBot service. Please ensure the backend is running and try again.',
        category: 'general',
        suggestions: ['Try again', 'Restart the app'],
        sources: [],
        confidence: 0,
        timestamp: new Date(),
      }
      setMessages(prev => prev.filter(m => !m.typing).concat(errMsg))
    } finally {
      setLoading(false)
    }
  }, [loading, messages, context, open])

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const handleOpen = () => {
    setOpen(true)
    setMinimized(false)
    setUnread(0)
  }

  const handleClear = () => {
    setMessages([])
    setHasOpened(false)
  }

  if (!token) return null

  return (
    <>
      {/* ── Keyframe styles ─────────────────────────────────────────── */}
      <style>{`
        @keyframes agribot-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.7; }
          30% { transform: translateY(-6px); opacity: 1; }
        }
        @keyframes agribot-slide-up {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes agribot-pulse-ring {
          0%   { box-shadow: 0 0 0 0 rgba(34,197,94,0.4); }
          70%  { box-shadow: 0 0 0 14px rgba(34,197,94,0); }
          100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
        }
        .agribot-fab {
          animation: agribot-pulse-ring 2.5s infinite;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .agribot-fab:hover {
          transform: scale(1.08) !important;
        }
        .agribot-send:hover { opacity: 1 !important; }
        .agribot-chip:hover {
          background: rgba(34,197,94,0.2) !important;
          border-color: rgba(34,197,94,0.5) !important;
        }
        .agribot-suggestion:hover {
          background: rgba(34,197,94,0.15) !important;
          color: var(--color-primary-light) !important;
        }
      `}</style>

      {/* ── FAB Button ──────────────────────────────────────────────── */}
      {!open && (
        <button
          id="agribot-fab"
          className="agribot-fab"
          onClick={handleOpen}
          style={{
            position: 'fixed',
            bottom: 28,
            right: 28,
            width: 60,
            height: 60,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--color-primary-dark), var(--color-primary))',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            color: '#fff',
            boxShadow: '0 4px 20px rgba(34,197,94,0.4)',
          }}
          title="Open AgriBot AI Agronomist"
        >
          <Bot size={26} />
          {unread > 0 && (
            <span style={{
              position: 'absolute', top: 2, right: 2,
              background: 'var(--color-danger)', color: '#fff',
              borderRadius: '50%', width: 18, height: 18,
              fontSize: '0.65rem', fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {unread}
            </span>
          )}
        </button>
      )}

      {/* ── Chat Window ─────────────────────────────────────────────── */}
      {open && (
        <div
          id="agribot-window"
          style={{
            position: 'fixed',
            bottom: 28,
            right: 28,
            width: 'min(420px, calc(100vw - 32px))',
            height: minimized ? 60 : 'min(600px, calc(100vh - 80px))',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-active)',
            borderRadius: 20,
            display: 'flex',
            flexDirection: 'column',
            zIndex: 9999,
            boxShadow: '0 16px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(34,197,94,0.1)',
            animation: 'agribot-slide-up 0.25s ease-out',
            overflow: 'hidden',
            transition: 'height 0.25s ease',
          }}
        >
          {/* Header */}
          <div style={{
            padding: '14px 16px',
            borderBottom: minimized ? 'none' : '1px solid var(--border)',
            background: 'linear-gradient(135deg, rgba(22,163,74,0.15), rgba(22,32,25,0.8))',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexShrink: 0,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--color-primary-dark), var(--color-primary))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 0 12px rgba(34,197,94,0.35)',
            }}>
              <Bot size={18} color="#fff" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                AgriBot
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-primary)', display: 'inline-block' }} />
                AI Agronomist {context?.cropName ? `· ${context.cropName}` : ''} {context?.district ? `· ${context.district}` : ''}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {messages.length > 0 && (
                <button
                  onClick={handleClear}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, borderRadius: 8, display: 'flex' }}
                  title="Clear conversation"
                >
                  <RotateCcw size={14} />
                </button>
              )}
              <button
                onClick={() => setMinimized(v => !v)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, borderRadius: 8, display: 'flex' }}
                title={minimized ? 'Expand' : 'Minimize'}
              >
                <ChevronDown size={16} style={{ transform: minimized ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </button>
              <button
                onClick={() => setOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, borderRadius: 8, display: 'flex' }}
                title="Close"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {!minimized && (
            <>
              {/* Messages */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                scrollbarWidth: 'thin',
                scrollbarColor: 'var(--border) transparent',
              }}>
                {/* Quick prompts (shown only if no messages from user) */}
                {messages.length <= 1 && (
                  <div style={{ padding: '4px 0 8px' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 8, letterSpacing: '0.05em' }}>
                      QUICK ACTIONS
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {QUICK_PROMPTS.map((p, i) => (
                        <button
                          key={i}
                          className="agribot-chip"
                          onClick={() => sendMessage(p.label)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 5,
                            padding: '5px 10px',
                            background: 'rgba(34,197,94,0.06)',
                            border: '1px solid rgba(34,197,94,0.2)',
                            borderRadius: 20,
                            cursor: 'pointer',
                            color: p.color,
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            transition: 'all 0.15s',
                          }}
                        >
                          {p.icon} {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map(msg => (
                  <div
                    key={msg.id}
                    style={{
                      display: 'flex',
                      flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                      gap: 8,
                      alignItems: 'flex-start',
                    }}
                  >
                    {/* Avatar */}
                    {msg.role === 'bot' && (
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--color-primary-dark), var(--color-primary))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0, marginTop: 2,
                      }}>
                        <Bot size={14} color="#fff" />
                      </div>
                    )}

                    {/* Bubble */}
                    <div style={{ maxWidth: '82%' }}>
                      <div style={{
                        padding: msg.typing ? '4px 8px' : '10px 13px',
                        borderRadius: msg.role === 'user'
                          ? '16px 4px 16px 16px'
                          : '4px 16px 16px 16px',
                        background: msg.role === 'user'
                          ? 'linear-gradient(135deg, var(--color-primary-dark), var(--color-primary))'
                          : 'rgba(22,32,25,0.95)',
                        border: msg.role === 'user'
                          ? 'none'
                          : '1px solid var(--border)',
                        color: msg.role === 'user' ? '#fff' : 'var(--text-primary)',
                        fontSize: '0.83rem',
                        lineHeight: 1.5,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                      }}>
                        {msg.typing ? (
                          <TypingDots />
                        ) : msg.role === 'user' ? (
                          <span>{msg.content}</span>
                        ) : (
                          renderMarkdown(msg.content)
                        )}
                      </div>

                      {/* Category + confidence + sources */}
                      {msg.role === 'bot' && !msg.typing && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, paddingLeft: 4 }}>
                          {msg.category && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                              {categoryIcon(msg.category)} {msg.category}
                            </span>
                          )}
                          {msg.confidence !== undefined && msg.confidence > 0 && (
                            <span style={{ fontSize: '0.63rem', color: 'var(--text-muted)', marginLeft: 4 }}>
                              {Math.round(msg.confidence * 100)}% confidence
                            </span>
                          )}
                        </div>
                      )}

                      {/* Source pills */}
                      {msg.role === 'bot' && !msg.typing && msg.sources && msg.sources.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4, paddingLeft: 4 }}>
                          {msg.sources.map((s, i) => (
                            <span key={i} style={{
                              fontSize: '0.6rem', color: 'var(--text-muted)',
                              padding: '1px 6px', borderRadius: 10,
                              border: '1px solid var(--border)',
                              display: 'flex', alignItems: 'center', gap: 3,
                            }}>
                              <ExternalLink size={8} /> {s}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Suggestion chips */}
                      {msg.role === 'bot' && !msg.typing && msg.suggestions && msg.suggestions.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6, paddingLeft: 4 }}>
                          {msg.suggestions.map((s, i) => (
                            <button
                              key={i}
                              className="agribot-suggestion"
                              onClick={() => sendMessage(s)}
                              style={{
                                fontSize: '0.7rem',
                                padding: '3px 8px',
                                borderRadius: 12,
                                border: '1px solid rgba(34,197,94,0.2)',
                                background: 'rgba(34,197,94,0.05)',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer',
                                transition: 'all 0.15s',
                              }}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              {/* Context indicator */}
              {context?.cropName && (
                <div style={{
                  padding: '6px 12px',
                  borderTop: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'rgba(34,197,94,0.04)',
                  flexShrink: 0,
                }}>
                  <Leaf size={10} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    Context: <strong style={{ color: 'var(--color-primary)' }}>{context.cropName}</strong>
                    {context.district && <> · {context.district}</>}
                    {context.ndviMean != null && <> · NDVI {context.ndviMean.toFixed(2)}</>}
                    {context.ndviHealth && <> ({context.ndviHealth})</>}
                  </span>
                </div>
              )}

              {/* Input */}
              <div style={{
                padding: '10px 12px',
                borderTop: '1px solid var(--border)',
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                background: 'var(--bg-surface)',
                flexShrink: 0,
              }}>
                <input
                  ref={inputRef}
                  id="agribot-input"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  disabled={loading}
                  placeholder="Ask about your crop, pest, irrigation…"
                  style={{
                    flex: 1,
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    padding: '8px 12px',
                    color: 'var(--text-primary)',
                    fontSize: '0.83rem',
                    outline: 'none',
                    fontFamily: 'var(--font-body)',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={e => { e.target.style.borderColor = 'var(--border-active)' }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
                />
                <button
                  className="agribot-send"
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || loading}
                  style={{
                    width: 36, height: 36,
                    borderRadius: 10,
                    background: input.trim() && !loading
                      ? 'linear-gradient(135deg, var(--color-primary-dark), var(--color-primary))'
                      : 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    cursor: input.trim() && !loading ? 'pointer' : 'default',
                    color: input.trim() && !loading ? '#fff' : 'var(--text-muted)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                    opacity: input.trim() && !loading ? 0.9 : 0.5,
                    transition: 'all 0.2s',
                  }}
                  title="Send message"
                >
                  {loading ? (
                    <span style={{ width: 14, height: 14, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
                  ) : (
                    <Send size={14} />
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}
