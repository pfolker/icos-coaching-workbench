/**
 * Corpus expansion manifest (Phase 1, Step 3) — REAL transcripts only.
 *
 * The seed corpus (corpus.ts) is manufacturing-dominated because the
 * historical failures happened on manufacturing answers. Step 3 broadens the
 * corpus toward 20–30 cases across professions so the benchmark isn't purely
 * manufacturing-shaped. The hard rule, carried straight from the pivot's own
 * principle: cases must be REAL transcripts, never invented adversarial ones.
 *
 * This manifest does two honest things:
 *  1. AVAILABLE: inventories the real transcripts that already exist in this
 *     repo (with their canonical source path), so they can be pulled into the
 *     corpus by reference — not re-copied (re-copying is exactly what caused
 *     the Case 001 fabrication). A test asserts each source file still exists.
 *  2. NEEDED: names the profession coverage still missing, as an explicit
 *     request for real data — NOT filled with synthetic placeholders.
 *
 * No transcript text is duplicated here; `source` is the source of truth.
 */

export interface AvailableTranscript {
  /** proposed corpus id if adopted */
  case_id: string;
  label: string;
  domain: string;
  /** canonical source-of-truth location (file[:line] or file#export) */
  source: string;
  /** already used as a seeded historical-failure case in corpus.ts? */
  used_as_historical_failure: boolean;
  notes?: string;
}

/**
 * Real transcripts already in the repo. The evidence-shadow-compare cases are
 * the only NON-manufacturing real transcripts that currently exist, so they
 * are the backbone of cross-domain coverage until more real data is supplied.
 */
export const AVAILABLE_TRANSCRIPTS: AvailableTranscript[] = [
  // --- Atlas numbered cases (evidence-runtime/fixtures) ---
  { case_id: "RT-001", label: "Founder's original answer (deburring)", domain: "manufacturing", source: "evidence-runtime/fixtures/case001.ts:3", used_as_historical_failure: true, notes: "same transcript as HF-001" },
  { case_id: "RT-002", label: "Founder's retry (indicator straightness check)", domain: "manufacturing", source: "evidence-runtime/fixtures/case002.ts:3", used_as_historical_failure: false, notes: "natural retry pair for RT-001 → exercises retry_effect" },
  { case_id: "RT-004", label: "Rambling but substantive (packaging line)", domain: "manufacturing", source: "evidence-runtime/fixtures/case004.ts:3", used_as_historical_failure: false },
  { case_id: "RT-005", label: "Ambiguous ownership (weekly reports automation)", domain: "data/reporting", source: "evidence-runtime/fixtures/case005.ts:3", used_as_historical_failure: false },
  { case_id: "RT-006", label: "Contradictory ownership (staging environment)", domain: "software", source: "evidence-runtime/fixtures/case006.ts:3", used_as_historical_failure: false },
  { case_id: "RT-007", label: "Red-herring quote (vision inspection calibration)", domain: "manufacturing/quality", source: "evidence-runtime/fixtures/case007.ts:3", used_as_historical_failure: false },
  { case_id: "RT-008", label: "Two plausible causes (pressure-test failures)", domain: "manufacturing", source: "evidence-runtime/fixtures/case008.ts:3", used_as_historical_failure: false },
  { case_id: "RT-009", label: "Genuine quotes, invalid reasoning (return policy)", domain: "customer_support", source: "evidence-runtime/fixtures/case009.ts:3", used_as_historical_failure: true, notes: "same transcript as HF-002" },
  { case_id: "RT-010", label: "Missing context makes inference tempting (onboarding)", domain: "product", source: "evidence-runtime/fixtures/case010.ts:3", used_as_historical_failure: false },
  { case_id: "RT-003", label: "Strong concise answer (CNC location pin)", domain: "manufacturing", source: "evidence-benchmark/src/case003Fixture.ts:20", used_as_historical_failure: false },
  // --- coaching-runtime real capstone ---
  { case_id: "RT-FND", label: "Founder's actual real retry text (capstone)", domain: "manufacturing", source: "coaching-runtime/src/founderCase.ts:17", used_as_historical_failure: false, notes: "NOT byte-identical to case002 — real captured text" },
  // --- cross-domain real transcripts (evidence-shadow-compare) ---
  { case_id: "RT-SALES", label: "Account about to churn → renewed +15%", domain: "sales", source: "evidence-shadow-compare/src/salesRetentionCase.ts:12", used_as_historical_failure: false },
  { case_id: "RT-NURSE", label: "Patient confusion + elevated HR → caught sepsis", domain: "healthcare", source: "evidence-shadow-compare/src/nursingCase.ts:9", used_as_historical_failure: false },
  { case_id: "RT-SUPPORT", label: "Order damaged twice → retained customer", domain: "customer_support", source: "evidence-shadow-compare/src/customerSupportCase.ts:11", used_as_historical_failure: false },
  { case_id: "RT-SRE", label: "Recurring checkout outage → timeout + circuit breaker", domain: "software/SRE", source: "evidence-shadow-compare/src/checkoutOutageCase.ts:22", used_as_historical_failure: false },
  // --- deliberately low-evidence / adversarial (negative controls, still REAL text) ---
  { case_id: "RT-THIN", label: "Deliberately evidence-poor answer", domain: "manufacturing", source: "evidence-shadow-compare/src/thinCase.ts:15", used_as_historical_failure: false, notes: "good-enough-judgment negative control: coach must NOT manufacture substance" },
  { case_id: "RT-ADV-VLE", label: "Verbose, low-evidence rambling", domain: "general", source: "evidence-shadow-compare/src/adversarialCases.ts:18", used_as_historical_failure: false },
  { case_id: "RT-ADV-ISM", label: "Isolated single mention (torque wrench, unsure)", domain: "manufacturing", source: "evidence-shadow-compare/src/adversarialCases.ts:41", used_as_historical_failure: false },
  { case_id: "RT-ADV-IMM", label: "Isolated multiple mentions (vague setting/constraint)", domain: "manufacturing", source: "evidence-shadow-compare/src/adversarialCases.ts:61", used_as_historical_failure: false },
];

/**
 * Profession coverage still missing to reach a balanced 20–30. These are
 * REQUESTS FOR REAL TRANSCRIPTS, not cases — left empty on purpose rather
 * than fabricated. The count target and the "real, not synthetic" rule both
 * come from the Phase 1 work order.
 */
export interface NeededCoverage {
  domain: string;
  why: string;
}

export const NEEDED_COVERAGE: NeededCoverage[] = [
  { domain: "finance/analyst", why: "no real transcript exists in-repo" },
  { domain: "teaching/education", why: "no real transcript exists in-repo" },
  { domain: "legal", why: "no real transcript exists in-repo" },
  { domain: "marketing/PM", why: "only tangential (RT-010 product) coverage" },
  { domain: "skilled trades (non-machining)", why: "machining is over-represented; electrical/HVAC/etc. absent" },
  { domain: "research/science", why: "no real transcript exists in-repo" },
];

/**
 * Snapshot of where corpus coverage stands. Numbers are computed, not
 * asserted, so this stays honest as the corpus changes.
 */
export function coverageSummary() {
  const domains = new Map<string, number>();
  for (const t of AVAILABLE_TRANSCRIPTS) domains.set(t.domain, (domains.get(t.domain) ?? 0) + 1);
  return {
    available_count: AVAILABLE_TRANSCRIPTS.length,
    distinct_domains: [...domains.keys()].sort(),
    domain_counts: Object.fromEntries([...domains.entries()].sort()),
    needed_domains: NEEDED_COVERAGE.map((n) => n.domain),
    target_range: "20–30 real cases",
  };
}
