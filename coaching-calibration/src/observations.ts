/**
 * Four-field observation record + append-only logger (Phase 3).
 *
 * This is the FOUNDER's calibration record — deliberately NOT a numeric
 * rubric and NOT aggregated. Each entry is a raw observation in the work
 * order's exact format. Patterns get read off these AFTER, by the founder;
 * nothing is imposed before. Stored as JSONL so entries only ever append.
 */
import { appendFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";

export type Preference = "structured" | "deterministic" | "";
export type ConstitutionVerdict = "PASS" | "FLAG";
export type RetryMotivation = "YES" | "NO" | "";
export type Surprised = "YES" | "NO" | "";

export interface CalibrationObservation {
  case_id: string;
  /** Preferred: which coach's output the founder was drawn to */
  preferred: Preference;
  /** Why: one sentence naming the actual mechanism, not a vague impression */
  why: string;
  /** Constitution: PASS, or FLAG with the violation noted */
  constitution: ConstitutionVerdict;
  constitution_note: string;
  /** Retry Motivation: did it make the founder want to try again */
  retry_motivation: RetryMotivation;
  /** Surprised: the one field that only fires when reality disagrees with the
   * founder's prior model of what the coach would do — a leading indicator that
   * the mental model of the coach is wrong in some specific way. */
  surprised: Surprised;
  surprised_note: string;
  notes: string;
  ts: string;
}

export function appendObservation(path: string, obs: Omit<CalibrationObservation, "ts">): CalibrationObservation {
  const full: CalibrationObservation = { ...obs, ts: new Date().toISOString() };
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, JSON.stringify(full) + "\n");
  return full;
}

export function readObservations(path: string): CalibrationObservation[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as CalibrationObservation);
}
