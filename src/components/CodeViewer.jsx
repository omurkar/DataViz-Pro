/**
 * CodeViewer — Feature 9: SQL & Python Code Export
 * Shows the equivalent SQL query and Python/pandas code for any chart.
 */
import React, { useState, useEffect } from 'react';
import { Code2, Copy, Check, X, Terminal, Database } from 'lucide-react';

export default function CodeViewer({ chartConfig, tableName, onClose }) {
  const [tab, setTab] = useState('sql');
  const [code, setCode] = useState({ sql: '', python: '' });
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCode = async () => {
      if (!chartConfig) return;
      setLoading(true);
      try {
        const res = await fetch('http://127.0.0.1:5000/api/code-export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chart_config: chartConfig,
            table_name: tableName || 'your_table',
          }),
        });
        const json = await res.json();
        if (json.success) setCode({ sql: json.sql, python: json.python });
      } catch {}
      setLoading(false);
    };
    fetchCode();
  }, [chartConfig, tableName]);

  const copyCode = () => {
    const content = tab === 'sql' ? code.sql : code.python;
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const TAB_STYLE = (active) => ({
    padding: '8px 16px', borderRadius: 8, fontSize: '0.8rem', fontWeight: 600,
    border: active ? '1px solid rgba(124,58,237,0.5)' : '1px solid transparent',
    background: active ? 'rgba(124,58,237,0.15)' : 'transparent',
    color: active ? '#7c3aed' : 'var(--text-muted)',
    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s',
  });

  const currentCode = tab === 'sql' ? code.sql : code.python;

  // Simple syntax highlighting (inline)
  const highlight = (code, lang) => {
    if (!code) return '';
    if (lang === 'sql') {
      return code
        .replace(/\b(SELECT|FROM|WHERE|GROUP BY|ORDER BY|LIMIT|COUNT|SUM|AVG|AS|AND|OR|HAVING|JOIN|ON|DESC|ASC|BY)\b/g, '<span style="color:#3b82f6;font-weight:600">$1</span>')
        .replace(/--[^\n]*/g, '<span style="color:#64748b;font-style:italic">$&</span>')
        .replace(/\b(\d+)\b/g, '<span style="color:#f59e0b">$1</span>');
    }
    return code
      .replace(/#[^\n]*/g, '<span style="color:#64748b;font-style:italic">$&</span>')
      .replace(/\b(import|from|as|def|return|if|else|for|in|True|False|None|plt|pd|df)\b/g, '<span style="color:#3b82f6;font-weight:600">$1</span>')
      .replace(/'([^']*)'/g, '<span style="color:#10b981">\'$1\'</span>')
      .replace(/\b(\d+)\b/g, '<span style="color:#f59e0b">$1</span>');
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        width: '100%', maxWidth: 680, background: 'var(--bg-card)',
        borderRadius: 20, border: '1px solid var(--border)',
        boxShadow: '0 32px 80px rgba(0,0,0,0.5)', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'linear-gradient(135deg, rgba(124,58,237,0.12), rgba(16,185,129,0.08))',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: 'linear-gradient(135deg, #7c3aed, #10b981)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Code2 size={20} color="white" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>View Code</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{chartConfig?.title || 'Chart'}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 6 }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Tab bar */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setTab('sql')} style={TAB_STYLE(tab === 'sql')}>
              <Database size={14} /> SQL Query
            </button>
            <button onClick={() => setTab('python')} style={TAB_STYLE(tab === 'python')}>
              <Terminal size={14} /> Python / pandas
            </button>
            <button
              onClick={copyCode}
              style={{
                marginLeft: 'auto', padding: '8px 16px', borderRadius: 8,
                background: copied ? 'rgba(16,185,129,0.15)' : 'var(--bg-secondary)',
                border: `1px solid ${copied ? 'rgba(16,185,129,0.4)' : 'var(--border)'}`,
                color: copied ? '#10b981' : 'var(--text-secondary)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                fontSize: '0.8rem', fontWeight: 600, transition: 'all 0.2s',
              }}
            >
              {copied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy</>}
            </button>
          </div>

          {/* Code block */}
          {loading ? (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              Generating code…
            </div>
          ) : (
            <div style={{
              background: '#0d1117', borderRadius: 12, padding: 20,
              fontFamily: '"Fira Code", "Cascadia Code", monospace',
              fontSize: '0.8rem', lineHeight: 1.7,
              border: '1px solid #30363d', overflowX: 'auto',
              maxHeight: 380, overflowY: 'auto',
            }}>
              {currentCode ? (
                <div
                  dangerouslySetInnerHTML={{
                    __html: highlight(currentCode, tab).replace(/\n/g, '<br/>'),
                  }}
                  style={{ color: '#e6edf3', whiteSpace: 'pre' }}
                />
              ) : (
                <div style={{ color: '#64748b' }}>No code available.</div>
              )}
            </div>
          )}

          {/* Column info */}
          {chartConfig && (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {[
                { label: 'Chart Type', val: chartConfig.type },
                { label: 'X Axis', val: chartConfig.x },
                { label: 'Y Axis', val: chartConfig.y || '—' },
                { label: 'Table', val: tableName || 'your_table' },
              ].map(item => (
                <div key={item.label} style={{
                  flex: 1, minWidth: 100, background: 'var(--bg-secondary)',
                  borderRadius: 8, padding: '8px 12px',
                }}>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'monospace', marginTop: 2 }}>{item.val}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
