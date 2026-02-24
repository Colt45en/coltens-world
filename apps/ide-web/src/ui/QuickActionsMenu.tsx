/**
 * QuickActionsMenu - Command palette and quick navigation
 */

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Command, Zap, ExternalLink } from "lucide-react";
import { ROUTES } from "../world/routes";

interface QuickAction {
  id: string;
  label: string;
  description?: string;
  keywords?: string[];
  icon?: React.ReactNode;
  action: () => void;
  group?: string;
}

interface QuickActionsMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export function QuickActionsMenu({ isOpen, onClose }: QuickActionsMenuProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const actions = useMemo(
    (): QuickAction[] => [
      // Navigation
      {
        id: "nav-home",
        label: "Go to Home",
        description: "Return to launcher page",
        keywords: ["home", "launcher", "main"],
        icon: <Command size={16} />,
        action: () => navigate(ROUTES.root),
        group: "Navigation",
      },
      {
        id: "nav-studio",
        label: "Open Studio",
        description: "Ontology IDE workspace",
        keywords: ["studio", "ide", "editor"],
        icon: <Zap size={16} />,
        action: () => navigate(ROUTES.lab.studio),
        group: "Navigation",
      },
      {
        id: "nav-brain",
        label: "Open Brain Console",
        description: "AI reasoning and chat interface",
        keywords: ["brain", "ai", "chat", "agent"],
        icon: <Zap size={16} />,
        action: () => navigate(ROUTES.lab.brain),
        group: "Navigation",
      },
      {
        id: "nav-nucleus",
        label: "Open Nucleus Monitor",
        description: "WebSocket event inspector",
        keywords: ["nucleus", "websocket", "events", "monitor"],
        icon: <Zap size={16} />,
        action: () => navigate(ROUTES.lab.nucleus),
        group: "Navigation",
      },
      {
        id: "nav-lexicon",
        label: "Open Lexicon",
        description: "Knowledge base and bookfold",
        keywords: ["lexicon", "bookfold", "knowledge", "docs"],
        icon: <Zap size={16} />,
        action: () => navigate(ROUTES.lab.lexicon),
        group: "Navigation",
      },
      {
        id: "nav-ecosystem",
        label: "Open Ecosystem Dashboard",
        description: "System-wide monitoring",
        keywords: ["ecosystem", "dashboard", "monitoring", "health"],
        icon: <Zap size={16} />,
        action: () => navigate(ROUTES.lab.ecosystem),
        group: "Navigation",
      },
      {
        id: "nav-settings",
        label: "Open Settings",
        description: "System preferences and configuration",
        keywords: ["settings", "preferences", "config"],
        icon: <Zap size={16} />,
        action: () => navigate(ROUTES.settings),
        group: "Navigation",
      },
      {
        id: "nav-flowstate",
        label: "Open FlowState Panel",
        description: "Context analysis and metrics",
        keywords: ["flowstate", "analysis", "metrics"],
        icon: <Zap size={16} />,
        action: () => navigate(ROUTES.lab.flowstate),
        group: "Navigation",
      },
      {
        id: "nav-prefab",
        label: "Open Prefab Engine",
        description: "3D model generator",
        keywords: ["prefab", "3d", "model", "engine"],
        icon: <Zap size={16} />,
        action: () => navigate(ROUTES.lab.prefabEngine),
        group: "Navigation",
      },
      // Quick Actions
      {
        id: "action-clear-cache",
        label: "Clear Local Storage",
        description: "Reset all cached data",
        keywords: ["clear", "cache", "reset", "storage"],
        action: () => {
          if (confirm("Clear all local storage?")) {
            localStorage.clear();
            alert("Local storage cleared!");
          }
        },
        group: "Actions",
      },
      {
        id: "action-reload",
        label: "Reload Page",
        description: "Refresh the application",
        keywords: ["reload", "refresh", "restart"],
        action: () => window.location.reload(),
        group: "Actions",
      },
      {
        id: "action-external-nucleus",
        label: "Open Nucleus in Browser",
        description: "http://localhost:3000",
        keywords: ["nucleus", "browser", "external"],
        icon: <ExternalLink size={16} />,
        action: () => window.open("http://localhost:3000", "_blank"),
        group: "External",
      },
      {
        id: "action-external-brain",
        label: "Open Brain API",
        description: "http://127.0.0.1:8001",
        keywords: ["brain", "api", "external"],
        icon: <ExternalLink size={16} />,
        action: () => window.open("http://127.0.0.1:8001", "_blank"),
        group: "External",
      },
    ],
    [navigate]
  );

  const filteredActions = useMemo(() => {
    if (!query.trim()) return actions;

    const q = query.toLowerCase();
    return actions.filter((action) => {
      const searchText = [
        action.label,
        action.description || "",
        ...(action.keywords || []),
      ].join(" ").toLowerCase();

      return searchText.includes(q);
    });
  }, [actions, query]);

  const groupedActions = useMemo(() => {
    const groups = new Map<string, QuickAction[]>();
    filteredActions.forEach((action) => {
      const group = action.group || "Other";
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group)!.push(action);
    });
    return Array.from(groups.entries());
  }, [filteredActions]);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filteredActions.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const action = filteredActions[selectedIndex];
        if (action) {
          action.action();
          onClose();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, filteredActions, selectedIndex, onClose]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(10, 14, 39, 0.9)",
        backdropFilter: "blur(8px)",
        zIndex: 10000,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "10vh",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "90%",
          maxWidth: 640,
          background: "rgba(20, 30, 60, 0.95)",
          border: "1px solid rgba(100, 255, 218, 0.3)",
          borderRadius: 12,
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5), 0 0 40px rgba(100, 255, 218, 0.2)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div
          style={{
            padding: 16,
            borderBottom: "1px solid rgba(100, 255, 218, 0.15)",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <Search size={20} style={{ color: "#64ffda" }} />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search actions... (Esc to close)"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "#e6f1ff",
              fontSize: 16,
              fontFamily: "monospace",
            }}
          />
        </div>

        {/* Results */}
        <div style={{ maxHeight: "60vh", overflowY: "auto", padding: "8px 0" }}>
          {filteredActions.length === 0 ? (
            <div
              style={{
                padding: 32,
                textAlign: "center",
                color: "rgba(230, 241, 255, 0.5)",
                fontSize: 14,
              }}
            >
              No actions found for "{query}"
            </div>
          ) : (
            groupedActions.map(([group, groupActions]) => (
              <div key={group} style={{ marginBottom: 8 }}>
                <div
                  style={{
                    padding: "8px 16px",
                    fontSize: 11,
                    fontWeight: "bold",
                    color: "rgba(100, 255, 218, 0.6)",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  {group}
                </div>
                {groupActions.map((action, absoluteIndex) => {
                  const index = filteredActions.indexOf(action);
                  const isSelected = index === selectedIndex;

                  return (
                    <button
                      key={action.id}
                      onClick={() => {
                        action.action();
                        onClose();
                      }}
                      onMouseEnter={() => setSelectedIndex(index)}
                      style={{
                        width: "100%",
                        padding: "12px 16px",
                        background: isSelected
                          ? "rgba(100, 255, 218, 0.15)"
                          : "transparent",
                        border: "none",
                        borderLeft: isSelected
                          ? "3px solid #64ffda"
                          : "3px solid transparent",
                        textAlign: "left",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        transition: "all 0.15s ease",
                      }}
                    >
                      {action.icon && (
                        <div style={{ color: "#64ffda" }}>{action.icon}</div>
                      )}
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: "bold",
                            color: isSelected ? "#64ffda" : "#e6f1ff",
                            marginBottom: action.description ? 2 : 0,
                          }}
                        >
                          {action.label}
                        </div>
                        {action.description && (
                          <div
                            style={{
                              fontSize: 12,
                              color: "rgba(230, 241, 255, 0.6)",
                            }}
                          >
                            {action.description}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "8px 16px",
            borderTop: "1px solid rgba(100, 255, 218, 0.15)",
            display: "flex",
            justifyContent: "space-between",
            fontSize: 11,
            color: "rgba(230, 241, 255, 0.5)",
            fontFamily: "monospace",
          }}
        >
          <span>↑↓ Navigate • Enter Select • Esc Close</span>
          <span>{filteredActions.length} actions</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to trigger quick actions menu with keyboard shortcut
 */
export function useQuickActionsMenu() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return { isOpen, setIsOpen };
}
