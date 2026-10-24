/**
 * NLGInsight — Feature 7: Automated Text Insights
 * Fetches a one-sentence LLM/rule-based insight for a chart and displays it.
 */
import React, { useState, useEffect } from 'react';
import { Lightbulb, RefreshCw } from 'lucide-react';

export default function NLGInsight({ chartConfig, compact = false }) {
  const [insight, setInsight] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchInsight = async () => {
    if (!chartConfig?.data || chartConfig.data.length === 0) return;
    setLoading(true);
    try {
      const res = await fetch('http://127.0.0.1:5000/api/nlg-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chart_config: chartConfig,
          data: chartConfig.data,
        }),
      });
      const json = await res.json();
      if (json.success) setInsight(json.insight);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchInsight();
  }, [chartConfig?.id]);

  if (!insight && !loading) return null;

  if (compact) {
    return (
      <div style={{
        fontSize: '0.72rem', color: 'var(--text-muted)',
        lineHeight: 1.4, fontStyle: 'italic',
        borderLeft: '2px solid #7c3aed',
        paddingLeft: 8, marginTop: 6,
      }}>
        {loading ? '…' : insight}
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 8,
      background: 'rgba(124,58,237,0.07)', borderRadius: 8,
      padding: '8px 12px', marginTop: 8,
      border: '1px solid rgba(124,58,237,0.2)',
    }}>
      <Lightbulb size={13} color="#7c3aed" style={{ flexShrink: 0, marginTop: 1 }} />
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: '0.75rem' }}>
          <RefreshCw size={10} style={{ animation: 'spin 1s linear infinite' }} /> Generating insight…
        </div>
      ) : (
        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {insight}
        </span>
      )}
    </div>
  );
}
