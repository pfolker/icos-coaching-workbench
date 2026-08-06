/**
 * Alpha Workbench — Session Orchestrator
 *
 * Owns session flow. Composes the five FROZEN engines with zero adapter code
 * (structural typing across every seam). Engines never know a UI exists;
 * this file never generates copy, never selects opportunities, never judges.
 *
 * State machine:
 *   AWAITING_ANSWER --answer--> COACHED --retry--> COMPARED --advance--+
 *         ^                        |                                   |
 *         |                        +-------advance (skip retry)--------+
 *         +---- next question ----------------------------------------+
 *                                   (after last question) SESSION_SUMMARY
 *
 * Error handling: compute-then-commit. The pipeline runs fully; only on
 * success does session state mutate. A thrown engine error leaves the session
 * exactly where it was and is appended to the event log.
 *
 * Shadow-mode Evidence Runtime integration (Project A Milestone 1, see
 * shadowMode.ts): fire-and-forget only, after the real response is fully
 * built. It never touches rendered output — see submitAnswer()'s call site.
 */
import { observe } from "../../observation-engine/src/index";
import { generateOpportunities } from "../../opportunity-engine/src/index";
import { decide } from "../../decision-engine/src/index";
import { generateCoachingMove, MISSION_FOCUS } from "../../conversation-engine/src/index";
import { compareRetry } from "../../comparison-engine/src/index";
import { QUESTIONS, WorkbenchQuestion } from "./questions";
import { buildProof, ProofPayload, quickScan, QuickScan } from "./proof";
import { runShadowPass } from "./shadowMode";

export type SessionState = "AWAITING_ANSWER" | "COACHED" | "COMPARED" | "SESSION_SUMMARY";

export interface WorkbenchEvent {
  seq: number;
  ts: string;
  type: string;
  detail: string;
}

interface Turn {
  question: WorkbenchQuestion;
  mission: { habit_id: string } | null;
  observations?: ReturnType<typeof observe>;
  candidates?: ReturnType<typeof generateOpportunities>;
  decision?: ReturnType<typeof decide>;
  move?: ReturnType<typeof generateCoachingMove>;
  retry_observations?: ReturnType<typeof observe>;
  comparison?: ReturnType<typeof compareRetry>;
  transcript?: string;
  retry_transcript?: string;
  proof?: ProofPayload;
  quick_scan?: QuickScan;
  picked_version?: "v1" | "v2";
  claim?: string;
  locked?: boolean;
  iteration: number;
}

export interface Session {
  id: string;
  state: SessionState;
  question_index: number;
  turns: Turn[];
  learner_model: { habits: Record<string, { demonstrated: boolean; coached_count: number; verdicts: ("achieved" | "partial" | "not_yet")[] }> };
  lines: { question: string; line: string; claim: string | null }[];
  events: WorkbenchEvent[];
}

const sessions = new Map<string, Session>();
let seq = 0;

const log = (s: Session, type: string, detail: string) => {
  s.events.push({ seq: ++seq, ts: new Date().toISOString(), type, detail });
};

const err = (code: string, msg: string, status: number) =>
  Object.assign(new Error(msg), { code, status });

export function createSession(): Session {
  const id = Math.random().toString(36).slice(2, 10);
  const s: Session = {
    id,
    state: "AWAITING_ANSWER",
    question_index: 0,
    turns: [{ question: QUESTIONS[0]!, mission: null, iteration: 1 }],
    learner_model: { habits: {} },
    lines: [],
    events: [],
  };
  sessions.set(id, s);
  log(s, "SESSION_CREATED", `question 1 of ${QUESTIONS.length}; no mission on the opening question`);
  return s;
}

export const getSession = (id: string): Session => {
  const s = sessions.get(id);
  if (!s) throw err("NOT_FOUND", "unknown session", 404);
  return s;
};

const currentTurn = (s: Session): Turn => s.turns[s.turns.length - 1]!;

export function submitAnswer(id: string, transcript: string, duration_seconds?: number) {
  const s = getSession(id);
  if (s.state !== "AWAITING_ANSWER") throw err("STATE_ILLEGAL", `cannot answer in state ${s.state}`, 409);
  const turn = currentTurn(s);

  // ---- compute (no state mutation until everything succeeds) ----
  const observations = observe({ transcript, duration_seconds });
  const opportunityContext = {
    question_type: turn.question.type,
    ...(turn.mission ? { mission_habit_id: turn.mission.habit_id } : {}),
  };
  const candidates = generateOpportunities({ observation_set: observations, context: opportunityContext });
  const decision = decide({
    candidates,
    coaching_state: "flowing",
    mission: turn.mission,
    learner_model: s.learner_model,
  });
  const move = generateCoachingMove({
    decision, observation_set: observations, transcript,
    coaching_state: "flowing", mission: turn.mission,
  });

  // ---- commit ----
  Object.assign(turn, { observations, candidates, decision, move, transcript });
  turn.quick_scan = quickScan(observations, candidates.map((c) => c.opportunity_id), candidates);
  s.state = "COACHED";
  log(s, "OBSERVED", `${observations.observations.length} observation(s), ${observations.metrics.word_count} words`);
  log(s, "OPPORTUNITIES", `${candidates.length} candidate(s): ${candidates.map((c) => c.opportunity_id).join(", ") || "none"}`);
  log(s, "DECIDED", decision.decision_type === "coach_one"
    ? `${decision.selected!.opportunity.opportunity_id} via ${decision.selected!.intervention_type} (${decision.reasoning.priority_class_applied}); ${decision.reasoning.rejected.length} rejected`
    : "reinforce_only");
  log(s, "COACHED", `verification ${move.verification.passed ? "passed" : "FAILED"} (${move.verification.checks.filter((c) => c.passed).length}/${move.verification.checks.length})${move.verification.degraded ? " DEGRADED" : ""}`);

  const result = { session: publicView(s), debug: debugView(s) };

  // ---- shadow-mode Evidence Runtime integration (Project A Milestone 1) ----
  // Fire-and-forget, AFTER `result` above is already fully built. Never
  // awaited: the real response returns immediately regardless of how long
  // the shadow pass's live Listen Engine call takes, or whether it fails.
  // runShadowPass() never mutates `s`/`turn` (it doesn't receive them) and
  // never throws past its own boundary — see shadowMode.ts.
  runShadowPass(`${s.id}_${turn.question.id}`, transcript, opportunityContext).catch(() => {});

  return result;
}

export function submitRetry(id: string, retry_transcript: string, duration_seconds?: number) {
  const s = getSession(id);
  if (s.state !== "COACHED") throw err("STATE_ILLEGAL", `cannot retry in state ${s.state}`, 409);
  const turn = currentTurn(s);
  if (!turn.decision || turn.decision.decision_type !== "coach_one") {
    throw err("STATE_ILLEGAL", "reinforce_only turns have no retry; advance instead", 409);
  }

  const retry_observations = observe({ transcript: retry_transcript, duration_seconds });
  const comparison = compareRetry({
    original_transcript: turn.transcript!,
    retry_transcript,
    original_observation_set: turn.observations!,
    retry_observation_set: retry_observations,
    decision: turn.decision,
    coaching_move: turn.move!,
    mission: turn.mission,
  });

  // commit + learner model update (the fork's fuel)
  Object.assign(turn, { retry_observations, comparison, retry_transcript });
  turn.proof = buildProof(turn.transcript!, turn.observations!, retry_transcript, retry_observations);
  turn.picked_version = undefined;
  turn.claim = undefined;
  const habit = comparison.coached_habit;
  const rec = s.learner_model.habits[habit] ?? { demonstrated: false, coached_count: 0, verdicts: [] };
  rec.coached_count += 1;
  rec.verdicts.push(comparison.verdict);
  if (comparison.verdict === "achieved") rec.demonstrated = true;
  s.learner_model.habits[habit] = rec;
  s.state = "COMPARED";
  log(s, "COMPARED", `verdict ${comparison.verdict} on ${habit}; ${comparison.banked_flaws.length} flaw(s) banked silently`);

  return { session: publicView(s), debug: debugView(s) };
}

export function advance(id: string) {
  const s = getSession(id);
  if (s.state !== "COACHED" && s.state !== "COMPARED") {
    throw err("STATE_ILLEGAL", `cannot advance in state ${s.state}`, 409);
  }
  const turn = currentTurn(s);
  if (s.state === "COACHED") log(s, "RETRY_SKIPPED", "learner advanced without a retry (honest signal, logged)");
  harvestLine(s, turn);

  if (s.question_index + 1 >= QUESTIONS.length) {
    s.state = "SESSION_SUMMARY";
    log(s, "SESSION_SUMMARY", "session complete");
    return { session: publicView(s), debug: debugView(s) };
  }

  // next mission: keep the coached habit if not achieved; clear it if achieved
  const coached = turn.decision?.decision_type === "coach_one"
    ? turn.decision.selected!.opportunity.related_habits[0]! : null;
  const achieved = turn.comparison?.verdict === "achieved";
  const mission = coached && !achieved ? { habit_id: coached } : null;

  s.question_index += 1;
  s.turns.push({ question: QUESTIONS[s.question_index]!, mission, iteration: 1 });
  s.state = "AWAITING_ANSWER";
  log(s, "ADVANCED", `question ${s.question_index + 1}${mission ? `; mission carried: ${mission.habit_id}` : "; fresh start, no mission"}`);
  return { session: publicView(s), debug: debugView(s) };
}

/** Beat 4/5 support: the keeper line for "take these into Thursday". */
function harvestLine(s: Session, turn: Turn) {
  if (!turn.comparison) return;
  const quoted = turn.comparison.reinforcement.quoted_spans[0]?.span_text;
  const line = quoted ?? turn.retry_transcript?.split(/(?<=[.!?])\s+/).slice(-1)[0] ?? null;
  if (line && !s.lines.some((l) => l.line === line)) {
    s.lines.push({ question: turn.question.text, line, claim: turn.claim ?? null });
    log(s, "LINE_KEPT", `"${line.slice(0, 60)}${line.length > 60 ? "…" : ""}"`);
  }
}

/** Beat 1: the learner judges before any reveal. Logged: does their read match the machine's? */
export function recordPick(id: string, version: "v1" | "v2") {
  const s = getSession(id);
  if (s.state !== "COMPARED") throw err("STATE_ILLEGAL", "no comparison to judge", 409);
  const turn = currentTurn(s);
  turn.picked_version = version;
  const machine = turn.comparison!.verdict === "not_yet" ? "v1" : "v2";
  log(s, "LEARNER_PICKED", `learner chose ${version}; machine verdict implies ${machine}; ${version === machine ? "agreement" : "disagreement — interesting"}`);
  return { session: publicView(s), debug: debugView(s) };
}

/** Beat 4: the learner names what THEY changed. Generation effect, stored. */
export function recordClaim(id: string, text: string) {
  const s = getSession(id);
  if (s.state !== "COMPARED") throw err("STATE_ILLEGAL", "nothing to claim yet", 409);
  const clean = (text ?? "").trim().slice(0, 200);
  if (!clean) throw err("INPUT_INVALID", "claim must be a non-empty sentence", 400);
  currentTurn(s).claim = clean;
  log(s, "CLAIMED", `"${clean}"`);
  return { session: publicView(s), debug: debugView(s) };
}

/** Beat 5 option 2: Go Deeper — V2 becomes the working answer; one insight, next priority. */
export function goDeeper(id: string) {
  const s = getSession(id);
  if (s.state !== "COMPARED") throw err("STATE_ILLEGAL", "go deeper follows a comparison", 409);
  const turn = currentTurn(s);
  harvestLine(s, turn);

  const transcript = turn.retry_transcript!;
  const observations = turn.retry_observations!;
  const candidates = generateOpportunities({
    observation_set: observations,
    context: { question_type: turn.question.type, ...(turn.mission ? { mission_habit_id: turn.mission.habit_id } : {}) },
  });
  const decision = decide({ candidates, coaching_state: "flowing", mission: turn.mission, learner_model: s.learner_model });
  const move = generateCoachingMove({ decision, observation_set: observations, transcript, coaching_state: "flowing", mission: turn.mission });

  // commit: the retry is now the baseline; the loop continues on THIS answer
  turn.transcript = transcript;
  turn.observations = observations;
  turn.candidates = candidates;
  turn.decision = decision;
  turn.move = move;
  turn.quick_scan = quickScan(observations, candidates.map((c) => c.opportunity_id), candidates);
  turn.retry_transcript = undefined;
  turn.retry_observations = undefined;
  turn.comparison = undefined;
  turn.proof = undefined;
  turn.picked_version = undefined;
  turn.iteration += 1;
  s.state = "COACHED";
  log(s, "GO_DEEPER", decision.decision_type === "coach_one"
    ? `iteration ${turn.iteration}: next priority ${decision.selected!.opportunity.opportunity_id}`
    : `iteration ${turn.iteration}: nothing left to coach — the answer stands`);
  return { session: publicView(s), debug: debugView(s) };
}

/** Beat 5 option 3: Lock It In — one uninterrupted repetition, no coaching, kept. */
export function lockIn(id: string, transcript: string) {
  const s = getSession(id);
  if (s.state !== "COMPARED") throw err("STATE_ILLEGAL", "lock in follows a comparison", 409);
  const clean = (transcript ?? "").trim();
  if (!clean) throw err("INPUT_INVALID", "say the whole answer once more to lock it in", 400);
  const turn = currentTurn(s);
  turn.retry_transcript = clean; // the locked take becomes the keeper source
  turn.locked = true;
  harvestLine(s, turn);
  log(s, "LOCKED_IN", "one clean uninterrupted repetition, no coaching");
  return { session: publicView(s), debug: debugView(s) };
}

/** Learner-facing view: coaching only. */
export function publicView(s: Session) {
  const turn = currentTurn(s);
  const missionLine = turn.mission && MISSION_FOCUS[turn.mission.habit_id]
    ? `Today's focus: ${MISSION_FOCUS[turn.mission.habit_id]}.` : null;
  const nextMissionHabit = (() => {
    for (let i = s.turns.length - 1; i >= 0; i--) {
      const t = s.turns[i]!;
      const h = t.decision?.decision_type === "coach_one" ? t.decision.selected!.opportunity.related_habits[0]! : null;
      if (h && t.comparison?.verdict !== "achieved") return h;
    }
    return null;
  })();
  return {
    id: s.id,
    state: s.state,
    question_number: s.question_index + 1,
    question_total: QUESTIONS.length,
    question: turn.question.text,
    mission_line: missionLine,
    move: turn.move ? (({ verification, ...rest }) => ({ ...rest, degraded: verification.degraded }))(turn.move) : null,
    quick_scan: turn.quick_scan ?? null,
    comparison: turn.comparison
      ? { reinforcement: turn.comparison.reinforcement } // verdict lives in debug; the learner's own pick is the verdict moment
      : null,
    proof: turn.proof ? {
      ...turn.proof,
      picked_version: turn.picked_version ?? null,
      claim: turn.claim ?? null,
      locked: turn.locked ?? false,
      iteration: turn.iteration,
    } : null,
    summary: s.state === "SESSION_SUMMARY" ? {
      turns: s.turns.map((t) => ({
        question: t.question.text,
        coached: t.decision?.decision_type === "coach_one" ? t.decision.selected!.opportunity.opportunity_id : "reinforce_only",
        verdict: t.comparison?.verdict ?? (t.decision?.decision_type === "coach_one" ? "no retry" : "n/a"),
      })),
      next_mission: nextMissionHabit && MISSION_FOCUS[nextMissionHabit]
        ? `Next session: ${MISSION_FOCUS[nextMissionHabit]}.`
        : "Next session: fresh assessment. Bring a new story.",
      your_lines: s.lines,
    } : null,
  };
}

/** Engineering view: everything, including what the learner never sees. */
export function debugView(s: Session) {
  const turn = currentTurn(s);
  return {
    state: s.state,
    candidates: turn.candidates ?? null,
    decision_reasoning: turn.decision?.reasoning ?? null,
    selected: turn.decision?.decision_type === "coach_one" ? turn.decision.selected : null,
    move_verification: turn.move?.verification ?? null,
    comparison_internal: turn.comparison ? {
      verdict: turn.comparison.verdict,
      improvement_summary: turn.comparison.improvement_summary,
      banked_flaws: turn.comparison.banked_flaws,
      verification: turn.comparison.verification,
      evidence_from_retry: turn.comparison.evidence_from_retry,
    } : null,
    learner_model: s.learner_model,
    events: s.events,
  };
}
