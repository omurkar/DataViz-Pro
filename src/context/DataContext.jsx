import React, { createContext, useContext, useState } from 'react';

const DataContext = createContext();

export function useData() {
  return useContext(DataContext);
}

export function DataProvider({ children }) {
  // Database connection info
  const [dbConfig, setDbConfig] = useState({
    host: 'localhost',
    port: '3306',
    user: '',
    password: '',
    database: '',
  });

  // Data source: 'mysql' | 'excel'
  const [dataSource, setDataSource] = useState('mysql');

  // Raw extracted data
  const [rawData, setRawData] = useState(null);
  const [columns, setColumns] = useState([]);
  const [tableName, setTableName] = useState('');
  const [tables, setTables] = useState([]);

  // Cleaned data
  const [cleanData, setCleanData] = useState(null);
  const [trashData, setTrashData] = useState(null);
  const [edaSummary, setEdaSummary] = useState(null);
  const [geminiValidation, setGeminiValidation] = useState(null);

  // Chart configurations (accumulated from customization page)
  const [chartConfigs, setChartConfigs] = useState([]);

  // ── AUTO DASHBOARD ───────────────────────────────────────────
  // Stores the Phase 3 dashboard config object returned by /api/auto-dashboard
  const [autoDashboard, setAutoDashboard] = useState(null);
  // 'idle' | 'loading' | 'done' | 'error'
  const [autoDashboardStatus, setAutoDashboardStatus] = useState('idle');
  const [autoDashboardError, setAutoDashboardError] = useState(null);
  // Grid layout for edit mode (react-grid-layout format)
  const [dashboardLayout, setDashboardLayout] = useState([]);
  // Whether the user has activated Edit Mode on the auto-dashboard
  const [editModeActive, setEditModeActive] = useState(false);
  // ─────────────────────────────────────────────────────────────

  // Dashboard settings
  const [dashboardSettings, setDashboardSettings] = useState({
    colorTheme: 'purple', // purple, ocean, sunset
    gridCols: 2,
  });

  // Session ID for Firestore (so DashboardView can update the same session)
  const [currentSessionId, setCurrentSessionId] = useState(null);

  // Add a new chart config
  const addChartConfig = (config) => {
    setChartConfigs(prev => [...prev, config]);
  };

  // Reset chart configs
  const resetChartConfigs = () => {
    setChartConfigs([]);
  };

  const resetAll = () => {
    setDataSource('mysql');
    setRawData(null);
    setColumns([]);
    setTableName('');
    setTables([]);
    setCleanData(null);
    setTrashData(null);
    setEdaSummary(null);
    setGeminiValidation(null);
    setChartConfigs([]);
    setDashboardSettings({ colorTheme: 'purple', gridCols: 2 });
    setCurrentSessionId(null);
    setAutoDashboard(null);
    setAutoDashboardStatus('idle');
    setAutoDashboardError(null);
    setDashboardLayout([]);
    setEditModeActive(false);
  };

  const value = {
    dbConfig, setDbConfig,
    dataSource, setDataSource,
    rawData, setRawData,
    columns, setColumns,
    tableName, setTableName,
    tables, setTables,
    cleanData, setCleanData,
    trashData, setTrashData,
    edaSummary, setEdaSummary,
    geminiValidation, setGeminiValidation,
    chartConfigs, setChartConfigs, addChartConfig, resetChartConfigs,
    dashboardSettings, setDashboardSettings,
    currentSessionId, setCurrentSessionId,
    autoDashboard, setAutoDashboard,
    autoDashboardStatus, setAutoDashboardStatus,
    autoDashboardError, setAutoDashboardError,
    dashboardLayout, setDashboardLayout,
    editModeActive, setEditModeActive,
    resetAll,
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
}
