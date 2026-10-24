/**
 * TransformLineage — Feature 5: Data Transformation Lineage
 * Timeline of all cleaning steps, with ability to delete steps and replay pipeline.
 */
import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import {
  GitBranch, Trash2, RefreshCw, CheckCircle2, Circle, X,
  ChevronRight, Play, Plus, AlertCircle,
} from 'lucide-react';

const STEP_TYPES = [
  { type: 'drop_nulls',   label: 'Drop Null Rows',   color: '#ef4444' },
  { type: 'fill_mean',    label: 'Fill with Mean',   color: '#3b82f6' },
  { type: 'fill_mode',    label: 'Fill with Mode',   color: '#8b5cf6' },
  { type: 'drop_column',  label: 'Drop Column',      color: '#f59e0b' },
  { type: 'calc_field',   label: 'Calculated Field', color: '#10b981' },
];

export default function TransformLineage({ onClose }) {
  const { rawData, cleanData, setCleanData, columns, setColumns } = useData();
  const [sessionId, setSessionId] = useState(null);
  const [steps, setSteps] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initLoading, setInitLoading] = useState(false);
  const [error, setError] = useState('');

  // New step form
  const [newStep, setNewStep] = useState({ type: 'drop_nulls', column: '', formula: '', new_column: '' });
  const [showAdd, setShowAdd] = useState(false);

  const sourceData = rawData || cleanData;

  // Initialize session
  const initSession = async () => {
    if (!sourceData || sourceData.length === 0) { setError('No data available.'); return; }
    setInitLoading(true);
    try {
      const res = await fetch('http://127.0.0.1:5000/api/lineage/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: sourceData, columns }),
      });
      const json = await res.json();
      if (json.success) {
        setSessionId(json.session_id);
        setError('');
        // Pre-populate with auto-clean steps if available
        if (result?.steps_applied) {
          setSteps(result.steps_applied.map((s, i) => ({ id: i, description: s, type: 'auto', column: '' })));
        }
      } else {
        setError(json.error);
      }
    } catch { setError('Backend error'); }
    setInitLoading(false);
  };

  const addStep = () => {
    if (!newStep.column && newStep.type !== 'calc_field') return;
    const step = {
      id: Date.now(),
      type: newStep.type,
      column: newStep.column,
      formula: newStep.formula,
      new_column: newStep.new_column,
      description: `${STEP_TYPES.find(s => s.type === newStep.type)?.label || newStep.type}: ${newStep.column || newStep.new_column}`,
    };
    setSteps(prev => [...prev, step]);
    setNewStep({ type: 'drop_nulls', column: '', formula: '', new_column: '' });
    setShowAdd(false);
  };

  const removeStep = (id) => setSteps(prev => prev.filter(s => s.id !== id));

  const replayPipeline = async () => {
    if (!sessionId || steps.length === 0) return;
    setLoading(true); setError('');
    try {
      const res = await fetch('http://127.0.0.1:5000/api/lineage/replay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, steps }),
      });
      const json = await res.json();
      if (json.success) {
        setCleanData(json.data);
        setColumns(json.columns);
        setResult(json);
      } else {
        setError(json.error);
      }
    } catch { setError('Replay error'); }
    setLoading(false);
  };

  const stepColor = (type) => STEP_TYPES.find(s => s.type === type)?.color || '#94a3b8';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        width: '100%', maxWidth: 700, maxHeight: '90vh', overflowY: 'auto',
        background: 'var(--bg-card)', borderRadius: 20, border: '1px solid var(--border)',
        boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(124,58,237,0.08))',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: 'linear-gradient(135deg, #6366f1, #7c3aed)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <GitBranch size={20} color="white" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>Transformation Lineage</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Build & replay your data pipeline</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 6 }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Init button */}
          {!sessionId ? (
            <div style={{
              background: 'var(--bg-secondary)', borderRadius: 12,
              padding: 20, textAlign: 'center',
            }}>
              <GitBranch size={32} color="#6366f1" style={{ marginBottom: 12 }} />
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
                Initialize a lineage session from your current data to start building a pipeline.
              </div>
              <button
                onClick={initSession}
                disabled={initLoading}
                style={{
                  padding: '10px 24px', borderRadius: 10,
                  background: 'linear-gradient(135deg, #6366f1, #7c3aed)',
                  border: 'none', color: 'white', fontWeight: 700, fontSize: '0.875rem',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, margin: '0 auto',
                }}
              >
                <RefreshCw size={16} /> {initLoading ? 'Initializing…' : 'Initialize Session'}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(99,102,241,0.1)', borderRadius: 10 }}>
              <CheckCircle2 size={14} color="#6366f1" />
              <span style={{ fontSize: '0.8rem', color: '#6366f1', fontWeight: 600 }}>Session Active: {sessionId}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                {sourceData?.length?.toLocaleString()} rows in memory
              </span>
            </div>
          )}

          {/* Pipeline steps */}
          {sessionId && (
            <>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ChevronRight size={16} color="#6366f1" /> Pipeline Steps
                </div>

                {steps.length === 0 && (
                  <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: '0.8rem', background: 'var(--bg-secondary)', borderRadius: 12 }}>
                    No steps added yet. Click + to add your first transformation.
                  </div>
                )}

                {/* Timeline */}
                <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {steps.map((step, idx) => (
                    <div key={step.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 0 }}>
                      {/* Left rail */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 32, flexShrink: 0 }}>
                        <div style={{
                          width: 24, height: 24, borderRadius: '50%',
                          background: stepColor(step.type), color: 'white',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.65rem', fontWeight: 700, flexShrink: 0,
                        }}>{idx + 1}</div>
                        {idx < steps.length - 1 && (
                          <div style={{ width: 2, flex: 1, minHeight: 16, background: 'var(--border)', margin: '4px 0' }} />
                        )}
                      </div>
                      {/* Step card */}
                      <div style={{
                        flex: 1, marginLeft: 12, marginBottom: 8,
                        background: 'var(--bg-secondary)', borderRadius: 10,
                        padding: '10px 14px', border: `1px solid ${stepColor(step.type)}30`,
                        display: 'flex', alignItems: 'center', gap: 12,
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {STEP_TYPES.find(s => s.type === step.type)?.label || step.type}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: 2 }}>
                            {step.column && `column: ${step.column}`}
                            {step.formula && ` | formula: ${step.formula}`}
                          </div>
                        </div>
                        <button
                          onClick={() => removeStep(step.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4 }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Add step form */}
              {showAdd ? (
                <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 16, border: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)', marginBottom: 12 }}>Add Transformation Step</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <select value={newStep.type} onChange={e => setNewStep(p => ({ ...p, type: e.target.value }))}
                      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', color: 'var(--text-primary)', fontSize: '0.8rem' }}>
                      {STEP_TYPES.map(s => <option key={s.type} value={s.type}>{s.label}</option>)}
                    </select>
                    {newStep.type !== 'calc_field' && (
                      <input value={newStep.column} onChange={e => setNewStep(p => ({ ...p, column: e.target.value }))}
                        placeholder="Column name" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', color: 'var(--text-primary)', fontSize: '0.8rem', outline: 'none' }} />
                    )}
                    {newStep.type === 'calc_field' && (
                      <>
                        <input value={newStep.formula} onChange={e => setNewStep(p => ({ ...p, formula: e.target.value }))}
                          placeholder="Formula (e.g. Revenue / Units)" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', color: '#10b981', fontFamily: 'monospace', fontSize: '0.8rem', outline: 'none' }} />
                        <input value={newStep.new_column} onChange={e => setNewStep(p => ({ ...p, new_column: e.target.value }))}
                          placeholder="New column name" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', color: 'var(--text-primary)', fontSize: '0.8rem', outline: 'none' }} />
                      </>
                    )}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={addStep} style={{ flex: 1, padding: '8px', borderRadius: 8, background: '#6366f1', border: 'none', color: 'white', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}>Add Step</button>
                      <button onClick={() => setShowAdd(false)} style={{ padding: '8px 16px', borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem' }}>Cancel</button>
                    </div>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowAdd(true)} style={{
                  padding: '10px', borderRadius: 10, border: '2px dashed var(--border)',
                  background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center',
                  fontSize: '0.8rem', transition: 'all 0.2s',
                }}>
                  <Plus size={14} /> Add Transformation Step
                </button>
              )}

              {error && (
                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '12px 16px', color: '#ef4444', fontSize: '0.875rem' }}>
                  ⚠️ {error}
                </div>
              )}

              {result && (
                <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 10, padding: 16 }}>
                  <div style={{ fontWeight: 700, color: '#10b981', marginBottom: 8, fontSize: '0.875rem' }}>
                    ✅ Pipeline Replayed — {result.row_count.toLocaleString()} rows
                  </div>
                  {result.steps_applied.map((s, i) => (
                    <div key={i} style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                      <CheckCircle2 size={10} color="#10b981" /> {s}
                    </div>
                  ))}
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Close</button>
                <button
                  onClick={replayPipeline}
                  disabled={loading || steps.length === 0}
                  style={{
                    padding: '10px 24px', borderRadius: 10,
                    background: 'linear-gradient(135deg, #6366f1, #7c3aed)',
                    border: 'none', color: 'white', fontWeight: 700,
                    fontSize: '0.875rem', cursor: 'pointer',
                    opacity: loading || steps.length === 0 ? 0.5 : 1,
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}
                >
                  <Play size={16} /> {loading ? 'Replaying…' : 'Replay Pipeline'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
