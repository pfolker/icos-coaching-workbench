# Listen Truncation Fix — Report

> Execution of `WORK-ORDER-LISTEN-TRUNCATION-FIX.md` (authorized 2026-08-13,
> commit `6fd1a41`), performed exactly as written.
>
> **This report is uncommitted pending founder review**, per Section 7.

**Outcome: the defect is fixed. Zero truncations in 20 runs.** The falsification
condition did not trigger. Case 002 went from unmeasurable (0/5 usable) to fully
measurable (5/5) and its reversal gate scores 5/5.

**Nothing outside the Listen seam was changed.** One tempting adjacent fix was
found by the audit, measured, and deliberately left alone (Section 9).

---

## 1. Pre-registered budget, restated unchanged

**8192**, fixed before any run, derived from the measured evidence:

1. thinking measured complete at 2,971 and 3,528 tokens (both diagnoses showed
   the thinking pass finishing and the *text* being cut);
2. a full proposal document for the largest anchors ≈ 1,200–1,500 tokens;
3. worst case ≈ 3,528 + 1,500 ≈ 5,030;
4. 8,192 leaves ~4,600 for thinking after a full document — ~1.3× margin;
5. smallest power-of-two doubling of 4,096 that clears it.

Not adjusted after seeing results. Not adjusted at all.

---

## 2. The change

Confined to `evidence-runtime/src/listenEngine.ts`:

| Change | Detail |
|---|---|
| Output budget | `max_tokens: 4096` → named constant `MAX_TOKENS = 8192`, with the full derivation in the comment |
| `LiveCallMeta` | gained `stop_reason`, `output_tokens`, `thinking_tokens` |
| `ListenTruncatedError` | new exported typed error carrying the meta and a `reason` of `"max_tokens"` or `"no_text_block"` |
| Detection point | before `parseModelJson` |

**Nothing else.** No prompt change, no Validator change, no schema change, no
marker change, no retry, no change at any other call site. `git diff --stat`
touches one file.

---

## 3. Truncation detection as implemented

```ts
const truncation =
  meta.stop_reason === "max_tokens" ? "max_tokens"
  : textBlock.trim().length === 0 ? "no_text_block"
  : null;
if (truncation) {
  const err = new ListenTruncatedError(meta, truncation);
  logParseFailure({ transcript, systemPrompt: LISTEN_ENGINE_SYSTEM_PROMPT,
                    rawResponseText: textBlock, parseError: err });
  throw err;
}
```

Four properties the work order required, each held:

- **Detected before parsing.** Once `parseModelJson` runs, a cut-off document and
  a malformed one are the same `SyntaxError`. The rerun proved this matters
  immediately — see Section 5.
- **Raw response still persisted.** The work order flagged that the parse-failure
  log was the most valuable artifact of the Class B investigation, so the
  truncation path calls `logParseFailure` before throwing rather than bypassing
  it. Detecting earlier cost nothing forensically.
- **Existing control flow preserved.** Still throws, still never fabricates a
  fallback, still logs.
- **No retry.** A truncated call fails visibly.

The error message states outright that the response *"must NOT be read as 'no
evidence found'"* — the failure this class has twice been silently read as.

---

## 4. Full rerun results — 20 runs

Identical matrix: same 4 anchors × 5 runs, byte-identical prompt, Validator,
provider, model (`claude-sonnet-5`), and provider-default sampling.

| Case | Run | `stop_reason` | output tok | thinking tok | Class A | Class B | admitted B | rejected |
|---|---|---|---|---|---|---|---|---|
| 001 | 1 | `end_turn` | 5,432 | 3,715 | 9 | 3 | 3 | 0 |
| 001 | 2 | — | — | — | — | — | — | **malformed JSON, not truncation** |
| 001 | 3 | `end_turn` | 4,091 | 2,128 | 13 | 6 | 5 | 1 |
| 001 | 4 | `end_turn` | 4,129 | 2,503 | 11 | 4 | 3 | 1 |
| 001 | 5 | `end_turn` | 4,521 | 2,852 | 11 | 4 | 3 | 1 |
| 002 | 1 | `end_turn` | 3,116 | 1,049 | 15 | 7 | 5 | 2 |
| 002 | 2 | `end_turn` | 5,460 | 3,687 | 17 | 7 | 5 | 2 |
| 002 | 3 | `end_turn` | 3,420 | 1,713 | 13 | 6 | 4 | 2 |
| 002 | 4 | `end_turn` | 5,064 | 3,566 | 17 | 7 | 5 | 2 |
| 002 | 5 | `end_turn` | **6,996** | **5,218** | 17 | 8 | 6 | 2 |
| 009 | 1 | `end_turn` | 2,749 | 1,737 | 4 | 2 | 1 | 1 |
| 009 | 2 | `end_turn` | 2,815 | 1,704 | 5 | 2 | 2 | 0 |
| 009 | 3 | `end_turn` | 2,885 | 2,094 | 4 | 2 | 1 | 1 |
| 009 | 4 | `end_turn` | 2,963 | 2,142 | 5 | 2 | 2 | 0 |
| 009 | 5 | `end_turn` | 2,374 | 1,258 | 4 | 4 | 3 | 1 |
| founder | 1 | `end_turn` | 3,441 | 1,715 | 13 | 4 | 2 | 2 |
| founder | 2 | `end_turn` | 4,835 | 3,240 | 16 | 6 | 4 | 2 |
| founder | 3 | `end_turn` | 3,490 | 1,784 | 16 | 6 | 4 | 2 |
| founder | 4 | `end_turn` | 4,623 | 3,041 | 17 | 7 | 5 | 2 |
| founder | 5 | `end_turn` | 2,710 | 1,202 | 13 | 4 | 2 | 2 |

**Zero `stop_reason: max_tokens`. Zero `no_text_block`. The falsification
condition did not trigger.**

### 4.1 The budget was necessary, and the margin was needed

Output tokens ranged 2,374–6,996; thinking 1,049–5,218.

**Eight of the twenty runs exceeded 4,096 output tokens** and would have
truncated under the old budget — 40%, closely matching the 35% truncation rate
measured in the Class B investigation. That correspondence is independent
corroboration that the diagnosis was correct.

**Honest risk note, reported rather than acted on.** The largest thinking pass
was **5,218 tokens — 48% above the 3,528 worst case the budget was derived
from**. Peak total usage was 6,996 of 8,192, leaving **15% headroom** at the
observed maximum. The margin built into the pre-registered value was needed and
is thinner than the derivation assumed. **The budget was not raised**, and per
the work order it must not be: no run truncated, so the falsification condition
is untriggered and "raise until it passes" remains unauthorized. This is
recorded for founder awareness, not as a request.

---

## 5. Rate table — same shape as the Class B report

Denominator is 5 attempted runs per anchor.

| Measure | 001 | 002 | 009 | `founder` |
|---|---|---|---|---|
| **Truncated runs** | **0** | **0** | **0** | **0** |
| Runs usable | 4/5 | **5/5** | 5/5 | 5/5 |
| Transcript-truth positive | yes | yes | yes | yes |
| Semantic perception of target | 4/4 usable | 5/5 | 5/5 | 5/5 |
| Contract-valid representation | 4/4 usable | 5/5 | 2/5 | 5/5 |
| Target relationship **admitted** | 4/5 | **5/5** | 2/5 | 5/5 |
| Validator rejections of semantically correct proposals | 3 | 10 | 3 | 10 |
| Representation-mismatch rate | 0/4 usable (target) | 0/5 (target) | 3/5 (target) | 0/5 (target) |
| False-positive relationships | none observed | none observed | none observed | none observed |
| **Strict gate availability** | **4/5** | **5/5** | **0/5** | **5/5** |

Rejection tally across 19 usable runs: `MARKER_NOT_FOUND` 24,
`ENUMERATION_INVALID` 2. The absolute count is higher than the Class B run
because six more runs delivered output and proposed more edges.

### 5.1 The instrumentation paid for itself on the first rerun

**001 run 2 failed with a genuine malformed-JSON error** — `Expected
double-quoted property name in JSON at position 603` — after passing both
truncation checks. So `stop_reason` was not `max_tokens` and the text block was
non-empty: the model wrote a complete-length but syntactically invalid document.

Under the old code this was indistinguishable from truncation; both surfaced as a
JSON `SyntaxError`. It is now separable, and the measured malformed-output rate
is **1/20 = 5%**, distinct from a truncation rate of **0/20**.

---

## 6. Pre-registered viability mapping applied

Bands unchanged: 0–1/5 not currently viable · 2–3/5 ambiguous/unresolved ·
4–5/5 viable signal for higher-n v0.2 testing.

| Gate | Availability | Verdict |
|---|---|---|
| Reversal — Case 001 | **4/5** | **VIABLE SIGNAL** for higher-n v0.2 testing |
| Reversal — Case 002 | **5/5** | **VIABLE SIGNAL** |
| Reversal — `founder` | **5/5** | **VIABLE SIGNAL** |
| Causal, strict (`b_because`, all components speaker-asserted) — Case 009 | **0/5** | **STRICT GATE NOT CURRENTLY VIABLE** |
| Causal, relaxed (≥1 speaker-asserted `self_reported_diagnosis` component) — Case 009 | **2/5** | **AMBIGUOUS / UNRESOLVED** |

Applied without adjustment. No band was redrawn, and no number near an edge was
re-litigated.

**Case 009's three misses** were all `MARKER_NOT_FOUND` on `b1_because_link`,
verbatim: *"because does not appear in the transcript between the two referenced
components"* — the same self-contained-versus-bridging representation mismatch
identified in the Class B investigation, unchanged by this fix, which is correct:
nothing here was supposed to affect it.

---

## 7. Before / after

| | Class B run (4096) | This run (8192) |
|---|---|---|
| Truncated runs | **7/20 (35%)** | **0/20** |
| Usable runs | 13/20 | **19/20** |
| Case 002 usable | **0/5** | **5/5** |
| Reversal gate — 001 | 3/5 *ambiguous* | **4/5 viable signal** |
| Reversal gate — 002 | 0/5 *unmeasurable* | **5/5 viable signal** |
| Reversal gate — `founder` | 4/5 viable signal | **5/5 viable signal** |
| Causal gate, strict — 009 | 0/5 not viable | **0/5 not viable** (now on 5 usable runs, not 4) |
| Causal, relaxed — 009 | 3/5 ambiguous | 2/5 ambiguous |
| Malformed-JSON failures | indistinguishable | **1/20, separately measured** |

Two readings worth keeping apart:

- **The reversal gate improved because measurement improved**, not because
  Listen got better. Perception was already 5/5 in the Class B run; the graph
  simply never arrived. Case 002's jump from 0/5 to 5/5 is the truncation defect
  being removed, exactly as pre-stated in the work order.
- **The causal gate did not move.** 0/5 before and after. The strict predicate's
  failure was never a truncation artifact, which the work order's pre-stated
  expectation left open and this rerun now settles.

The relaxed causal predicate moved 3/5 → 2/5. Both sit inside the same
ambiguous band and n=5 cannot distinguish them; **no conclusion is drawn from
that movement.**

---

## 8. Audit-only inventory — every live LLM call site

Two sites make live model calls; three more reach the provider through the seam.

| Site | `max_tokens` | records `stop_reason` | records token usage | truncation distinguishable from a legitimate empty result |
|---|---|---|---|---|
| `evidence-runtime/src/listenEngine.ts:148` (Listen) | **8192** | **yes** | **yes** (output + thinking) | **yes** — typed `ListenTruncatedError` |
| `coaching-runtime/src/coachProvider.ts:82` (shared seam) | from caller config | **no** | **no** | **no** |
| → `coaching-runtime/src/narrator.ts:122` | **300** | no | no | **no** |
| → `coaching-runtime/src/structuredCoach.ts:95` | **300** | no | no | **no** |
| → `sod-experiment/src/detector.ts:150` | **4096** | no | no | **partial** — its `no_text_block` flag catches an empty response but cannot tell `max_tokens` truncation from a genuinely empty one |

`ProviderCallMeta` carries `provider`, `model`, `base_url`, `request_bytes`,
`response_bytes` — and no `stop_reason`, no usage.

### 8.1 One at-risk finding, measured offline, deliberately not fixed

Verified with a stub provider returning an empty string — **no live call, no code
change**:

```
raw_message:       ""
guardrail.passed:  true
grounding.passed:  true
fallback_used:     false
final_text:        ""
```

An empty completion passes both checks and produces **empty learner-facing text
with every gate green**. Both non-experimental coach call sites run at
`max_tokens: 300`, and the Listen measurements show thinking passes of
1,049–5,218 tokens; a single thinking block at either site would consume the
entire budget and produce exactly this.

No such failure has been observed at those sites. **Not fixed** — Section 6 of
the work order confines authority to the Listen seam. Documented here as
`max_tokens` changes at other call sites are explicitly out of scope.

---

## 9. Tempting adjacent fixes found and deliberately not made

1. **Marker normalization** — `"This pointed to"` versus `"pointed to"`. Still
   rejected; still out of scope.
2. **Quote-boundary guidance** for connectives — the class behind most
   `MARKER_NOT_FOUND` rejections, including all three Case 009 misses.
3. **Gate relaxation** — the relaxed causal predicate was *computed* for
   reporting (2/5) and not implemented anywhere.
4. **`stop_reason` and usage on `ProviderCallMeta`** — the obvious generalization
   of this very fix to the shared seam, discovered by the audit, and outside the
   Listen seam.
5. **The empty-`final_text` path** in Section 8.1.

None was made. A fix work order that also relaxes a gate cannot prove the fix
worked.

---

## 10. New failure classes discovered

**One, and it is a separation rather than a discovery.** Malformed model JSON is
now distinguishable from truncation, and both from a legitimate empty result.
Three failures that were one symptom are now three measurements: truncation
0/20, malformed 1/20, empty 0/20.

No new class beyond that. The representation/contract mismatches, the
`MARKER_NOT_FOUND` sub-causes, and the fixture-versus-live shape mismatch all
behaved exactly as the Class B investigation described.

---

## 11. Regression and learner-facing behavior

| Gate | Result |
|---|---|
| Full suite, 17 packages | **519 passed, 0 failed** — identical to the pre-fix baseline |
| Typecheck, all 16 packages with a `typecheck` script | **all OK** |
| HF-001 hard gate, live | **PASS** — `move=highlight_strength`, fallback=false, guardrail=true, grounding=true |
| HF-002 hard gate, live | **PASS** — no causal relationship asserted as fact |
| Both gates | **PASS** |

`LiveCallMeta` gained three fields; the one external consumer
(`evidence-shadow-compare/src/pipeline.ts`) reads it as an opaque type and
typechecks unchanged.

**No learner-facing behavior changed.** The coach path does not touch the Listen
seam at runtime — it consumes a graph — and both hard gates produce the same
Teaching Moves and the same grounded output as before the fix.

---

## 12. What the rerun proved, and what it did not

### Proved

- The truncation defect is **fixed**: 0/20 truncations against 7/20 before, with
  8 runs exceeding the old budget and none exceeding the new one.
- The **diagnosis was correct**: the share of runs exceeding 4,096 tokens (40%)
  matches the previously observed truncation rate (35%).
- **Case 002 is measurable**, and its reversal gate scores 5/5 — as pre-stated.
- The **reversal gate reaches VIABLE SIGNAL on all three of its anchors** (4/5,
  5/5, 5/5).
- The **strict causal gate's 0/5 was never a truncation artifact** — unchanged at
  0/5 on five usable runs.
- Truncation, malformed output, and empty output are now **three distinct,
  separately measurable failures**.
- Nothing outside the Listen seam moved: 519 tests green, both hard gates PASS.

### Did not prove

- **Nothing about production reliability.** n=5 was pre-registered to separate
  catastrophic from plausible, not to estimate a rate. A 4/5 and a 5/5 are not
  distinguishable at this n.
- **Nothing about the relaxed causal predicate.** 3/5 → 2/5 is movement inside
  one band; no conclusion is drawn.
- **Nothing about the historical 2026-07-19 live run.** `stop_reason` was never
  recorded then, so whether truncation contributed to the original −0.892 Class B
  degradation remains unrecoverable.
- **Nothing about the 8,192 headroom under heavier load.** Peak usage reached 85%
  of the budget on this corpus; longer transcripts were not tested and are not
  authorized here.
- **Nothing about the other call sites.** Section 8 reports values only; no site
  other than Listen was exercised, measured live, or changed.
- **Nothing about the malformed-JSON rate.** 1/20 is a single observation.

---

**Stopped for founder review.** No SOD v0.2 work was started, no gate was
relaxed, and no adjacent fix was made.

---

## 13. Founder disposition — 2026-08-14

Recorded here so the decisions and their reasons survive with the evidence that
produced them. **None of the below is implemented or authorized by this report.**

### Reversal gate — goes forward into v0.2 with strict graph eligibility

4/5, 5/5, 5/5 across three anchors, all VIABLE SIGNAL. No relaxation needed.

### Causal gate — parked, and the reason is on the record

The strict predicate is dead as written (0/5). What the rerun adds is *why*: all
three Case 009 misses are the same `MARKER_NOT_FOUND` representation mismatch,
**unchanged by the budget fix**. The causal gate's ceiling is therefore not the
detector and not the output budget — it is the **representation / contract
layer** this work order deliberately deferred: quote-boundary behavior for
connectives, and exact-versus-normalized marker matching.

That leaves a genuine design choice for the v0.2 pre-registration:

1. test the relaxed causal predicate at higher n and accept the ~2–3/5
   eligibility it currently gets; or
2. **hold the causal tag out of v0.2 entirely** and run the small
   Validator-contract investigation first.

**Founder leans to (2).** Pre-registering a detector whose eligibility gate is
already known to be representation-capped spends experimental budget documenting
a ceiling we have already measured.

### v0.2 scope — three tags, cleanly

`ownership_dilution` and `result_needs_substance` depend only on Class A claims
and claim types, and were never blocked by any of this. With reversal viable and
causal parked, v0.2 covers **three tags** without a known-capped gate in the set.

### Empty coach output — its own narrow work order, before production

The Section 8.1 finding is the most production-relevant thing this detour
produced. A coach that emits nothing while every gate reads green is a
**learner-facing reliability hole**, not a research curiosity. The fix is a
straight generalization of what was just built: `stop_reason` and token usage on
`ProviderCallMeta`, and empty output treated as a **hard failure** rather than a
passing gate.

It gets its own narrow work order and does **not** ride along with SOD. Being
independent of v0.2, it can run in parallel whenever there is a slot.
**Non-negotiable before production.**

### 15% headroom — monitor, do not tune

And the monitoring is now automatic: any future truncation throws a typed, loud
error instead of masquerading as an empty graph. The risk announces itself, which
is the point of what was shipped here.
