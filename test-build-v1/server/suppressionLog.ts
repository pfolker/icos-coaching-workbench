/**
 * Step 5's diagnostic log — a same-day human-review surface, not an
 * analytics dashboard. Design choice: ONE append-only, human-readable
 * text file (logs/suppression-log.txt) rather than one file per session.
 * Reasoning: a reviewer opening this file at the end of a test session
 * wants to read chronologically top-to-bottom and judge each suppression
 * for themselves, without hunting across a directory of per-session
 * files first. Each entry is a clearly delimited, indented text block —
 * readable in any editor, greppable, never a raw single-line JSON blob.
 *
 * Two entry kinds, deliberately distinguished per the founder directive
 * ("Log the fallback event distinctly from a suppression event"):
 *   - REAL TURN — the live pipeline ran; records the full gate replay.
 *   - DEGRADED TURN — the live call failed/timed out/was forced; records
 *     the fallback reason, never mixed in with real suppression data.
 */
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { TurnLogDetail, SerializedCause } from "./realTurn";

const here = dirname(fileURLToPath(import.meta.url));
const LOG_PATH = join(here, "../logs/suppression-log.txt");

function ensureLogDir(): void {
  mkdirSync(dirname(LOG_PATH), { recursive: true });
}

function formatSuppressions(entries: { opportunity_id: string; rule_name: string; reasoning: string }[]): string {
  if (entries.length === 0) return "    (none)";
  return entries.map((s) => `    - ${s.opportunity_id} suppressed by "${s.rule_name}"\n      reasoning: ${s.reasoning}`).join("\n");
}

function formatEdges(edges: { relationship_type: string; ordering_basis?: string; marker_text: string }[]): string {
  if (edges.length === 0) return "    (none)";
  return edges.map((e) =>
    `    - ${e.relationship_type}${e.ordering_basis ? ` (ordering_basis: ${e.ordering_basis})` : ""} — marker_text: "${e.marker_text}"`
  ).join("\n");
}

function formatClaims(claims: { claim_type: string; quote: string }[]): string {
  if (claims.length === 0) return "    (none)";
  return claims.map((c) => `    - [${c.claim_type}] "${c.quote}"`).join("\n");
}

function formatCause(cause: SerializedCause | null, indent = "    "): string {
  if (!cause) return `${indent}(none)`;
  const lines = [
    `${indent}name: ${cause.name ?? "(none)"}`,
    `${indent}message: ${cause.message ?? "(none)"}`,
    `${indent}code: ${cause.code ?? "(none)"}`,
    `${indent}errno: ${cause.errno ?? "(none)"}`,
    `${indent}syscall: ${cause.syscall ?? "(none)"}`,
  ];
  if (cause.cause) {
    lines.push(`${indent}cause:`, formatCause(cause.cause, indent + "  "));
  }
  return lines.join("\n");
}

function formatQuickScan(scan: TurnLogDetail["rendered_quick_scan"]): string {
  const lines: string[] = [];
  for (const [category, items] of Object.entries(scan)) {
    if (!items || items.length === 0) continue;
    lines.push(`    ${category}:`);
    for (const item of items) {
      lines.push(`      [${item.polarity}] ${item.label}${item.explanation ? ` — ${item.explanation}` : ""}`);
    }
  }
  return lines.length ? lines.join("\n") : "    (empty)";
}

export function appendLogEntry(sessionId: string, turnLabel: string, detail: TurnLogDetail): void {
  ensureLogDir();
  const header = detail.degraded ? "DEGRADED TURN (regex-only fallback)" : "REAL TURN (live pipeline, O5 suppression applied live)";
  const lines: string[] = [
    "=".repeat(96),
    `${header} — session ${sessionId} — ${turnLabel}`,
    `timestamp: ${detail.timestamp}`,
    "=".repeat(96),
    "",
    `transcript:`,
    `  "${detail.transcript}"`,
    "",
    "pipeline diagnostics:",
    `  requestedPipeline: ${detail.diagnostics.requestedPipeline}`,
    `  actualPipeline: ${detail.diagnostics.actualPipeline}`,
    `  fallbackReason: ${detail.diagnostics.fallbackReason ?? "(none)"}`,
    `  errorName: ${detail.diagnostics.errorName ?? "(none)"}`,
    `  errorMessage: ${detail.diagnostics.errorMessage ?? "(none)"}`,
    `  errorCause:`,
    formatCause(detail.diagnostics.errorCause),
    `  elapsedMs: ${detail.diagnostics.elapsedMs}`,
    "",
  ];

  if (detail.degraded) {
    lines.push(`degraded_reason: ${detail.degradedReason}`, "");
  } else if (detail.live) {
    lines.push(
      `raw_regex_fired_candidates: [${detail.live.regex_fired_candidates.join(", ") || "none"}]`,
      `evidence_derived_candidates: [${detail.live.evidence_derived_candidates.join(", ") || "none"}]`,
      `O5_vagueness_in_merged_pool: ${detail.live.o5_in_merged_pool}`,
      "",
      "candidate_suppressions:",
      formatSuppressions(detail.live.candidate_suppressions),
      "",
      "gate replay (read-only, for human judgment — not a re-decision):",
      `  gate (a) specificity claims (action/constraint/decision), count=${detail.live.gate_replay.specificity_claims.length}:`,
      formatClaims(detail.live.gate_replay.specificity_claims),
      `  gate (b) edges, count=${detail.live.gate_replay.edge_count}:`,
      formatEdges(detail.live.gate_replay.edges),
      "",
      `final_candidates (fed to decide()): [${detail.live.final_candidates.join(", ") || "none"}]`,
      `selected_opportunity_id (Today's Focus): ${detail.live.selected_opportunity_id ?? "(reinforce_only — nothing selected)"}`,
      ""
    );
  }

  lines.push(
    "rendered Coach's Notes (what the learner actually saw):",
    formatQuickScan(detail.rendered_quick_scan),
    "",
    `rendered Today's Focus: ${detail.rendered_todays_focus ? `${detail.rendered_todays_focus.label} — ${detail.rendered_todays_focus.explanation}` : "(none — reinforce_only)"}`,
    "",
    ""
  );

  appendFileSync(LOG_PATH, lines.join("\n"), "utf8");
}

export { LOG_PATH };
