import { useNavigate } from "react-router-dom";
import { GlassPanel, NeonButton, NeonTitle } from "../ui/neon";
import { Book, BookOpen, Database, ExternalLink, FileText, Library, RefreshCw } from "lucide-react";
import React, { useState, useEffect } from "react";
import { AdvancedMetricsCard } from "../ui/AdvancedMetricsCard";
import { TabPanel, type Tab } from "../ui/TabPanel";
import { LoadingSpinner } from "../ui/LoadingSpinner";

interface LexiconStats {
  totalEntries: number;
  categories: number;
  lastUpdated: string;
  averageWordLength: number;
}

export function LabLexiconPage() {
  const navigate = useNavigate();
  const nucleusBase = (import.meta.env.VITE_NUCLEUS_HTTP as string | undefined) ?? "http://127.0.0.1:3000";
  const bookfoldUrl = `${nucleusBase.replace(/\/$/, "")}/leximorph/bookfold`;
  const [iframeKey, setIframeKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<LexiconStats>({
    totalEntries: 1247,
    categories: 23,
    lastUpdated: new Date().toISOString(),
    averageWordLength: 8.4,
  });

  const handleRefresh = () => {
    setLoading(true);
    setIframeKey(prev => prev + 1);
    setTimeout(() => setLoading(false), 1000);
  };

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1500);
    return () => clearTimeout(timer);
  }, [iframeKey]);

  const bookfoldTab: Tab = {
    id: "bookfold",
    label: "Bookfold Interface",
    icon: <BookOpen size={14} />,
    content: (
      <div style={{ height: "70vh", position: "relative" }}>
        {loading && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(10, 14, 39, 0.9)",
              zIndex: 10,
            }}
          >
            <LoadingSpinner size={48} text="Loading Lexicon..." />
          </div>
        )}
        <iframe
          key={iframeKey}
          src={bookfoldUrl}
          title="Nexus Lexicon Bookfold"
          className="w-full h-full"
          allow="clipboard-read; clipboard-write"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
          style={{
            border: "1px solid rgba(100, 255, 218, 0.1)",
            borderRadius: 8,
          }}
          onLoad={() => setLoading(false)}
        />
      </div>
    ),
  };

  const docsTab: Tab = {
    id: "docs",
    label: "Documentation",
    icon: <FileText size={14} />,
    content: (
      <div style={{ padding: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: "bold", color: "#64ffda", marginBottom: 16 }}>
          Lexicon System Overview
        </h3>

        <div style={{ fontSize: 13, color: "rgba(230, 241, 255, 0.8)", lineHeight: 1.8, marginBottom: 24 }}>
          <p>
            The <strong>Nexus Lexicon</strong> is the central knowledge repository for the World Engine ecosystem.
            It provides structured access to terminology, concepts, APIs, and system documentation.
          </p>
        </div>

        <h4 style={{ fontSize: 14, fontWeight: "bold", color: "#64ffda", marginBottom: 12, marginTop: 24 }}>
          Key Features
        </h4>

        <ul style={{ fontSize: 13, color: "rgba(230, 241, 255, 0.7)", lineHeight: 2, paddingLeft: 20 }}>
          <li><strong>Bookfold Interface:</strong> Browse and search the complete lexicon hierarchy</li>
          <li><strong>API Gateway:</strong> All operations route through Nucleus /leximorph/* endpoints</li>
          <li><strong>Real-time Sync:</strong> Updates propagate across IDE, Brain, and external tools</li>
          <li><strong>Semantic Search:</strong> Find entries by meaning, not just keywords</li>
          <li><strong>Versioning:</strong> Track changes and maintain historical records</li>
          <li><strong>Export/Import:</strong> Share lexicon data across environments</li>
        </ul>

        <h4 style={{ fontSize: 14, fontWeight: "bold", color: "#64ffda", marginBottom: 12, marginTop: 24 }}>
          Integration Points
        </h4>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginTop: 16 }}>
          {[
            { label: "Brain AI", desc: "Cognitive reasoning" },
            { label: "FlowState", desc: "Context analysis" },
            { label: "Nucleus Hub", desc: "Event routing" },
            { label: "IDE Tools", desc: "Code assistance" },
          ].map(item => (
            <div
              key={item.label}
              style={{
                padding: 12,
                background: "rgba(100, 255, 218, 0.05)",
                border: "1px solid rgba(100, 255, 218, 0.15)",
                borderRadius: 8,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: "bold", color: "#64ffda", marginBottom: 4 }}>
                {item.label}
              </div>
              <div style={{ fontSize: 11, color: "rgba(230, 241, 255, 0.6)" }}>
                {item.desc}
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  };

  const apiTab: Tab = {
    id: "api",
    label: "API Reference",
    icon: <Database size={14} />,
    content: (
      <div style={{ padding: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: "bold", color: "#64ffda", marginBottom: 16 }}>
          Lexicon API Endpoints
        </h3>

        <div style={{ fontFamily: "monospace", fontSize: 12 }}>
          {[
            { method: "GET", path: "/leximorph/bookfold", desc: "Access Bookfold UI" },
            { method: "GET", path: "/leximorph/entries", desc: "List all entries" },
            { method: "GET", path: "/leximorph/search?q=...", desc: "Search entries" },
            { method: "POST", path: "/leximorph/entry", desc: "Create new entry" },
            { method: "PUT", path: "/leximorph/entry/:id", desc: "Update entry" },
            { method: "DELETE", path: "/leximorph/entry/:id", desc: "Delete entry" },
          ].map(endpoint => (
            <div
              key={endpoint.path}
              style={{
                padding: 12,
                marginBottom: 8,
                background: "rgba(10, 20, 40, 0.6)",
                border: "1px solid rgba(100, 255, 218, 0.15)",
                borderRadius: 6,
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <span
                style={{
                  padding: "4px 8px",
                  background: endpoint.method === "GET" ? "rgba(100, 200, 150, 0.2)" : "rgba(100, 150, 255, 0.2)",
                  color: endpoint.method === "GET" ? "#64c896" : "#6495ed",
                  borderRadius: 4,
                  fontSize: 10,
                  fontWeight: "bold",
                  minWidth: 50,
                  textAlign: "center",
                }}
              >
                {endpoint.method}
              </span>
              <code style={{ flex: 1, color: "#64ffda" }}>
                {endpoint.path}
              </code>
              <span style={{ fontSize: 11, color: "rgba(230, 241, 255, 0.5)" }}>
                {endpoint.desc}
              </span>
            </div>
          ))}
        </div>
      </div>
    ),
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <GlassPanel className="rounded-2xl p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <NeonTitle as="h2" className="text-2xl flex items-center gap-2">
              <Library className="text-purple-400" size={28} />
              Nexus Bookfold · Lexicon Entry
            </NeonTitle>
            <p className="text-white/60 mt-3">
              Primary lexicon entrypoint. IDE, Nucleus, and Brain operations route through the
              Nucleus <code>/leximorph/*</code> gateway for unified knowledge access and semantic search.
            </p>
          </div>
          <div className="flex gap-2">
            <NeonButton
              onClick={handleRefresh}
              style={{ display: "flex", alignItems: "center", gap: 8 }}
            >
              <RefreshCw size={16} />
              Refresh
            </NeonButton>
            <NeonButton
              onClick={() => window.open(bookfoldUrl, "_blank", "noopener,noreferrer")}
              style={{ display: "flex", alignItems: "center", gap: 8 }}
            >
              <ExternalLink size={16} />
              Open in New Tab
            </NeonButton>
            <NeonButton variant="ghost" onClick={() => navigate("/")}>
              Back
            </NeonButton>
          </div>
        </div>
      </GlassPanel>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <AdvancedMetricsCard
          label="Total Entries"
          value={stats.totalEntries}
          icon={<Book size={20} />}
          color="#9b59b6"
        />
        <AdvancedMetricsCard
          label="Categories"
          value={stats.categories}
          icon={<Database size={20} />}
          color="#64ffda"
        />
        <AdvancedMetricsCard
          label="Avg Word Length"
          value={stats.averageWordLength}
          unit="chars"
          icon={<FileText size={20} />}
          color="#6495ed"
        />
        <AdvancedMetricsCard
          label="Last Updated"
          value={new Date(stats.lastUpdated).toLocaleDateString()}
          icon={<RefreshCw size={20} />}
          color="#ffa500"
        />
      </div>

      {/* Main Content */}
      <GlassPanel className="rounded-2xl" style={{ minHeight: 600 }}>
        <TabPanel tabs={[bookfoldTab, docsTab, apiTab]} defaultTab="bookfold" />
      </GlassPanel>

      {/* Footer Info */}
      <GlassPanel className="rounded-2xl p-4">
        <div className="font-mono text-xs text-white/50 flex items-center justify-between">
          <div>
            <strong>Entry:</strong> {bookfoldUrl}
          </div>
          <div>
            <strong>Gateway:</strong> {nucleusBase.replace(/\/$/, "")}/leximorph
          </div>
        </div>
      </GlassPanel>
    </div>
  );
}
