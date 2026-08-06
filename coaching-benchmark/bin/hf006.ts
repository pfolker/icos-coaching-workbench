#!/usr/bin/env node
/**
 * CLI: HF-006 grounding-system reliability metric (item 5). Deterministic, no
 * network — tests grounding.ts's own false-positive vs detection behavior.
 * Reported as its OWN metric, separate from the coach's pass/fail.
 */
import { runGroundingReliability } from "../src/groundingReliability";

const r = runGroundingReliability();
console.log(`=== HF-006 grounding-system reliability (evidence: ${r.evidence_source}, ${r.evidence_quote_count} quotes) ===`);
for (const p of r.results) {
  console.log(`\n[${p.id}] ${p.label} — grounding ${p.passed ? "PASS" : "FLAG"} ${p.correct ? "(correct)" : "(INCORRECT)"}`);
  console.log(`  "${p.message}"`);
  if (!p.passed) console.log(`  ungrounded terms: ${p.ungrounded_terms.join(", ")}`);
  if (p.note) console.log(`  note: ${p.note}`);
}
console.log(`\nrequired-fabrication detection: ${r.required_fabrication_detected_count}/${r.required_fabrication_count} = ${r.required_fabrication_detection_rate.toFixed(2)}`);
console.log(`false-positive rate:            ${r.false_positive_count}/${r.legitimate_count} = ${r.false_positive_rate.toFixed(2)}`);
if (r.known_limitation_misses.length > 0) {
  console.log(`KNOWN LIMITATION — missed (concrete-entity approach's own new failure class, kept on record):`);
  for (const m of r.known_limitation_misses) console.log(`  [${m.id}] "${m.message}" — ${m.note ?? ""}`);
}
