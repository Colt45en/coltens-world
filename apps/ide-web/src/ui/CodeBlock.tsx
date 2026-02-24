/**
 * CodeBlock - Syntax-highlighted code display with copy functionality
 */

import React, { useState } from "react";
import { Check, Copy } from "lucide-react";
import { GlassPanel } from "./neon";

export interface CodeBlockProps {
  code: string;
  language?: string;
  title?: string;
  showLineNumbers?: boolean;
  maxHeight?: number;
  copyable?: boolean;
}

export function CodeBlock({
  code,
  language = "typescript",
  title,
  showLineNumbers = true,
  maxHeight = 400,
  copyable = true,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy code:", err);
    }
  };

  const lines = code.split("\n");

  return (
    <GlassPanel
      style={{
        borderRadius: 8,
        overflow: "hidden",
        background: "rgba(10, 20, 40, 0.8)",
        border: "1px solid rgba(100, 255, 218, 0.15)",
      }}
    >
      {title && (
        <div
          style={{
            padding: "8px 12px",
            borderBottom: "1px solid rgba(100, 255, 218, 0.1)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "rgba(100, 255, 218, 0.05)",
          }}
        >
          <span style={{ fontSize: 12, fontWeight: "bold", color: "#64ffda" }}>
            {title}
          </span>
          <span style={{ fontSize: 10, color: "rgba(230, 241, 255, 0.5)", textTransform: "uppercase" }}>
            {language}
          </span>
        </div>
      )}

      <div style={{ position: "relative" }}>
        {copyable && (
          <button
            onClick={handleCopy}
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              padding: "6px 10px",
              background: "rgba(100, 255, 218, 0.1)",
              border: "1px solid rgba(100, 255, 218, 0.2)",
              borderRadius: 6,
              color: "#64ffda",
              fontSize: 11,
              fontFamily: "monospace",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              transition: "all 0.2s ease",
              zIndex: 10,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(100, 255, 218, 0.2)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(100, 255, 218, 0.1)";
            }}
          >
            {copied ? (
              <>
                <Check size={14} />
                Copied!
              </>
            ) : (
              <>
                <Copy size={14} />
                Copy
              </>
            )}
          </button>
        )}

        <div
          style={{
            maxHeight,
            overflow: "auto",
            padding: copyable ? "12px 12px 12px 0" : 12,
          }}
        >
          <pre
            style={{
              margin: 0,
              fontSize: 13,
              fontFamily: "monospace",
              lineHeight: 1.6,
              color: "#e6f1ff",
            }}
          >
            {lines.map((line, i) => (
              <div key={i} style={{ display: "flex" }}>
                {showLineNumbers && (
                  <span
                    style={{
                      display: "inline-block",
                      minWidth: 40,
                      paddingRight: 12,
                      textAlign: "right",
                      color: "rgba(230, 241, 255, 0.3)",
                      userSelect: "none",
                    }}
                  >
                    {i + 1}
                  </span>
                )}
                <code style={{ flex: 1 }}>{line || " "}</code>
              </div>
            ))}
          </pre>
        </div>
      </div>
    </GlassPanel>
  );
}
