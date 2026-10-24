/**
 * AnomalyDetector — Feature 2: Automated Anomaly Detection
 * Selects a column, calls backend Z-Score/IQR analysis,
 * overlays red markers on the chart.
 */
import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceDot, ResponsiveContainer, Legend,
} from 'recharts';
import { AlertTriangle, Zap, X, TrendingUp, Activity } from 'lucide-react';

export default function AnomalyDetector({ onClose }) {
  const { cleanData, columns } = useData();
  const [selectedCol, setSelectedCol] = useState('');
  const [method, setMethod] = useState('zscore');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const numericCols = columns.filter(col => {
    if (!cleanData || cleanData.length === 0) return false;
    return cleanData.slice(0, 20).some(row => typeof row[col] === 'number');
  });

  const detect = async () => {
    if (!selectedCol || !cleanData) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('http://127.0.0.1:5000/api/anomaly-detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: cleanData, column: selectedCol, method }),
      });
      const json = await res.json();
      if (json.success) setResult(json);
      else setError(json.error || 'Detection failed');
    } catch {
      setError('Backend connection error');
    } finally {
      setLoading(false);
    }
  };

  // Build chart data from enriched_data
  const chartData = result?.enriched_data?.map((d, i) => ({
    index: i,
    value: typeof d.value === 'number' ? d.value : parseFloat(d.value),
    is_anomaly: d.is_anomaly,
  })) || [];

  const anomalyPoints = chartData.filter(d => d.is_anomaly);

  const CustomDot = (props) => {
    const { cx, cy, payload } = props;
    if (!payload.is_anomaly) return null;
    return <circle cx={cx} cy={cy} r={6} fill="#ef4444" stroke="white" strokeWidth={2} />;
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        width: '100%', maxWidth: 860, maxHeight: '88vh', overflowY: 'auto',
        background: 'var(--bg-card)', borderRadius: 20,
        border: '1px solid var(--border)',
        boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'linear-gradient(135deg, rgba(239,68,68,0.1), rgba(251,146,60,0.08))',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: 'linear-gradient(135deg, #ef4444, #f97316)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <AlertTriangle size={20} color="white" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>Anomaly Detection</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Statistical outlier analysis</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 6 }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Controls */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <select
              value={selectedCol}
              onChange={e => setSelectedCol(e.target.value)}
              style={{
                flex: 1, minWidth: 180,
                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                borderRadius: 10, padding: '10px 14px', color: 'var(--text-primary)', fontSize: '0.875rem',
              }}
            >
              <option value="">Select numeric column…</option>
              {numericCols.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 8 }}>
              {['zscore', 'iqr'].map(m => (
                <button
                  key={m}
                  onClick={() => setMethod(m)}
                  style={{
                    padding: '10px 16px', borderRadius: 10, fontSize: '0.8rem', fontWeight: 600,
                    border: method === m ? '2px solid #ef4444' : '1px solid var(--border)',
                    background: method === m ? 'rgba(239,68,68,0.15)' : 'var(--bg-secondary)',
                    color: method === m ? '#ef4444' : 'var(--text-secondary)',
                    cursor: 'pointer', transition: 'all 0.2s',
                  }}
                >
                  {m === 'zscore' ? 'Z-Score (σ)' : 'IQR Method'}
                </button>
              ))}
            </div>
            <button
              onClick={detect}
              disabled={!selectedCol || loading}
              style={{
                padding: '10px 20px', borderRadius: 10,
                background: 'linear-gradient(135deg, #ef4444, #f97316)',
                border: 'none', color: 'white', fontWeight: 700,
                fontSize: '0.875rem', cursor: 'pointer',
                opacity: !selectedCol || loading ? 0.5 : 1, transition: 'opacity 0.2s',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              <Zap size={16} />
              {loading ? 'Detecting…' : 'Detect Anomalies'}
            </button>
          </div>

          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 10, padding: 12, color: '#ef4444', fontSize: '0.875rem',
            }}>⚠️ {error}</div>
          )}

          {result && (
            <>
              {/* Stats row */}
              <div style={{ display: 'flex', gap: 12 }}>
                {[
                  { label: 'Total Points', value: result.enriched_data?.length || 0, icon: <Activity size={16} />, color: '#3b82f6' },
                  { label: 'Anomalies Found', value: result.anomaly_count, icon: <AlertTriangle size={16} />, color: '#ef4444' },
                  { label: 'Clean Rate', value: `${(((result.enriched_data?.length || 0) - result.anomaly_count) / (result.enriched_data?.length || 1) * 100).toFixed(1)}%`, icon: <TrendingUp size={16} />, color: '#10b981' },
                ].map(stat => (
                  <div key={stat.label} style={{
                    flex: 1, background: 'var(--bg-secondary)', borderRadius: 12,
                    padding: '14px 16px', border: `1px solid ${stat.color}30`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: stat.color, marginBottom: 4 }}>
                      {stat.icon}
                      <span style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{stat.label}</span>
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: stat.color }}>{stat.value}</div>
                  </div>
                ))}
              </div>

              {/* Chart with anomaly dots */}
              {chartData.length > 0 && (
                <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: '16px 8px' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12, padding: '0 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ display: 'inline-block', width: 10, height: 2, background: '#3b82f6' }} /> Normal &nbsp;
                    <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#ef4444' }} /> Anomaly
                  </div>
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={chartData.slice(0, 500)} margin={{ left: 0, right: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="index" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                      <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                      <Tooltip
                        contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                        labelStyle={{ color: 'var(--text-muted)' }}
                      />
                      <Line
                        type="monotone" dataKey="value" stroke="#3b82f6"
                        strokeWidth={1.5} dot={<CustomDot />}
                        activeDot={{ r: 5, fill: '#3b82f6' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Anomaly list */}
              {result.anomalies && result.anomalies.length > 0 && (
                <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 16 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)', marginBottom: 12 }}>
                    Flagged Anomalies ({result.anomalies.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
                    {result.anomalies.map((a, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '8px 12px', borderRadius: 8,
                        background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                      }}>
                        <AlertTriangle size={12} color="#ef4444" />
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Row {a.index}</span>
                        <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#ef4444' }}>{typeof a.value === 'number' ? a.value.toLocaleString() : a.value}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>{a.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
