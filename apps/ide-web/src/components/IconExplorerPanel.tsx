import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useMeasure } from "../hooks/useMeasure";
import {
  extractPosts,
  generateIconSvg,
  type PostMetadata,
} from "../utils/iconGenerator";

const DEMO_POSTS: PostMetadata[] = [
  {
    title: "The Becoming",
    date: "January 30, 2026",
    slug: "the-becoming",
    seed: "The Becoming | January 30, 2026",
  },
  {
    title: "Neural Cartography",
    date: "February 5, 2026",
    slug: "neural-cartography",
    seed: "Neural Cartography | February 5, 2026",
  },
  {
    title: "Temporal Mechanics",
    date: "February 12, 2026",
    slug: "temporal-mechanics",
    seed: "Temporal Mechanics | February 12, 2026",
  },
  {
    title: "Emergence Patterns",
    date: "February 18, 2026",
    slug: "emergence-patterns",
    seed: "Emergence Patterns | February 18, 2026",
  },
];

export function IconExplorerPanel() {
  const [ref, bounds] = useMeasure<HTMLDivElement>();
  const [searchQuery, setSearchQuery] = useState("");
  const [posts, setPosts] = useState<PostMetadata[]>(DEMO_POSTS);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [newIconText, setNewIconText] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  // Load from post-icons/index.json if available
  useEffect(() => {
    const loadIcons = async () => {
      try {
        const response = await fetch("/post-icons/index.json");
        if (response.ok) {
          const data = await response.json();
          // Handle both direct array and object with posts property
          const iconList = Array.isArray(data) ? data : data.posts || [];
          if (Array.isArray(iconList) && iconList.length > 0) {
            setPosts([...DEMO_POSTS, ...iconList]);
          }
        }
      } catch (err) {
        console.debug("post-icons/index.json not available, using demo only");
      }
    };
    loadIcons();
  }, []);

  // Filter posts by search query
  const filteredPosts = useMemo(() => {
    if (!searchQuery) return posts;
    const q = searchQuery.toLowerCase();
    return posts.filter(
      (p) =>
        p.title.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q)
    );
  }, [posts, searchQuery]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!gridRef.current) return;

      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((i) => Math.max(0, i - 1));
          break;
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((i) => Math.min(filteredPosts.length - 1, i + 1));
          break;
        case "Home":
          e.preventDefault();
          setSelectedIndex(0);
          break;
        case "End":
          e.preventDefault();
          setSelectedIndex(filteredPosts.length - 1);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filteredPosts.length]);

  // Scroll selected item into view
  useEffect(() => {
    if (!gridRef.current) return;
    const children = gridRef.current.children;
    const selected = children[selectedIndex] as HTMLElement | undefined;
    if (selected) {
      selected.scrollIntoView({ behavior: "smooth", block: "nearest" });
      selected.focus();
    }
  }, [selectedIndex]);

  // Add new icon
  const handleAddIcon = useCallback(() => {
    if (!newIconText.trim()) return;

    const extracted = extractPosts(newIconText);
    if (extracted.length === 0) return;

    const newPost = extracted[0];
    if (!newPost) return;

    setPosts((prev) => {
      const exists = prev.some((p) => p.slug === newPost.slug);
      return exists ? prev : [...prev, newPost];
    });
    setNewIconText("");
    setShowAddForm(false);
  }, [newIconText]);

  // Grid sizing
  const cellPx = 60; // larger for icon visibility
  const gapPx = 8;
  const minCols = 2;

  const cols = useMemo(() => {
    const width = bounds?.width ?? 320;
    const inner = Math.max(0, width - 24);
    const slot = cellPx + gapPx;
    const computed = Math.floor((inner + gapPx) / slot);
    return Math.max(minCols, computed || minCols);
  }, [bounds?.width]);

  return (
    <div
      ref={ref}
      className="panel icon-explorer"
    >
      {/* Header */}
      <div className="panel-header">
        <div className="panel-title">🎨 Icons</div>
        <div className="panel-meta">
          <span>{filteredPosts.length} icons</span>
        </div>
      </div>

      {/* Search */}
      <div className="icon-search-container">
        <input
          type="text"
          placeholder="Search icons..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setSelectedIndex(0);
          }}
          className="icon-search-input"
        />
      </div>

      {/* Add Icon Form */}
      {showAddForm && (
        <div className="icon-form-container">
          <textarea
            placeholder="Icon for Title&#10;Description&#10;February 22, 2026"
            value={newIconText}
            onChange={(e) => setNewIconText(e.target.value)}
            className="icon-form-textarea"
          />
          <div className="icon-form-buttons">
            <button
              onClick={handleAddIcon}
              className="icon-btn-add"
            >
              Add
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="icon-btn-cancel"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Add Button */}
      <div className="icon-toggle-container">
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="icon-toggle-add"
        >
          {showAddForm ? "✕ Close" : "+ Add Icon"}
        </button>
      </div>

      {/* Icon Grid - Dynamic columns computed from measured width (cannot be static) */}
      {/* stylelint-disable-next-line */}
      {/* eslint-disable-next-line react/forbid-component-props */}
      <div
        ref={gridRef}
        className="icon-grid icon-grid-container"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {filteredPosts.map((post, idx) => {
          const svg = generateIconSvg({
            seed: post.seed,
            title: post.title,
            size: 48,
          });

          return (
            <button
              key={post.slug}
              onClick={() => setSelectedIndex(idx)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                }
              }}
              className={`icon-cell ${selectedIndex === idx ? "selected" : ""}`}
              title={post.title}
            >
              <div
                className="icon-preview-wrapper"
                dangerouslySetInnerHTML={{ __html: svg }}
              />
            </button>
          );
        })}
      </div>

      {/* Selected Icon Details */}
      {filteredPosts[selectedIndex] && (
        <div className="icon-details-container">
          <div className="icon-details-title">
            {filteredPosts[selectedIndex].title}
          </div>
          {filteredPosts[selectedIndex].date && (
            <div className="icon-details-date">
              {filteredPosts[selectedIndex].date}
            </div>
          )}
          <div className="icon-details-slug">
            {filteredPosts[selectedIndex].slug}
          </div>
        </div>
      )}
    </div>
  );
}
