# ICOS Alpha Workbench

Internal engineering tool. One page, one complete coaching session, every
frozen ICOS engine executing in sequence. Not a product.

## Run it

Keep this folder as a sibling of the six ICOS packages
(observation-engine, opportunity-engine, decision-engine,
conversation-engine, comparison-engine, pipeline-integration), then:

```
cd alpha-workbench
npm install
npm start        # → http://localhost:4321
```

Answer the question (paste a transcript; the ⏺ timer captures your spoken
duration for pacing metrics), read the coaching card, retry, compare, advance.
Expand the debug panels to watch the Decision Engine reject candidates and the
Comparison Engine bank flaws the learner never sees.

`npm test` runs a scripted full session through the real engines.

See ARCHITECTURE.md for the full design (state machine, API contracts,
event flow, and what building this tool caught in the frozen engines).
