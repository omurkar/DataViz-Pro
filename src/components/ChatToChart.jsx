/**
 * ChatToChart — Feature 1: Natural Language Querying
 * User types plain-English questions → backend LLM → chart appears inline
 */
import React, { useState, useRef, useEffect } from 'react';
import { useData } from '../context/DataContext';
import DynamicChart from './DynamicChart';
import { Send, Sparkles, Bot, User, BarChart3, Code2, X, Lightbulb } from 'lucide-react';

const EXAMPLE_QUESTIONS = [
  'Show me total revenue by region',
  'What is the trend over time for sales?',
  'Which category has the highest count?',
  'Show me the distribution of profit',
];

export default function ChatToChart({ onClose }) {
  const { cleanData, columns } = useData();
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      text: '👋 Ask me anything about your data! I\'ll turn your question into a chart instantly.',
      chart: null,
      insight: null,
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendQuestion = async (question) => {
    if (!question.trim() || loading) return;
    if (!cleanData || cleanData.length === 0) {
      setMessages(prev => [...prev, {
        id: Date.now(),
        role: 'assistant',
        text: '⚠️ No data loaded yet. Please connect a database or upload a file first.',
        chart: null,
      }]);
      return;
    }

    const userMsg = { id: Date.now(), role: 'user', text: question };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('http://127.0.0.1:5000/api/nl-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, data: cleanData, columns }),
      });
      const json = await res.json();
      if (json.success && json.chart_config) {
        setMessages(prev => [...prev, {
          id: Date.now() + 1,
          role: 'assistant',
          text: json.insight || 'Here\'s your chart:',
          chart: json.chart_config,
          sqlHint: json.sql_hint,
          insight: json.insight,
        }]);
      } else {
        setMessages(prev => [...prev, {
          id: Date.now() + 1,
          role: 'assistant',
          text: `❌ ${json.error || 'Could not generate chart for that question.'}`,
          chart: null,
        }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'assistant',
        text: '❌ Connection error. Is the backend running?',
        chart: null,
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        width: '100%', maxWidth: 820, height: '85vh',
        background: 'var(--bg-card)', borderRadius: 20,
        border: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(59,130,246,0.1))',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: 'linear-gradient(135deg, #7c3aed, #3b82f6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Sparkles size={20} color="white" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>Chat to Chart</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ask questions in plain English</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 6 }}>
            <X size={20} />
          </button>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {messages.map(msg => (
            <div key={msg.id} style={{
              display: 'flex', gap: 12,
              flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                background: msg.role === 'user'
                  ? 'linear-gradient(135deg, #7c3aed, #a855f7)'
                  : 'linear-gradient(135deg, #1e293b, #334155)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {msg.role === 'user' ? <User size={14} color="white" /> : <Bot size={14} color="#94a3b8" />}
              </div>
              <div style={{ maxWidth: '80%', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{
                  background: msg.role === 'user'
                    ? 'linear-gradient(135deg, #7c3aed, #6d28d9)'
                    : 'var(--bg-secondary)',
                  borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '4px 18px 18px 18px',
                  padding: '10px 16px',
                  color: msg.role === 'user' ? 'white' : 'var(--text-primary)',
                  fontSize: '0.875rem', lineHeight: 1.5,
                }}>
                  {msg.text}
                </div>
                {msg.chart && (
                  <div style={{
                    background: 'var(--bg-secondary)', borderRadius: 12,
                    padding: 16, border: '1px solid var(--border)',
                  }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <BarChart3 size={12} /> {msg.chart.title}
                    </div>
                    <DynamicChart config={msg.chart} height={220} />
                    {msg.sqlHint && (
                      <details style={{ marginTop: 8 }}>
                        <summary style={{ fontSize: '0.7rem', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Code2 size={10} /> View SQL
                        </summary>
                        <pre style={{
                          fontSize: '0.7rem', color: '#10b981',
                          background: '#0f172a', borderRadius: 6, padding: 10,
                          overflow: 'auto', marginTop: 6,
                        }}>{msg.sqlHint}</pre>
                      </details>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'linear-gradient(135deg, #1e293b, #334155)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Bot size={14} color="#94a3b8" />
              </div>
              <div style={{
                background: 'var(--bg-secondary)', borderRadius: '4px 18px 18px 18px',
                padding: '12px 16px', display: 'flex', gap: 6, alignItems: 'center',
              }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: '#7c3aed',
                    animation: `bounce 1.4s ease-in-out ${i * 0.2}s infinite`,
                  }} />
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Example chips */}
        <div style={{ padding: '8px 24px', display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: '1px solid var(--border)' }}>
          <Lightbulb size={14} color="var(--text-muted)" style={{ marginTop: 3 }} />
          {EXAMPLE_QUESTIONS.map(q => (
            <button
              key={q}
              onClick={() => sendQuestion(q)}
              style={{
                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                borderRadius: 20, padding: '4px 12px', fontSize: '0.7rem',
                cursor: 'pointer', color: 'var(--text-secondary)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.target.style.borderColor = '#7c3aed'; e.target.style.color = '#7c3aed'; }}
              onMouseLeave={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.color = 'var(--text-secondary)'; }}
            >{q}</button>
          ))}
        </div>

        {/* Input */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 12 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendQuestion(input)}
            placeholder="Ask anything about your data..."
            disabled={loading}
            style={{
              flex: 1, background: 'var(--bg-secondary)', border: '1px solid var(--border)',
              borderRadius: 12, padding: '12px 16px', color: 'var(--text-primary)',
              fontSize: '0.875rem', outline: 'none',
            }}
          />
          <button
            onClick={() => sendQuestion(input)}
            disabled={loading || !input.trim()}
            style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'linear-gradient(135deg, #7c3aed, #3b82f6)',
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: loading || !input.trim() ? 0.5 : 1,
              transition: 'opacity 0.2s',
            }}
          >
            <Send size={18} color="white" />
          </button>
        </div>
      </div>
    </div>
  );
}
