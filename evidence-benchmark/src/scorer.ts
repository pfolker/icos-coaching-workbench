/**
 * Tier 1 (Evidence Correctness) scorer — ICOS Evaluation System Design v0.1,
 * Section 5. Pure functions: (pipeline output, ground truth) -> metrics.
 * Reads evidence-validator/evidence-runtime output; never calls into or
 * modifies either package's actual validation logic.
 */
import { PROMOTION_LABELS, ValidatedClassA, ValidatedClassB, ValidatorOutput } from "../../evidence-validator/src/types";
import { ListenEngineRawOutput } from "../../evidence-runtime/src/modelOutput";
import { GroundTruthCase } from "./groundTruth";

/**
 * Bidirectional substring/equality match. Deliberately not exact-only: a
 * live model's quote boundary can legitimately differ slightly from ground
 * truth's (see evidence-runtime/README.md's quote-boundary finding) without
 * that being a real miss. Deterministic, auditable — no semantic judgment.
 */
export function quotesMatch(a: string, b: string): boolean {
  const ta = a.trim();
  const tb = b.trim();
  if (ta.length === 0 || tb.length === 0) return false;
  return ta === tb || ta.includes(tb) || tb.includes(ta);
}

/**
 * Picks ONE best-matching candidate for a ground-truth quote, used wherever
 * a single claim_type/proposal_id needs to be read off the match (claim_type
 * agreement, additions, Class B component translation) rather than just a
 * yes/no (recall). Exact match wins first, unconditionally; only when no
 * exact match exists does it fall back to substring matching, breaking ties
 * by closest length. This matters because a longer ground-truth quote (e.g.
 * Case 009's full self_reported_diagnosis sentence) can legitimately contain
 * a SHORTER, unrelated ground-truth quote (e.g. the context_fact half of the
 * same sentence) as a literal substring — naive first-match substring
 * search picked the wrong candidate here during this package's own build
 * (see README.md's Design v0.1 gaps / lessons learned).
 */
export function findBestQuoteMatch<T extends { quote: string }>(gtQuote: string, candidates: T[]): T | undefined {
  const trimmed = gtQuote.trim();
  const exact = candidates.find((c) => c.quote.trim() === trimmed);
  if (exact) return exact;
  const overlapping = candidates.filter((c) => quotesMatch(trimmed, c.quote));
  if (overlapping.length === 0) return undefined;
  return [...overlapping].sort(
    (a, b) => Math.abs(a.quote.trim().length - trimmed.length) - Math.abs(b.quote.trim().length - trimmed.length)
  )[0];
}

// ------------------------------------------------------------ Class A recall

export interface ClassARecallResult {
  matched: number;
  total_ground_truth: number;
  rate: number;
  unmatched_ground_truth_ids: string[];
}

/** Recall matched on QUOTE only (Design Section 5's "correctly reproduced") — claim_type fit is a separate metric (scoreClaimTypeAgreement). */
export function scoreClassARecall(groundTruth: GroundTruthCase, validatedClassA: ValidatedClassA[]): ClassARecallResult {
  const unmatched_ground_truth_ids: string[] = [];
  let matched = 0;
  for (const gt of groundTruth.class_a) {
    if (validatedClassA.some((v) => quotesMatch(gt.quote, v.quote))) matched++;
    else unmatched_ground_truth_ids.push(gt.id);
  }
  const total_ground_truth = groundTruth.class_a.length;
  return { matched, total_ground_truth, rate: total_ground_truth === 0 ? 1 : matched / total_ground_truth, unmatched_ground_truth_ids };
}

// --------------------------------------------------------- Quote fidelity

export interface QuoteFidelityResult {
  total_proposed: number;
  exact: number;
  paraphrased: number;
  paraphrased_examples: { proposal_id: string; quote: string }[];
}

/**
 * Measured over the RAW Listen Engine proposals (before validation), not
 * just validated_class_a — a paraphrased quote never reaches validated_class_a
 * at all (Validator Rule 1 rejects it as QUOTE_NOT_FOUND), so this is the
 * only place a paraphrase-attempt trend is visible (Design Section 5).
 */
export function scoreQuoteFidelity(transcript: string, rawClassAProposals: ListenEngineRawOutput["class_a_proposals"]): QuoteFidelityResult {
  let exact = 0;
  let paraphrased = 0;
  const paraphrased_examples: { proposal_id: string; quote: string }[] = [];
  for (const p of rawClassAProposals) {
    if (transcript.includes(p.quote.trim())) exact++;
    else {
      paraphrased++;
      paraphrased_examples.push({ proposal_id: p.proposal_id, quote: p.quote });
    }
  }
  return { total_proposed: rawClassAProposals.length, exact, paraphrased, paraphrased_examples };
}

// ---------------------------------------------------- claim_type agreement

export interface ClaimTypeAgreementResult {
  matched_total: number;
  agree: number;
  rate: number;
  disagreements: { ground_truth_id: string; ground_truth_type: string; proposed_type: string; quote: string }[];
}

/** Among quote-matched claims only. Disagreement is reported, not penalized as wrong — Case 009 already proved this can be a genuine, defensible Specification ambiguity, not an error. */
export function scoreClaimTypeAgreement(groundTruth: GroundTruthCase, validatedClassA: ValidatedClassA[]): ClaimTypeAgreementResult {
  let matched_total = 0;
  let agree = 0;
  const disagreements: ClaimTypeAgreementResult["disagreements"] = [];
  for (const gt of groundTruth.class_a) {
    const hit = findBestQuoteMatch(gt.quote, validatedClassA);
    if (!hit) continue;
    matched_total++;
    if (hit.claim_type === gt.claim_type) agree++;
    else disagreements.push({ ground_truth_id: gt.id, ground_truth_type: gt.claim_type, proposed_type: hit.claim_type, quote: hit.quote });
  }
  return { matched_total, agree, rate: matched_total === 0 ? 1 : agree / matched_total, disagreements };
}

// ----------------------------------------------------------------- additions

export interface AdditionsResult {
  count: number;
  items: { proposal_id: string; claim_type: string; quote: string }[];
}

/** Validated claims with no ground-truth counterpart. Counted and flagged for human review, never auto-failed (Design Section 5) — auto-judging legitimacy would be exactly the semantic scoring this project avoids. */
export function scoreAdditions(groundTruth: GroundTruthCase, validatedClassA: ValidatedClassA[]): AdditionsResult {
  const items = validatedClassA
    .filter((v) => !groundTruth.class_a.some((gt) => quotesMatch(gt.quote, v.quote)))
    .map((v) => ({ proposal_id: v.proposal_id, claim_type: v.claim_type, quote: v.quote }));
  return { count: items.length, items };
}

// ------------------------------------------------------------ Class B recall

export interface ClassBRecallResult {
  matched: number;
  total_ground_truth: number;
  rate: number;
  unmatched_ground_truth_ids: string[];
}

/**
 * Same recall concept as Class A, translated through quote-matching since
 * ground truth and pipeline output use independent proposal_id namespaces.
 * Matches on relationship_type + the SET of components (via their quotes),
 * ignoring order. KNOWN LIMITATION: temporal_sequence's actual order is not
 * verified here — see README.md's Design v0.1 gaps.
 */
export function scoreClassBRecall(
  groundTruth: GroundTruthCase, validatedClassA: ValidatedClassA[], validatedClassB: ValidatedClassB[]
): ClassBRecallResult {
  const unmatched_ground_truth_ids: string[] = [];
  let matched = 0;
  for (const gtb of groundTruth.class_b) {
    const gtComponents = gtb.component_ids.map((id) => groundTruth.class_a.find((a) => a.id === id)!);
    // Single best match per component (same exact-first strategy as claim_type
    // agreement) — avoids a longer sibling ground-truth quote that happens to
    // textually contain this component's quote being picked up as a false candidate.
    const matchedIds = gtComponents.map((comp) => findBestQuoteMatch(comp.quote, validatedClassA)?.proposal_id);
    if (matchedIds.some((id) => id === undefined)) {
      unmatched_ground_truth_ids.push(gtb.id);
      continue;
    }
    const wantedIds = new Set(matchedIds as string[]);
    const hit = validatedClassB.some((vb) => {
      if (vb.relationship_type !== gtb.relationship_type) return false;
      if (vb.components.length !== wantedIds.size) return false;
      return vb.components.every((c) => wantedIds.has(c));
    });
    if (hit) matched++;
    else unmatched_ground_truth_ids.push(gtb.id);
  }
  const total_ground_truth = groundTruth.class_b.length;
  return { matched, total_ground_truth, rate: total_ground_truth === 0 ? 1 : matched / total_ground_truth, unmatched_ground_truth_ids };
}

// ----------------------------------------------------- Class C hard-fail

export interface ClassCHardFailResult {
  passed: boolean;
  violations: string[];
}

/**
 * Failure Mode 9 (belief-fact collapse) in code form — HARD FAIL, not a
 * score (Design Section 5). Two independent sub-checks, both simple,
 * deterministic, auditable:
 *  1. Promotion-label check: no validated_class_a claim_type is a
 *     PROMOTION_LABEL. Should always pass given evidence-validator's actual
 *     code (classA.ts already rejects this upstream) — this is a defense-
 *     in-depth outer check for a regression in that code, not a duplicate
 *     of it.
 *  2. Hypothesis-leakage check: no validated_class_a quote overlaps a
 *     class_c_non_admissible hypothesis/reasoning text. A minimum length
 *     threshold avoids trivial false positives on short common phrases.
 */
const MIN_OVERLAP_LENGTH = 20;

export function scoreClassCHardFail(
  output: Pick<ValidatorOutput, "validated_class_a" | "class_c_non_admissible">
): ClassCHardFailResult {
  const violations: string[] = [];

  for (const a of output.validated_class_a) {
    if ((PROMOTION_LABELS as readonly string[]).includes(a.claim_type)) {
      violations.push(
        `validated_class_a "${a.proposal_id}" has claim_type "${a.claim_type}", a promotion label that must never ` +
        `appear in validated output (Failure Mode 9 / belief-fact collapse).`
      );
    }
  }

  for (const c of output.class_c_non_admissible) {
    const texts = [c.hypothesis, c.reasoning].map((s) => s.trim()).filter((s) => s.length >= MIN_OVERLAP_LENGTH);
    for (const a of output.validated_class_a) {
      const q = a.quote.trim();
      if (q.length < MIN_OVERLAP_LENGTH) continue;
      for (const t of texts) {
        if (q === t || q.includes(t) || t.includes(q)) {
          violations.push(
            `validated_class_a "${a.proposal_id}" quote overlaps class_c_non_admissible "${c.proposal_id}"'s ` +
            `hypothesis/reasoning text — a non-admissible inference may have leaked into admitted evidence.`
          );
        }
      }
    }
  }

  return { passed: violations.length === 0, violations };
}

// ----------------------------------------------------- rejection reason tally

export function scoreRejectionTally(rejected: { reason_code: string }[]): Record<string, number> {
  const tally: Record<string, number> = {};
  for (const r of rejected) tally[r.reason_code] = (tally[r.reason_code] ?? 0) + 1;
  return tally;
}

// ----------------------------------------------------------------- combined

export interface CaseMetrics {
  case_id: string;
  class_a_recall: ClassARecallResult;
  quote_fidelity: QuoteFidelityResult;
  claim_type_agreement: ClaimTypeAgreementResult;
  additions: AdditionsResult;
  class_b_recall: ClassBRecallResult;
  class_c_hard_fail: ClassCHardFailResult;
  rejection_tally: Record<string, number>;
}

export function scoreCase(
  groundTruth: GroundTruthCase,
  transcript: string,
  rawClassAProposals: ListenEngineRawOutput["class_a_proposals"],
  validatorOutput: ValidatorOutput,
): CaseMetrics {
  return {
    case_id: groundTruth.case_id,
    class_a_recall: scoreClassARecall(groundTruth, validatorOutput.validated_class_a),
    quote_fidelity: scoreQuoteFidelity(transcript, rawClassAProposals),
    claim_type_agreement: scoreClaimTypeAgreement(groundTruth, validatorOutput.validated_class_a),
    additions: scoreAdditions(groundTruth, validatorOutput.validated_class_a),
    class_b_recall: scoreClassBRecall(groundTruth, validatorOutput.validated_class_a, validatorOutput.validated_class_b),
    class_c_hard_fail: scoreClassCHardFail(validatorOutput),
    rejection_tally: scoreRejectionTally(validatorOutput.rejected),
  };
}
