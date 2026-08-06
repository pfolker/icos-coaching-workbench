# @icos/comparison-engine

The mission-anchored retry verdict (ADR-001 §4, JA-05). Compares ONLY the
coached dimension between V1 and V2. Never a re-grade.

## How verdicts work
Deterministic per-opportunity success predicates over the RETRY observations,
with ORIGINAL metrics as the baseline for relative rules (`src/predicates.ts`).
Copy explains; predicates decide. A corrupted or crashing reinforcement
generator can degrade the COPY, never move the VERDICT.

achieved = the coached signal is present in the retry
partial  = measurable movement without the full fix (e.g. a bare numeral
           without magnitude framing; filler down 40% but above threshold)
not_yet  = no movement on the coached dimension. Copy stays warm and repeats
           the SAME ask. It never adds a second point and never scolds.

## Protect-the-win (JA-05), mechanically
New flaws in the retry are detected against the original (new weak close, new
employer negativity, lost quantification, filler spike) and emitted in
`banked_flaws` for learner memory. A dedicated verifier check
(`banked_flaws_not_in_copy`) proves their coaching vocabulary never reaches
learner-facing copy. The win is celebrated; the flaw waits its turn.

## Verifier (nine checks, dual-transcript)
Quote grounding against retry AND original transcripts (spans carry a
`source` tag), span slice-integrity per source, numeric facts grounded in
either transcript, single-point language ban, selected-signature present,
rejected-signatures absent, banked-signatures absent, no em dashes.
Degradation ladder: generate → verify → retry once → safe fallback
(verdict-true copy, zero quotes, signature suffix), re-verified.

## Tests (14)
The eight required scenarios (achieved / partial / not_yet / win+banked flaw /
rejected-absent / grounded quotes incl. lying generator / no-re-grade /
degraded fallback incl. crash and em dash), determinism, validation, and the
FULL LOOP integration (`test/loop.test.ts`): V1 → observe → opportunities →
decide → coaching move → V2 → observe → compare, across all five packages
with zero adapters.

Signatures in `src/registry.ts` duplicate conversation-engine's vocabulary by
design; single-sourcing both into `/config` is the noted follow-up.
