/**
 * FilterContext — Feature 4: Cross-Filtering
 * Global cross-filter state. When a chart segment is clicked,
 * it publishes a filter. All other charts consume it.
 */
import React, { createContext, useContext, useState, useCallback } from 'react';

const FilterContext = createContext();

export function useFilters() {
  return useContext(FilterContext);
}

export function FilterProvider({ children }) {
  // filters: { [column]: value } — active cross-filters
  const [filters, setFilters] = useState({});

  const applyFilter = useCallback((column, value) => {
    setFilters(prev => {
      // Toggle: clicking the same value again clears it
      if (prev[column] === value) {
        const next = { ...prev };
        delete next[column];
        return next;
      }
      return { ...prev, [column]: value };
    });
  }, []);

  const clearFilter = useCallback((column) => {
    setFilters(prev => {
      const next = { ...prev };
      delete next[column];
      return next;
    });
  }, []);

  const clearAllFilters = useCallback(() => setFilters({}), []);

  /**
   * applyFiltersToData: filters a data array based on active filters.
   * Each chart should call this before rendering.
   */
  const applyFiltersToData = useCallback((data, xColumn) => {
    if (!data || Object.keys(filters).length === 0) return data;
    return data.filter(row => {
      return Object.entries(filters).every(([col, val]) => {
        // Don't filter on own column (avoids self-filtering)
        if (col === xColumn) return true;
        const rowVal = String(row[col] ?? row['name'] ?? '');
        return rowVal === String(val);
      });
    });
  }, [filters]);

  const activeFilterCount = Object.keys(filters).length;

  return (
    <FilterContext.Provider value={{
      filters,
      applyFilter,
      clearFilter,
      clearAllFilters,
      applyFiltersToData,
      activeFilterCount,
    }}>
      {children}
    </FilterContext.Provider>
  );
}
