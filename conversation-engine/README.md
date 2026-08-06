# @icos/conversation-engine

The FIRST package allowed to produce learner-facing language. Consumes a
CoachingDecision + ObservationSet + transcript; emits a verified CoachingMove.

## Architecture: pluggable generation, mechanical verification

Generation is a `CopyGenerator` (v1: deterministic templates in
`src/generator.ts`; a future LLM generator replaces that ONE file). The
verifier (`src/verify.ts`) is generator-agnostic and is the load-bearing
component: eight mechanical checks gate every card, template or LLM alike.

## Verifier checks (all eight run on every move)
1. quote_grounding: every "..." phrase is a verbatim transcript substring
2. span_integrity: every declared span matches transcript.slice exactly
3. numeric_facts: every number in copy exists in the transcript (or an
   explicit allowed list for metric-derived values)
4. single_point_language: no second-coaching-point connectors (word-boundary
   regex banlist)
5. selected_topic_present: the selected opportunity's unique signature phrase
   appears (signatures live in each retry instruction)
6. rejected_topics_absent: no rejected opportunity's signature appears
7. retry_pattern_match: the retry belongs to the selected opportunity
8. style_no_em_dash: learner-facing copy never contains em/en dashes
   (founder style rule, enforced mechanically)

## Degradation ladder
generate → verify → regenerate once → degraded fallback. The fallback is safe
BY CONSTRUCTION (registry copy only, zero quotes, zero numbers, correct retry
for the selected opportunity) and is itself re-verified. A hallucinating or
crashing generator ships the fallback, never the corruption.

## Copy rules
All learner-facing language lives in `src/registry.ts` as data. Task-level
recognition only (JA-08 gate: when nothing earns a quote, the recognition is
honest and unquoted, never inflated). Intervention branches: I1 supply,
I3 elicit (question form), I7 reframe (belief-blocked habits only),
I10 protect (softened ask). Mission line appears ONLY when the decision
reports aligned_selected.

## Tests (34)
Malicious-generator suite (hallucinated quotes, invented numbers, second
points, rejected-topic leaks, wrong retries, em dashes, crashing generators);
per-branch behavior; retry table across all nine opportunities; JA-08 gate;
reinforce_only; determinism; and the four-package integration
(`test/pipeline.test.ts`) proving transcript → observation-engine →
opportunity-engine → decision-engine → conversation-engine with zero adapters.
