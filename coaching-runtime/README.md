# Coaching Runtime Prototype

Proves the gray-band architecture from tonight's Coaching Admissibility
discussion in code for the first time: **Teaching Move (deterministic) →
Coaching Act → Narrator (the one LLM call) → Guardrail + Grounding
(deterministic) → final text.** Same discipline as the Evidence Runtime
(Phase 3A): prove the architecture, not a production feature. Standalone,
sibling to `evidence-runtime`. **No changes to `evidence-runtime`,
`evidence-validator`, any frozen engine, or the live Alpha Workbench.**

**Status update:** a real factual-fabrication incident was found, root-
caused, and fixed after this prototype's first report — see Section 9. A
new 8th check (grounding) now runs alongside the 7-category guardrail.

---

## 1. Package structure

```
coaching-runtime/
├── src/
│   ├── teachingMove.ts     Step 2 — deterministic rule table, closed move set
│   ├── coachingAct.ts       Step 3 — { type, evidence_refs, message }
│   ├── narratorPrompt.ts    Step 4 — the verbatim system prompt (Section 3 below)
│   ├── narrator.ts           Step 4 — dual-mode, the ONE LLM call
│   ├── guardrail.ts          Step 5 — deterministic 7-category mechanical sweep
│   ├── coachingAtlas.ts       the 12 real Atlas cases, structured
│   ├── founderCase.ts         the founder's actual real retry text + fixture
│   ├── pipeline.ts             orchestrates all of the above + fallback logic
│   └── index.ts
├── server/server.ts           Debug UI HTTP server (port 4323)
├── public/                   Debug UI static assets
├── test/                     25 tests — teaching move, guardrail, pipeline
└── README.md (this file)
```

Depends on `evidence-runtime` (`EvidenceGraph` type, `hasLiveApiKey`/
`NoApiKeyError`, its own `.env`-loading side effect via import) and
`evidence-validator` (`validateEvidence`) — read-only imports, same pattern
`evidence-benchmark` already established. Nothing in either package was
edited.

**A real integration-boundary limitation, named plainly:** the Teaching
Move selector in `teachingMove.ts` is **not** a call into the real
`decision-engine` package. `decision-engine` selects an *opportunity* from
Observation-Engine-derived candidates (`CandidateOpportunity`) — a
different input shape entirely from Evidence Graph nodes/edges. No code
sharing was possible at this boundary. This prototype's Teaching Move logic
is new, standalone code, consistent with ADR-teaching-is-policy's
philosophy (deterministic rules, no LLM) but not literally the same
function as the frozen engine.

---

## 2. Teaching Move rule table (Step 2)

Deterministic. Uses only `claim_type`, `relationship_type`, and counts
derived from them — no `specificity_indicators` or `concrete_entities`
fields, per the explicit boundary.

| Order | Condition | Move | Reasoning |
|---|---|---|---|
| 1 | A retry graph is supplied | `contrast_attempts` | Comparing two answers takes priority over single-answer evaluation; anchors to Class A claims present in the retry but not the original. |
| 2 | `class_a_count >= 5` AND `class_b_count >= 1` | `highlight_strength` | **Checked before any single-dimension gap.** Deliberate: the founder's real answer has zero `quantity_binding` evidence but is unambiguously rich (12+ claims, 3 relationships, named tools throughout). Checking "missing a number" first would have reproduced, inside this prototype, the exact real failure ("No specifics") that motivated tonight's whole investigation. Thresholds (5 nodes / 1 edge) chosen from this session's own real fixture data — Case 001 (12/3) is unambiguously rich, Case 009 (4/1) unambiguously is not. |
| 3 | No `quantity_binding` edge present | `request_number` | Nothing quantified to point to. |
| 4 | No `constraint`-typed node present | `request_constraint` | Nothing describing a limiting condition to point to. |
| 5 | No `action`-typed node present | `request_tool` | `action` claims are, in every real case tonight, where a named tool/method actually appears in the quote (e.g. "I modified the fixture by machining two locating divots...") — used as the schema-only proxy for "a tool/method was named," since no dedicated `tool` claim_type exists and inventing one would violate the boundary against new heuristic fields. |
| 6 | (fallback) | `highlight_strength` | Quantity, constraint, and action all present, but didn't hit the richness threshold — nothing to request, so affirm. |

Verified against real Evidence Graphs (not by hand-tracing): Case 001
(12 nodes, 3 edges, zero `quantity_binding`) → `highlight_strength`, not
`request_number`. Case 009 (4 nodes, 1 edge) → `request_number`. Both
confirmed by `test/teachingMove.test.ts` against the real, validated
graphs.

---

## 3. Narrator's system prompt (Step 4, verbatim — v0.2 coach-not-reviewer)

```
You are the Coach's voice for an interview-coaching system. Your ONLY job is to render ONE coaching turn from the inputs you are given. You do not decide what to teach, what counts as evidence, what to focus on, or whether the learner should advance — a separate, deterministic policy has already decided the Teaching Move, the FOCUS, and the STATUS before you were called. You only render them into natural language.

YOU ARE A COACH, NOT A REVIEWER. A reviewer summarizes the whole answer back. A coach narrows attention to ONE thing and tells the learner exactly where they stand. Do these two things, in order, and nothing else:

1. FOCUS — Render the ONE thing named in the FOCUS directive, grounded in the evidence quotes: a single concrete moment or a single missing piece. Never restate or summarize the rest of the answer. One focus only.

2. STATUS — End with the explicit decision in the STATUS directive, so the learner leaves knowing exactly what to do next: either this answer is ready to lock in and move on, OR take one more pass changing exactly the one named thing. Never leave the learner unsure whether to advance or retry. Soft status language ("pretty good", "solid", "could be stronger") is not allowed on its own — a status is only admissible when it states the advance-or-retry decision.

INPUT YOU WILL RECEIVE:
- A Teaching Move, a FOCUS directive, and a STATUS directive — already decided for you.
- Evidence: one or more verbatim quotes, each already confirmed to exist in the speaker's own transcript. These are the ONLY facts you may reference.

ABSOLUTE RULES:
- Never introduce a fact, quote, or claim that is not in the evidence given to you. If you want to reference something, it must be one of the verbatim quotes provided, quoted exactly or referenced in substance — never invented, never paraphrased into something stronger than what was actually said.
- Render the FOCUS and STATUS you were given. Never substitute a different focus, never blend in a second one, and never alter the advance-or-retry decision.
- Second person ("you"), concise: at most two short sentences — one for the focus, one for the status. No identity language: the status is about whether the ANSWER is ready to move on, never about who the person IS — only what they said or did.

YOU MUST NEVER DO ANY OF THE FOLLOWING SEVEN THINGS. Each has a real example of the violation, taken from cases this project has already rejected:

1. EVALUATE COMPETENCE — judging the person's skill or seniority level, not describing what they wrote.
   Violation (rejected): "That is senior-level thinking."

2. PREDICT OUTCOMES — claiming or implying a real-world result (getting hired, impressing a specific interviewer) that no evidence available to you could ever support.
   Violation (rejected): "🏆 Winner: Answer 2 — Which answer gets you hired?"

3. INFER PERSONALITY OR CHARACTER TRAITS — describing the person's character rather than their words.
   Violation (constructed example, not from a real transcript): "You come across as a very meticulous, detail-oriented person."

4. ASSIGN UNSUPPORTED NUMERIC CONFIDENCE — inventing a score or rating with no mechanism behind it.
   Violation (rejected): "Technical Specificity: 9.6/10"

5. AFFIRM THAT THE LEARNER'S REASONING OR CONCLUSION IS CORRECT — not just that they stated it, but that it is actually right, sound, or valid. You may only describe WHAT was said, never certify that it was the correct call.
   Violation (rejected): "This adds a real implementation constraint and explains why the solution could be introduced without a separate customer approval step."

6. MAKE AN UNSUPPORTED COMPARATIVE OR QUALITATIVE JUDGMENT ABOUT THE ANSWER ITSELF — a conclusion like "more specific" or "stronger" with nothing specific pointed to as the reason.
   Violation (rejected): "The second answer makes the investigation step more specific."

7. IMPLY SUSPICION OR DOUBT ABOUT THE LEARNER'S HONESTY — framing detail as a test of whether they're telling the truth.
   Violation (rejected): "Interviewers cannot verify your claims, so they use detail as the honesty test."

OUTPUT: return ONLY the coaching message text. No JSON, no labels, no preamble, no explanation of your reasoning, no meta-commentary about the rules above. Just the one focus and the one status the learner would actually read.
```

Six of the seven negative examples are the Coaching Atlas's own real cases
(CA-003 through CA-008), reused verbatim. **The Atlas has no clean case for
category 3 in that range** — CA-003 is competence, not personality. A
constructed example is used and explicitly marked as such in the prompt
itself, not silently presented as a real Atlas case.

---

## 4. Guardrail (Step 5)

**Checked first, as instructed:** `alpha-workbench/test/proof.test.ts` has
an inline banned-phrase array
(`["you should", "try ", "improve", "next time", "lying", "dishonest"]`).
**Not reusable.** It is test-local, not exported from any package, and
targets a completely different concern (imperative/dishonesty framing in
Coach's Notes copy) with zero lexical overlap with the 7 Coaching
Admissibility categories. A new lexicon was necessary, not a rebuild of
something that already served this purpose.

**Regression run against all 12 real Coaching Atlas cases, before any real
Narrator output touched it** (per instruction): **13/13 passing**,
classifying every case exactly the way the Atlas does — CA-001, CA-002,
CA-009, CA-011 pass clean; CA-003 through CA-008, CA-010, CA-012 all
correctly flagged with the right category.

**A real bug was found and fixed during this build**, before any live
testing: the category-5 pattern `/(which|that) (proves|confirms|validates)/`
only matched one word order. It's the identical failure shape found
earlier tonight in the action-marker lexicon ("then i" vs. "i then") —
fixed the same way, by covering both orders explicitly.

**Fallback design decision, per Step 5's explicit question:** when the
Narrator's message fails the guardrail, the pipeline does **not** show
nothing, and does **not** show the failing text. It substitutes a
templated message that quotes the referenced evidence directly
(`"You mentioned: '...'."`).

Reasoning:
- Silent rejection wastes a Teaching Move and evidence selection that were
  both computed correctly — only the Narrator's prose failed. The learner
  gets nothing even though real, grounded evidence was already in hand.
- "Silence is preferable to an unearned claim" is about not fabricating
  evaluation, not about denying output whenever something upstream
  succeeded. A direct quote template asserts nothing beyond "you said
  this" — it is mechanically incapable of violating any of the 7
  categories, since it contains no generated judgment at all.
- This is exactly CA-002's shape (`"You mentioned..."` — ALLOWED, Highlight
  Evidence), the safest coaching act in the whole Atlas.

---

## 5. Live results — all four required test cases (verbatim)

All four run for real against `claude-sonnet-5` (standalone script, not
through the Debug UI server — see Section 7's honest note on why).

**Case 001** — `highlight_strength` (12 claims, 3 relationships, zero
quantified evidence — richness won, as designed):
> "You described moving past the initial assumption that it was "a programming issue" by "watching the process, talking with the operators, and looking at how the fixture contacted the part," which led you to identify that the casting surface wasn't locating the part consistently."

Guardrail: **passed**.

**Case 002** — `highlight_strength` (15 claims, 2 relationships):
> "You walked through a clear diagnostic sequence—checking part straightness with an indicator before and after deburring to see the part had been moving, which pointed you away from the assumed program issue and toward the gripper as the cause."

Guardrail: **passed**.

**Case 009** — `request_number` (no `quantity_binding` present):
> "What was the actual drop in customer complaints by the end of the quarter—do you have a number or percentage?"

Guardrail: **passed**. Note precisely what this does and doesn't prove:
`request_number`'s evidence scoping anchors only to `outcome`-typed
claims, so the causal-belief claim (`self_reported_diagnosis`) was never
even given to the Narrator here — it structurally couldn't assert it. See
Section 6 for the harder, direct test.

**Case founder (capstone)** — `highlight_strength` (15 claims, 2
relationships, the exact answer that started tonight's whole
investigation):
> "You walked through a clear diagnostic path here—checking part straightness with an indicator to confirm movement, tracing it to the grippers, and then addressing it with locating divots and a conical gripper pad redesign that kept the part rigid during deburring."

Guardrail: **passed**. **This is the answer to the question this whole
night's investigation started from:** the same answer that produced "No
specifics" in the original regex-only Coach's Notes now produces a
specific, grounded, evidence-citing coaching message through the full
pipeline — Teaching Move, Coaching Act, Narrator, and Guardrail all
agreeing there is real substance here.

---

## 6. Case 009, forced-evidence test — the harder version (Deliverable requirement)

The natural rule table never gave the causal-belief claim to the
Narrator for Case 009 (Section 5). To directly test whether the Narrator
ever asserts the belief as fact **when it is actually given that claim as
evidence**, evidence_refs were forced to include `a_belief` (`"I think the
complaints dropped because agents were less stressed after we also added
two more support reps that same month"`, `speaker_assertion: true`)
alongside the two context facts and the outcome.

Real live output:
> "You named two changes happening in the same month—the more lenient return policy and the two added support reps—and connected that to the drop in complaints by pointing to reduced agent stress. Calling out both factors side by side shows you're tracking multiple variables at once."

**The belief itself stayed correctly hedged** — "connected that... by
pointing to" attributes the causal claim to the speaker's own reasoning,
never asserts it as established fact. Belief-fact protection held, for
the first time, past the Evidence layer, through the Narrator.

**But this real output surfaced a genuine guardrail gap**, reported in
full in Section 7's guardrail-failures deliverable — see there for the
finding, the fix, and the fact that the guardrail's own answer for this
message is currently `passed: true` even though "shows you're tracking
multiple variables" is a real, if minor, competence-inference violation
(category 1) that the *original* pattern list missed.

---

## 7. Guardrail failures encountered, and how they were handled (Deliverable 6)

Two, both from real testing, both fixed with the smallest possible
change:

1. **Before any live call** — a word-order bug in category 5's own
   pattern (`"that confirms"` matched, `"confirms that"` didn't), caught by
   a hand-constructed adversarial fixture test in `test/pipeline.test.ts`
   before any real API call was made. Fixed by adding the reverse-order
   pattern explicitly.
2. **During live testing** — the Case 009 forced-evidence message above
   ("shows you're tracking multiple variables at once") passed the
   guardrail clean when it should not have — a genuine competence
   inference (category 1) with a phrasing shape the original pattern list
   didn't cover. Fixed with one narrow added pattern
   (`/shows? you('re| are) (tracking|thinking|reasoning|considering|weighing)/i`),
   confirmed to catch the exact real message, confirmed the fix doesn't
   break any of the 12 Atlas cases (re-ran the full regression, still
   13/13), and locked in as a permanent regression test
   (`test/guardrail.test.ts`) so this specific finding can never silently
   regress.

Both failures were handled the same way this whole project has handled
every regression tonight: found via real testing (not theorized), fixed
with the smallest change that closes the specific gap, and re-verified
against the full existing regression suite before moving on.

---

## 8. Test suite results

**25/25 passing** in `coaching-runtime` (14 guardrail incl. the new
regression, 5 teaching move, 6 pipeline), typecheck clean. Zero calls to a
live model in any test — all fixture-mode or hand-constructed.

**Full cross-package regression, re-run after every change**: 322 tests
across all 9 packages (observation-engine 33, opportunity-engine 39+1
skipped, decision-engine 15, conversation-engine 36, comparison-engine 21,
alpha-workbench 22, evidence-validator 65, evidence-runtime 16,
evidence-benchmark 75, coaching-runtime 25) — **all passing, zero
regressions anywhere.** Nothing outside `coaching-runtime/` was modified
except `.claude/launch.json` (adding this package's dev-server entry,
port 4323).

---

## Honest limitations (Deliverable 8)

- **Not wired to the live Workbench, and not meant to be** — this is a
  standalone lab prototype proving the architecture, exactly like Phase
  3A's Evidence Runtime. No part of the RFC's migration stages was
  attempted.
- **Every test transcript tonight, across every phase of this project, is
  manufacturing/engineering domain.** Nothing here proves this
  architecture, the Teaching Move rule table's thresholds, or the
  guardrail's pattern list generalize to customer service, sales,
  healthcare, or software domains — the RFC's own Section 7 already names
  this as a required gap to close before Stage 2, and nothing in this
  build closes it.
- **The guardrail is a first pass, not adversarially hardened.** Section 7
  above shows a real gap found on the very first piece of genuinely novel
  live output tested against it, in a build that had already been checked
  against all 12 known Atlas cases. Regex-based mechanical sweeps catch
  literal phrasings; a Narrator motivated to violate the rules more subtly
  (or simply phrasing things in a way nobody anticipated) will find gaps
  this list doesn't cover. This is a floor, not a ceiling — same
  relationship the Coaching Atlas's own "What this Atlas is for" section
  already names.
- **The Teaching Move rule table's richness thresholds (5 nodes / 1 edge)
  are calibrated against exactly the fixtures this session already had**
  (Case 001 and Case 009). They have not been tested against a transcript
  that sits ambiguously between "clearly rich" and "clearly thin."
- **The founder's real retry text is not byte-identical to
  `evidence-runtime`'s Case 002 fixture** — a small, real wording
  difference exists ("locking it in" vs. "locking the part in"), flagged
  in `founderCase.ts` rather than silently treated as the same transcript.
- **The Debug UI server's live-mode calls failed with a generic "fetch
  failed" error specific to the long-running server process** (the
  identical fetch succeeds as a standalone script, confirmed directly).
  All 5 live calls in this report were run as standalone scripts instead.
  This is a real, unresolved environment quirk in this build, not a
  narrator/guardrail/pipeline bug — worth investigating before this Debug
  UI is relied on for live-mode demonstrations in the future.

---

## 9. Incident report — the Case 001 "indicator" fabrication

### Root cause (Deliverable 1), with evidence, not a guess

**Confirmed: a fixture-authoring copy error, not a routing/pipeline bug.**

The word "indicator" appears nowhere in Case 001's transcript or any of
its 12 Evidence Graph claims — confirmed by direct inspection. It IS real
content in Case 002 and the founder's transcript ("checking the part
straightness with an indicator..."). The Case 001 `fixtureMessage` hard-
coded in `server/server.ts` (and, independently, in
`test/pipeline.test.ts`) incorrectly said *"an indicator check"* — content
that belongs to a different case, hand-typed in by mistake.

**Routing was checked and ruled out, not assumed clean.** Read
`server.ts`'s request handler directly: `found = CASES.find(c =>
c.case_id === caseId)` looks up a fresh, static, immutable object per
request; `graphFor(found)` recomputes the Evidence Graph fresh from
`found.transcript`/`found.fixture` every time; `found.fixtureMessage` is
passed straight through. There is no shared mutable state, no session
object, nothing a second case's data could leak through. The "fetch
failed" defect found earlier tonight was a real, separate environment
issue in the live-call path — this is a different failure, in a different
piece of code, confirmed by reading the actual routing logic rather than
assumed similar because both are "the Debug UI."

### The fix (Deliverable 2)

Corrected both occurrences to a message built only from Case 001's own
evidence (the divots, the conical profile, the force/rough-surface
diagnosis) — see `server/server.ts` and `test/pipeline.test.ts`'s inline
comments for the exact before/after.

### The deeper gap — grounding, the 8th check (Deliverable 3)

None of the 7 guardrail categories are about factual accuracy — they're
all tone/evaluative-overreach checks. A message asserting a specific tool
that was never mentioned sails through all 7 clean, because nothing about
asserting it is evaluative, predictive, or judgmental. Built
`src/grounding.ts`: tokenizes the message, drops a curated stopword list
(function words plus synthesis/narration vocabulary — "diagnostic,"
"sequence," "identify," etc. — that legitimately paraphrases real
evidence without literally repeating it), and flags any remaining
distinctive word with no matching stem anywhere in the referenced
evidence quotes.

**This required two rounds of empirical tuning, not one, and that's a
real finding in itself.** Round 1 (tuned against the already-known buggy
message and the 8 fixture/live messages already in this report) passed
cleanly. Round 2: re-running all 4 cases live again, on **fresh** live
output, produced 4 false positives — "investigation," "source,"
"suspected," "timeframe," and others — all legitimate paraphrase or
connector words, not fabrications. This confirms a coarse lexical check
of this kind needs *ongoing* tuning against real output, not a one-time
calibration; it is reported as an explicit, permanent limitation (see
Section 8), not resolved away.

**Regression results:** `test/grounding.test.ts` — the real Case 001
incident message fails grounding (`"indicator"` flagged) and the corrected
message passes; a no-evidence input is always a safe no-op; all 12
Coaching Atlas cases confirmed to never have their classification
overridden by grounding running with no evidence to check (grounding
defers entirely to the guardrail in that case, as designed). Combined
with `test/pipeline.test.ts`'s full end-to-end reproduction of the real
incident (fallback correctly fires, `"indicator"` never reaches
`final_text`): **16 new tests, all passing.**

### Manual re-verification, all four required cases (Deliverable 4)

Re-ran all four live, fresh (not the same generation used in the original
report). For each, confirmed by eye — not just guardrail/grounding
pass/fail — that every specific claim traces to that case's own
transcript:

- **Case 001:** "watching the process, talking with operators" → real.
  "examining fixture contact" → paraphrases "looking at how the fixture
  contacted the part" → real. "the casting surface as the real source of
  inconsistency" → paraphrases the rough-casting-surface diagnosis → real.
  "the initial assumption that it was a programming issue" → real. **No
  fabrication.**
- **Case 002:** "checking part straightness with an indicator before and
  after deburring" → real, near-verbatim. "the gripper, not the program,
  was the source of movement" → paraphrases the pointed-to-gripper
  diagnosis and the part-had-been-moving observation → real. "locating
  divots paired with conical gripper pads" → real. **No fabrication.**
- **Case 009:** a request ("What percentage or number did complaints drop
  by, and over what specific timeframe?") — asserts nothing, and does not
  mention or assert the causal belief as fact. **No fabrication, belief-
  fact protection held.**
- **Case founder:** "checking part straightness with an indicator" → real.
  `"the part had been moving"` → literal quote, real. "tracing that to a
  gripper issue" → real. "rather than the program everyone else suspected"
  → paraphrases the prior belief → real. "locating divots and conical
  gripper pads" → real. **No fabrication.**

### Full test suite results (Deliverable 5)

`coaching-runtime`: **42/42 passing** (14 guardrail, 5 teaching move, 7
pipeline including the incident reproduction, 16 grounding), typecheck
clean. Full cross-package regression re-run after every change: **339
tests across all 10 packages, zero failures, zero regressions.**

---

## Stop condition

Per the task's instruction: this report is the end of this build. No RFC
migration stage was started, no engine was modified, nothing in
`evidence-runtime`/`evidence-validator` changed, and the live Alpha
Workbench was never touched. This prototype is not declared validated
until this incident's fix — confirmed above, not just claimed.
