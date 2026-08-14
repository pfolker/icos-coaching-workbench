# Work Order — Listen Truncation Fix

> **AUTHORIZED 2026-08-13.** Approved as drafted; executed without modification.
> Drafted 2026-08-13 at Patrick's request, following the Class B Live-Admission
> Investigation (`CLASS-B-LIVE-ADMISSION-INVESTIGATION.md`, commit `a35ecdc`).

---

## Authority

**Narrow implementation authority, confined to the Listen seam.**

Authorized:

* one change to the Listen Engine's output budget, at the pre-registered value
  fixed in Section 2 below;
* truncation detection and reporting at the Listen seam (Section 3);
* the pre-registered rerun of the Phase C matrix (Section 4);
* a read-only audit of every other live LLM call site (Section 5).

Not authorized: anything else. See Section 6.

This work order exists because the Class B investigation found a mechanical
defect that destroyed 35% of its runs and made one anchor unmeasurable. It is a
repair, not an experiment.

---

## 1. The defect

Measured in the Class B investigation, 20 live Listen runs across four anchors:

* **7 of 20 runs (35%) produced no parseable output.** By case: 001 ×1,
  **002 ×5**, 009 ×1, `founder` ×1.
* Direct diagnosis of two calls confirmed the mechanism:

| Case | `stop_reason` | output tokens | thinking tokens | text block |
|---|---|---|---|---|
| 002 | `max_tokens` | 4096 | 2,971 | cut mid-string |
| 001 | `max_tokens` | 4096 | 3,528 | cut mid-string |

The model reasons before answering. Thinking consumed **73–86%** of the
configured budget, leaving too little for the JSON, which was cut mid-token.

Current value: `max_tokens: 4096` at
`evidence-runtime/src/listenEngine.ts:72`.

**Why this is urgent rather than cosmetic.** A truncated run yields no graph at
all. Every downstream availability number — Class B recall, eligibility,
anything SOD v0.2 would measure — silently counts it as "the relationship was
not there". This failure class has now appeared **twice**: once in SOD v0.1
(the void runs, where a thinking block consumed the entire 1024-token budget)
and once here. It must never again be readable as an empty result.

---

## 2. Pre-registered output budget

> ### The new value is **8192**. It is fixed now, before any run.

**Derivation from the measured evidence:**

1. **Thinking, measured complete:** 2,971 and 3,528 tokens. Both diagnoses show
   thinking *finishing* and the text block being cut, so these are complete
   thinking passes, not truncated ones. Worst observed: **3,528**.
2. **Output JSON required:** Case 002's truncated text reached ~3,000 characters
   (~750 tokens) having emitted roughly two-thirds of Class A and an incomplete
   Class B array. A complete document for the largest anchors (002 and `founder`,
   ~15–16 Class A, ~5–6 Class B, plus Class C) is estimated at
   **~1,200–1,500 tokens**.
3. **Worst-case requirement:** 3,528 + 1,500 ≈ **5,030 tokens**.
4. **Headroom:** thinking is the volatile term and has been directly measured
   only twice. 8,192 leaves ~4,600 tokens for thinking above a full-size
   document — a ~1.3× margin over the worst observed thinking pass *after* the
   text is paid for.
5. **Why 8192 specifically:** it is the smallest power-of-two doubling of the
   current budget that clears the measured worst case with margin. It is not
   chosen by trying values.

**This value may not be adjusted after seeing results.** "Raise until it passes"
is explicitly not authorized.

**Falsification condition — pre-registered:** if **any** run in Section 4
truncates at 8,192, that is a **reportable failure of this work order**. Stop,
report the `stop_reason` and token usage, and do not raise the budget again. A
second truncation at double the budget would mean the problem is not budget
sizing, and that is a finding worth having rather than a number worth chasing.

---

## 3. Truncation detection at the Listen seam

Part of the fix, not optional. The budget change alone would hide the next
occurrence rather than surface it.

**Required:**

1. **Record per call:** `stop_reason`, `output_tokens`, and
   `output_tokens_details.thinking_tokens` from the API response, carried on the
   Listen result's `meta`.
2. **Detect truncation before parsing.** `stop_reason === "max_tokens"`, or a
   response carrying no text block, must be identified *before*
   `parseModelJson` is reached. Today the truncation surfaces as a generic JSON
   syntax error, which is indistinguishable from the model emitting malformed
   JSON — two different failures with different owners.
3. **Surface it explicitly**, in the same spirit as `sod-experiment`'s
   `no_text_block` field: a distinct, typed truncation signal carrying the
   recorded `stop_reason` and usage, so a caller can tell
   *"the pipeline was cut off"* from *"the model answered badly"* and from
   *"there was nothing to find"*.
4. **Preserve existing control flow.** The current behavior — never fabricate a
   fallback, log the full raw response to
   `evidence-runtime/logs/listen-engine-parse-failures.log`, re-throw — stays.
   The existing parse-failure log proved to be the single most valuable artifact
   in the Class B investigation; it must keep working exactly as it does.
5. **Do not add retry.** A truncated call must fail visibly, not be silently
   re-attempted.

**Note for the implementer:** the raw-response persistence at
`listenEngineParseFailureLog.ts` is what made the truncated runs forensically
recoverable — the Case 002 contrast proposals were read out of it. Whatever
shape the truncation signal takes, that capture must not be bypassed on the
truncation path.

---

## 4. Rerun the identical Phase C matrix

**Identical, not similar.** Same 4 anchors — **001, 002, 009, `founder`** — at
**5 independent live runs each**, 20 runs total.

Byte-for-byte unchanged from the Class B investigation:

* the Listen system prompt;
* the Validator, its marker vocabulary, and every admission rule;
* the provider and model (`claude-sonnet-5` via `runListenEngineLive`);
* sampling (provider default — no temperature is exposed and none may be added);
* the ground-truth corpus and the anchors themselves.

**The only difference between the two runs must be the output budget and the
truncation instrumentation.** That is what makes the comparison mean anything.

**Report the same rate table**, same rows, same denominators (5 attempted runs
per anchor):

runs usable · transcript-truth positive · semantic perception · contract-valid
representation · target relationship admitted · validator rejections of
semantically correct proposals · representation-mismatch rate · false-positive
relationships · strict gate availability

**Apply the already-pre-registered viability mapping unchanged** — 0–1/5 not
currently viable; 2–3/5 ambiguous/unresolved; 4–5/5 viable signal for higher-n
v0.2 testing. **No new interpretation rules after the fact**, and no
re-litigating the bands because a number lands near an edge.

Also report, per run: `stop_reason`, output tokens, thinking tokens. Those
columns are the evidence that the defect is actually fixed.

**Expected outcome, stated in advance so it cannot be claimed afterwards:**
Case 002 should become measurable. Its five truncated runs each showed a
`contrast_marker` "but" proposal in progress, so its admission rate should be
non-zero. If it is measurable and still 0/5 admitted, that is a genuine and
newly-visible gate result — and it must be reported as such, not treated as a
disappointment.

---

## 5. Audit-only — every other live LLM call site

**Report values. Change nothing outside the Listen seam.**

Grep the repository for every site that makes a live model call — the Narrator,
the SOD experiment, the `CoachProvider` seam and each of its callers, the
benchmark runners, and anything else that reaches a provider.

For each site report:

| Field |
|---|
| file and line |
| the `max_tokens` value |
| whether the result records `stop_reason` |
| whether the result records output/thinking token usage |
| whether a truncated or empty response is distinguishable from a legitimate empty result |

The Class B and SOD v0.1 findings together suggest this class is systemic rather
than local. The audit's purpose is to size that, not to fix it. **Any site found
to be at risk gets documented in the report and left alone.**

---

## 6. Explicitly out of scope

Do not implement, and do not slip in alongside the authorized change:

* marker normalization — including the `"This pointed to"` versus `"pointed to"`
  case, which is a real and tempting one-line-looking fix;
* any other Validator change, marker-vocabulary addition, or admission-rule
  change;
* any Listen prompt change, schema change, or Class B contract change;
* gate relaxation of any kind, including the relaxed causal and reversal
  predicates identified in the Class B investigation;
* SOD v0.2 work of any kind — no design, no pre-registration, no implementation;
* `max_tokens` changes at any call site other than the Listen seam;
* retry logic, streaming, provider or model migration, temperature tuning;
* frozen-engine changes, Narrator changes, Teaching Move changes, readiness
  changes, principle selection, learner-facing changes.

**Document any tempting adjacent fix. Do not make it.** The Class B
investigation identified at least three candidates — marker normalization,
quote-boundary guidance for connectives, and the two relaxed gate predicates.
None is authorized here. A fix work order that also relaxes a gate cannot prove
the fix worked.

---

## 7. Deliverable

A report containing:

1. the pre-registered budget and its derivation, restated unchanged from
   Section 2;
2. the exact change made at the Listen seam, and nothing else changed;
3. the truncation-detection mechanism as implemented;
4. the full 20-run rerun results, per run, including `stop_reason` and token
   usage;
5. the rate table in the same shape as the Class B report;
6. the pre-registered viability mapping applied to the new numbers;
7. a before/after comparison against the Class B investigation's table;
8. the audit inventory of every other live call site;
9. any tempting adjacent fix found and deliberately not made;
10. any new failure class discovered;
11. regression results — the full suite must remain green, and no learner-facing
    behavior may change;
12. a clear statement of what the rerun proved and what it did not.

**Report state:** leave the report uncommitted pending founder review, following
the precedent used for the decomposition and Class B investigations.

---

## 8. Stop conditions

Stop and report, rather than continuing, if:

* any run truncates at 8,192 (Section 2's falsification condition);
* the fix changes any learner-facing behavior, any Validator decision, or any
  existing test result;
* the rerun cannot be made byte-identical to the Class B matrix for any reason;
* the truncation instrumentation would require changing the provider seam in a
  way that affects other callers.

---

## Governing principle

> **Fix the delivery defect. Change nothing else. Measure the same thing twice
> and let the two numbers be comparable.**

The value of this work comes entirely from the rerun being identical except for
the defect. Every adjacent improvement made along the way destroys that.
