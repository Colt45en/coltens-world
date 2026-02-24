import React, { useEffect, useRef, useState } from "react";
import {
  TIERS,
  MATH_TOPICS,
  GRAPHICS_OPERATIONS,
  getTopicsByTier,
  getTopicPrerequisites,
  getGraphicsOperationsForTopic,
  buildDependencyChain,
  type MathTopic,
  type GraphicsOperation,
} from "../data/math-dependency-graph";

interface GraphNode {
  id: string;
  topic: MathTopic;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
}

interface GraphEdge {
  from: string;
  to: string;
}

type ViewMode = "graph" | "curriculum" | "operations";

export const LabMathDependencyGraphPage: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("graph");
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedPath, setHighlightedPath] = useState<string[]>([]);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const animationFrameRef = useRef<number>();

  // Initialize graph layout
  useEffect(() => {
    const graphNodes: GraphNode[] = [];
    const graphEdges: GraphEdge[] = [];

    // Create nodes
    Object.entries(MATH_TOPICS).forEach(([id, topic]) => {
      const tier = TIERS.find((t) => t.tier === topic.tier);
      const tierY = 50 + topic.tier * 120;
      const tierTopics = getTopicsByTier(topic.tier);
      const indexInTier = tierTopics.findIndex((t) => t.name === topic.name);
      const tierX = 100 + indexInTier * 180;

      graphNodes.push({
        id,
        topic,
        x: tierX,
        y: tierY,
        vx: 0,
        vy: 0,
        radius: 30,
        color: tier?.color || "#8b5cf6",
      });
    });

    // Create edges
    Object.entries(MATH_TOPICS).forEach(([fromId, topic]) => {
      topic.enables?.forEach((toId) => {
        graphEdges.push({ from: fromId, to: toId });
      });
    });

    setNodes(graphNodes);
    setEdges(graphEdges);
  }, []);

  // Force-directed layout simulation
  useEffect(() => {
    if (nodes.length === 0 || viewMode !== "graph") return;

    const simulate = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Apply forces
      const updatedNodes = nodes.map((node) => {
        let fx = 0;
        let fy = 0;

        // Spring force along edges
        edges.forEach((edge) => {
          if (edge.from === node.id) {
            const target = nodes.find((n) => n.id === edge.to);
            if (target) {
              const dx = target.x - node.x;
              const dy = target.y - node.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              const force = (dist - 150) * 0.01;
              fx += (dx / dist) * force;
              fy += (dy / dist) * force;
            }
          }
          if (edge.to === node.id) {
            const source = nodes.find((n) => n.id === edge.from);
            if (source) {
              const dx = source.x - node.x;
              const dy = source.y - node.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              const force = (dist - 150) * 0.01;
              fx += (dx / dist) * force;
              fy += (dy / dist) * force;
            }
          }
        });

        // Repulsion between nodes
        nodes.forEach((other) => {
          if (other.id !== node.id) {
            const dx = node.x - other.x;
            const dy = node.y - other.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 200 && dist > 0) {
              const force = 1000 / (dist * dist);
              fx += (dx / dist) * force;
              fy += (dy / dist) * force;
            }
          }
        });

        // Damping
        const vx = (node.vx + fx) * 0.9;
        const vy = (node.vy + fy) * 0.9;

        return {
          ...node,
          x: node.x + vx,
          y: node.y + vy,
          vx,
          vy,
        };
      });

      setNodes(updatedNodes);
      renderGraph(ctx, updatedNodes, edges);

      animationFrameRef.current = requestAnimationFrame(simulate);
    };

    animationFrameRef.current = requestAnimationFrame(simulate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [nodes, edges, viewMode, selectedTopic, highlightedPath, hoveredNode]);

  const renderGraph = (
    ctx: CanvasRenderingContext2D,
    graphNodes: GraphNode[],
    graphEdges: GraphEdge[]
  ) => {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // Draw edges
    graphEdges.forEach((edge) => {
      const from = graphNodes.find((n) => n.id === edge.from);
      const to = graphNodes.find((n) => n.id === edge.to);
      if (!from || !to) return;

      const isHighlighted =
        highlightedPath.includes(from.id) && highlightedPath.includes(to.id);
      const isSelected =
        selectedTopic === from.id || selectedTopic === to.id;

      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.strokeStyle = isHighlighted
        ? "#22d3ee"
        : isSelected
        ? "#a855f7"
        : "rgba(255,255,255,0.1)";
      ctx.lineWidth = isHighlighted ? 3 : isSelected ? 2 : 1;
      ctx.stroke();

      // Draw arrow
      if (isHighlighted || isSelected) {
        const angle = Math.atan2(to.y - from.y, to.x - from.x);
        const arrowX = to.x - Math.cos(angle) * (to.radius + 5);
        const arrowY = to.y - Math.sin(angle) * (to.radius + 5);
        ctx.beginPath();
        ctx.moveTo(arrowX, arrowY);
        ctx.lineTo(
          arrowX - Math.cos(angle - Math.PI / 6) * 10,
          arrowY - Math.sin(angle - Math.PI / 6) * 10
        );
        ctx.lineTo(
          arrowX - Math.cos(angle + Math.PI / 6) * 10,
          arrowY - Math.sin(angle + Math.PI / 6) * 10
        );
        ctx.closePath();
        ctx.fillStyle = isHighlighted ? "#22d3ee" : "#a855f7";
        ctx.fill();
      }
    });

    // Draw nodes
    graphNodes.forEach((node) => {
      const isSelected = selectedTopic === node.id;
      const isHighlighted = highlightedPath.includes(node.id);
      const isHovered = hoveredNode === node.id;

      // Glow effect
      if (isSelected || isHighlighted || isHovered) {
        const gradient = ctx.createRadialGradient(
          node.x,
          node.y,
          0,
          node.x,
          node.y,
          node.radius + 15
        );
        gradient.addColorStop(0, node.color + "88");
        gradient.addColorStop(1, node.color + "00");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius + 15, 0, Math.PI * 2);
        ctx.fill();
      }

      // Node circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      ctx.fillStyle = isSelected
        ? node.color
        : isHighlighted
        ? "#22d3ee"
        : node.color + "cc";
      ctx.fill();
      ctx.strokeStyle = isSelected || isHighlighted ? "#ffffff" : node.color;
      ctx.lineWidth = isSelected || isHighlighted ? 3 : 1;
      ctx.stroke();

      // Node label (abbreviated)
      ctx.fillStyle = "#ffffff";
      ctx.font = "12px 'Orbitron', monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const label = node.topic.name.split(" ")[0] || "";
      ctx.fillText(label, node.x, node.y);

      // Tier number
      ctx.font = "10px 'Orbitron', monospace";
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.fillText(`T${node.topic.tier}`, node.x, node.y + 20);
    });
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const clickedNode = nodes.find((node) => {
      const dx = x - node.x;
      const dy = y - node.y;
      return Math.sqrt(dx * dx + dy * dy) <= node.radius;
    });

    if (clickedNode) {
      setSelectedTopic(clickedNode.id);
      setHighlightedPath([]);
    } else {
      setSelectedTopic(null);
      setHighlightedPath([]);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const hoveredNode = nodes.find((node) => {
      const dx = x - node.x;
      const dy = y - node.y;
      return Math.sqrt(dx * dx + dy * dy) <= node.radius;
    });

    setHoveredNode(hoveredNode?.id || null);
  };

  const findPath = (from: string, to: string) => {
    const paths = buildDependencyChain(from, to);
    if (paths.length > 0 && paths[0]) {
      setHighlightedPath(paths[0]);
    }
  };

  const filteredTopics = Object.entries(MATH_TOPICS).filter(
    ([id, topic]) =>
      topic.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      topic.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedTopicData = selectedTopic ? MATH_TOPICS[selectedTopic] : null;
  const selectedPrereqs = selectedTopic
    ? getTopicPrerequisites(selectedTopic)
    : [];
  const selectedOps = selectedTopic
    ? getGraphicsOperationsForTopic(selectedTopic)
    : [];

  return (
    <div className="h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 text-white overflow-hidden">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/30 backdrop-blur-xl">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-scifi text-2xl bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
                Math Dependency Graph
              </h1>
              <p className="text-sm text-white/60 mt-1">
                Explore the mathematical foundations of computer graphics
              </p>
            </div>

            {/* View Mode Tabs */}
            <div className="flex gap-2">
              {[
                { id: "graph", label: "Graph", icon: "🕸️" },
                { id: "curriculum", label: "Curriculum", icon: "📚" },
                { id: "operations", label: "Operations", icon: "⚙️" },
              ].map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => setViewMode(mode.id as ViewMode)}
                  className={`px-4 py-2 rounded-lg font-scifi text-sm transition-all ${
                    viewMode === mode.id
                      ? "bg-purple-500/30 border-2 border-purple-400"
                      : "bg-white/5 border border-white/10 hover:bg-white/10"
                  }`}
                >
                  <span className="mr-2">{mode.icon}</span>
                  {mode.label}
                </button>
              ))}
            </div>
          </div>

          {/* Search */}
          <div className="mt-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search topics, operations, or equations..."
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-cyan-400"
            />
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-180px)]">
        {/* Main Content */}
        <div className="flex-1 relative">
          {viewMode === "graph" && (
            <canvas
              ref={canvasRef}
              width={1200}
              height={800}
              className="w-full h-full cursor-pointer"
              onClick={handleCanvasClick}
              onMouseMove={handleCanvasMouseMove}
            />
          )}

          {viewMode === "curriculum" && (
            <div className="p-6 overflow-y-auto h-full">
              <div className="space-y-6">
                {TIERS.map((tier) => {
                  const tierTopics = getTopicsByTier(tier.tier);
                  return (
                    <div
                      key={tier.id}
                      className="bg-white/5 border border-white/10 rounded-xl p-6"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h2 className="font-scifi text-xl" style={{ color: tier.color }}>
                            Tier {tier.tier}: {tier.name}
                          </h2>
                          <p className="text-sm text-white/60">
                            Duration: {tier.durationMonths} months
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {tierTopics.map((topic) => {
                          const topicKey = Object.keys(MATH_TOPICS).find(
                            (k) => MATH_TOPICS[k] === topic
                          );
                          return (
                            <button
                              key={topicKey}
                              onClick={() => {
                                setSelectedTopic(topicKey || null);
                                setViewMode("graph");
                              }}
                              className="text-left p-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-400/50 rounded-lg transition-all"
                            >
                              <div className="font-scifi text-sm text-white/90">
                                {topic.name}
                              </div>
                              <div className="text-xs text-white/50 mt-1">
                                {topic.description}
                              </div>
                              {topic.graphicsRelevance && (
                                <div className="text-xs text-cyan-400 mt-2">
                                  → {topic.graphicsRelevance}
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {viewMode === "operations" && (
            <div className="p-6 overflow-y-auto h-full">
              <div className="space-y-6">
                {["modeling", "animation", "rendering", "simulation"].map(
                  (category) => {
                    const categoryOps = GRAPHICS_OPERATIONS.filter(
                      (op) => op.category === category
                    );
                    return (
                      <div
                        key={category}
                        className="bg-white/5 border border-white/10 rounded-xl p-6"
                      >
                        <h2 className="font-scifi text-xl text-purple-400 mb-4 capitalize">
                          {category}
                        </h2>
                        <div className="space-y-4">
                          {categoryOps.map((op, idx) => (
                            <div
                              key={idx}
                              className="bg-white/5 border border-white/10 rounded-lg p-4"
                            >
                              <div className="font-scifi text-white/90 mb-2">
                                {op.operation}
                              </div>
                              {op.equation && (
                                <div className="text-cyan-400 font-mono text-sm mb-2">
                                  {op.equation}
                                </div>
                              )}
                              <div className="text-xs text-white/60">
                                <span className="text-white/40">
                                  Requires:
                                </span>{" "}
                                {op.mathRequired.map((req, i) => (
                                  <button
                                    key={i}
                                    onClick={() => {
                                      setSelectedTopic(req);
                                      setViewMode("graph");
                                    }}
                                    className="text-purple-400 hover:text-purple-300 underline"
                                  >
                                    {MATH_TOPICS[req]?.name || req}
                                    {i < op.mathRequired.length - 1 ? ", " : ""}
                                  </button>
                                ))}
                              </div>
                              {op.methods && (
                                <div className="text-xs text-white/40 mt-1">
                                  Methods: {op.methods.join(", ")}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar: Topic Details */}
        {selectedTopicData && (
          <div className="w-96 border-l border-white/10 bg-black/30 backdrop-blur-xl overflow-y-auto p-6">
            <div className="space-y-6">
              {/* Topic Header */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-scifi text-xl text-purple-400">
                    {selectedTopicData.name}
                  </h3>
                  <button
                    onClick={() => setSelectedTopic(null)}
                    className="text-white/40 hover:text-white"
                  >
                    ✕
                  </button>
                </div>
                <div className="text-sm text-white/60">
                  {selectedTopicData.description}
                </div>
                <div className="text-xs text-white/40 mt-2">
                  Tier {selectedTopicData.tier} ·{" "}
                  {TIERS.find((t) => t.tier === selectedTopicData.tier)?.name}
                </div>
              </div>

              {/* Prerequisites */}
              {selectedPrereqs.length > 0 && (
                <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                  <div className="font-scifi text-sm text-white/70 mb-2">
                    Prerequisites
                  </div>
                  <div className="space-y-1">
                    {selectedPrereqs.map((prereq) => (
                      <button
                        key={prereq}
                        onClick={() => setSelectedTopic(prereq)}
                        className="block text-sm text-cyan-400 hover:text-cyan-300 underline"
                      >
                        {MATH_TOPICS[prereq]?.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Enables */}
              {selectedTopicData.enables &&
                selectedTopicData.enables.length > 0 && (
                  <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                    <div className="font-scifi text-sm text-white/70 mb-2">
                      Enables
                    </div>
                    <div className="space-y-1">
                      {selectedTopicData.enables.map((enabled) => (
                        <button
                          key={enabled}
                          onClick={() => setSelectedTopic(enabled)}
                          className="block text-sm text-purple-400 hover:text-purple-300 underline"
                        >
                          {MATH_TOPICS[enabled]?.name || enabled}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

              {/* Operations/Equations */}
              {selectedTopicData.operations && (
                <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                  <div className="font-scifi text-sm text-white/70 mb-2">
                    Operations
                  </div>
                  <div className="space-y-2">
                    {Object.entries(selectedTopicData.operations).map(
                      ([key, value]) => (
                        <div key={key}>
                          <div className="text-xs text-white/40">{key}</div>
                          <div className="text-sm text-cyan-400 font-mono">
                            {value}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* Functions */}
              {selectedTopicData.functions && (
                <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                  <div className="font-scifi text-sm text-white/70 mb-2">
                    Functions
                  </div>
                  <div className="space-y-2">
                    {Object.entries(selectedTopicData.functions).map(
                      ([key, values]) => (
                        <div key={key}>
                          <div className="text-xs text-white/40">{key}</div>
                          <div className="text-sm text-cyan-400 font-mono">
                            {Array.isArray(values) ? values.join(", ") : values}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* Methods */}
              {selectedTopicData.methods && (
                <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                  <div className="font-scifi text-sm text-white/70 mb-2">
                    Methods
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedTopicData.methods.map((method) => (
                      <span
                        key={method}
                        className="px-2 py-1 bg-purple-500/20 border border-purple-400/30 rounded text-xs text-purple-300"
                      >
                        {method}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Graphics Applications */}
              {selectedOps.length > 0 && (
                <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                  <div className="font-scifi text-sm text-white/70 mb-2">
                    Used In Graphics
                  </div>
                  <div className="space-y-2">
                    {selectedOps.map((op, idx) => (
                      <div key={idx} className="text-sm">
                        <div className="text-white/90">{op.operation}</div>
                        <div className="text-xs text-white/40">
                          {op.category}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Graphics Relevance */}
              {selectedTopicData.graphicsRelevance && (
                <div className="bg-gradient-to-br from-cyan-500/10 to-purple-500/10 border border-cyan-400/30 rounded-lg p-4">
                  <div className="font-scifi text-sm text-cyan-400 mb-1">
                    Graphics Relevance
                  </div>
                  <div className="text-sm text-white/80">
                    {selectedTopicData.graphicsRelevance}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer Stats */}
      <footer className="border-t border-white/10 bg-black/30 backdrop-blur-xl px-6 py-3">
        <div className="flex items-center justify-between text-xs text-white/50">
          <div>
            {Object.keys(MATH_TOPICS).length} topics ·{" "}
            {GRAPHICS_OPERATIONS.length} operations · 7 tiers
          </div>
          <div>
            {selectedTopic ? (
              <span className="text-cyan-400">
                Topic selected: {selectedTopicData?.name}
              </span>
            ) : (
              "Click a node to explore dependencies"
            )}
          </div>
        </div>
      </footer>
    </div>
  );
};
