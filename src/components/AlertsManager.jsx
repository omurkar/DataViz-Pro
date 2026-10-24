/**
 * AlertsManager — Feature 10: Threshold Alerts
 * UI to create, view, and delete alert rules. Checks alerts against current data.
 */
import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { Bell, Plus, Trash2, X, CheckCircle2, AlertTriangle, Zap } from 'lucide-react';

const OPERATORS = ['<', '>', '<=', '>=', '=='];

export default function AlertsManager({ onClose }) {
  const { cleanData, columns } = useData();
  const { user } = useAuth();
  const userId = user?.uid || 'anonymous';

  const [alerts, setAlerts] = useState([]);
  const [triggered, setTriggered] = useState([]);
  const [form, setForm] = useState({ column: '', operator: '<', threshold: '' });
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);

  const numericCols = columns.filter(col => {
    if (!cleanData || cleanData.length === 0) return false;
    return cleanData.slice(0, 10).some(row => typeof row[col] === 'number');
  });

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    try {
      const res = await fetch(`http://127.0.0.1:5000/api/alerts/${userId}`);
      const json = await res.json();
      if (json.success) setAlerts(json.alerts);
    } catch {}
  };

  const createAlert = async () => {
    if (!form.column || !form.threshold) return;
    setLoading(true);
    try {
      const res = await fetch('http://127.0.0.1:5000/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          column: form.column,
          operator: form.operator,
          threshold: parseFloat(form.threshold),
          label: `${form.column} ${form.operator} ${form.threshold}`,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setAlerts(prev => [...prev, json.alert]);
        setForm({ column: '', operator: '<', threshold: '' });
      }
    } catch {}
    setLoading(false);
  };

  const deleteAlert = async (alertId) => {
    try {
      await fetch(`http://127.0.0.1:5000/api/alerts/${userId}/${alertId}`, { method: 'DELETE' });
      setAlerts(prev => prev.filter(a => a.id !== alertId));
    } catch {}
  };

  const checkNow = async () => {
    if (!cleanData || cleanData.length === 0) return;
    setChecking(true);
    try {
      const res = await fetch('http://127.0.0.1:5000/api/alerts/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, data: cleanData }),
      });
      const json = await res.json();
      if (json.success) setTriggered(json.triggered);
    } catch {}
    setChecking(false);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        width: '100%', maxWidth: 640, maxHeight: '88vh', overflowY: 'auto',
        background: 'var(--bg-card)', borderRadius: 20, border: '1px solid var(--border)',
        boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(239,68,68,0.08))',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Bell size={20} color="white" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>Threshold Alerts</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{alerts.length} active rules</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 6 }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Create alert form */}
          <div style={{
            background: 'var(--bg-secondary)', borderRadius: 14, padding: 18,
            border: '1px solid var(--border)',
          }}>
            <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)', marginBottom: 14 }}>Create New Alert</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: 2, minWidth: 140 }}>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Column</label>
                <select
                  value={form.column}
                  onChange={e => setForm(p => ({ ...p, column: e.target.value }))}
                  style={{ width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', color: 'var(--text-primary)', fontSize: '0.8rem' }}
                >
                  <option value="">Select column…</option>
                  {numericCols.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: 80 }}>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Condition</label>
                <select
                  value={form.operator}
                  onChange={e => setForm(p => ({ ...p, operator: e.target.value }))}
                  style={{ width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', color: '#f59e0b', fontSize: '0.85rem', fontWeight: 700 }}
                >
                  {OPERATORS.map(op => <option key={op} value={op}>{op}</option>)}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: 100 }}>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Threshold</label>
                <input
                  type="number"
                  value={form.threshold}
                  onChange={e => setForm(p => ({ ...p, threshold: e.target.value }))}
                  placeholder="500"
                  style={{ width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', color: 'var(--text-primary)', fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <button
                onClick={createAlert}
                disabled={loading || !form.column || !form.threshold}
                style={{
                  padding: '8px 16px', borderRadius: 8,
                  background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                  border: 'none', color: 'white', fontWeight: 700, fontSize: '0.8rem',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                  opacity: !form.column || !form.threshold ? 0.5 : 1,
                  whiteSpace: 'nowrap', flexShrink: 0,
                }}
              >
                <Plus size={14} /> Add Alert
              </button>
            </div>
          </div>

          {/* Alert list */}
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)', marginBottom: 12 }}>Active Rules</div>
            {alerts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: '0.8rem', background: 'var(--bg-secondary)', borderRadius: 12 }}>
                No alert rules yet. Create one above.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {alerts.map(alert => {
                  const isTriggered = triggered.some(t => t.id === alert.id);
                  return (
                    <div key={alert.id} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 16px', borderRadius: 10,
                      background: isTriggered ? 'rgba(239,68,68,0.08)' : 'var(--bg-secondary)',
                      border: `1px solid ${isTriggered ? 'rgba(239,68,68,0.4)' : 'var(--border)'}`,
                    }}>
                      <div style={{ color: isTriggered ? '#ef4444' : '#f59e0b' }}>
                        {isTriggered ? <AlertTriangle size={16} /> : <Bell size={16} />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                          {alert.column} {alert.operator} {alert.threshold}
                        </div>
                        {isTriggered && (
                          <div style={{ fontSize: '0.72rem', color: '#ef4444', marginTop: 2 }}>
                            🔴 TRIGGERED — current value: {triggered.find(t => t.id === alert.id)?.current_value?.toFixed(2)}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => deleteAlert(alert.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4 }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Triggered alerts */}
          {triggered.length > 0 && (
            <div style={{
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 12, padding: 16,
            }}>
              <div style={{ fontWeight: 700, color: '#ef4444', marginBottom: 10, fontSize: '0.875rem', display: 'flex', gap: 8, alignItems: 'center' }}>
                <AlertTriangle size={16} /> {triggered.length} Alert{triggered.length > 1 ? 's' : ''} Triggered!
              </div>
              {triggered.map(t => (
                <div key={t.id} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 4 }}>• {t.message}</div>
              ))}
            </div>
          )}

          {/* Check now button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Close</button>
            <button
              onClick={checkNow}
              disabled={checking || alerts.length === 0 || !cleanData}
              style={{
                padding: '10px 24px', borderRadius: 10,
                background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                border: 'none', color: 'white', fontWeight: 700, fontSize: '0.875rem',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                opacity: alerts.length === 0 || !cleanData ? 0.5 : 1,
              }}
            >
              <Zap size={16} /> {checking ? 'Checking…' : 'Check Now'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
