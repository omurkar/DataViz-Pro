/**
 * CalcFieldBuilder — Feature 3: Calculated Field Builder
 * Excel-like formula bar that adds new computed columns to the dataset.
 */
import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { Calculator, Plus, Check, X, ChevronRight, Info } from 'lucide-react';

const FORMULA_EXAMPLES = [
  { label: 'Profit Margin %', formula: '(Profit / Revenue) * 100' },
  { label: 'Revenue per Unit', formula: 'Revenue / Quantity' },
  { label: 'Price Increase', formula: 'Price * 1.1' },
  { label: 'Combined Score', formula: 'Score_A + Score_B' },
];

export default function CalcFieldBuilder({ onClose }) {
  const { cleanData, setCleanData, columns, setColumns } = useData();
  const [formula, setFormula] = useState('');
  const [newColName, setNewColName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [preview, setPreview] = useState(null);

  const applyFormula = async () => {
    if (!formula.trim() || !newColName.trim() || !cleanData) return;
    setLoading(true); setError(''); setSuccess('');
    try {
      const res = await fetch('http://127.0.0.1:5000/api/calc-field', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: cleanData,
          formula: formula.trim(),
          new_column_name: newColName.trim(),
        }),
      });
      const json = await res.json();
      if (json.success) {
        setCleanData(json.data);
        setColumns(json.columns);
        setPreview(json.preview);
        setSuccess(`✅ Column "${json.new_column}" added! ${json.data.length} rows updated.`);
      } else {
        setError(json.error || 'Formula evaluation failed');
      }
    } catch {
      setError('Backend connection error');
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
        width: '100%', maxWidth: 680, background: 'var(--bg-card)',
        borderRadius: 20, border: '1px solid var(--border)',
        boxShadow: '0 32px 80px rgba(0,0,0,0.5)', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(59,130,246,0.08))',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: 'linear-gradient(135deg, #10b981, #3b82f6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Calculator size={20} color="white" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>Calculated Field Builder</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Add new computed columns using formulas</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 6 }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Available columns */}
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Available Columns
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {columns.map(col => (
                <button
                  key={col}
                  onClick={() => setFormula(prev => prev + (prev ? ' + ' : '') + col)}
                  style={{
                    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                    borderRadius: 8, padding: '4px 10px', fontSize: '0.75rem',
                    cursor: 'pointer', color: '#3b82f6', fontFamily: 'monospace',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => e.target.style.borderColor = '#3b82f6'}
                  onMouseLeave={e => e.target.style.borderColor = 'var(--border)'}
                >
                  {col}
                </button>
              ))}
            </div>
          </div>

          {/* Formula examples */}
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Examples
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {FORMULA_EXAMPLES.map(ex => (
                <button
                  key={ex.label}
                  onClick={() => { setFormula(ex.formula); setNewColName(ex.label.replace(/\s+/g, '_')); }}
                  style={{
                    background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)',
                    borderRadius: 8, padding: '6px 12px', fontSize: '0.75rem',
                    cursor: 'pointer', color: '#10b981',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <ChevronRight size={10} /> {ex.label}
                </button>
              ))}
            </div>
          </div>

          {/* Formula input */}
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Formula Expression
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                color: '#10b981', fontWeight: 700, fontFamily: 'monospace', fontSize: '1rem',
              }}>ƒx</span>
              <input
                value={formula}
                onChange={e => setFormula(e.target.value)}
                placeholder="e.g. Revenue / Quantity * 100"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  paddingLeft: 36, paddingRight: 16, paddingTop: 12, paddingBottom: 12,
                  background: '#0f172a', border: '2px solid rgba(16,185,129,0.4)',
                  borderRadius: 10, color: '#10b981', fontSize: '0.9rem',
                  fontFamily: 'monospace', outline: 'none',
                }}
              />
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Info size={10} /> Supports: +, -, *, /, (, ), column names. Powered by pandas.eval()
            </div>
          </div>

          {/* New column name */}
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              New Column Name
            </label>
            <input
              value={newColName}
              onChange={e => setNewColName(e.target.value)}
              placeholder="e.g. Profit_Margin"
              style={{
                width: '100%', boxSizing: 'border-box', padding: '10px 14px',
                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                borderRadius: 10, color: 'var(--text-primary)', fontSize: '0.875rem', outline: 'none',
              }}
            />
          </div>

          {/* Error / Success */}
          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 10, padding: '12px 16px', color: '#ef4444', fontSize: '0.875rem',
            }}>⚠️ {error}</div>
          )}
          {success && (
            <div style={{
              background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
              borderRadius: 10, padding: '12px 16px', color: '#10b981', fontSize: '0.875rem',
            }}>{success}</div>
          )}

          {/* Preview table */}
          {preview && preview.length > 0 && (
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Preview (5 rows)
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                  <thead>
                    <tr>
                      {Object.keys(preview[0]).map(k => (
                        <th key={k} style={{
                          padding: '6px 10px', background: 'var(--bg-secondary)',
                          color: k === newColName ? '#10b981' : 'var(--text-muted)',
                          fontWeight: 600, textAlign: 'left', border: '1px solid var(--border)',
                        }}>{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i}>
                        {Object.entries(row).map(([k, v]) => (
                          <td key={k} style={{
                            padding: '6px 10px', border: '1px solid var(--border)',
                            color: k === newColName ? '#10b981' : 'var(--text-primary)',
                            fontFamily: k === newColName ? 'monospace' : 'inherit',
                          }}>
                            {v !== null && v !== undefined ? String(v).slice(0, 30) : '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Apply button */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={{
              padding: '10px 20px', borderRadius: 10, background: 'var(--bg-secondary)',
              border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.875rem',
            }}>Cancel</button>
            <button
              onClick={applyFormula}
              disabled={!formula.trim() || !newColName.trim() || loading}
              style={{
                padding: '10px 24px', borderRadius: 10,
                background: 'linear-gradient(135deg, #10b981, #3b82f6)',
                border: 'none', color: 'white', fontWeight: 700,
                fontSize: '0.875rem', cursor: 'pointer',
                opacity: !formula.trim() || !newColName.trim() || loading ? 0.5 : 1,
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              {loading ? 'Calculating…' : <><Plus size={16} /> Add Column</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
