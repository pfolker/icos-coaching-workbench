import { describe, it, expect } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { runDeterministicCoach } from "../src/deterministicCoach";
import { CALIBRATION_CASES, CALIBRATION_CASES_BY_ID } from "../src/corpus";
import { runComparison } from "../src/runComparison";
import { appendObservation, readObservations } from "../src/observations";
import { CoachProvider, ProviderCompletion } from "../../coaching-runtime/src/coachProvider";

const mock = (reply: string): CoachProvider => ({
  name: "mock",
  async complete(_s, _u, cfg): Promise<ProviderCompletion> {
    return { text: reply, meta: { provider: "mock", model: cfg.model, base_url: "mock://", request_bytes: 0, response_bytes: reply.length } };
  },
});

describe("deterministic coach adapter (five frozen engines, one turn)", () => {
  it("produces coaching text and a decision on a real transcript", () => {
    const c = CALIBRATION_CASES_BY_ID.get("001")!;
    const r = runDeterministicCoach(c.transcript);
    expect(r.coaching_text.length).toBeGreaterThan(0);
    expect(["coach_one", "reinforce_only"]).toContain(r.decision_type);
    expect(r.observation_count).toBeGreaterThan(0);
  });

  it("runs cleanly on every corpus case (no throw across domains)", () => {
    for (const c of CALIBRATION_CASES) {
      const r = runDeterministicCoach(c.transcript);
      expect(typeof r.coaching_text, `${c.id}`).toBe("string");
    }
  });
});

describe("calibration corpus", () => {
  it("has real transcripts and Listen fixtures for every case, unique ids, multiple domains", () => {
    expect(CALIBRATION_CASES.length).toBeGreaterThanOrEqual(15);
    const ids = CALIBRATION_CASES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(CALIBRATION_CASES.map((c) => c.domain)).size).toBeGreaterThan(4);
    for (const c of CALIBRATION_CASES) {
      expect(c.transcript.length, c.id).toBeGreaterThan(0);
      expect(Array.isArray(c.fixture.class_a_proposals), c.id).toBe(true);
    }
  });
});

describe("runComparison (both coaches, structured via mock — no network)", () => {
  it("returns deterministic AND structured output for the same case", async () => {
    const c = CALIBRATION_CASES_BY_ID.get("009")!;
    const r = await runComparison(c, { provider: mock("What was the actual number or percentage of the drop?"), model: "test-model" });
    expect(r.deterministic.coaching_text.length).toBeGreaterThan(0);
    expect(r.structured.final_text.length).toBeGreaterThan(0);
    expect(r.structured.provider).toBe("mock");
    expect(r.structured.model).toBe("test-model");
  });
});

describe("four-field observation logger (append-only, no scoring)", () => {
  it("round-trips an observation as JSONL", () => {
    const path = join(tmpdir(), `calib-${randomUUID()}.jsonl`);
    appendObservation(path, { case_id: "001", preferred: "structured", why: "pointed at a specific claim", constitution: "PASS", constitution_note: "", retry_motivation: "YES", surprised: "NO", surprised_note: "", notes: "" });
    appendObservation(path, { case_id: "009", preferred: "deterministic", why: "asked for a number", constitution: "FLAG", constitution_note: "implied a conclusion", retry_motivation: "NO", surprised: "YES", surprised_note: "picked a request over an affirmation", notes: "borderline" });
    const back = readObservations(path);
    expect(back).toHaveLength(2);
    expect(back[0]!.preferred).toBe("structured");
    expect(back[0]!.surprised).toBe("NO");
    expect(back[1]!.constitution).toBe("FLAG");
    expect(back[1]!.surprised).toBe("YES");
    expect(back[1]!.surprised_note).toContain("request");
    expect(back[1]!.ts).toBeTruthy();
  });
});
