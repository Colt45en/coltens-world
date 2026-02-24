import { AlertCircle, CheckCircle, Eye, Lock } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { GlassPanel, NeonButton, NeonTitle } from "../ui/neon";

interface ApprovalItem {
  approval_id: string;
  tool_id: string;
  decision: "pending" | "approved" | "rejected";
  requested_at: string;
}

export function LabBrainObserverPage() {
  const navigate = useNavigate();
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [selectedApproval, setSelectedApproval] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleApprove = async (approvalId: string) => {
    setSubmitting(true);
    try {
      const res = await fetch(
        `http://localhost:3000/api/approvals/${approvalId}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actor: "brain-observer" }),
        }
      );

      if (res.ok) {
        setApprovals((prev) =>
          prev.map((a) =>
            a.approval_id === approvalId
              ? { ...a, decision: "approved" }
              : a
          )
        );
        setSelectedApproval(null);
      }
    } catch (err) {
      console.error("Approval error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async (approvalId: string) => {
    setSubmitting(true);
    try {
      const res = await fetch(
        `http://localhost:3000/api/approvals/${approvalId}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actor: "brain-observer" }),
        }
      );

      if (res.ok) {
        setApprovals((prev) =>
          prev.map((a) =>
            a.approval_id === approvalId
              ? { ...a, decision: "rejected" }
              : a
          )
        );
        setSelectedApproval(null);
      }
    } catch (err) {
      console.error("Rejection error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const pending = approvals.filter((a) => a.decision === "pending");

  return (
    <div className="space-y-6">
      {/* Header */}
      <GlassPanel className="rounded-2xl p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-purple-400" />
              <NeonTitle as="h2" className="text-2xl">
                Brain Observer
              </NeonTitle>
            </div>
            <p className="text-white/60 mt-2">
              Monitor agent reasoning and semantic queries. Approval decisions only editable component in read-only mode.
            </p>
          </div>
          <NeonButton variant="ghost" onClick={() => navigate("/")} className="ml-4">
            Back
          </NeonButton>
        </div>
      </GlassPanel>

      {/* Mode Badge */}
      <div className="flex items-center gap-2 px-4 py-2 bg-purple-500/10 border border-purple-500/30 rounded-lg w-fit">
        <Lock className="w-4 h-4 text-purple-400" />
        <span className="text-sm text-purple-300">Observe Mode (Read-Only)</span>
      </div>

      {/* Approval Queue */}
      <GlassPanel className="rounded-2xl p-6">
        <h3 className="text-white/90 font-semibold mb-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-purple-400" />
          Pending Agent Approvals ({pending.length})
        </h3>

        {pending.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
            <p className="text-white/40">No pending approvals</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map((approval) => (
              <div
                key={approval.approval_id}
                className={`border rounded-lg p-4 cursor-pointer transition ${
                  selectedApproval === approval.approval_id
                    ? "border-purple-400 bg-purple-500/10"
                    : "border-slate-700 hover:border-purple-400/50"
                }`}
                onClick={() => setSelectedApproval(approval.approval_id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-purple-300">
                      {approval.tool_id}
                    </div>
                    <div className="text-xs text-white/40 mt-1">
                      {new Date(approval.requested_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="px-2 py-1 bg-purple-500/20 border border-purple-500/40 rounded text-xs text-purple-300">
                    PENDING
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassPanel>

      {/* Decision Panel */}
      {selectedApproval && (
        <GlassPanel className="rounded-2xl p-6 border border-purple-500/50 bg-purple-500/5">
          <h3 className="text-white/90 font-semibold mb-4">Approval Decision</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-white/60 mb-2">Approval ID</label>
              <input
                type="text"
                value={selectedApproval}
                disabled
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white/60 text-sm font-mono"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => handleApprove(selectedApproval)}
                disabled={submitting}
                className="flex-1 px-4 py-2 bg-green-600/40 hover:bg-green-600/60 border border-green-500/50 rounded text-green-300 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                {submitting ? "Processing..." : "Approve"}
              </button>

              <button
                onClick={() => handleReject(selectedApproval)}
                disabled={submitting}
                className="flex-1 px-4 py-2 bg-red-600/40 hover:bg-red-600/60 border border-red-500/50 rounded text-red-300 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "Processing..." : "Reject"}
              </button>
            </div>
          </div>
        </GlassPanel>
      )}

      {/* Info */}
      <div className="text-xs text-white/40 space-y-1">
        <p>• Only approval decisions editable in observer mode</p>
        <p>• Brain semantic queries visible but not modifiable</p>
        <p>• Agent tool calls displayed but require approval</p>
        <p>• Connected to Brain API at http://localhost:8001</p>
      </div>
    </div>
  );
}
