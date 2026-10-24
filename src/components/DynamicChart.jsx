/**
 * DynamicChart — Phase 4 Chart Factory Component
 * Renders any chart type from a standardized config object.
 * Supported types: 'line', 'bar', 'scatter', 'pie', 'area'
 */
import React, { useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, ScatterChart, Scatter,
  PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { Sparkles, Info } from 'lucide-react';

// ── Palette ──────────────────────────────────────────────────
const PALETTE = [
  '#7c3aed', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b',
  '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316',
];

const DARK_BG   = 'rgba(30,24,58,0.0)';  // transparent — parent card provides bg

// ── Tooltip ──────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '10px',
      padding: '10px 14px',
      fontSize: '0.8rem',
      color: 'var(--text)',
      boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
    }}>
      {label && <p style={{ color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || PALETTE[i], margin: '2px 0' }}>
          {p.name}: <strong>{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</strong>
        </p>
      ))}
    </div>
  );
}

// ── Scatter Tooltip ──────────────────────────────────────────
function ScatterTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0]?.payload;
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: '10px', padding: '10px 14px', fontSize: '0.8rem', color: 'var(--text)',
    }}>
      <p>x: <strong>{d?.x}</strong></p>
      <p>y: <strong>{d?.y}</strong></p>
    </div>
  );
}

// ── PIE label ────────────────────────────────────────────────
function renderPieLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }) {
  if (percent < 0.04) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.6;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central"
      fontSize={11} fontWeight={600} style={{ pointerEvents: 'none' }}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

// ── Axis tick formatter ───────────────────────────────────────
const shortTick = (v) => {
  if (typeof v === 'number') {
    if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
    if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(0)}k`;
    return v;
  }
  const s = String(v);
  return s.length > 10 ? s.slice(0, 9) + '…' : s;
};

// ── MAIN COMPONENT ───────────────────────────────────────────
export default function DynamicChart({ config, height = 260 }) {
  const [showInfo, setShowInfo] = useState(false);

  if (!config) return null;
  const { type, title, data = [], xAxis, yAxis } = config;

  const axisStyle = {
    tick: { fill: 'var(--text-muted)', fontSize: 11 },
    axisLine: { stroke: 'var(--border)' },
    tickLine: false,
  };

  const gridStyle = { stroke: 'var(--border)', strokeOpacity: 0.5, strokeDasharray: '3 3' };

  // ── Shared chart wrappers ────────────────────────────────────
  const withContainer = (chart) => (
    <ResponsiveContainer width="100%" height={height}>
      {chart}
    </ResponsiveContainer>
  );

  // ── Render by type ───────────────────────────────────────────
  let chartEl = null;

  if (type === 'line') {
    chartEl = withContainer(
      <LineChart data={data} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
        <CartesianGrid {...gridStyle} />
        <XAxis dataKey="name" {...axisStyle} tickFormatter={shortTick} />
        <YAxis {...axisStyle} tickFormatter={shortTick} />
        <Tooltip content={<CustomTooltip />} />
        <Line
          type="monotone" dataKey="value" stroke={PALETTE[0]}
          strokeWidth={2.5} dot={false} activeDot={{ r: 5 }}
        />
      </LineChart>
    );
  } else if (type === 'area') {
    chartEl = withContainer(
      <AreaChart data={data} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={PALETTE[0]} stopOpacity={0.3} />
            <stop offset="95%" stopColor={PALETTE[0]} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid {...gridStyle} />
        <XAxis dataKey="name" {...axisStyle} tickFormatter={shortTick} />
        <YAxis {...axisStyle} tickFormatter={shortTick} />
        <Tooltip content={<CustomTooltip />} />
        <Area type="monotone" dataKey="value" stroke={PALETTE[0]} strokeWidth={2.5}
          fill="url(#areaGrad)" dot={false} />
      </AreaChart>
    );
  } else if (type === 'bar') {
    chartEl = withContainer(
      <BarChart data={data} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}
        barSize={Math.min(32, Math.floor(600 / Math.max(data.length, 1)))}>
        <CartesianGrid {...gridStyle} vertical={false} />
        <XAxis dataKey="name" {...axisStyle} tickFormatter={shortTick} />
        <YAxis {...axisStyle} tickFormatter={shortTick} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Bar>
      </BarChart>
    );
  } else if (type === 'scatter') {
    chartEl = withContainer(
      <ScatterChart margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
        <CartesianGrid {...gridStyle} />
        <XAxis dataKey="x" name={xAxis} {...axisStyle} tickFormatter={shortTick} />
        <YAxis dataKey="y" name={yAxis} {...axisStyle} tickFormatter={shortTick} />
        <Tooltip content={<ScatterTooltip />} cursor={{ strokeDasharray: '3 3' }} />
        <Scatter data={data} fill={PALETTE[1]} opacity={0.75} />
      </ScatterChart>
    );
  } else if (type === 'pie') {
    chartEl = withContainer(
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name"
          cx="50%" cy="50%"
          outerRadius={Math.min(height * 0.38, 110)}
          innerRadius={Math.min(height * 0.18, 50)}
          paddingAngle={2}
          labelLine={false}
          label={renderPieLabel}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          formatter={(v) => <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{v}</span>}
          iconSize={10}
          wrapperStyle={{ paddingTop: 8 }}
        />
      </PieChart>
    );
  } else {
    // Fallback to bar for unknown types
    chartEl = withContainer(
      <BarChart data={data} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
        <CartesianGrid {...gridStyle} />
        <XAxis dataKey="name" {...axisStyle} />
        <YAxis {...axisStyle} />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="value" fill={PALETTE[0]} radius={[4, 4, 0, 0]} />
      </BarChart>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%' }}>
      {/* Chart header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <span style={{
            fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em',
            color: PALETTE[0], textTransform: 'uppercase', opacity: 0.85,
          }}>
            {type}
          </span>
          <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)', lineHeight: 1.3 }}>
            {title}
          </h3>
        </div>
        {(xAxis || yAxis) && (
          <button
            onClick={() => setShowInfo(v => !v)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', padding: 4, borderRadius: 6,
            }}
            title="Column details"
          >
            <Info size={14} />
          </button>
        )}
      </div>

      {showInfo && (
        <div style={{
          background: 'var(--surface-alt)', borderRadius: 8, padding: '6px 10px',
          marginBottom: 10, fontSize: '0.75rem', color: 'var(--text-muted)',
          display: 'flex', gap: 12,
        }}>
          {xAxis && <span>X: <strong style={{ color: 'var(--text)' }}>{xAxis}</strong></span>}
          {yAxis && <span>Y: <strong style={{ color: 'var(--text)' }}>{yAxis}</strong></span>}
          <span>{data.length} pts</span>
        </div>
      )}

      {data.length === 0 ? (
        <div style={{
          height, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-muted)', fontSize: '0.85rem',
        }}>
          No data available
        </div>
      ) : chartEl}
    </div>
  );
}
