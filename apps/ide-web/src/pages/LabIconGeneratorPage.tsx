/**
 * Lab Icon Generator Page - Interactive deterministic icon generation demo
 */

import React, { useState, useEffect, useMemo } from "react";
import {
  extractPosts,
  generateIconSvg,
  type PostMetadata,
} from "../utils/iconGenerator";

const SAMPLE_INPUT = `Icon for The Becoming
The Becoming: A reflection on transformation and identity in the digital age
January 30, 2026

Icon for Neural Cartography
Neural Cartography: Mapping the topology of thought
February 5, 2026

Icon for Temporal Mechanics
Temporal Mechanics: Understanding causality in distributed systems
February 12, 2026

Icon for Emergence Patterns
Emergence Patterns: How complexity arises from simplicity
February 18, 2026

Icon for Semantic Drift
Semantic Drift: When meanings shift over time
February 21, 2026`;

const LabIconGeneratorPage: React.FC = () => {
  const [inputText, setInputText] = useState(SAMPLE_INPUT);
  const [iconSize, setIconSize] = useState(96);
  const [selectedPost, setSelectedPost] = useState<PostMetadata | null>(null);

  const posts = useMemo(() => {
    try {
      return extractPosts(inputText);
    } catch (err) {
      console.error("Parse error:", err);
      return [];
    }
  }, [inputText]);

  const icons = useMemo(() => {
    return posts.map((post) => ({
      post,
      svg: generateIconSvg({
        seed: post.seed,
        title: post.title,
        size: iconSize,
      }),
    }));
  }, [posts, iconSize]);

  useEffect(() => {
    if (posts.length > 0 && !selectedPost) {
      const firstPost = posts[0];
      if (firstPost) setSelectedPost(firstPost);
    }
  }, [posts, selectedPost]);

  const selectedIcon = useMemo(() => {
    if (!selectedPost) return null;
    return generateIconSvg({
      seed: selectedPost.seed,
      title: selectedPost.title,
      size: 256,
    });
  }, [selectedPost]);

  const handleDownload = (post: PostMetadata, svg: string) => {
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${post.slug}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadAll = () => {
    icons.forEach(({ post, svg }) => {
      setTimeout(() => handleDownload(post, svg), 100 * icons.indexOf({ post, svg }));
    });
  };

  const handleCopySvg = (svg: string) => {
    navigator.clipboard.writeText(svg);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: "#0b0b10",
        color: "#e8e8ea",
      }}
    >
      {/* Header */}
      <div style={{ padding: "20px", borderBottom: "1px solid #2a2a3a" }}>
        <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 600 }}>
          🎨 Deterministic Icon Generator
        </h1>
        <p style={{ margin: "8px 0 0", color: "#888", fontSize: "14px" }}>
          Production-grade identicons: same title/date → same icon (always)
        </p>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Left: Input */}
        <div
          style={{
            width: "400px",
            borderRight: "1px solid #2a2a3a",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "20px", borderBottom: "1px solid #2a2a3a" }}>
            <h3 style={{ margin: "0 0 12px", fontSize: "14px", fontWeight: 600 }}>
              Input Text
            </h3>
            <p style={{ margin: "0 0 12px", fontSize: "12px", color: "#888" }}>
              Format: "Icon for [Title]" followed by date
            </p>

            <div style={{ marginBottom: "16px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "4px",
                  fontSize: "13px",
                }}
              >
                Icon Size: {iconSize}px
              </label>
              <input
                type="range"
                min="48"
                max="256"
                step="8"
                value={iconSize}
                onChange={(e) => setIconSize(Number(e.target.value))}
                style={{ width: "100%" }}
                title="Icon size control"
                aria-label="Adjust icon size"
              />
            </div>

            <button
              onClick={handleDownloadAll}
              disabled={icons.length === 0}
              style={{
                width: "100%",
                padding: "10px",
                background: icons.length === 0 ? "#333" : "#00f3ff",
                color: icons.length === 0 ? "#666" : "#000",
                border: "none",
                borderRadius: "6px",
                cursor: icons.length === 0 ? "not-allowed" : "pointer",
                fontWeight: 600,
                fontSize: "13px",
              }}
            >
              ⬇ Download All ({icons.length})
            </button>
          </div>

          <div style={{ flex: 1, overflow: "auto", padding: "20px" }}>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Paste your blog index text here..."
              style={{
                width: "100%",
                height: "100%",
                minHeight: "400px",
                background: "#0a0a0f",
                border: "1px solid #2a2a3a",
                borderRadius: "6px",
                padding: "12px",
                color: "#e8e8ea",
                fontSize: "13px",
                fontFamily: "monospace",
                resize: "none",
              }}
            />
          </div>
        </div>

        {/* Middle: Icon Grid */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "20px", borderBottom: "1px solid #2a2a3a" }}>
            <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 600 }}>
              Generated Icons ({posts.length})
            </h3>
          </div>

          <div
            style={{
              flex: 1,
              overflow: "auto",
              padding: "20px",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
              gap: "16px",
              alignContent: "start",
            }}
          >
            {icons.map(({ post, svg }) => (
              <div
                key={post.slug}
                onClick={() => setSelectedPost(post)}
                style={{
                  background: "#141420",
                  border:
                    selectedPost?.slug === post.slug
                      ? "2px solid #00f3ff"
                      : "1px solid #2a2a3a",
                  borderRadius: "8px",
                  padding: "12px",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  if (selectedPost?.slug !== post.slug) {
                    e.currentTarget.style.borderColor = "#444";
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedPost?.slug !== post.slug) {
                    e.currentTarget.style.borderColor = "#2a2a3a";
                  }
                }}
              >
                <div
                  dangerouslySetInnerHTML={{ __html: svg }}
                  style={{
                    width: `${iconSize}px`,
                    height: `${iconSize}px`,
                    margin: "0 auto 8px",
                  }}
                />
                <div
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    marginBottom: "4px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={post.title}
                >
                  {post.title}
                </div>
                {post.date && (
                  <div style={{ fontSize: "10px", color: "#888" }}>
                    {post.date}
                  </div>
                )}
              </div>
            ))}

            {posts.length === 0 && (
              <div
                style={{
                  gridColumn: "1 / -1",
                  padding: "40px",
                  textAlign: "center",
                  color: "#666",
                  fontSize: "14px",
                }}
              >
                <p style={{ margin: "0 0 8px" }}>No posts found</p>
                <p style={{ margin: 0, fontSize: "12px" }}>
                  Enter "Icon for [Title]" format text on the left
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Detail Panel */}
        {selectedPost && (
          <div
            style={{
              width: "360px",
              borderLeft: "1px solid #2a2a3a",
              display: "flex",
              flexDirection: "column",
              overflow: "auto",
            }}
          >
            <div style={{ padding: "20px", borderBottom: "1px solid #2a2a3a" }}>
              <h3 style={{ margin: "0 0 12px", fontSize: "14px", fontWeight: 600 }}>
                Icon Details
              </h3>

              {/* Large preview */}
              <div
                style={{
                  background: "#0a0a0f",
                  border: "1px solid #2a2a3a",
                  borderRadius: "8px",
                  padding: "24px",
                  marginBottom: "16px",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                {selectedIcon && (
                  <div
                    dangerouslySetInnerHTML={{ __html: selectedIcon }}
                    style={{ width: "256px", height: "256px" }}
                  />
                )}
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
                <button
                  onClick={() =>
                    selectedIcon && handleDownload(selectedPost, selectedIcon)
                  }
                  style={{
                    flex: 1,
                    padding: "10px",
                    background: "#00f3ff",
                    color: "#000",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: "12px",
                  }}
                >
                  Download SVG
                </button>
                <button
                  onClick={() => selectedIcon && handleCopySvg(selectedIcon)}
                  style={{
                    flex: 1,
                    padding: "10px",
                    background: "#1a1a28",
                    color: "#e8e8ea",
                    border: "1px solid #2a2a3a",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "12px",
                  }}
                >
                  Copy SVG
                </button>
              </div>

              {/* Metadata */}
              <div
                style={{
                  background: "#0a0a0f",
                  border: "1px solid #2a2a3a",
                  borderRadius: "6px",
                  padding: "12px",
                  fontSize: "12px",
                }}
              >
                <div style={{ marginBottom: "8px" }}>
                  <div style={{ color: "#888", marginBottom: "2px" }}>Title</div>
                  <div style={{ fontFamily: "monospace", fontSize: "11px" }}>
                    {selectedPost.title}
                  </div>
                </div>

                {selectedPost.date && (
                  <div style={{ marginBottom: "8px" }}>
                    <div style={{ color: "#888", marginBottom: "2px" }}>Date</div>
                    <div style={{ fontFamily: "monospace", fontSize: "11px" }}>
                      {selectedPost.date}
                    </div>
                  </div>
                )}

                <div style={{ marginBottom: "8px" }}>
                  <div style={{ color: "#888", marginBottom: "2px" }}>Slug</div>
                  <div style={{ fontFamily: "monospace", fontSize: "11px" }}>
                    {selectedPost.slug}
                  </div>
                </div>

                <div>
                  <div style={{ color: "#888", marginBottom: "2px" }}>
                    Seed (deterministic)
                  </div>
                  <div
                    style={{
                      fontFamily: "monospace",
                      fontSize: "11px",
                      wordBreak: "break-all",
                    }}
                  >
                    {selectedPost.seed}
                  </div>
                </div>
              </div>
            </div>

            {/* Algorithm Info */}
            <div style={{ padding: "20px" }}>
              <h4
                style={{
                  margin: "0 0 12px",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#00f3ff",
                }}
              >
                Algorithm Properties
              </h4>
              <ul
                style={{
                  margin: 0,
                  padding: "0 0 0 20px",
                  fontSize: "12px",
                  lineHeight: "1.8",
                  color: "#ccc",
                }}
              >
                <li>Deterministic: same seed → same icon</li>
                <li>Symmetric: mirrored 5×5 grid pattern</li>
                <li>Cohesive palette: HSL-based color harmony</li>
                <li>Zero dependencies: vanilla SVG</li>
                <li>CI-friendly: --check mode detects drift</li>
                <li>Fast: ~1ms per icon generation</li>
              </ul>

              <h4
                style={{
                  margin: "20px 0 12px",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#00f3ff",
                }}
              >
                Usage (CLI)
              </h4>
              <pre
                style={{
                  background: "#0a0a0f",
                  border: "1px solid #2a2a3a",
                  borderRadius: "6px",
                  padding: "12px",
                  fontSize: "11px",
                  fontFamily: "monospace",
                  overflow: "auto",
                  color: "#e8e8ea",
                  margin: 0,
                }}
              >
                {`# Generate icons
node scripts/generate-post-icons.mjs \\
  --input posts.txt \\
  --out public/post-icons \\
  --size 96

# CI check (fails if drift)
node scripts/generate-post-icons.mjs \\
  --input posts.txt \\
  --out public/post-icons \\
  --check`}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LabIconGeneratorPage;
