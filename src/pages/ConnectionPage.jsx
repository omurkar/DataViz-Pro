import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { useTheme } from '../context/ThemeContext';
import {
  Database, ArrowLeft, Plug, ChevronDown, CheckCircle2, AlertCircle,
  Table2, Upload, FileSpreadsheet, X, Sun, Moon, BarChart3,
} from 'lucide-react';

// ── Top navigation bar shared component ─────────────────────────
function TopBar({ onBack }) {
  const { isDark, toggle } = useTheme();
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '36px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <button onClick={onBack} className="btn-secondary" style={{ padding: '9px 14px' }} id="back-btn">
          <ArrowLeft size={17} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '36px', height: '36px', background: 'var(--accent-gradient)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BarChart3 size={18} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: '800', letterSpacing: '-0.5px' }}>
              <span className="gradient-text">Connect</span> Data Source
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '1px' }}>
              Choose how to bring your data in
            </p>
          </div>
        </div>
      </div>
      <button
        onClick={toggle}
        style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
          borderRadius: '9px', padding: '8px 12px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '5px',
          color: 'var(--text-secondary)', fontSize: '0.78rem', fontWeight: '500',
        }}
        id="conn-theme-toggle"
      >
        {isDark ? <Sun size={14} /> : <Moon size={14} />}
        {isDark ? 'Light' : 'Dark'}
      </button>
    </div>
  );
}

// ── Error box ───────────────────────────────────────────────────
function ErrorBox({ message }) {
  if (!message) return null;
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: '10px',
      padding: '13px 16px', background: 'var(--danger-bg)',
      border: '1px solid rgba(239,68,68,0.25)', borderRadius: '10px',
      marginBottom: '22px', color: 'var(--danger)', fontSize: '0.83rem', fontWeight: '500',
    }}>
      <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
      {message}
    </div>
  );
}

// ── Source Selector Tabs ─────────────────────────────────────────
function SourceTab({ label, icon, active, onClick, id }) {
  return (
    <button
      id={id}
      onClick={onClick}
      style={{
        flex: 1, padding: '14px 16px', border: 'none', cursor: 'pointer',
        borderRadius: '12px', fontWeight: '600', fontSize: '0.875rem',
        fontFamily: 'Inter, sans-serif', transition: 'all 0.2s ease',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
        background: active ? 'var(--bg-card)' : 'transparent',
        color: active ? 'var(--text-primary)' : 'var(--text-muted)',
        boxShadow: active ? 'var(--shadow-card)' : 'none',
        border: active ? '1px solid var(--glass-border)' : '1px solid transparent',
      }}
    >
      <div style={{
        width: '36px', height: '36px', borderRadius: '10px', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        background: active ? 'var(--accent-gradient)' : 'var(--bg-secondary)',
        color: active ? 'white' : 'var(--text-muted)',
        transition: 'all 0.2s ease',
      }}>
        {icon}
      </div>
      {label}
    </button>
  );
}

// ── MYSQL CONNECTION PANEL ──────────────────────────────────────
function MySQLPanel({ dbConfig, setDbConfig, navigate, setRawData, setColumns, setTableName, tables, setTables, setDataSource }) {
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [selectedTable, setSelectedTable] = useState('');
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);
  const extractionIdRef = useRef(null);
  const rawDataRef = useRef(null);

  // Navigate when rawData updates from THIS extraction
  const [pendingNav, setPendingNav] = useState(false);
  useEffect(() => {
    if (pendingNav && rawDataRef.current?.length > 0) {
      setPendingNav(false);
      navigate('/eda');
    }
  }, [pendingNav, navigate]);

  const handleChange = (field, value) => setDbConfig(prev => ({ ...prev, [field]: value }));

  const handleConnect = async () => {
    setConnecting(true); setError('');
    try {
      const res = await fetch('/api/connect', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dbConfig),
      });
      const data = await res.json();
      if (data.success) { setTables(data.tables || []); setConnected(true); setStep(2); }
      else setError(data.error || 'Connection failed');
    } catch { setError('Cannot connect to backend. Make sure the Python server is running on port 5000.'); }
    setConnecting(false);
  };

  const handleExtract = async () => {
    if (!selectedTable || extracting) return;
    setExtracting(true); setError('');
    setRawData(null); setColumns([]); setTableName('');
    try {
      const res = await fetch('/api/extract', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...dbConfig, table: selectedTable }),
      });
      const data = await res.json();
      if (data.success) {
        setDataSource('mysql');
        rawDataRef.current = data.data;
        setRawData(data.data);
        setColumns(data.columns);
        setTableName(selectedTable);
        navigate('/eda');
      } else { setError(data.error || 'Data extraction failed'); setExtracting(false); }
    } catch (err) {
      setError(`Failed to extract data: ${err.message || 'Check if backend server is running on port 5000.'}`);
      setExtracting(false);
    }
  };

  const fields = [
    { key: 'host', label: 'Host', placeholder: 'localhost', type: 'text' },
    { key: 'port', label: 'Port', placeholder: '3306', type: 'text' },
    { key: 'user', label: 'Username', placeholder: 'root', type: 'text' },
    { key: 'password', label: 'Password', placeholder: '••••••••', type: 'password' },
    { key: 'database', label: 'Database Name', placeholder: 'my_database', type: 'text' },
  ];

  // Step indicator
  const steps = ['Enter Credentials', 'Select Table'];

  return (
    <>
      {/* Step indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '28px' }}>
        {steps.map((label, i) => (
          <React.Fragment key={i}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className={`step-dot ${step > i + 1 ? 'done' : step === i + 1 ? 'active' : 'pending'}`}>
                {step > i + 1 ? <CheckCircle2 size={15} /> : i + 1}
              </div>
              <span style={{ fontSize: '0.82rem', fontWeight: step === i + 1 ? '600' : '400', color: step === i + 1 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && <div className={`step-line ${step > i + 1 ? 'done' : ''}`} />}
          </React.Fragment>
        ))}
      </div>

      <ErrorBox message={error} />

      {step === 1 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <div style={{ width: '42px', height: '42px', background: 'rgba(124,58,237,0.12)', borderRadius: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Database size={21} color="var(--accent-primary)" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: '700' }}>MySQL Connection</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Enter your database credentials</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {fields.map(f => (
              <div key={f.key}>
                <label className="input-label">{f.label}</label>
                <input type={f.type} className="input-field" placeholder={f.placeholder}
                  value={dbConfig[f.key]} onChange={e => handleChange(f.key, e.target.value)} id={`db-${f.key}`} />
              </div>
            ))}
          </div>

          <button className="btn-primary" id="connect-btn"
            style={{ width: '100%', justifyContent: 'center', marginTop: '24px', padding: '13px', opacity: connecting ? 0.7 : 1 }}
            onClick={handleConnect} disabled={connecting || !dbConfig.database}>
            {connecting ? <><div className="spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }} /> Connecting…</> : <><Plug size={17} /> Connect to Database</>}
          </button>
        </>
      )}

      {step === 2 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '22px' }}>
            <div style={{ width: '42px', height: '42px', background: 'rgba(16,185,129,0.12)', borderRadius: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={21} color="var(--success)" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: '700' }}>Connected Successfully</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Database: <strong>{dbConfig.database}</strong></p>
            </div>
          </div>

          <label className="input-label"><Table2 size={11} style={{ display: 'inline', marginRight: '4px' }} /> Select a Table</label>
          <div style={{ position: 'relative', marginBottom: '24px' }}>
            <select className="input-field" style={{ appearance: 'none', paddingRight: '40px', cursor: 'pointer' }}
              value={selectedTable} onChange={e => setSelectedTable(e.target.value)} id="table-select">
              <option value="">— Choose a table —</option>
              {tables.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <ChevronDown size={16} style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn-secondary" onClick={() => { setStep(1); setConnected(false); }} style={{ flex: 1, justifyContent: 'center' }}>
              <ArrowLeft size={15} /> Back
            </button>
            <button className="btn-primary" id="extract-btn"
              style={{ flex: 2, justifyContent: 'center', opacity: extracting || !selectedTable ? 0.6 : 1 }}
              onClick={handleExtract} disabled={extracting || !selectedTable}>
              {extracting ? <><div className="spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }} /> Extracting…</> : <><Database size={17} /> Extract & Analyze</>}
            </button>
          </div>
        </>
      )}
    </>
  );
}

// ── EXCEL / CSV UPLOAD PANEL ────────────────────────────────────
function ExcelPanel({ navigate, setRawData, setColumns, setTableName, setDataSource }) {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef(null);

  const ACCEPTED = ['.xlsx', '.xls', '.csv'];
  const MAX_MB = 50;

  const validateFile = (f) => {
    if (!f) return 'No file selected.';
    const ext = '.' + f.name.split('.').pop().toLowerCase();
    if (!ACCEPTED.includes(ext)) return `Unsupported file type. Please upload ${ACCEPTED.join(', ')} files.`;
    if (f.size > MAX_MB * 1024 * 1024) return `File is too large. Maximum size is ${MAX_MB} MB.`;
    return null;
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    const err = validateFile(f);
    if (err) { setError(err); return; }
    setError(''); setFile(f);
  }, []);

  const handleDragOver = (e) => { e.preventDefault(); setDragging(true); };
  const handleDragLeave = () => setDragging(false);

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    const err = validateFile(f);
    if (err) { setError(err); return; }
    setError(''); setFile(f);
  };

  const handleUpload = async () => {
    if (!file || uploading) return;
    setUploading(true); setError(''); setProgress(20);

    const formData = new FormData();
    formData.append('file', file);

    // Fake progress for UX feel
    const tick = setInterval(() => setProgress(p => Math.min(p + 10, 85)), 350);

    try {
      const res = await fetch('/api/upload-excel', { method: 'POST', body: formData });
      clearInterval(tick);
      setProgress(100);
      const data = await res.json();
      if (data.success) {
        setDataSource('excel');
        setRawData(data.data);
        setColumns(data.columns);
        setTableName(data.fileName || file.name.replace(/\.[^.]+$/, ''));
        navigate('/eda');
      } else {
        setError(data.error || 'Upload failed. Please check your file and try again.');
        setUploading(false); setProgress(0);
      }
    } catch (err) {
      clearInterval(tick);
      setError(`Upload failed: ${err.message || 'Make sure the Python server is running on port 5000.'}`);
      setUploading(false); setProgress(0);
    }
  };

  const removeFile = () => { setFile(null); setError(''); setProgress(0); if (fileInputRef.current) fileInputRef.current.value = ''; };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <div style={{ width: '42px', height: '42px', background: 'rgba(37,99,235,0.12)', borderRadius: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <FileSpreadsheet size={21} color="var(--accent-blue-light)" />
        </div>
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: '700' }}>Upload Excel or CSV</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Same automated EDA pipeline as MySQL — instantly</p>
        </div>
      </div>

      <ErrorBox message={error} />

      {/* Drop Zone */}
      {!file ? (
        <div
          className={`drop-zone ${dragging ? 'drag-over' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          id="excel-drop-zone"
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', pointerEvents: 'none' }}>
            <div style={{
              width: '56px', height: '56px', borderRadius: '14px',
              background: 'var(--accent-gradient)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', color: 'white',
              boxShadow: '0 6px 20px rgba(124,58,237,0.3)',
            }}>
              <Upload size={26} />
            </div>
            <div>
              <p style={{ fontWeight: '600', fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
                {dragging ? 'Drop it here!' : 'Drop your file here'}
              </p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                or <span style={{ color: 'var(--accent-secondary)', fontWeight: '600' }}>click to browse</span>
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
              {ACCEPTED.map(ext => (
                <span key={ext} className="badge badge-purple">{ext.toUpperCase()}</span>
              ))}
              <span className="badge badge-info">Max {MAX_MB} MB</span>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            style={{ display: 'none' }}
            id="excel-file-input"
          />
        </div>
      ) : (
        /* File Preview */
        <div style={{
          padding: '20px', background: 'var(--bg-secondary)', borderRadius: '12px',
          border: '1px solid var(--border-subtle)', marginBottom: '8px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '46px', height: '46px', borderRadius: '11px', flexShrink: 0,
              background: 'linear-gradient(135deg, #059669, #10b981)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
            }}>
              <FileSpreadsheet size={22} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: '600', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {file.name}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '2px' }}>
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </div>
            </div>
            {!uploading && (
              <button onClick={removeFile} className="btn-ghost" style={{ padding: '6px', color: 'var(--danger)' }}>
                <X size={16} />
              </button>
            )}
          </div>

          {/* Upload progress */}
          {uploading && (
            <div style={{ marginTop: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                <span>Processing…</span>
                <span>{progress}%</span>
              </div>
              <div className="progress-bar-track">
                <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Feature bullets */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '18px 0 22px' }}>
        {[
          'Automatic null handling & data imputation',
          'Duplicate detection & case normalization',
          'Date parsing & type inference',
          'AI-powered dashboard generation',
        ].map((text, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            <CheckCircle2 size={14} style={{ color: 'var(--success)', flexShrink: 0 }} />
            {text}
          </div>
        ))}
      </div>

      {file ? (
        <button className="btn-primary" id="upload-btn"
          style={{ width: '100%', justifyContent: 'center', padding: '13px', opacity: uploading ? 0.7 : 1 }}
          onClick={handleUpload} disabled={uploading}>
          {uploading ? <><div className="spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }} /> Analyzing data…</> : <><Upload size={17} /> Upload & Run EDA</>}
        </button>
      ) : (
        <button className="btn-secondary"
          style={{ width: '100%', justifyContent: 'center', padding: '13px' }}
          onClick={() => fileInputRef.current?.click()} id="browse-btn">
          <FileSpreadsheet size={17} /> Browse Files
        </button>
      )}
    </>
  );
}

// ── Main Connection Page ─────────────────────────────────────────
export default function ConnectionPage() {
  const navigate = useNavigate();
  const { dbConfig, setDbConfig, setRawData, setColumns, setTableName, tables, setTables, setDataSource } = useData();
  const [source, setSource] = useState('mysql'); // 'mysql' | 'excel'

  return (
    <div style={{ minHeight: '100vh', padding: '28px 32px' }}>
      <TopBar onBack={() => navigate('/dashboard')} />

      {/* Source selector */}
      <div style={{ maxWidth: '640px', margin: '0 auto 32px' }}>
        <div style={{ display: 'flex', gap: '8px', background: 'var(--bg-secondary)', padding: '6px', borderRadius: '14px' }}>
          <SourceTab
            id="tab-mysql"
            label="MySQL Database"
            icon={<Database size={18} />}
            active={source === 'mysql'}
            onClick={() => setSource('mysql')}
          />
          <SourceTab
            id="tab-excel"
            label="Excel / CSV File"
            icon={<FileSpreadsheet size={18} />}
            active={source === 'excel'}
            onClick={() => setSource('excel')}
          />
        </div>
      </div>

      {/* Panel card */}
      <div className="glass-card fade-in-up" style={{ maxWidth: '640px', margin: '0 auto', padding: '36px' }}>
        {source === 'mysql' ? (
          <MySQLPanel
            dbConfig={dbConfig}
            setDbConfig={setDbConfig}
            navigate={navigate}
            setRawData={setRawData}
            setColumns={setColumns}
            setTableName={setTableName}
            tables={tables}
            setTables={setTables}
            setDataSource={setDataSource}
          />
        ) : (
          <ExcelPanel
            navigate={navigate}
            setRawData={setRawData}
            setColumns={setColumns}
            setTableName={setTableName}
            setDataSource={setDataSource}
          />
        )}
      </div>
    </div>
  );
}
