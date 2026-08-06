/**
 * Registered known transcripts — the same "CASES array" convention
 * evidence-runtime's and coaching-runtime's Debug UIs already use. Fixture
 * mode can only replay a KNOWN transcript (a hand-authored
 * ListenEngineRawOutput has to exist for it); an arbitrary pasted/typed
 * transcript can only run in live mode. This is a real, reported limitation
 * of "paste or type a transcript" (README.md Section 3), not hidden.
 */
import { ListenEngineRawOutput } from "../../evidence-runtime/src/modelOutput";
import * as founderCase from "../../coaching-runtime/src/founderCase";
import * as cncCase from "../../evidence-benchmark/src/case003Fixture";
import * as thinCase from "./thinCase";
import * as checkoutOutageCase from "./checkoutOutageCase";

export interface KnownCase {
  case_id: string;
  label: string;
  transcript: string;
  fixture: ListenEngineRawOutput;
}

export const KNOWN_CASES: KnownCase[] = [
  {
    case_id: "founder",
    label: "Founder's real retry (deburring / indicator / divots / conical profile)",
    transcript: founderCase.TRANSCRIPT,
    fixture: founderCase.LISTEN_ENGINE_FIXTURE,
  },
  {
    case_id: "cnc",
    label: "CNC stress test (Atlas Case 003 — Strong Concise Answer)",
    transcript: cncCase.TRANSCRIPT,
    fixture: cncCase.LISTEN_ENGINE_FIXTURE,
  },
  {
    case_id: "thin",
    label: "Genuinely thin answer (no tools, no numbers, no named action)",
    transcript: thinCase.TRANSCRIPT,
    fixture: thinCase.LISTEN_ENGINE_FIXTURE,
  },
  {
    case_id: "checkout-outage",
    label: "Checkout outage (real, user-supplied — root_cause priority overrides the ladder)",
    transcript: checkoutOutageCase.TRANSCRIPT,
    fixture: checkoutOutageCase.LISTEN_ENGINE_FIXTURE,
  },
];

export const findKnownCase = (case_id: string): KnownCase | undefined =>
  KNOWN_CASES.find((c) => c.case_id === case_id);

export const findKnownCaseByTranscript = (transcript: string): KnownCase | undefined =>
  KNOWN_CASES.find((c) => c.transcript === transcript);
