# ICOS Evidence Validator

Standalone, deterministic implementation of **Evidence Specification
v1.1**, regression-tested against **Evidence Atlas v0.1** (Cases 001-010).
See `CHANGELOG.md` for the v1.0 → v1.1 migration (Evidence Precedents
EP-001–EP-005) and `DAY-ZERO-FINDINGS.md` for what shaped v1.0 itself.

**No integration with any other ICOS package.** Does not import from, or
get imported by, the Observation/Opportunity/Decision/Intervention/
Conversation/Comparison engines or the Alpha Workbench. No LLM calls, no
confidence floats, no coaching output, no learner-facing copy. A future
Listen Engine (or, in this build, test fixtures) proposes claims; this
package validates them. The proposing system never assigns its own class.

## Package structure

```
evidence-validator/
├── src/
│   ├── types.ts        schemas, enums, output contract, reason codes
│   ├── lexicons.ts      small word lists (mismatch-detection only; Class B fixed marker lists)
│   ├── classA.ts        Class A validation (quote/span/enum + bounded structural check)
│   ├── classB.ts        Class B validation (five relationship-type mechanical rules)
│   ├── classC.ts         Class C validation (structural only — never scores reasoning)
│   ├── validator.ts     orchestrator: validateEvidence(), multi-candidate handling
│   └── index.ts          public exports
├── test/
│   ├── fixtures/         one file per Atlas case (001-010), transcript + proposals
│   ├── atlas/             one test file per Atlas case, asserting the required behavior
│   ├── reason-codes.test.ts   synthetic coverage for every code an Atlas fixture doesn't exercise
│   ├── determinism.test.ts    the required determinism proof
│   └── helpers.ts
├── CHANGELOG.md
├── DAY-ZERO-FINDINGS.md
└── README.md (this file)
```

## Usage

```ts
import { validateEvidence } from "./src/index";

const output = validateEvidence({
  transcript: "...",
  class_a_proposals: [...],
  class_b_proposals: [...],
  class_c_proposals: [...],
});
// output: { validated_class_a, validated_class_b, class_c_non_admissible,
//           rejected, requires_review, selection_required, specification_gaps }
```

## Places the Specification could not be implemented mechanically as written

1. **Class A rule 4 ("claim adds no content beyond the quote").** The
   Specification itself acknowledges this carries residual judgment
   (Section 4: "deciding which claim_type label best fits... is not fully
   mechanical"). This build implements only a narrow, symmetric mismatch
   check between claim_types with genuinely disjoint lexical signal
   (cognition/belief-reporting vs. first-person action verbs) — enough to
   catch obvious mismatches and flag genuine mixed-signal cases as
   `requires_review`, never enough to positively confirm any claim_type.
   Attempting a `problem`-vs-`outcome` polarity lexicon, for instance, was
   deliberately not built: the same words ("dropped," "improved") indicate
   a problem or an outcome depending on what changed, not the word itself.
   Unaffected by v1.1 — `decision` and `context_fact` were not added to
   this check either, for the same reason.
2. **Class B minimum component counts per relationship type** are still
   not specified numerically (Specification Section 8, item 7, carried
   forward unresolved in v1.1). This build's per-type minimums remain
   implementation choices, not ratified specification:
   `temporal_sequence`/`enumeration` require 2+; `explicit_connective`/
   `contrast_marker` accept either 1 (self-contained — the marker and both
   linked ideas inside one Class A quote) or 2 (bridging two separate
   Class A claims); `quantity_binding` requires 1+.
3. **`explicit_connective`/`contrast_marker` do not support 3+ component
   bridging.** Atlas Case 002's B5 ("A13/A14 jointly pointed to A15") is a
   genuine 3-component relationship in the Atlas's own prose; this
   Validator represents it as a self-contained 1-component relationship on
   A15 alone instead (see `test/fixtures/case002.ts`), which correctly
   confirms the marker's mechanical presence but does not capture the
   fuller multi-antecedent semantic. Extending to N-component bridging was
   not attempted — the 2-component "gap between two spans" rule doesn't
   generalize obviously to N spans without picking an ordering convention
   the Specification doesn't yet define.
4. **Multiple-candidate scope** (Specification Section 8, item 8, carried
   forward unresolved in v1.1). This build scopes the mechanism to
   `claim_type: "problem"` only — a transcript naturally contains many
   actions and outcomes, so applying this to every type would misfire on
   nearly every normal, multi-claim Atlas case. Implementation decision,
   not a Specification rule; see `validator.ts`, `MULTI_CANDIDATE_CLAIM_TYPES`.
5. **EP-004's connector-governed ordering is defined only for exactly two
   components.** A 3+-component `temporal_sequence` where raw position
   fails falls straight to `ORDER_INVALID` — this build does not attempt
   to generalize connector-governed ordering to longer chains.

## Reason codes added beyond the seed list

- **`ENUMERATION_INVALID`** — the seed list's `MARKER_NOT_FOUND` /
  `ORDER_INVALID` didn't cleanly cover enumeration's two distinct failure
  modes (components not all the same claim_type; a different-type claim
  sitting between them), so a dedicated code was added.

Two seed-list codes (`MULTIPLE_CANDIDATES_UNRESOLVED`, `SPECIFICATION_GAP`)
are declared for schema completeness but are not currently emitted as
`rejected` reason codes by any path in this build — see the comments on
each in `types.ts` for why, and what they're reserved for.

## Resolved history

Five Atlas/Specification frictions — `context_fact`'s missing enum entry,
"finding"/"decision" informal Atlas labels, Case 001's B2 and Case 002's B5
using marker phrases absent from v1.0's fixed lists, Case 008's
`temporal_sequence` direction contradicting raw-position-only ordering, and
(found later, via a real live model call in the Evidence Runtime Prototype)
Class C's `supporting_quotes` field inviting literal quote text instead of
the `proposal_id` reference it always meant — were formally resolved as
Evidence Precedents EP-001 through EP-005. See `CHANGELOG.md` for the full
detail and what each fixture now demonstrates.

## Determinism

Every Atlas fixture (all 10 cases, plus Case 007's multiple-candidate
variant) is run twice independently and asserted byte-identical, plus a
three-pass interleaved run guarding against hidden shared mutable state.
See `test/determinism.test.ts`. Output arrays are always built by
iterating the caller's input arrays in order — never from `Map`/`Set`
iteration — so this is a property of the code, not an incidental pass.
