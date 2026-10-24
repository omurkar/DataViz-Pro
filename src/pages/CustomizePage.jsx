import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { ArrowLeft, Sparkles, ArrowRight, Plus, BarChart3, PieChart, TrendingUp, Activity, Columns, Check } from 'lucide-react';

const SINGLE_COL_CHARTS = [
  { value: 'bar', label: 'Bar Chart', icon: <BarChart3 size={16} /> },
  { value: 'pie', label: 'Pie Chart', icon: <PieChart size={16} /> },
  { value: 'area', label: 'Area Chart', icon: <Activity size={16} /> },
  { value: 'line', label: 'Line Chart', icon: <TrendingUp size={16} /> },
];

const MULTI_COL_CHARTS = [
  { value: 'bar', label: 'Grouped Bar', icon: <BarChart3 size={16} /> },
  { value: 'line', label: 'Multi-Line', icon: <TrendingUp size={16} /> },
  { value: 'area', label: 'Stacked Area', icon: <Activity size={16} /> },
  { value: 'scatter', label: 'Scatter Plot', icon: <Columns size={16} /> },
  { value: 'radar', label: 'Radar Chart', icon: <Activity size={16} /> },
];

export default function CustomizePage() {
  const navigate = useNavigate();
  const { columns, cleanData, addChartConfig, chartConfigs, resetChartConfigs } = useData();
  const [chatMessages, setChatMessages] = useState([]);
  const [phase, setPhase] = useState('select-columns'); // select-columns, select-chart, choose-action, add-new-choice
  const [selectedColumns, setSelectedColumns] = useState([]);
  const [selectedChart, setSelectedChart] = useState('');
  const [geminiSuggesting, setGeminiSuggesting] = useState(false);
  const [suggestedCharts, setSuggestedCharts] = useState([]);
  const chatEndRef = useRef(null);

  // One-time guard: only redirect if user manually navigated here without data
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!columns || columns.length === 0) {
        navigate('/connect');
        return;
      }
      resetChartConfigs();
      addAIMessage("Welcome! Let's build your dashboard. 🎨\n\nWhich columns are the main ones you'd like to visualize?");
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const addAIMessage = (text) => {
    setChatMessages(prev => [...prev, { role: 'ai', text, timestamp: Date.now() }]);
  };

  const addUserMessage = (text) => {
    setChatMessages(prev => [...prev, { role: 'user', text, timestamp: Date.now() }]);
  };

  const toggleColumn = (col) => {
    setSelectedColumns(prev =>
      prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
    );
  };

  const handleColumnsSelected = async () => {
    if (selectedColumns.length === 0) return;
    addUserMessage(`Selected columns: ${selectedColumns.join(', ')}`);
    setPhase('loading');

    // Determine suitable charts
    setGeminiSuggesting(true);
    try {
      const res = await fetch('/api/gemini/suggest-charts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ columns: selectedColumns, allColumns: columns, sampleData: cleanData?.slice(0, 5) || [] }),
      });
      const data = await res.json();
      if (data.charts) {
        setSuggestedCharts(data.charts);
      } else {
        // Fallback if API unavailable
        setSuggestedCharts(selectedColumns.length === 1 ? SINGLE_COL_CHARTS : MULTI_COL_CHARTS);
      }
    } catch {
      setSuggestedCharts(selectedColumns.length === 1 ? SINGLE_COL_CHARTS : MULTI_COL_CHARTS);
    }
    setGeminiSuggesting(false);

    setTimeout(() => {
      addAIMessage(`Great choices! Now select the graph type for these columns.\n\n${selectedColumns.length === 1 ? 'Since you selected 1 column, here are suitable single-column charts:' : `With ${selectedColumns.length} columns selected, here are multi-column chart options:`}`);
      setPhase('select-chart');
    }, 500);
  };

  const handleChartSelected = (chartType) => {
    const chartLabel = [...SINGLE_COL_CHARTS, ...MULTI_COL_CHARTS].find(c => c.value === chartType)?.label || chartType;
    addUserMessage(`Selected chart: ${chartLabel}`);
    setSelectedChart(chartType);

    addChartConfig({
      columns: [...selectedColumns],
      chartType,
      chartLabel,
      id: Date.now(),
    });

    setTimeout(() => {
      addAIMessage(`✅ Added: **${chartLabel}** with columns [${selectedColumns.join(', ')}]\n\nWhat would you like to do next?`);
      setPhase('choose-action');
    }, 300);
  };

  const handleAddNew = () => {
    addUserMessage('Add new chart');
    setTimeout(() => {
      addAIMessage('Would you like to select new main columns or use the same columns with a different graph?');
      setPhase('add-new-choice');
    }, 300);
  };

  const handleNewMain = () => {
    addUserMessage('New main columns');
    setSelectedColumns([]);
    setSelectedChart('');
    setSuggestedCharts([]);
    setTimeout(() => {
      addAIMessage('Select the new columns you want to visualize:');
      setPhase('select-columns');
    }, 300);
  };

  const handleSameMain = () => {
    addUserMessage('Same columns, different graph');
    setSelectedChart('');
    setTimeout(() => {
      addAIMessage(`Using the same columns [${selectedColumns.join(', ')}]. Pick a different graph type:`);
      setPhase('select-chart');
    }, 300);
  };

  const handleAnalyse = () => {
    addUserMessage('Analyse data & generate dashboard');
    navigate('/dashboard-view');
  };

  const availableCharts = suggestedCharts.length > 0 ? suggestedCharts : (selectedColumns.length === 1 ? SINGLE_COL_CHARTS : MULTI_COL_CHARTS);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '24px 32px', display: 'flex', alignItems: 'center', gap: '16px', borderBottom: '1px solid var(--border-color)' }}>
        <button onClick={() => navigate('/eda')} className="btn-secondary" style={{ padding: '8px 14px' }}>
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '1.3rem', fontWeight: '800' }}>
            <span className="gradient-text">What to add</span> in this graph architecture
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            {chartConfigs.length} chart(s) configured
          </p>
        </div>
        {chartConfigs.length > 0 && (
          <button className="btn-primary" onClick={handleAnalyse} id="analyse-btn">
            <BarChart3 size={16} /> Analyse Data <ArrowRight size={16} />
          </button>
        )}
      </div>

      {/* Chat Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
        <div style={{ maxWidth: '700px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {chatMessages.map((msg, i) => (
            <div
              key={i}
              className={msg.role === 'ai' ? 'chat-bubble-ai fade-in-up' : 'chat-bubble-user fade-in-up'}
            >
              {msg.role === 'ai' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: 'var(--accent-primary)', fontSize: '0.75rem', fontWeight: '600' }}>
                  <Sparkles size={14} /> AI Assistant
                </div>
              )}
              <div style={{ fontSize: '0.9rem', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                {msg.text.split('**').map((part, j) => j % 2 === 0 ? part : <strong key={j}>{part}</strong>)}
              </div>
            </div>
          ))}

          {/* Loading */}
          {(phase === 'loading' || geminiSuggesting) && (
            <div className="chat-bubble-ai fade-in-up">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
                <div className="spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }} />
                AI is thinking...
              </div>
            </div>
          )}

          {/* Column Selection */}
          {phase === 'select-columns' && (
            <div className="fade-in-up" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {columns.map(col => (
                  <button
                    key={col}
                    className={`chip ${selectedColumns.includes(col) ? 'active' : ''}`}
                    onClick={() => toggleColumn(col)}
                  >
                    {selectedColumns.includes(col) && <Check size={12} />}
                    {col}
                  </button>
                ))}
              </div>
              {selectedColumns.length > 0 && (
                <button className="btn-primary" onClick={handleColumnsSelected} style={{ alignSelf: 'flex-end' }}>
                  Proceed <ArrowRight size={16} />
                </button>
              )}
            </div>
          )}

          {/* Chart Selection */}
          {phase === 'select-chart' && (
            <div className="fade-in-up" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {availableCharts.map(chart => (
                <button
                  key={chart.value + Math.random()}
                  className="chip"
                  onClick={() => handleChartSelected(chart.value)}
                  style={{ padding: '10px 18px', fontSize: '0.85rem' }}
                >
                  {chart.icon} {chart.label}
                </button>
              ))}
            </div>
          )}

          {/* Action Choice */}
          {phase === 'choose-action' && (
            <div className="fade-in-up" style={{ display: 'flex', gap: '12px' }}>
              <button className="btn-secondary" onClick={handleAddNew}>
                <Plus size={16} /> Add New
              </button>
              <button className="btn-primary" onClick={handleAnalyse}>
                <BarChart3 size={16} /> Analyse Data
              </button>
            </div>
          )}

          {/* Add New Choice */}
          {phase === 'add-new-choice' && (
            <div className="fade-in-up" style={{ display: 'flex', gap: '12px' }}>
              <button className="btn-secondary" onClick={handleNewMain}>
                <Columns size={16} /> New Main
              </button>
              <button className="btn-secondary" onClick={handleSameMain}>
                <BarChart3 size={16} /> Same Main
              </button>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Bottom bar - chart configs summary */}
      {chartConfigs.length > 0 && (
        <div style={{ padding: '16px 32px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
          <div style={{ maxWidth: '700px', margin: '0 auto', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginRight: '8px' }}>Charts:</span>
            {chartConfigs.map((cfg, i) => (
              <div key={i} className="chip active" style={{ fontSize: '0.75rem' }}>
                {cfg.chartLabel} ({cfg.columns.join(', ')})
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
