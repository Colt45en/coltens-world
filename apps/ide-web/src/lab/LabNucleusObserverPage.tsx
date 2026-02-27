import { CheckCircle, Clock, Eye, Lock, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GlassPanel, NeonButton, NeonTitle } from "../ui/neon";

interface ApprovalPanel {
  approval_id: string;
  requested_at: string;
  tool_id: string;
  decision: "pending" | "approved" | "rejected" | "expired";
  decided_at?: string;
  actor?: string;
  rationale?: string;
}

export function LabNucleusObserverPage() {
  const navigate = useNavigate();
  const [approvals, setApprovals] = useState<ApprovalPanel[]>([]);
  const [selectedApproval, setSelectedApproval] = useState<string | null>(null);
  const [decision, setDecision] = useState<"approved" | "rejected" | null>(null);
  const [rationale, setRationale] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Poll for pending approvals from Nucleus
    const pollApprovals = async () => {
      try {
        const res = await fetch("http://localhost:3000/api/approvals/pending");
        if (res.ok) {
          const data = await res.json();
          setApprovals(data);
        }
      } catch (err) {
        console.error("Approval poll error:", err);
      }
    };

    pollApprovals();
    const interval = setInterval(pollApprovals, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleDecision = async (approvalId: string, approved: boolean) => {
    setSubmitting(true);
    try {
      const endpoint = `http://localhost:3000/api/approvals/${approvalId}/${approved ? "approve" : "reject"}`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actor: "observer", rationale }),
      });

      if (res.ok) {
        setApprovals((prev) =>
          prev.map((a) =>
            a.approval_id === approvalId
              ? {
                  ...a,
                  decision: approved ? "approved" : "rejected",
                  decided_at: new Date().toISOString(),
                  actor: "observer",
                }
              : a
          )
        );
        setSelectedApproval(null);
        setRationale("");
      }
    } catch (err) {
      console.error("Decision error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const pending = approvals.filter((a) => a.decision === "pending");
  const resolved = approvals.filter((a) => a.decision !== "pending");

  return (
    <div className="space-y-6">
      {/* Header */}
      <GlassPanel className="rounded-2xl p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-cyan-400" />
              <NeonTitle as="h2" className="text-2xl">
                Nucleus Observer
              </NeonTitle>
            </div>
            <p className="text-white/60 mt-2">
              Read-only monitor for nucleus events and system state. Approval decisions only editable component.
            </p>
          </div>
          <NeonButton variant="ghost" onClick={() => navigate("/")} className="ml-4">
            Back
          </NeonButton>
        </div>
      </GlassPanel>

      {/* Mode Badge */}
      <div className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/30 rounded-lg w-fit">
        <Lock className="w-4 h-4 text-blue-400" />
        <span className="text-sm text-blue-300">Observe Mode (Read-Only)</span>
      </div>

      {/* Pending Approvals */}
      <GlassPanel className="rounded-2xl p-6">
        <h3 className="text-white/90 font-semibold mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-yellow-400" />
          Pending Approvals ({pending.length})
        </h3>

        {pending.length === 0 ? (
          <p className="text-white/40 text-sm">No pending approvals</p>
        ) : (
          <div className="space-y-3">
            {pending.map((approval) => (
              <div
                key={approval.approval_id}
                className={`border rounded-lg p-4 cursor-pointer transition ${
                  selectedApproval === approval.approval_id
                    ? "border-cyan-400 bg-cyan-500/10"
                    : "border-slate-700 hover:border-cyan-400/50"
                }`}
                onClick={() => setSelectedApproval(approval.approval_id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="text-sm font-mono text-cyan-300">{approval.tool_id}</div>
                    <div className="text-xs text-white/40 mt-1">
                      {new Date(approval.requested_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="px-2 py-1 bg-yellow-500/20 border border-yellow-500/40 rounded text-xs text-yellow-300">
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
        <GlassPanel className="rounded-2xl p-6 border border-cyan-500/50 bg-cyan-500/5">
          <h3 className="text-white/90 font-semibold mb-4">Decision Panel</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-white/60 mb-2">Approval ID</label>
              <input
                type="text"
                value={selectedApproval}
                disabled
                title="Approval ID"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white/60 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm text-white/60 mb-2">Rationale</label>
              <textarea
                value={rationale}
                onChange={(e) => setRationale(e.target.value)}
                disabled={submitting}
                rows={3}
                maxLength={200}
                className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded text-white text-sm focus:border-cyan-400 outline-none"
                placeholder="(Optional) Add context for this decision..."
              />
              <p className="text-xs text-white/40 mt-1">{rationale.length}/200</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => handleDecision(selectedApproval, true)}
                disabled={submitting}
                className="flex-1 px-4 py-2 bg-green-600/40 hover:bg-green-600/60 border border-green-500/50 rounded text-green-300 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                {submitting ? "Processing..." : "Approve"}
              </button>

              <button
                onClick={() => handleDecision(selectedApproval, false)}
                disabled={submitting}
                className="flex-1 px-4 py-2 bg-red-600/40 hover:bg-red-600/60 border border-red-500/50 rounded text-red-300 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <XCircle className="w-4 h-4" />
                {submitting ? "Processing..." : "Reject"}
              </button>
            </div>
          </div>
        </GlassPanel>
      )}

      {/* Resolved Approvals */}
      {resolved.length > 0 && (
        <GlassPanel className="rounded-2xl p-6">
          <h3 className="text-white/90 font-semibold mb-4">Resolved ({resolved.length})</h3>

          <div className="space-y-2 max-h-48 overflow-y-auto">
            {resolved.map((approval) => (
              <div
                key={approval.approval_id}
                className="border border-slate-700/50 rounded p-3 flex items-center justify-between"
              >
                <div className="text-xs">
                  <div className="font-mono text-white/60">{approval.approval_id}</div>
                  <div className="text-white/40 mt-1">{approval.actor}</div>
                </div>
                <div
                  className={`px-2 py-1 rounded text-xs font-semibold ${
                    approval.decision === "approved"
                      ? "bg-green-500/20 text-green-300"
                      : "bg-red-500/20 text-red-300"
                  }`}
                >
                  {approval.decision.toUpperCase()}
                </div>
              </div>
            ))}
          </div>
        </GlassPanel>
      )}

      {/* Info*/}
      <div className="text-xs text-white/40 space-y-1">
        <p>• Real-time approval polling every 2 seconds</p>
        <p>• Only approval decisions are modifiable in observer mode</p>
        <p>• All other nucleus state is read-only</p>
        <p>• Connected to Nucleus API at http://localhost:3000</p>
      </div>
    </div>
  );
}
