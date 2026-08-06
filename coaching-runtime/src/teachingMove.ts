/**
 * Teaching Move selection — deterministic rules only, per ADR-teaching-is-policy
 * ("Teaching Is Policy, Not Intelligence"). No LLM anywhere in this file.
 *
 * Input is the real evidence-runtime EvidenceGraph shape (confirmed by reading
 * evidence-runtime/src/evidenceGraph.ts fresh before writing this — not
 * assumed). Uses ONLY claim_type, relationship_type, and counts derived from
 * them — no "specificity_indicators" or "concrete_entities" fields, per the
 * explicit boundary (those were flagged tonight as untested and not adopted).
 *
 * This is NOT a call into the real decision-engine package. decision-engine
 * selects an OPPORTUNITY from Observation-Engine-derived candidates — a
 * different input shape entirely (CandidateOpportunity, not Evidence Graph
 * nodes/edges). No code-sharing was possible at this integration boundary;
 * named here as a real limitation, not glossed over (see README.md).
 */
import { EvidenceGraph } from "../../evidence-runtime/src/evidenceGraph";

export type TeachingMoveType =
  | "request_number" | "request_constraint" | "request_tool"
  | "highlight_strength" | "contrast_attempts";

export interface TeachingMoveResult {
  type: TeachingMoveType;
  reason: string;
  /** Evidence claim/edge ids this move should anchor its Coaching Act to. */
  anchor_claim_ids: string[];
}

interface GraphCounts {
  class_a_count: number;
  class_b_count: number;
  has_quantity: boolean;
  has_constraint: boolean;
  has_action: boolean;
  outcome_ids: string[];
  action_ids: string[];
  constraint_ids: string[];
  all_ids: string[];
}

function countGraph(graph: EvidenceGraph): GraphCounts {
  const outcome_ids = graph.nodes.filter((n) => n.claim_type === "outcome").map((n) => n.id);
  const action_ids = graph.nodes.filter((n) => n.claim_type === "action").map((n) => n.id);
  const constraint_ids = graph.nodes.filter((n) => n.claim_type === "constraint").map((n) => n.id);
  return {
    class_a_count: graph.nodes.length,
    class_b_count: graph.edges.length,
    has_quantity: graph.edges.some((e) => e.relationship_type === "quantity_binding"),
    has_constraint: constraint_ids.length > 0,
    has_action: action_ids.length > 0,
    outcome_ids,
    action_ids,
    constraint_ids,
    all_ids: graph.nodes.map((n) => n.id),
  };
}

/** Rich enough overall that affirming what's there beats manufacturing a request. Chosen from this session's real fixture data: Case 001 (12 nodes, 3 edges) is unambiguously rich; Case 009 (4 nodes, 1 edge) unambiguously is not. */
const RICH_CLASS_A_THRESHOLD = 5;
const RICH_CLASS_B_THRESHOLD = 1;

/**
 * @param retryGraph when present, this is a contrast (original vs. retry) —
 *   contrast_attempts is the only move that ever fires in that mode. Single-
 *   answer evaluation only applies when just one graph is given.
 */
export function selectTeachingMove(graph: EvidenceGraph, retryGraph?: EvidenceGraph): TeachingMoveResult {
  if (retryGraph) {
    const originalIds = new Set(graph.nodes.map((n) => n.id));
    const newIds = retryGraph.nodes.filter((n) => !originalIds.has(n.id)).map((n) => n.id);
    return {
      type: "contrast_attempts",
      reason: "a retry graph was supplied — comparing two submitted answers takes priority over single-answer evaluation",
      anchor_claim_ids: newIds,
    };
  }

  const c = countGraph(graph);

  // Richness checked FIRST, before any single-dimension "what's missing" check.
  // This is deliberate: the founder's real answer (Case 001) has NO quantified
  // evidence at all, but is unambiguously rich (12 claims, 3 relationships,
  // named tools and a diagnostic method throughout). Checking "missing
  // quantity" before overall richness would have reproduced, inside this
  // prototype, the exact real failure that motivated tonight's whole
  // investigation — a rich answer downgraded to a request because it lacks
  // one specific dimension. Overall richness must win first.
  if (c.class_a_count >= RICH_CLASS_A_THRESHOLD && c.class_b_count >= RICH_CLASS_B_THRESHOLD) {
    return {
      type: "highlight_strength",
      reason: `rich overall: ${c.class_a_count} validated Class A claims (>= ${RICH_CLASS_A_THRESHOLD}) and ${c.class_b_count} Class B relationship(s) (>= ${RICH_CLASS_B_THRESHOLD}) — affirm rather than manufacture a request`,
      anchor_claim_ids: c.all_ids,
    };
  }

  if (!c.has_quantity) {
    return {
      type: "request_number",
      reason: "no quantity_binding relationship present in the graph",
      anchor_claim_ids: c.outcome_ids,
    };
  }
  if (!c.has_constraint) {
    return {
      type: "request_constraint",
      reason: "no claim_type \"constraint\" node present in the graph",
      anchor_claim_ids: c.action_ids,
    };
  }
  if (!c.has_action) {
    return {
      type: "request_tool",
      reason: "no claim_type \"action\" node present in the graph — nothing describing what was done to point to",
      anchor_claim_ids: [...c.outcome_ids, ...c.constraint_ids],
    };
  }

  return {
    type: "highlight_strength",
    reason: "quantity, constraint, and action are all present; nothing specific to request",
    anchor_claim_ids: c.all_ids,
  };
}
