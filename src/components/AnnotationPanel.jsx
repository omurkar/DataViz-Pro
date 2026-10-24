/**
 * AnnotationPanel — Feature 8: Collaborative Annotations
 * Shift-click a chart data point → opens comment form.
 * All annotations stored on backend and overlaid on charts.
 */
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { MessageSquare, Send, Trash2, X, User, Clock } from 'lucide-react';

export default function AnnotationPanel({ chartId, xValue, yValue, dashboardId, onClose }) {
  const { user } = useAuth();
  const userId = user?.uid || 'anonymous';
  const userName = user?.displayName || user?.email?.split('@')[0] || 'User';

  const [annotations, setAnnotations] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  const effectiveDashboardId = dashboardId || 'default';

  useEffect(() => {
    fetchAnnotations();
  }, [chartId]);

  const fetchAnnotations = async () => {
    try {
      const res = await fetch(`http://127.0.0.1:5000/api/annotations/${effectiveDashboardId}`);
      const json = await res.json();
      if (json.success) {
        setAnnotations(json.annotations.filter(a => a.chart_id === chartId));
      }
    } catch {}
  };

  const saveAnnotation = async () => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('http://127.0.0.1:5000/api/annotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dashboard_id: effectiveDashboardId,
          chart_id: chartId,
          x_value: xValue,
          y_value: yValue,
          user_id: userId,
          user_name: userName,
          text: text.trim(),
        }),
      });
      const json = await res.json();
      if (json.success) {
        setAnnotations(prev => [...prev, json.annotation]);
        setText('');
      }
    } catch {}
    setLoading(false);
  };

  const deleteAnnotation = async (annId) => {
    try {
      await fetch(`http://127.0.0.1:5000/api/annotations/${effectiveDashboardId}/${annId}`, { method: 'DELETE' });
      setAnnotations(prev => prev.filter(a => a.id !== annId));
    } catch {}
  };

  const formatTime = (iso) => {
    try {
      return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return iso; }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1100,
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        width: 420, background: 'var(--bg-card)', borderRadius: 18,
        border: '1px solid var(--border)',
        boxShadow: '0 24px 60px rgba(0,0,0,0.5)', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'linear-gradient(135deg, rgba(59,130,246,0.12), rgba(124,58,237,0.08))',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <MessageSquare size={18} color="#3b82f6" />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Annotation</div>
              {xValue && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Point: {String(xValue).slice(0, 30)}</div>}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Annotations list */}
          <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {annotations.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', padding: 20 }}>
                No annotations yet. Be the first to comment!
              </div>
            ) : annotations.map(ann => (
              <div key={ann.id} style={{
                background: 'var(--bg-secondary)', borderRadius: 10,
                padding: '10px 12px', border: '1px solid var(--border)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #7c3aed, #3b82f6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.6rem', color: 'white', fontWeight: 700,
                  }}>
                    {ann.user_name?.charAt(0).toUpperCase()}
                  </div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>{ann.user_name}</span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Clock size={10} /> {formatTime(ann.created_at)}
                  </span>
                  {ann.user_id === userId && (
                    <button onClick={() => deleteAnnotation(ann.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 2 }}>
                      <Trash2 size={10} />
                    </button>
                  )}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>{ann.text}</div>
              </div>
            ))}
          </div>

          {/* New comment input */}
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && saveAnnotation()}
              placeholder="Add a comment…"
              style={{
                flex: 1, background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                borderRadius: 10, padding: '10px 14px', color: 'var(--text-primary)',
                fontSize: '0.85rem', outline: 'none',
              }}
            />
            <button
              onClick={saveAnnotation}
              disabled={loading || !text.trim()}
              style={{
                width: 40, height: 40, borderRadius: 10,
                background: 'linear-gradient(135deg, #3b82f6, #7c3aed)',
                border: 'none', cursor: 'pointer', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: !text.trim() ? 0.5 : 1,
              }}
            >
              <Send size={14} color="white" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
