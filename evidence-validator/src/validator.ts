/**
 * ICOS Evidence Validator — main entry point.
 * Orchestrates Class A -> Class B -> Class C validation, multiple-candidate
 * handling (Atlas Case 007), and specification-gap surfacing. Fully
 * deterministic: every output array is built by iterating the caller's
 * input arrays in the order given, never from Map/Set iteration, so byte-
 * identical re-runs are a property of the code, not incidental.
 */
import { validateClassAProposal } from "./classA";
import { validateClassBProposal } from "./classB";
import { validateClassCProposal } from "./classC";
import {
  ClassAProposal, RequiresReview, SelectionRequired, SpecificationGap,
  ValidatedClassA, ValidatorInput, ValidatorOutput,
} from "./types";

/**
 * Multiple-candidate handling is scoped to claim_type "problem" only.
 * Recurring claim_types (action, outcome, context_fact, ...) are NORMAL —
 * a single story routinely contains several actions or outcomes, and
 * flagging every one would misfire on nearly every Atlas case. "problem"
 * is different: a transcript answering "tell me about a problem you
 * solved" has exactly one intended subject, so multiple validated
 * candidates for it are a genuine competing-alternatives situation (Atlas
 * Case 007), not routine story structure. This scoping choice is not
 * dictated by the Specification (which does not enumerate which
 * claim_types this applies to) and is called out in the report as an
 * implementation decision, not a settled spec rule.
 */
const MULTI_CANDIDATE_CLAIM_TYPES = new Set(["problem"]);

/**
 * Discourse-marker pattern for Atlas Case 007's precedence signal ("the
 * specific problem I want to talk about is..."). Attached as metadata only
 * — never used to auto-select a winner, per the task's explicit
 * instruction not to implement an inferred-precedence rule absent a formal
 * Specification revision.
 */
const DISCOURSE_MARKER =
  /\bthe (?:specific|real|actual|main)?\s*problem (?:i want to (?:talk about|focus on|discuss)|that (?:i want to talk about|matters most)) is\b/i;

function findDiscourseMarker(transcript: string): { marker_text: string; markerEnd: number } | null {
  const m = DISCOURSE_MARKER.exec(transcript);
  if (!m) return null;
  return { marker_text: m[0], markerEnd: m.index + m[0].length };
}

function detectSelectionRequired(
  validatedClassA: ValidatedClassA[], transcript: string
): SelectionRequired[] {
  const byType = new Map<string, ValidatedClassA[]>();
  for (const c of validatedClassA) {
    if (!MULTI_CANDIDATE_CLAIM_TYPES.has(c.claim_type)) continue;
    (byType.get(c.claim_type) ?? byType.set(c.claim_type, []).get(c.claim_type)!).push(c);
  }
  const out: SelectionRequired[] = [];
  for (const claimType of MULTI_CANDIDATE_CLAIM_TYPES) {
    const candidates = byType.get(claimType);
    if (!candidates || candidates.length < 2) continue;
    const marker = findDiscourseMarker(transcript);
    let discourse_marker: SelectionRequired["discourse_marker"];
    if (marker) {
      // the candidate positioned soonest after the marker is the one it names
      const after = candidates
        .filter((c) => c.source_span.start >= marker.markerEnd)
        .sort((a, b) => a.source_span.start - b.source_span.start)[0];
      if (after) {
        discourse_marker = { marker_text: marker.marker_text, marked_proposal_id: after.proposal_id };
      }
    }
    out.push({
      claim_type: claimType as ValidatedClassA["claim_type"],
      candidate_proposal_ids: candidates.map((c) => c.proposal_id),
      discourse_marker,
      explanation: `${candidates.length} validated "${claimType}" candidates compete for the same ` +
        `slot; v1 does not auto-select a canonical claim. All candidates remain in validated_class_a.`,
    });
  }
  return out;
}

export function validateEvidence(input: ValidatorInput): ValidatorOutput {
  const { transcript } = input;

  const validated_class_a: ValidatedClassA[] = [];
  const rejected: ValidatorOutput["rejected"] = [];
  const requires_review: RequiresReview[] = [];

  for (const proposal of input.class_a_proposals as ClassAProposal[]) {
    const result = validateClassAProposal(proposal, transcript);
    if (result.outcome === "validated") {
      validated_class_a.push(result.claim);
    } else if (result.outcome === "rejected") {
      rejected.push(result.rejection);
    } else {
      requires_review.push(result.review);
    }
  }

  const validated_class_b: ValidatorOutput["validated_class_b"] = [];
  for (const proposal of input.class_b_proposals) {
    const result = validateClassBProposal(proposal, transcript, validated_class_a);
    if (result.outcome === "validated") validated_class_b.push(result.claim);
    else rejected.push(result.rejection);
  }

  const validatedClassAIds = new Set(validated_class_a.map((c) => c.proposal_id));
  const class_c_non_admissible: ValidatorOutput["class_c_non_admissible"] = [];
  for (const proposal of input.class_c_proposals) {
    const result = validateClassCProposal(proposal, validatedClassAIds);
    if (result.outcome === "validated") class_c_non_admissible.push(result.claim);
    else rejected.push(result.rejection);
  }

  const selection_required = detectSelectionRequired(validated_class_a, transcript);

  // v1.1: no run-time specification gaps are currently detected. The
  // context_fact enum gap that used to be flagged here was resolved as a
  // formal enum addition (Specification v1.1, EP-001) rather than staying
  // an open Validator-side gap — see CHANGELOG.md. The `specification_gaps`
  // output array and SpecificationGap type remain part of the contract for
  // any future case where the Specification genuinely doesn't resolve how
  // to handle something at validation time.
  const specification_gaps: SpecificationGap[] = [];

  return {
    validated_class_a,
    validated_class_b,
    class_c_non_admissible,
    rejected,
    requires_review,
    selection_required,
    specification_gaps,
  };
}
