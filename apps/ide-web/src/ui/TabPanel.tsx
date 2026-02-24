/**
 * TabPanel - Tab navigation component
 */

import React, { useState } from "react";
import { GlassPanel } from "./neon";

export interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
  content: React.ReactNode;
  badge?: number;
}

export interface TabPanelProps {
  tabs: Tab[];
  defaultTab?: string;
  onChange?: (tabId: string) => void;
}

export function TabPanel({ tabs, defaultTab, onChange }: TabPanelProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    onChange?.(tabId);
  };

  const activeContent = tabs.find(t => t.id === activeTab)?.content;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div
        style={{
          display: "flex",
          gap: 4,
          padding: "8px 8px 0 8px",
          borderBottom: "1px solid rgba(100, 255, 218, 0.1)",
        }}
      >
        {tabs.map(tab => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              style={{
                padding: "10px 20px",
                background: isActive ? "rgba(100, 255, 218, 0.1)" : "transparent",
                border: "none",
                borderBottom: isActive ? "2px solid #64ffda" : "2px solid transparent",
                color: isActive ? "#64ffda" : "rgba(230, 241, 255, 0.6)",
                fontSize: 13,
                fontWeight: isActive ? "bold" : "normal",
                fontFamily: "monospace",
                cursor: "pointer",
                transition: "all 0.2s ease",
                display: "flex",
                alignItems: "center",
                gap: 8,
                position: "relative",
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = "#e6f1ff";
                  e.currentTarget.style.background = "rgba(100, 255, 218, 0.05)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = "rgba(230, 241, 255, 0.6)";
                  e.currentTarget.style.background = "transparent";
                }
              }}
            >
              {tab.icon}
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span
                  style={{
                    padding: "2px 6px",
                    background: "#64ffda",
                    color: "#0a0e27",
                    fontSize: 10,
                    fontWeight: "bold",
                    borderRadius: 10,
                    marginLeft: 4,
                  }}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
        {activeContent}
      </div>
    </div>
  );
}
