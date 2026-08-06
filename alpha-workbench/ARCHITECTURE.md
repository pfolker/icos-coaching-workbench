# Alpha Workbench — Architecture (Deliverables 1–12)

**Status:** Built and smoke-tested. This document describes the shipped artifact, not a plan.
**Purpose:** the first physical prototype of ICOS — one complete coaching session, every engine executing in sequence, on localhost. It exists to answer one question: does the loop feel like coaching a person would pay for?

---

## 1. Architecture

Three layers, engines untouched:

```
public/index.html          UI (vanilla JS, single page)
        │  fetch JSON                    ← learner sees coaching only;
        ▼                                  engineering panels are <details>
server/server.ts           HTTP layer (node:http, no framework)
        │  function calls
        ▼
server/orchestrator.ts     Session Orchestrator (state machine, event log,
        │                  learner model, compute-then-commit)
        ▼  direct imports, zero adapters (structural typing)
../observation-engine  ../opportunity-engine  ../decision-engine
../conversation-engine ../comparison-engine        [ALL FROZEN]
```

Engines run **server-side** deliberately: (a) matches the production blueprint's server-authoritative orchestrator, (b) observation-engine uses `node:crypto`, so no engine ever needs to know a browser exists — engineering goal #3 satisfied by construction, not discipline.

## 2. Folder Structure

```
alpha-workbench/
├── package.json          # scripts: start, test, typecheck; devDeps: tsx, vitest, typescript
├── tsconfig.json
├── server/
│   ├── orchestrator.ts   # THE session owner: state machine + pipeline composition
│   ├── server.ts         # static file + JSON API, ~100 lines, node:http
│   └── questions.ts      # 3-question bank (config, not code)
├── public/
│   └── index.html        # the whole UI: one file, no build step
├── test/
│   └── orchestrator.test.ts  # full scripted session + state machine + view boundary
├── ARCHITECTURE.md       # this document
└── README.md             # quickstart
```

## 3. Session Orchestrator Design

`orchestrator.ts` owns everything session-shaped and nothing engine-shaped:
- **Composition only:** `observe → generateOpportunities → decide → generateCoachingMove` on answer; `observe(V2) → compareRetry` on retry. It never generates copy, never ranks, never judges — those verbs belong to engines.
- **Compute-then-commit:** the whole pipeline runs on local variables; session state mutates only after full success. A thrown engine error leaves the session exactly where it was (tested: empty transcript → INPUT_INVALID → state unchanged).
- **Within-session learner model:** comparison verdicts feed `learner_model.habits` — an `achieved` marks the habit demonstrated, which flips the Decision Engine's knowledge-check fork from supply (I1) to elicit (I3) later in the SAME session. The fork evolving live is one of the things the Workbench exists to let you feel.
- **Mission carry rule:** the opening question has no mission. After each turn, the coached habit becomes the next question's mission unless the retry achieved it. The summary's Next Mission is the most recent unresolved coached habit, rendered through conversation-engine's `MISSION_FOCUS` lines.
- **Two views from one state:** `publicView` (coaching only — moves are stripped of their verification report, keeping just a `degraded` boolean) and `debugView` (candidates, full reasoning trace with rejections, verification reports, banked flaws, learner model, event log). A test asserts the learner view never contains engineering vocabulary.

## 4. UI Component Tree

One page, sections top to bottom (spec order):
```
SessionPanel        mission line · progress · question
AnswerPanel         transcript textarea · duration timer button · Submit
CoachPanel          Conversation Card (🎯 mission / ✅ recognition / 🔍 insight /
                    💡 why / 🔁 retry ask)
                    ├─ <details> debug: selected opportunity
                    └─ <details> debug: decision reasoning (candidates + rejections)
RetryPanel          retry textarea · Compare · Skip retry
ComparePanel        Comparison Card (verdict + reinforcement)
                    └─ <details> debug: comparison internals (banked flaws etc.)
SummaryPanel        per-question results · Next Mission · New session
DevConsole          <details> event log + learner model (collapsed by default)
```
Panels show/hide purely from `session.state` — the UI holds no logic beyond rendering, engineering goal #4.

Audio note: the ⏺ button is a **duration timer**, not a recorder — speak aloud, stop, paste the transcript. Duration feeds real pacing metrics (filler/minute) without wiring STT into an internal tool. Deepgram integration is a production concern, deliberately out of scope.

## 5. State Machine

```
AWAITING_ANSWER ──answer──▶ COACHED ──retry──▶ COMPARED ──advance──▶ next Q / SUMMARY
      ▲                        │
      │                        └──advance (skip retry; logged as honest signal)──▶
      └───────────── next question ─────────────┘
```
Server-authoritative. Illegal transitions → `STATE_ILLEGAL` (HTTP 409), state untouched. `reinforce_only` turns reject retries with an explanatory error. All transitions tested.

## 6. API Contracts (UI ↔ orchestrator; engines never exposed raw)

```
POST /api/session                        → 201 { session, debug }
GET  /api/session/:id                    → 200 { session, debug }
POST /api/session/:id/answer   {transcript, duration_seconds?} → 200 { session, debug }
POST /api/session/:id/retry    {transcript, duration_seconds?} → 200 { session, debug }
POST /api/session/:id/advance  {}        → 200 { session, debug }
errors → { error: { code, message } }    INPUT_INVALID→400 · STATE_ILLEGAL→409 · NOT_FOUND→404 · else 500
```
`session` is the learner-facing shape; `debug` is the engineering shape. Both returned on every call so the dev console needs no extra round trips.

## 7. Event Flow

Every meaningful step appends to the session's ordered event log (visible in the dev console):
`SESSION_CREATED → OBSERVED → OPPORTUNITIES → DECIDED → COACHED → (RETRY_SKIPPED | COMPARED) → ADVANCED → … → SESSION_SUMMARY`. Each event carries a one-line human detail (counts, selected id + intervention + priority class, verdict + banked count, verification score). This is the workbench-scale version of the Blueprint's `icos_events` — same shape of truth, in-memory.

## 8. Error Handling

- Engines keep their own degradation ladders (a hallucinating generator degrades a card, never crashes a session — inherited, already tested upstream).
- Orchestrator: compute-then-commit (see §3).
- HTTP: shared error taxonomy mapped to status codes; malformed JSON and oversized bodies rejected at the door.
- UI: errors render inline next to the button that caused them; no state is assumed client-side, so recovery is just "act again."

## 9. Logging Strategy

One log, two audiences: the in-memory event log serves both the dev console (product truth: what the coach saw and decided) and the terminal (server prints startup + errors). No persistence by design — a workbench session is disposable. The R1 triple (context, move, retry outcome) is fully reconstructible from `debug` payloads, which is the property that matters for judging the loop.

## 10. Local Development

```
# prerequisite: the six ICOS package folders sit as siblings of alpha-workbench
cd alpha-workbench
npm install          # dev tooling only (tsx, vitest, typescript)
npm start            # → http://localhost:4321
npm test             # scripted full session through the real engines
```
Node 20+. No env vars, no keys, no database, no build step.

## 11. Deployment

**Intentionally: none.** This is an internal engineering tool; localhost is its habitat. If the team ever needs a shared instance: `npx tsx server/server.ts` behind Tailscale or a `fly.io` micro VM works as-is (stateless, in-memory sessions) — but resist it. The success criterion is a founder-run session, not uptime.

## 12. Technology Stack (and why so little of it)

| Layer | Choice | Why |
|---|---|---|
| Runtime | Node 20 + tsx | runs the frozen TS engines directly; no build |
| Server | node:http | ~100 lines; a framework would be the largest dependency in the project |
| UI | one HTML file, vanilla JS | zero build, zero state library; the UI only renders `session.state` |
| Tests | vitest | consistent with all six engine packages |
| Deps | **zero runtime dependencies** | matching the engines' own discipline |

---

## What the Workbench already caught (why prototypes exist)

Building it surfaced and fixed, with regression tests: **five comparison-engine copy templates missing their own signature phrases** (O4/O7/O8 achieved, O10 partial, O11 not_yet — every achieved verdict on three opportunities was silently degrading; a new registry invariant test now checks all 27 templates), and **a learner-view leak** (move verification reports carried engineering vocabulary into the public view; now stripped to a `degraded` boolean, with a view-boundary test).

## Stopping here, per instructions

The success criteria are met: clone → `npm install && npm start` → localhost → complete session → every engine visible in sequence → summary with a carried mission. Not built, on purpose: persistence, auth, STT, multi-session memory, styling, production integration. The next conversation this tool is meant to enable is not an engineering one — it is Patrick running sessions and deciding whether the loop earns a customer.
