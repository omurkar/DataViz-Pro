/**
 * AutoDashboardPage — Phase 4 & 5: Zero-Click Auto-Visualization
 * 
 * Flow:
 *  1. Receives clean data from DataContext (post EDA or post upload)
 *  2. Calls /api/auto-dashboard → gets standardized dashboard config
 *  3. Shows animated loading sequence ("Cleaning… Profiling… Discovering…")
 *  4. Reveals fully-populated dashboard (KPI cards + auto-charts)
 *  5. "Edit Mode" toggles react-grid-layout for drag/resize/delete
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { useTheme } from '../context/ThemeContext';
import GridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

import DynamicChart from '../components/DynamicChart';
import {
  BarChart3, Sparkles, Settings2, Trash2, Plus, ArrowLeft,
  Sun, Moon, LogOut, TrendingUp, Activity, Database, RefreshCw,
  GripVertical, X, CheckCircle2, Zap, Brain,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// ── Loading step sequence ─────────────────────────────────────
const LOADING_STEPS = [
  { label: 'Cleaning Data',         icon: <RefreshCw size={18} />, color: '#7c3aed', ms: 0 },
  { label: 'Profiling Columns',     icon: <Database size={18} />,  color: '#3b82f6', ms: 900 },
  { label: 'Discovering Insights',  icon: <Brain size={18} />,     color: '#06b6d4', ms: 1800 },
  { label: 'Generating Dashboard',  icon: <Sparkles size={18} />,  color: '#10b981', ms: 2700 },
];

function LoadingSequence({ onDone }) {
  const [activeStep, setActiveStep] = useState(0);
  const [doneSteps, setDoneSteps] = useState([]);

  useEffect(() => {
    LOADING_STEPS.forEach((step, i) => {
      setTimeout(() => {
        setActiveStep(i);
        if (i > 0) setDoneSteps(prev => [...prev, i - 1]);
      }, step.ms);
    });
    setTimeout(() => {
      setDoneSteps([0, 1, 2, 3]);
      setTimeout(onDone, 300);
    }, 3600);
  }, [onDone]);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '60vh', gap: 40,
    }}>
      {/* Orbit animation */}
      <div style={{ position: 'relative', width: 120, height: 120 }}>
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          border: '2px solid rgba(124,58,237,0.25)',
          animation: 'spin 3s linear infinite',
        }} />
        <div style={{
          position: 'absolute', inset: 10, borderRadius: '50%',
          border: '2px solid rgba(59,130,246,0.3)',
          animation: 'spin 2s linear infinite reverse',
        }} />
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Sparkles size={36} color="#7c3aed" />
        </div>
      </div>

      {/* Step list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 280 }}>
        {LOADING_STEPS.map((step, i) => {
          const isDone   = doneSteps.includes(i);
          const isActive = activeStep === i && !isDone;
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              opacity: i <= activeStep ? 1 : 0.3,
              transition: 'opacity 0.5s ease',
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: isDone ? '#10b981' : isActive ? step.color : 'var(--surface-alt)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', transition: 'background 0.4s',
                flexShrink: 0,
                boxShadow: isActive ? `0 0 18px ${step.color}66` : 'none',
              }}>
                {isDone ? <CheckCircle2 size={18} /> : step.icon}
              </div>
              <span style={{
                color: isActive ? 'var(--text)' : 'var(--text-muted)',
                fontWeight: isActive ? 700 : 500,
                fontSize: '0.95rem',
                transition: 'color 0.4s',
              }}>
                {step.label}
                {isActive && <span className="loading-dots">...</span>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── KPI Card ────────────────────────────────────────────────
function KpiCard({ kpi, index }) {
  const colors = ['#7c3aed', '#3b82f6', '#06b6d4', '#10b981'];
  const color  = colors[index % colors.length];
  return (
    <div className="glass-card" style={{
      padding: '20px 24px',
      borderLeft: `3px solid ${color}`,
      animation: `fadeSlideUp 0.5s ease ${index * 0.1}s both`,
    }}>
      <div style={{ fontSize: '0.75rem', fontWeight: 700, color, textTransform: 'uppercase',
        letterSpacing: '0.08em', marginBottom: 6 }}>
        {kpi.title}
      </div>
      <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>
        {kpi.value}
      </div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 6 }}>
        {kpi.trend}
      </div>
    </div>
  );
}

// ── Chart Tile (wrapper for grid) ───────────────────────────
function ChartTile({ config, editMode, onDelete, style }) {
  return (
    <div
      className="glass-card"
      style={{
        padding: 20,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
        ...style,
      }}
    >
      {editMode && (
        <div style={{
          position: 'absolute', top: 8, right: 8, display: 'flex', gap: 6, zIndex: 10,
        }}>
          <button
            onClick={() => onDelete(config.id)}
            style={{
              background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 6, padding: '4px 6px', cursor: 'pointer', color: '#ef4444',
              display: 'flex', alignItems: 'center',
            }}
            title="Remove chart"
          >
            <X size={13} />
          </button>
          <div style={{
            background: 'var(--surface-alt)', border: '1px solid var(--border)',
            borderRadius: 6, padding: '4px 6px', cursor: 'grab', color: 'var(--text-muted)',
            display: 'flex', alignItems: 'center',
          }}
            className="drag-handle" title="Drag to move"
          >
            <GripVertical size={13} />
          </div>
        </div>
      )}
      <DynamicChart config={config} height={230} />
    </div>
  );
}

// ── MAIN PAGE ──────────────────────────────────────────────
const BACKEND_URL = 'http://localhost:5000';
const COLS = 12;

export default function AutoDashboardPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { isDark, toggle } = useTheme();
  const {
    cleanData, columns, tableName, dataSource,
    autoDashboard, setAutoDashboard,
    autoDashboardStatus, setAutoDashboardStatus,
    autoDashboardError, setAutoDashboardError,
    editModeActive, setEditModeActive,
  } = useData();

  const [showLoading, setShowLoading] = useState(false);
  const [charts, setCharts] = useState([]);
  const [kpiCards, setKpiCards] = useState([]);
  const [layout, setLayout] = useState([]);
  const [engineUsed, setEngineUsed] = useState('heuristic');
  const [metaInfo, setMetaInfo] = useState(null);
  const [containerWidth, setContainerWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth - 48 : 1200
  );

  // Track container width for responsive grid
  useEffect(() => {
    const handleResize = () => setContainerWidth(window.innerWidth - 48);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ── Fetch auto-dashboard config ───────────────────────────
  const fetchDashboard = useCallback(async (data, cols) => {
    setAutoDashboardStatus('loading');
    setShowLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/auto-dashboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data, columns: cols, use_llm: true }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Dashboard generation failed');

      setAutoDashboard(json.dashboard);
      setCharts(json.dashboard.charts || []);
      setKpiCards(json.dashboard.kpi_cards || []);
      setEngineUsed(json.dashboard.meta?.engine || 'heuristic');
      setMetaInfo(json.dashboard.meta || null);

      // Build initial grid layout
      const initialLayout = (json.dashboard.charts || []).map((c, i) => ({
        i: c.id,
        x: (i % 2) * 6,
        y: Math.floor(i / 2) * 4,
        w: c.type === 'scatter' ? 6 : c.type === 'pie' ? 4 : 6,
        h: 4,
        minW: 3,
        minH: 3,
      }));
      setLayout(initialLayout);
      setAutoDashboardStatus('done');
    } catch (err) {
      setAutoDashboardError(err.message);
      setAutoDashboardStatus('error');
    }
  }, [setAutoDashboard, setAutoDashboardStatus, setAutoDashboardError]);

  // Trigger on mount if data is available
  useEffect(() => {
    if (!cleanData) {
      navigate('/connect');
      return;
    }
    // If already loaded, restore from context
    if (autoDashboardStatus === 'done' && autoDashboard) {
      setCharts(autoDashboard.charts || []);
      setKpiCards(autoDashboard.kpi_cards || []);
      setEngineUsed(autoDashboard.meta?.engine || 'heuristic');
      setMetaInfo(autoDashboard.meta || null);
      const storedLayout = (autoDashboard.charts || []).map((c, i) => ({
        i: c.id, x: (i % 2) * 6, y: Math.floor(i / 2) * 4,
        w: c.type === 'scatter' ? 6 : c.type === 'pie' ? 4 : 6, h: 4, minW: 3, minH: 3,
      }));
      setLayout(storedLayout);
      return;
    }
    fetchDashboard(cleanData, columns);
  }, []); // eslint-disable-line

  const handleLoadingDone = () => setShowLoading(false);

  const handleDeleteChart = (chartId) => {
    setCharts(prev => prev.filter(c => c.id !== chartId));
    setLayout(prev => prev.filter(l => l.i !== chartId));
  };

  const handleRefresh = () => fetchDashboard(cleanData, columns);

  // ── Nav helpers ───────────────────────────────────────────
  const navLinks = [
    { label: 'Overview',   path: '/dashboard' },
    { label: 'Connect',    path: '/connect' },
    { label: 'EDA',        path: '/eda' },
    { label: 'Auto Viz',   path: '/auto-dashboard', active: true },
    { label: 'Custom',     path: '/customize' },
    { label: 'History',    path: '/history' },
  ];

  // ─────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      {/* Top Nav */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', gap: 0,
        padding: '0 24px', height: 58,
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        backdropFilter: 'blur(16px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 32 }}>
          <BarChart3 size={22} color="#7c3aed" />
          <span style={{ fontWeight: 800, fontSize: '1rem', letterSpacing: '-0.01em' }}>DataViz Pro</span>
        </div>

        <div style={{ display: 'flex', gap: 4, flex: 1 }}>
          {navLinks.map(l => (
            <button key={l.path} onClick={() => navigate(l.path)} style={{
              background: l.active ? 'rgba(124,58,237,0.15)' : 'none',
              border: 'none', borderRadius: 8, padding: '6px 14px',
              color: l.active ? '#7c3aed' : 'var(--text-muted)',
              fontWeight: l.active ? 700 : 500, fontSize: '0.85rem', cursor: 'pointer',
            }}>
              {l.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={toggle} style={{
            background: 'var(--surface-alt)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: 'var(--text-muted)',
            display: 'flex', alignItems: 'center',
          }}>
            {isDark ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <button onClick={logout} style={{
            background: 'none', border: '1px solid var(--border)', borderRadius: 8,
            padding: '6px 12px', cursor: 'pointer', color: 'var(--text-muted)',
            fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <LogOut size={13} /> Sign Out
          </button>
        </div>
      </nav>

      <div style={{ padding: '32px 24px', maxWidth: 1400, margin: '0 auto' }}>
        {/* ── Loading Phase ── */}
        {autoDashboardStatus === 'loading' && showLoading && (
          <LoadingSequence onDone={handleLoadingDone} />
        )}

        {/* ── Error State ── */}
        {autoDashboardStatus === 'error' && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', minHeight: '50vh', gap: 16,
          }}>
            <div style={{ fontSize: '3rem' }}>⚠️</div>
            <h2 style={{ margin: 0, color: 'var(--text)' }}>Dashboard Generation Failed</h2>
            <p style={{ color: 'var(--text-muted)', maxWidth: 420, textAlign: 'center' }}>
              {autoDashboardError}
            </p>
            <button onClick={handleRefresh} className="btn-primary" style={{ gap: 8 }}>
              <RefreshCw size={15} /> Retry
            </button>
          </div>
        )}

        {/* ── Dashboard Reveal ── */}
        {autoDashboardStatus === 'done' && !showLoading && (
          <>
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <Sparkles size={22} color="#7c3aed" />
                  <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>
                    Auto-Generated Dashboard
                  </h1>
                  <span style={{
                    background: engineUsed === 'llm' ? 'rgba(124,58,237,0.15)' : 'rgba(59,130,246,0.15)',
                    color: engineUsed === 'llm' ? '#7c3aed' : '#3b82f6',
                    fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em',
                    padding: '3px 8px', borderRadius: 20, textTransform: 'uppercase',
                  }}>
                    {engineUsed === 'llm' ? '✦ Gemini AI' : '⚙ Heuristic'}
                  </span>
                </div>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  {metaInfo?.rows?.toLocaleString()} rows · {metaInfo?.columns?.length} columns
                  {tableName && ` · ${tableName}`}
                  {metaInfo?.cleaning_steps?.length > 0 && ` · ${metaInfo.cleaning_steps.length} auto-clean step(s)`}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={handleRefresh} style={{
                  background: 'var(--surface-alt)', border: '1px solid var(--border)',
                  borderRadius: 10, padding: '8px 16px', cursor: 'pointer',
                  color: 'var(--text-muted)', fontSize: '0.85rem',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <RefreshCw size={14} /> Regenerate
                </button>
                <button
                  onClick={() => setEditModeActive(v => !v)}
                  style={{
                    background: editModeActive ? 'rgba(124,58,237,0.15)' : 'var(--surface-alt)',
                    border: `1px solid ${editModeActive ? '#7c3aed' : 'var(--border)'}`,
                    borderRadius: 10, padding: '8px 16px', cursor: 'pointer',
                    color: editModeActive ? '#7c3aed' : 'var(--text-muted)',
                    fontSize: '0.85rem', fontWeight: editModeActive ? 700 : 400,
                    display: 'flex', alignItems: 'center', gap: 8,
                    transition: 'all 0.2s',
                  }}
                >
                  <Settings2 size={14} />
                  {editModeActive ? 'Done Editing' : 'Edit Layout'}
                </button>
                <button onClick={() => navigate('/customize')} className="btn-primary" style={{
                  borderRadius: 10, padding: '8px 16px', fontSize: '0.85rem',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <Plus size={14} /> Add Chart
                </button>
              </div>
            </div>

            {/* Edit mode banner */}
            {editModeActive && (
              <div style={{
                background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.25)',
                borderRadius: 12, padding: '12px 20px', marginBottom: 20,
                display: 'flex', alignItems: 'center', gap: 12,
                color: '#7c3aed', fontSize: '0.85rem',
              }}>
                <GripVertical size={16} />
                <strong>Edit Mode Active</strong> — Drag widgets to rearrange, resize from corners, or click × to remove.
              </div>
            )}

            {/* ── KPI Strip ── */}
            {kpiCards.length > 0 && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${Math.min(kpiCards.length, 4)}, 1fr)`,
                gap: 16, marginBottom: 28,
              }}>
                {kpiCards.map((kpi, i) => (
                  <KpiCard key={kpi.id} kpi={kpi} index={i} />
                ))}
              </div>
            )}

            {/* ── Chart Grid ── */}
            {charts.length === 0 ? (
              <div className="glass-card" style={{
                padding: 48, textAlign: 'center', color: 'var(--text-muted)',
              }}>
                <BarChart3 size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
                <p>No charts were generated. Your dataset may have too few numeric or categorical columns.</p>
                <button onClick={() => navigate('/customize')} className="btn-primary" style={{ marginTop: 16 }}>
                  Build Charts Manually
                </button>
              </div>
            ) : editModeActive ? (
              /* ── Draggable / Resizable Edit Mode ── */
              <GridLayout
                className="layout"
                layout={layout}
                cols={COLS}
                rowHeight={72}
                width={containerWidth}
                onLayoutChange={setLayout}
                draggableHandle=".drag-handle"
                resizeHandles={['se']}
                margin={[16, 16]}
              >
                {charts.map(cfg => (
                  <div key={cfg.id}>
                    <ChartTile
                      config={cfg}
                      editMode
                      onDelete={handleDeleteChart}
                      style={{ height: '100%' }}
                    />
                  </div>
                ))}
              </GridLayout>
            ) : (
              /* ── Static Masonry-Style Grid ── */
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))',
                gap: 20,
              }}>
                {charts.map((cfg, i) => (
                  <div
                    key={cfg.id}
                    style={{
                      gridColumn: cfg.type === 'line' || cfg.type === 'area' ? 'span 2' : 'span 1',
                      animation: `fadeSlideUp 0.5s ease ${0.05 * i}s both`,
                    }}
                  >
                    <ChartTile
                      config={cfg}
                      editMode={false}
                      onDelete={handleDeleteChart}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* ── Cleaning steps footer ── */}
            {metaInfo?.cleaning_steps?.length > 0 && (
              <div style={{
                marginTop: 32, background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 14, padding: '16px 20px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
                  color: '#10b981', fontWeight: 700, fontSize: '0.85rem' }}>
                  <CheckCircle2 size={15} /> Auto-Cleaning Summary
                </div>
                <ul style={{ margin: 0, padding: '0 0 0 20px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  {metaInfo.cleaning_steps.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            )}
          </>
        )}
      </div>

      {/* CSS animations */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .loading-dots {
          display: inline-block;
          animation: blink 1.2s step-start infinite;
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        .react-resizable-handle {
          background: rgba(124,58,237,0.4);
          border-radius: 2px;
        }
        .react-grid-item.react-grid-placeholder {
          background: rgba(124,58,237,0.15) !important;
          border: 2px dashed #7c3aed !important;
          border-radius: 14px !important;
          opacity: 1 !important;
        }
      `}</style>
    </div>
  );
}
