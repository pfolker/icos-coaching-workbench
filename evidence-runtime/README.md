# ICOS Evidence Runtime — Phase 3A Prototype

**What this is:** a prototype runtime that proves the propose → validate →
graph architecture end to end, using a real (or fixture) Listen Engine call
feeding the real, unmodified `evidence-validator` package. **What this is
not:** a production Listen Engine. There is no production prompt tuning, no
retry loop, no optimization, no new coaching logic, and — critically — **no
adapter feeding the Validated Evidence Graph into the existing engines.**
Stages 5-8 run the existing Observation → Opportunity → Decision →
Conversation engines, completely unmodified, on the same raw transcript,
purely for side-by-side observation. This is an engineering laboratory
built for transparency, not a demonstration of AI capability.

---

## 1. Architecture

```
                    ┌─────────────────────────────────────────────┐
                    │              ONE TRANSCRIPT                  │
                    └───────────────────┬───────────────────────────┘
                                         │
                ┌────────────────────────┴────────────────────────┐
                │                                                    │
                ▼ Stages 1-4 (NEW)                                   ▼ Stages 5-8 (EXISTING, UNMODIFIED)
   ┌─────────────────────────────┐                      ┌─────────────────────────────────┐
   │ 1. Transcript                │                      │ 5. Observation Engine Input       │
   ├─────────────────────────────┤                      │    (same transcript, computed      │
   │ 2. Prototype Listen Engine    │                      │     independently)                 │
   │   (live 1 LLM call, or        │                      ├─────────────────────────────────┤
   │    fixture — dual mode)       │                      │ 6. Observation Output              │
   │   -> Class A/B/C proposals    │                      ├─────────────────────────────────┤
   ├─────────────────────────────┤                      │ 7. Decision Output                  │
   │ 3. Evidence Validator          │                      ├─────────────────────────────────┤
   │   (real, unmodified package;   │                      │ 8. Conversation Output              │
   │    +1 additive field only)     │                      └─────────────────────────────────┘
   ├─────────────────────────────┤
   │ 4. Validated Evidence Graph    │              NO ADAPTER CONNECTS THESE TWO HALVES.
   │   (Class A/B nodes+edges;      │              Stage 5 would produce byte-identical
   │    Class C shown, never wired) │              output even if Stages 1-4 did not exist.
   └─────────────────────────────┘              (proven by test/pipeline.test.ts)
```

**Package layout:**
```
evidence-runtime/
├── src/
│   ├── systemPrompt.ts     the verbatim Listen Engine system prompt (Section 2 below)
│   ├── modelOutput.ts       raw model shapes + materializeSourceSpans()
│   ├── listenEngine.ts       dual-mode: runListenEngineLive / runListenEngineFixture
│   ├── existingEngines.ts    Stages 5-8: the four existing engines, unmodified, no adapter
│   ├── evidenceGraph.ts       Stage 4: reshapes ValidatorOutput into nodes/edges/non_admissible
│   ├── pipeline.ts             runPipeline(): wires all 8 stages for one transcript
│   └── index.ts
├── fixtures/                 hand-authored Listen Engine proposals, one file per Atlas case
├── server/server.ts           Debug UI HTTP server (port 4322)
├── public/                   Debug UI static assets (index.html, debugUI.js/css)
└── test/pipeline.test.ts       16 tests: all 9 required cases + edge cases + determinism
```

Depends on `../evidence-validator` and the four existing engines
(`../observation-engine`, `../opportunity-engine`, `../decision-engine`,
`../conversation-engine`) via the same relative-import convention
`alpha-workbench/server/orchestrator.ts` already uses. No package was
copied or forked.

---

## 2. The Listen Engine's system prompt (verbatim)

This is the exact, unmodified string used for the live call
(`src/systemPrompt.ts`, constant `LISTEN_ENGINE_SYSTEM_PROMPT`), sent as the
Anthropic Messages API `system` field, with the transcript sent as the
user message that follows it:

```
You are the Prototype Listen Engine for an evidence-extraction system. Your ONLY job is to read a transcript of a spoken interview answer and propose evidence claims about what was said. You do not score, coach, prioritize, judge, evaluate, summarize, or explain the quality of the answer. You do not decide which evidence class (A, B, or C) a claim belongs to, and you do not decide whether a claim is admissible — a separate, deterministic validator does both of those. Your only output is proposals.

You will propose three kinds of claims:

1. CLASS A PROPOSALS — a direct, verbatim quote from the transcript, tagged with a claim_type. claim_type must be exactly one of: problem, prior_belief, self_reported_diagnosis, action, decision, outcome, constraint, business_value, context_fact, reflection. Use self_reported_diagnosis for a speaker's own stated conclusion about a cause, including a belief they present as true — you are only claiming that the speaker SAID this, never that it IS true.

2. CLASS B PROPOSALS — a structural relationship between two or more Class A claims, where the relationship is explicitly marked by specific words in the transcript (a connective like "because"/"so"/"pointed to"/"led to"/"resulted in", a contrast marker like "but"/"instead of"/"however", a temporal connector like "once"/"after"/"before", or a number bound to a unit, or two same-type claims appearing in sequence). relationship_type must be exactly one of: temporal_sequence, explicit_connective, contrast_marker, quantity_binding, enumeration. Only propose a Class B relationship when you can point to the literal marker text that makes it explicit in the transcript — never propose one because a relationship merely seems implied.

3. CLASS C PROPOSALS — a hypothesis: an interpretation that requires connecting ideas the speaker did not explicitly connect themselves.

CRITICAL RULES:

- Prefer under-claiming to over-claiming. If you are unsure whether something is directly stated or something you are inferring, propose it as a CLASS C hypothesis grounded in the relevant CLASS A claim(s) and reasoning, rather than forcing it into a confident Class A or Class B claim. A cautious Class C proposal is always safer than an overconfident Class A proposal.
- Every quote you propose, in every claim type, must be copied EXACTLY, character-for-character, from the transcript you are given. Do not paraphrase, do not fix grammar, do not add or remove words, do not combine two separate sentences into one quote. If you cannot find the exact words in the transcript, do not propose the claim at all.
- Do not assign an evidence_class, an admissibility value, or any label describing how trustworthy, confident, or certain a claim is. You are not asked for and must not include any self-rated confidence score, probability, or certainty language anywhere in your output, for any claim. That judgment belongs entirely to a separate validator you do not have access to.
- Do not comment on the quality of the answer, do not suggest what the speaker should have said, do not generate coaching advice, and do not summarize the transcript. Propose evidence claims only.

OUTPUT FORMAT — return ONLY a single JSON object, no prose before or after, with exactly this shape:

{
  "class_a_proposals": [
    { "proposal_id": string, "claim_type": string, "quote": string }
  ],
  "class_b_proposals": [
    { "proposal_id": string, "relationship_type": string, "components": string[], "marker_text": string }
  ],
  "class_c_proposals": [
    { "proposal_id": string, "hypothesis": string, "supporting_claim_ids": string[], "reasoning": string, "clarification_question": string }
  ]
}

Each proposal_id must be a short, unique, lowercase snake_case string you invent, stable enough that class_b_proposals.components and class_c_proposals.supporting_claim_ids can reference the proposal_id of a class_a_proposals entry. IMPORTANT: supporting_claim_ids must contain the proposal_id values of class_a_proposals entries — never the literal quote text itself. Do not include a source_span field — exact character offsets are computed downstream from your quote, not by you.

The transcript will be given to you in the next message.
```

---

## 3. Pipeline walkthrough (one transcript, start to finish)

1. **Transcript** enters `runPipeline(case_id, transcript, listenResult)`.
2. **Listen Engine** (`listenEngine.ts`) has already produced a
   `ListenEngineRawOutput` — either from one real LLM call (`runListenEngineLive`,
   which throws `NoApiKeyError` plainly if `ANTHROPIC_API_KEY` isn't set — it
   never silently falls back) or from a hand-authored fixture
   (`runListenEngineFixture`). Model output has no `source_span` field.
3. **`materializeSourceSpans`** (`modelOutput.ts`) — ordinary code, not the
   model — locates each proposed quote's first verbatim occurrence in the
   transcript and attaches `source_span`. A quote that isn't found verbatim
   gets a sentinel span; it's still handed to the Validator rather than
   silently dropped, so `QUOTE_NOT_FOUND` (which checks `transcript.includes`
   independent of span) is the actual, auditable reason it's rejected.
4. **`validateEvidence`** — the real, byte-for-byte unmodified validation
   logic from `evidence-validator/src/validator.ts`, plus the one additive
   `admitted_by` field (Section 5 below). Produces the full `ValidatorOutput`:
   accepted Class A/B, non-admissible Class C, rejected, requires_review,
   selection_required.
5. **`buildEvidenceGraph`** (`evidenceGraph.ts`) reshapes that output into
   nodes (Class A), edges (Class B), and a structurally separate
   `non_admissible` list (Class C) that is never wired into the graph.
6. **`runExistingEngines`** (`existingEngines.ts`) — in parallel, computed
   from nothing produced above — runs `observe()`, `generateOpportunities()`,
   `decide()`, `generateCoachingMove()` on the identical transcript string,
   fresh state (no mission, no learner history, `coaching_state: "flowing"`,
   `question_type: "behavioral"`). `test/pipeline.test.ts`'s "no adapter"
   test proves this produces byte-identical output whether or not Stages 1-4
   ran at all.
7. **Debug UI** (`server/server.ts` + `public/`) exposes `GET /api/run/:caseId?mode=fixture|live`,
   which returns the full `PipelineResult`, and renders all 8 stages.

---

## 4. Dual-mode testing

- **Fixture mode** — `fixtures/case001.ts` … `case010.ts` (9 required cases:
  001, 002, 004, 005, 006, 007, 008, 009, 010), each a hand-authored,
  independent reading of the transcript in the exact shape a Listen Engine
  would produce (no `source_span`). **These are the assistant's own
  proposals, explicitly not Atlas ground truth** — see `fixtures/README.md`
  for why that distinction matters for attribution.
- **Live mode** — `runListenEngineLive` makes one real call to the Anthropic
  Messages API using the system prompt in Section 2. `ANTHROPIC_API_KEY` can
  come from the inherited process environment, or from a `.env` file in this
  package's root (`evidence-runtime/.env`, key=value, one per line) —
  `src/loadEnv.ts` loads it via Node's built-in `process.loadEnvFile` (no
  new dependency) as a convenience for local development; process env still
  wins if both are set. `.env` is git-ignored (root `.gitignore`); an
  `.env.example` documents the expected key name with no value. **In this
  environment, an `ANTHROPIC_API_KEY` was later supplied via `.env`. Before
  that, `hasLiveApiKey()` correctly gated the call and the Debug UI's
  live-mode run against Case 009 returned, verbatim:

  > `NO_API_KEY: Live mode unavailable: no ANTHROPIC_API_KEY is configured in
  > this environment. Reporting this plainly rather than silently falling
  > back to fixture output or fabricating a response.`

  confirming the "report plainly, never fabricate a fallback" requirement.
  **Once a key was configured, one real live call was made** (model
  `claude-sonnet-5`, Case 009, ~18s round trip) and ran through the full
  pipeline successfully — see Section 6 for the comparison against fixture
  mode and Section 9 for a genuine ambiguity this live call surfaced that no
  amount of fixture authoring would have found. Live mode was exercised for
  Case 009 only, on request, not re-run across all 9 cases.

---

## 5. The one additive Validator change

Per the task's explicit constraint (additive transparency only, never
loosening admission), `evidence-validator/src/types.ts` gained one new
required field, `admitted_by: string`, on `ValidatedClassA`, `ValidatedClassB`,
and `ClassCNonAdmissible` — populated in `classA.ts`/`classB.ts`/`classC.ts`
purely by describing a decision those files already made (which rule branch
matched, which marker, which `ordering_basis`). **No validation logic
changed.** Proof: all 65 pre-existing `evidence-validator` tests pass
unmodified (Section 6). This satisfies the Debug UI's "which rule admitted
this claim" requirement (Stage 3).

Example, from Case 008's temporal_sequence edge:
```json
"admitted_by": "temporal_sequence via ordering_basis=connector:once: connector \"once\" attached to \"we went back to the old sealant\" fixes logical order [\"we went back to the old sealant\", \"The failures stopped\"], matching the proposed component order"
```

---

## 6. Test results

**`evidence-runtime/test/pipeline.test.ts` — 16/16 passing.**

| Test | Result |
|---|---|
| All 9 required cases run end-to-end with a coherent graph (001,002,004,005,006,007,008,009,010) | ✅ 9/9 |
| No-adapter proof: Stage 5 byte-identical with/without Stages 1-4 | ✅ |
| Case 007 multi-candidate: both "problem" candidates preserved, `selection_required` fires, discourse marker attached as metadata only | ✅ |
| Case 009 adversarial: self-assigned `established_cause` rejected end-to-end with `BELIEF_FACT_COLLAPSE_ATTEMPT`, never reaches the graph | ✅ |
| Case 009 well-formed: causal belief validates as `self_reported_diagnosis`, `speaker_assertion: true`, never promoted | ✅ |
| Case 008: connector-governed `ordering_basis: "connector:once"` fires on a naturally-ordered proposal | ✅ |
| Case 010: clean single-cause narrative stays Class C; no "caused" language anywhere in nodes/edges | ✅ |
| Determinism: identical fixture run twice → byte-identical Stage 1-4 output, for all 9 cases | ✅ |

**Regression check — every existing package's own suite, unaffected:**

| Package | Result |
|---|---|
| evidence-validator (touched: +1 additive field) | 65/65 ✅ |
| observation-engine (untouched) | 33/33 ✅ |
| opportunity-engine (untouched) | 39/39 + 1 skipped ✅ |
| decision-engine (untouched) | 15/15 ✅ |
| conversation-engine (untouched) | 36/36 ✅ |
| comparison-engine (untouched) | 21/21 ✅ |
| alpha-workbench (untouched) | 22/22 ✅ |

**Live vs. fixture comparison (Case 009, after a key was configured):**

| | Fixture mode | Live mode (`claude-sonnet-5`) |
|---|---|---|
| Causal belief claim_type | `self_reported_diagnosis`, `speaker_assertion: true` | Same — `self_reported_diagnosis`, `speaker_assertion: true` |
| Belief-fact collapse attempted? | No (well-formed fixture); adversarial variant tested separately and rejected | No — the real model never attempted `established_cause` or similar |
| `context_fact` claims | `a_policy`/`a_reps` typed `context_fact` | Same two quotes typed `action` instead — a real claim_type judgment difference (Spec Section 4 explicitly acknowledges this label carries residual judgment) |
| Class B | one self-contained `explicit_connective` ("because") on the belief quote itself, accepted | model proposed "because" as *bridging* two separate components instead of self-contained — correctly rejected `MARKER_NOT_FOUND`; a `temporal_sequence` ("after") and a `quantity_binding` ("two more support reps") both validated |
| Class C | none proposed (fixture didn't need one) | 2 proposed, both rejected `CLASS_C_MALFORMED` — not because the hypotheses were unsound, but because the field (then named `supporting_quotes`) held literal quote text instead of a `proposal_id` reference (Section 9, new finding) |
| Determinism | byte-identical across repeated runs | two separate live calls for the same transcript produced different `proposal_id`s and slightly different claim boundaries — live mode is not deterministic, which is exactly why fixture mode exists as the reproducible baseline |

All 9 required cases were tested in fixture mode; live mode was additionally
run for Case 009 once a key became available (Section 4).

**Phase 3.1 update:** the field discovered above has since been renamed
`supporting_quotes` → `supporting_claim_ids` (Specification v1.1, EP-005;
see the Phase 3.1 section at the end of this README). The `context_fact`
vs. `action` divergence in this table was separately audited in the same
pass and left as-is — see that section for why.

---

## 7. Debug UI verification (screenshots)

The Debug UI was run live in a browser (`npm start`, port 4322) and driven
through the accessibility tree rather than pixel screenshots — the
screenshot tool was unavailable/timing out in this environment for reasons
unrelated to this code (confirmed via `preview_logs`: the server itself
never errored). The structural captures below are the actual rendered DOM
content, which is an equally strong (arguably stronger, since it's exact
text rather than pixels) proof the UI renders real pipeline output:

- **Case 001, fixture mode:** all 8 stages rendered; Stage 2 showed 12 raw
  Class A + 3 Class B + 1 Class C proposals, all correctly badged
  "accepted"/"class c"; Stage 3 showed full `admitted_by` rule attribution
  per claim (e.g. `"rules 1-3 ... claim_type \"problem\" in closed enum) +
  rule 4 lexical mismatch check ... found no mismatch"`); Stage 4's graph
  showed 12 nodes, 3 edges, 1 non-admissible entry explicitly marked "never
  wired into nodes/edges above"; Stages 5-8 showed real Observation/Decision/
  Conversation engine output for the identical transcript.
- **Case 009, live mode:** running with no API key returned exactly the
  plain `NO_API_KEY` message quoted in Section 4 — no crash, no fabricated
  output, no silent fixture substitution.
- **Case 009, fixture mode:** re-ran successfully; `a_belief` appeared in
  Stage 2/3/4 as `self_reported_diagnosis`, with a `b_because` self-contained
  `explicit_connective` edge — confirming the single most important case in
  this build behaves correctly through the full pipeline, not just in a
  unit test.

---

## 8. Lessons learned

1. **The hardest part of this build was never the Validator — it was
   deciding what the Listen Engine is not allowed to know.** Keeping
   `source_span` entirely off the model's plate (Section 9, ambiguity #2)
   removed an entire category of failure (models miscounting characters)
   that would otherwise have looked like a Validator bug (`SOURCE_SPAN_MISMATCH`)
   but was actually a Listen Engine problem — exactly the kind of
   misattribution dual-mode testing and rule-level `admitted_by` /
   `reason_code` transparency exist to prevent.
2. **"Additive transparency" is a real, checkable category, not just a
   nice phrase.** Adding `admitted_by` required touching every branch of
   `classB.ts`'s five relationship-type cases, which felt uncomfortably
   close to "real code change" — the discipline that made it safe was
   verifying it *only ever describes a decision already made a few lines
   above it* and then proving nothing broke (65/65 pre-existing tests,
   unmodified).
3. **Fixture-mode "independent authorship" is harder to keep honest than it
   sounds.** It is very tempting, while hand-authoring a fixture, to
   subconsciously reproduce the Atlas's own quote boundaries once you've
   read them. The one place this was caught explicitly is Case 001 (see
   Section 9, ambiguity #1) — deliberately choosing the *shorter*, more
   natural quote boundary instead of the Atlas-matching one, specifically
   because a real model has no access to the Atlas's answer key and would
   have no special reason to draw the boundary that way either.
4. **The "no adapter" requirement is easy to state and easy to accidentally
   violate by proximity.** Nothing in `existingEngines.ts` reads from
   `evidenceGraph.ts` — but the temptation to "just pass the graph through
   as extra context" while building `pipeline.ts` was real, since both are
   right there in the same function. The explicit `test/pipeline.test.ts`
   "no adapter" test (byte-identical output with/without Stages 1-4) exists
   because a code reviewer skimming the diff wouldn't necessarily catch a
   subtle accidental coupling; a test that actively tries to disprove the
   coupling is stronger than a comment promising it isn't there.
5. **Belief-fact protection needed to be tested at the pipeline level, not
   just the unit level, to actually trust it.** `evidence-validator`
   already had adversarial unit tests for `BELIEF_FACT_COLLAPSE_ATTEMPT`
   (Case 009). Re-running the identical attack shape through the full
   8-stage pipeline (Section 6) confirmed the protection survives contact
   with `materializeSourceSpans`, the Evidence Graph reshaping, and the
   Debug UI's rendering — none of which existed when those unit tests were
   originally written.
6. **A real model, on its very first live call, immediately validated the
   dual-mode design's whole rationale.** It correctly kept the causal belief
   scoped to `self_reported_diagnosis` (matching every fixture's simulated
   behavior) — but it also did something none of the 9 hand-authored
   fixtures did: it populated `supporting_quotes` with literal quote text
   instead of `proposal_id` references, silently losing two well-reasoned
   Class C hypotheses to `CLASS_C_MALFORMED`. No amount of careful fixture
   authoring would have found that, because a human authoring a fixture by
   hand already knows what a `proposal_id` reference is supposed to look
   like. This is the concrete case for why "fixture mode proves the pipeline
   works" and "the pipeline works against a real model" are different
   claims, and only one of them was actually tested before a key was
   available.

---

## 9. Specification ambiguities found while building this (Deliverable 8)

**Honesty note before the list:** findings #1-4 below were originally
written with no live LLM call available in this environment (no
`ANTHROPIC_API_KEY`) — they came from (a) closely reading
`evidence-validator`'s actual mechanical rules while writing
`materializeSourceSpans` and the fixtures, and (b) deliberately trying to
simulate a model that only sees the transcript and the system prompt, never
the Atlas's answer key. That is a real but weaker form of evidence than an
actual model transcript, and was reported as such rather than overclaimed.
**A key was later configured and one real live call was made** (Section 4,
Section 6) — finding #5 came directly from that call's actual output, not
simulation, and is flagged as such. All five are distinct from the two
already-known debts (Atlas Cases 004/005's "finding" prose wording;
Case 001/002's single-component B2/B5) and from
`evidence-validator/README.md`'s own five already-documented implementation
gaps (Class A rule 4 judgment; B's unspecified minimum component counts;
no 3+-component bridging; multi-candidate scope; EP-004's 2-component
limit).

1. **Class B marker-list widening (EP-003) only helps if the Listen
   Engine's quote boundary happens to include the marker — and nothing in
   the Specification guides quote-boundary decisions at all.** Case 001's
   "Instead of trying to solve it in software, I modified the fixture..."
   only produces a valid `contrast_marker` proposal if the Class A quote is
   extended backward across a comma to include "Instead of." A Listen
   Engine (real or simulated) has no textual reason to prefer the longer
   boundary over the shorter, more natural one — and the shorter one is
   arguably *more* faithful to "quote what was actually said" than
   reaching for a marker. `fixtures/case001.ts` deliberately keeps the
   shorter boundary and documents that no contrast_marker relationship gets
   proposed as a result. EP-003 fixed the marker *vocabulary*; it did not
   (and structurally cannot, from inside the Validator alone) fix the
   quote-boundary decision that determines whether the vocabulary ever
   gets exercised.
2. **The Specification requires `source_span` on every Class A entry
   (Section 3) but never says who computes it.** Asking an LLM to produce
   exact character offsets by hand is unreliable by construction — models
   are not good at literal character arithmetic, and a single off-by-one
   collapses Rule 2 (`SOURCE_SPAN_MISMATCH`) for an otherwise-perfectly-
   quoted claim. This build's answer — the Listen Engine proposes quotes
   only, and ordinary code (`materializeSourceSpans`) computes spans via
   verbatim string search — is a reasonable design decision, not something
   the Specification itself resolves. A future Specification revision
   should probably say so explicitly, since two independent
   implementations could otherwise reasonably disagree about whose job
   this is.
3. **No version of the Specification addresses what happens when a
   proposed quote appears more than once in the transcript.** This build
   defaults to the first verbatim occurrence (`modelOutput.ts`'s
   `locateSpan`), matching `evidence-validator/test/helpers.ts`'s own
   `span()` convention — but this default has never actually been
   exercised against a real duplicate-quote transcript, because none of
   the 10 Atlas cases happens to repeat a full quoted phrase. This is a
   genuine untested edge in both this build and the Atlas itself.
4. **The Specification's Class B schema (Section 3) shows `components` as
   `[<Class A claim references>]` without ever specifying what a
   "reference" formally is** — a `proposal_id` string, an index, the quote
   text itself, something else. This build had to invent the `proposal_id`
   convention from scratch (used consistently by `evidence-validator`'s own
   fixtures too, but that consistency reflects one implementation's choice,
   not a Specification requirement). Two independently-built Listen Engines
   satisfying the same Specification text could reasonably choose
   incompatible reference schemes with nothing in the document to arbitrate
   between them.
5. **[Actually observed, not simulated] A real model confirmed finding #4
   the very first time it was tested against a live model.** In the one live
   call made for Case 009 (Section 6), the model populated both Class C
   proposals' `supporting_quotes` with the literal quote **text**
   ("We changed our return policy to be more lenient at the start of the
   quarter.") instead of the Class A `proposal_id` ("action_return_policy")
   the system prompt explicitly asked it to reference — even though the
   prompt states outright: *"stable enough that class_b_proposals.components
   and class_c_proposals.supporting_quotes can reference the proposal_id of
   a class_a_proposals entry."* Both hypotheses were reasonable, well-scoped,
   correctly under-claimed as Class C — and both were discarded as
   `CLASS_C_MALFORMED` purely because of this reference-format mismatch, not
   because anything was actually wrong with the reasoning. The field name
   "supporting_quotes" itself plausibly primed the model toward quote text
   over an ID. **Update, Phase 3.1 freeze audit:** this was implemented and
   tested, not left as a candidate — the field is now `supporting_claim_ids`
   everywhere (Specification EP-005), and Task 4's live re-test confirms
   whether the rename alone was sufficient. See the Phase 3.1 section below.

---

## Phase 3.1 — Specification Cleanup & Freeze

Performed after the report above and after a real `ANTHROPIC_API_KEY`
became available; not a redesign, no new Evidence Classes, no Class B
expansion, no new Validator behavior, no prompt optimization beyond the one
rename this audit required.

### Change 1 — `supporting_quotes` renamed `supporting_claim_ids`

Implements Section 9 ambiguity #5 above. Every occurrence renamed: the
Specification's Class C schema (which — separately — was also missing
entirely from `evidence-specification-v1.1.md`'s Section 3; restored in the
same pass, since a schema can't be internally consistent if part of it
isn't written down at all), `evidence-validator/src/types.ts`,
`classC.ts`, every fixture and test referencing the field,
`evidence-runtime/src/systemPrompt.ts` (the live system prompt — now also
states explicitly: *"supporting_claim_ids must contain the proposal_id
values of class_a_proposals entries — never the literal quote text
itself"*), `evidenceGraph.ts`, and every evidence-runtime fixture with a
Class C proposal (001, 008, 010). See `evidence-validator/CHANGELOG.md`,
EP-005, for the formal record.

### Change 2 — Atlas Case 009 audit: `action` vs. `context_fact`

**Conclusion: genuine Specification ambiguity, not an Atlas error — the
Atlas is unchanged.** The Specification (Sections 1-8) never defines
`action` or `context_fact` in prose; both exist only as enum entries plus
worked Atlas examples, and Section 4 already acknowledges claim_type fit
"is not fully mechanical." The only definition-adjacent text anywhere is
EP-001's own gloss on `context_fact` ("real background material... not the
answer's main subject") — itself a narrative-centrality criterion, not
something a validator could ever check mechanically.

Case 009's `context_fact` labels are internally consistent with Case 008's
established precedent: Case 008 types even its confirmed corrective action
("we went back to the old sealant") as `context_fact` rather than `action`
— deliberately, to avoid the Class A/B layer smuggling in causal credit
that Class C is supposed to keep open (see the annotation added to
`evidence-atlas-v0.1.md`'s Case 008). Case 009 has no narrated
problem-solving action at all — both candidate causes are pre-existing
circumstances, not confirmed fixes — making `context_fact` at least as
well-justified as it is in Case 008. Both `action` and `context_fact` are
textually defensible readings from the bare enum alone; per this task's own
instruction, the ambiguity is documented (Specification's new "Phase 3.1
Freeze Audit" section, and a candidate v1.2 prose definition offered there)
rather than resolved by assumption.

### Change 3 — Atlas-wide sweep for the same pattern

Every "I/we + verb" Class A claim across all 10 Atlas cases was checked for
narrative-importance-driven mislabeling. Findings:

- **Cases 001, 002, 004, 005, 006, 007, 010** — every `action` claim is a
  narrated step in direct service of the stated problem (fixture
  modification, log-pulling, automation script, staging environment,
  bearing replacement, etc.); every `context_fact`/`constraint` claim is
  genuine background or an enabling condition, not a solving step.
  No changes needed.
- **Case 008 — closest call, examined in detail, no change needed.** All
  four Class A claims are `context_fact`, including "we went back to the
  old sealant," which is grammatically and functionally the answer's actual
  corrective action. This is not a narrative-importance mistake; it is
  Case 008's entire didactic point executed consistently — the case exists
  to demonstrate that two competing causes must NOT be prematurely
  resolved, and typing the reversion `action` would implicitly credit it as
  "the fix" one layer before Class C is supposed to weigh that question.
  This rationale existed only implicitly before this audit; it is now
  written down explicitly as an annotation on Case 008 in
  `evidence-atlas-v0.1.md`, so a future reader doesn't have to re-derive it
  (or mistake it for an inconsistency, as this task's own preamble
  suspected it might be).
- **Case 007** — "we lost two technicians" stays `context_fact`; this is
  the one case where the speaker explicitly self-marks it as background
  ("But the specific problem I want to talk about is..."), the strongest
  possible grounding for the label. No change.

No Atlas classification was changed by this sweep.

### Regression results

| Suite | Result |
|---|---|
| evidence-validator typecheck + `vitest run` | clean; **65/65 passing**, unchanged from before the rename |
| evidence-runtime typecheck + `vitest run` | clean; **16/16 passing**, unchanged from before the rename |
| Live re-test, Case 009, post-rename (`claude-sonnet-5`, ~26s) | **both Class C hypotheses now validate** into `class_c_non_admissible` — neither rejected. The model used `supporting_claim_ids` with real `proposal_id` values (e.g. `["action_return_policy", "outcome_complaints_dropped"]`), not literal quote text. One unrelated Class B proposal (a "because" bridging attempt between two separate components) was correctly rejected `MARKER_NOT_FOUND` — a pre-existing, unrelated self-contained-vs-bridging nuance, not a rename regression. The causal belief again validated as `self_reported_diagnosis`/`speaker_assertion: true`, never collapsed. |
| observation-engine / opportunity-engine / decision-engine / conversation-engine / comparison-engine / alpha-workbench | untouched by this pass (no source changed); re-run anyway for a complete record — **33/33, 39/39+1 skipped, 15/15, 36/36, 21/21, 22/22**, all passing |

**Net: zero regressions.** The rename fix is confirmed against a second,
independent live call — not just inferred from the code change.

### Remaining ambiguities intentionally left for v1.2

1. **`action` vs. `context_fact` has no prose definition anywhere in the
   Specification.** A candidate definition is drafted in
   `evidence-specification-v1.1.md`'s new "Phase 3.1 Freeze Audit" section
   but deliberately not adopted as binding v1.1 text — v1.1 is being frozen,
   not re-opened for a new rule.
2. **Class B minimum component counts, 3+-component bridging, multiple-
   candidate scope beyond `claim_type: "problem"`, and EP-004's 2-component
   ordering limit** — all pre-existing, already documented in
   `evidence-validator/README.md`; unaffected by this pass, still open for
   v1.2.
3. **Whether `supporting_claim_ids` alone (without the added prompt
   sentence) would have been enough** — untested; this build changed both
   the field name and added an explicit prompt sentence in the same pass,
   so if a future model still gets this wrong, it won't be possible from
   this evidence alone to say whether the name or the missing explicit
   sentence was the more load-bearing fix. Left as a real open question
   rather than a false claim of isolation.

---

## Stop condition

Per Phase 3A's original instruction: no production Listen Engine work —
prompt optimization, retry logic, production architecture, new
coaching/observation logic, or LLM tuning — has been started as part of
this build, and none should follow from this document without a separate,
explicit decision to begin Phase 3B.

Phase 3.1 (above) made exactly one prompt change (the `supporting_quotes` →
`supporting_claim_ids` rename plus one clarifying sentence, both required
by the terminology fix itself, not general optimization), one Specification
documentation restoration (the missing Class C schema block), one
Specification documentation addition (the action/context_fact ambiguity
note, explicitly not adopted as a binding rule), and one Atlas annotation
(Case 008's rationale, made explicit). No Evidence Class was added, no
Class B relationship type was expanded, no Validator admission rule was
loosened or added beyond EP-005's terminology change, and no Atlas
classification was changed. **Evidence Specification v1.1 is, as of this
pass, considered frozen** — the next substantive change to it should be a
deliberate v1.2, not further incremental patching.
