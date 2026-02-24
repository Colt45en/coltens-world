/**
 * DataTable - Advanced data table with sorting, filtering, and pagination
 */

import React, { useState, useMemo } from "react";
import { ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { GlassPanel } from "./neon";

export interface Column<T> {
  key: keyof T;
  label: string;
  sortable?: boolean;
  render?: (value: any, row: T) => React.ReactNode;
  width?: number | string;
}

export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  pageSize?: number;
  searchable?: boolean;
  searchKeys?: (keyof T)[];
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
}

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  pageSize = 10,
  searchable = true,
  searchKeys = [],
  emptyMessage = "No data available",
  onRowClick,
}: DataTableProps<T>) {
  const [page, setPage] = useState(0);
  const [sortBy, setSortBy] = useState<keyof T | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [search, setSearch] = useState("");

  const filteredData = useMemo(() => {
    let result = [...data];

    // Search filter
    if (search && searchKeys.length > 0) {
      const query = search.toLowerCase();
      result = result.filter(row =>
        searchKeys.some(key => {
          const value = String(row[key] || "").toLowerCase();
          return value.includes(query);
        })
      );
    }

    // Sorting
    if (sortBy) {
      result.sort((a, b) => {
        const aVal = a[sortBy];
        const bVal = b[sortBy];

        if (aVal < bVal) return sortAsc ? -1 : 1;
        if (aVal > bVal) return sortAsc ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [data, search, searchKeys, sortBy, sortAsc]);

  const paginatedData = useMemo(() => {
    const start = page * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, page, pageSize]);

  const totalPages = Math.ceil(filteredData.length / pageSize);

  const handleSort = (key: keyof T) => {
    if (sortBy === key) {
      setSortAsc(prev => !prev);
    } else {
      setSortBy(key);
      setSortAsc(true);
    }
  };

  return (
    <GlassPanel style={{ borderRadius: 12, overflow: "hidden" }}>
      {searchable && (
        <div style={{ padding: 12, borderBottom: "1px solid rgba(100, 255, 218, 0.1)" }}>
          <div style={{ position: "relative" }}>
            <Search
              size={16}
              style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "rgba(230, 241, 255, 0.5)" }}
            />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              style={{
                width: "100%",
                padding: "8px 8px 8px 36px",
                background: "rgba(10, 20, 40, 0.5)",
                border: "1px solid rgba(100, 255, 218, 0.2)",
                borderRadius: 6,
                color: "#e6f1ff",
                fontSize: 13,
                fontFamily: "monospace",
                outline: "none",
              }}
            />
          </div>
        </div>
      )}

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: "monospace" }}>
          <thead>
            <tr style={{ background: "rgba(100, 255, 218, 0.05)", borderBottom: "1px solid rgba(100, 255, 218, 0.15)" }}>
              {columns.map(col => (
                <th
                  key={String(col.key)}
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                  style={{
                    padding: "12px 16px",
                    textAlign: "left",
                    color: "#64ffda",
                    fontWeight: "bold",
                    cursor: col.sortable !== false ? "pointer" : "default",
                    width: col.width || "auto",
                    userSelect: "none",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {col.label}
                    {col.sortable !== false && sortBy === col.key && (
                      sortAsc ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ padding: 32, textAlign: "center", color: "rgba(230, 241, 255, 0.5)" }}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paginatedData.map((row, i) => (
                <tr
                  key={i}
                  onClick={() => onRowClick?.(row)}
                  style={{
                    borderBottom: "1px solid rgba(100, 255, 218, 0.05)",
                    cursor: onRowClick ? "pointer" : "default",
                    transition: "background 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (onRowClick) e.currentTarget.style.background = "rgba(100, 255, 218, 0.05)";
                  }}
                  onMouseLeave={(e) => {
                    if (onRowClick) e.currentTarget.style.background = "transparent";
                  }}
                >
                  {columns.map(col => (
                    <td key={String(col.key)} style={{ padding: "12px 16px", color: "#e6f1ff" }}>
                      {col.render ? col.render(row[col.key], row) : String(row[col.key] || "-")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div
          style={{
            padding: 12,
            borderTop: "1px solid rgba(100, 255, 218, 0.1)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: 12, color: "rgba(230, 241, 255, 0.6)" }}>
            Showing {page * pageSize + 1}-{Math.min((page + 1) * pageSize, filteredData.length)} of {filteredData.length}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              style={{
                padding: "6px 10px",
                background: page === 0 ? "rgba(100, 255, 218, 0.05)" : "rgba(100, 255, 218, 0.1)",
                border: "1px solid rgba(100, 255, 218, 0.2)",
                borderRadius: 6,
                color: page === 0 ? "rgba(230, 241, 255, 0.3)" : "#64ffda",
                cursor: page === 0 ? "not-allowed" : "pointer",
                fontSize: 11,
                fontFamily: "monospace",
              }}
            >
              <ChevronLeft size={14} />
            </button>
            <span style={{ padding: "6px 12px", fontSize: 12, color: "rgba(230, 241, 255, 0.7)" }}>
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              style={{
                padding: "6px 10px",
                background: page === totalPages - 1 ? "rgba(100, 255, 218, 0.05)" : "rgba(100, 255, 218, 0.1)",
                border: "1px solid rgba(100, 255, 218, 0.2)",
                borderRadius: 6,
                color: page === totalPages - 1 ? "rgba(230, 241, 255, 0.3)" : "#64ffda",
                cursor: page === totalPages - 1 ? "not-allowed" : "pointer",
                fontSize: 11,
                fontFamily: "monospace",
              }}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </GlassPanel>
  );
}
