/**
 * Operator Trigger Component
 *
 * Allows users to execute operators from the IDE.
 * Shows inline execution status and results.
 *
 * Displays:
 * - Available operators (fetched from /brain/operator/list)
 * - Input form for operator parameters
 * - Real-time execution feedback
 * - Results inline
 */

import React, { useEffect, useState } from "react";
import "./OperatorTrigger.css";

interface OperatorMeta {
  operator_id: string;
  operator_name: string;
  description?: string;
  schema?: Record<string, any>;
}

interface OperatorExecution {
  operator_id: string;
  status: "success" | "validation_error" | "timeout" | "execution_error";
  result?: Record<string, any>;
  error?: { code: string; message: string };
  execution_time_ms: number;
}

export const OperatorTrigger: React.FC = () => {
  const [operators, setOperators] = useState<OperatorMeta[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [params, setParams] = useState<string>("{}");
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<OperatorExecution | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load operators on mount
  useEffect(() => {
    (async () => {
      try {
        const resp = await fetch("http://localhost:3000/brain/operator/list");
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

        const data = await resp.json();
        setOperators(data.operators || []);
        if (data.operators?.length > 0 && !selected) {
          setSelected(data.operators[0].operator_id);
        }
      } catch (err) {
        console.error("Failed to load operators:", err);
      }
    })();
  }, []);

  const handleExecute = async () => {
    if (!selected) return;

    try {
      setError(null);
      setResult(null);
      setExecuting(true);

      // Parse params
      let parsedParams = {};
      try {
        parsedParams = JSON.parse(params);
      } catch {
        throw new Error("Invalid JSON in parameters");
      }

      // Execute operator
      const resp = await fetch("http://localhost:3000/brain/operator/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operator_id: selected,
          parameters: parsedParams,
        }),
      });

      if (!resp.ok) {
        const data = await resp.json();
        throw new Error(data.error?.message || `HTTP ${resp.status}`);
      }

      const data = await resp.json();
      setResult({
        operator_id: data.operator_id,
        status: data.status,
        result: data.result,
        error: data.error,
        execution_time_ms: data.execution_time_ms,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="operator-trigger-container">
      {/* Title */}
      <div className="operator-trigger-title">🚀 Execute Operator</div>

      {/* Operator Select */}
      <div className="operator-trigger-section">
        <label htmlFor="operator-select" className="operator-trigger-label">
          Operator
        </label>
        <select
          id="operator-select"
          aria-label="Select an operator to execute"
          value={selected || ""}
          onChange={(e) => setSelected(e.target.value)}
          disabled={executing}
          className="operator-trigger-select"
        >
          <option value="">Select operator...</option>
          {operators.map((op) => (
            <option key={op.operator_id} value={op.operator_id}>
              {op.operator_name}
            </option>
          ))}
        </select>
      </div>

      {/* Parameters */}
      <div className="operator-trigger-section">
        <label htmlFor="operator-params" className="operator-trigger-label">
          Parameters (JSON)
        </label>
        <textarea
          id="operator-params"
          value={params}
          onChange={(e) => setParams(e.target.value)}
          disabled={executing}
          placeholder="{}"
          className="operator-trigger-textarea"
        />
      </div>

      {/* Error */}
      {error && <div className="operator-trigger-error">{error}</div>}

      {/* Execute Button */}
      <button
        onClick={handleExecute}
        disabled={executing || !selected}
        className={`operator-trigger-button ${executing ? "executing" : ""} ${!selected ? "disabled" : ""}`}
      >
        {executing ? "⏳ Executing..." : "Execute"}
      </button>

      {/* Result */}
      {result && (
        <div className="operator-trigger-result">
          <div className="operator-trigger-result-header">
            {result.status === "success" ? "✅" : "❌"} Result ({result.execution_time_ms}ms)
          </div>
          <pre className="operator-trigger-result-content">
            {JSON.stringify(result.result || result.error || result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};
