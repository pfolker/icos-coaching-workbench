/**
 * Offline tests for the SOD experiment's deterministic parts. No live calls:
 * the provider seam is stubbed, so this suite is free and repeatable.
 *
 * What is worth testing here is NOT the model's judgment (that is what the
 * experiment measures) but the contracts around it: what SOD is shown, and
 * what is allowed back out.
 */
import { describe, it, expect } from "vitest";
import { CALIBRATION_CASES_BY_ID } from "../../coaching-calibration/src/corpus";
import { validateEvidence } from "../../evidence-validator/src/index";
import { materializeSourceSpans } from "../../evidence-runtime/src/modelOutput";
import { buildEvidenceGraph } from "../../evidence-runtime/src/evidenceGraph";
import { CoachProvider, ProviderCompletion } from "../../coaching-runtime/src/coachProvider";
import { buildSodInput, renderSodInput, suppliedIds } from "../src/sodInput";
import { extractJson, validateObservations, runSod } from "../src/detector";
import { SEMANTIC_TAGS, TAG_DEFINITIONS, EXCLUDED_TAGS } from "../src/vocabulary";
import { SOD_SYSTEM_PROMPT } from "../src/sodPrompt";
import { PRIMARY_CASES, CONTROL_CASES } from "../src/experiment";

function graphFor(id: string) {
  const c = CALIBRATION_CASES_BY_ID.get(id)!;
  return buildEvidenceGraph(validateEvidence(materializeSourceSpans(c.transcript, c.fixture)));
}

class StubProvider implements CoachProvider {
  readonly name = "stub";
  constructor(private readonly text: string) {}
  lastUser = "";
  async complete(_system: string, userMessage: string): Promise<ProviderCompletion> {
    this.lastUser = userMessage;
    return {
      text: this.text,
      meta: { provider: this.name, model: "stub", base_url: "stub", request_bytes: 0, response_bytes: 0 },
    };
  }
}

describe("input contract", () => {
  it("supplies admitted claims and relationships only", () => {
    const input = buildSodInput(graphFor("001"));
    expect(input.nodes.map((n) => n.id)).toContain("a_prior_belief");
    expect(input.edges.map((e) => e.id)).toContain("b_contrast_belief");
  });

  it("excludes Class C: case 001's non-admissible hypothesis never reaches SOD", () => {
    const graph = graphFor("001");
    expect(graph.non_admissible.length).toBeGreaterThan(0);
    const rendered = renderSodInput(buildSodInput(graph));
    for (const c of graph.non_admissible) {
      expect(rendered).not.toContain(c.hypothesis);
      expect(rendered).not.toContain(c.id);
    }
  });

  it("carries no raw transcript", async () => {
    const c = CALIBRATION_CASES_BY_ID.get("006")!;
    const stub = new StubProvider('{"observations": []}');
    await runSod({ case_id: "006", graph: graphFor("006"), provider: stub });
    expect(stub.lastUser).not.toContain(c.transcript);
    // the individual-vs-team signal is nonetheless fully present in the quotes
    expect(stub.lastUser).toContain("I built out a staging environment");
    expect(stub.lastUser).toContain("The team put together the test suite");
  });
});

describe("output contract", () => {
  it("accepts an empty observation list", async () => {
    const r = await runSod({ case_id: "005", graph: graphFor("005"), provider: new StubProvider('{"observations": []}') });
    expect(r.observations).toEqual([]);
    expect(r.parse_failed).toBe(false);
  });

  it("rejects an observation citing evidence never supplied", () => {
    const ids = suppliedIds(buildSodInput(graphFor("005")));
    const { observations, rejected } = validateObservations(
      [{ tag: "result_needs_substance", evidence_refs: ["a_does_not_exist"], confidence: 0.9, basis: "x" }],
      ids,
    );
    expect(observations).toHaveLength(0);
    expect(rejected[0]!.reason).toBe("untraceable_evidence_ref");
  });

  it("rejects a tag outside the fixed vocabulary", () => {
    const ids = suppliedIds(buildSodInput(graphFor("005")));
    const { observations, rejected } = validateObservations(
      [{ tag: "invented_tag", evidence_refs: ["a_outcome"], confidence: 1, basis: "x" }],
      ids,
    );
    expect(observations).toHaveLength(0);
    expect(rejected[0]!.reason).toBe("tag_outside_vocabulary");
  });

  it("rejects an observation with no evidence at all", () => {
    const ids = suppliedIds(buildSodInput(graphFor("005")));
    const { rejected } = validateObservations([{ tag: "result_needs_substance", evidence_refs: [], confidence: 1 }], ids);
    expect(rejected[0]!.reason).toBe("no_evidence_refs");
  });

  it("tolerates a fenced JSON response", () => {
    expect(extractJson('```json\n{"observations": []}\n```')).toBe('{"observations": []}');
  });

  it("records a malformed response instead of inventing observations", async () => {
    const r = await runSod({ case_id: "005", graph: graphFor("005"), provider: new StubProvider("not json at all") });
    expect(r.parse_failed).toBe(true);
    expect(r.observations).toEqual([]);
    expect(r.raw_response).toBe("not json at all");
  });
});

describe("experiment pre-registration", () => {
  it("defines exactly the four v0.1 tags, each with corpus ground truth", () => {
    expect(SEMANTIC_TAGS).toHaveLength(4);
    expect(TAG_DEFINITIONS.map((d) => d.tag).sort()).toEqual([...SEMANTIC_TAGS].sort());
    for (const d of TAG_DEFINITIONS) expect(d.ground_truth.length).toBeGreaterThan(0);
    expect(EXCLUDED_TAGS.length).toBeGreaterThan(0);
  });

  it("includes a positive tag, so perception is not gap-detection only", () => {
    expect(TAG_DEFINITIONS.some((d) => d.polarity === "strength")).toBe(true);
  });

  it("pairs each primary case with one target and every control with a reason", () => {
    expect(PRIMARY_CASES.map((p) => p.case_id)).toEqual(["001", "005", "006", "009"]);
    for (const c of CONTROL_CASES) {
      expect(CALIBRATION_CASES_BY_ID.has(c.case_id)).toBe(true);
      expect(c.why_chosen.length).toBeGreaterThan(0);
      expect(c.expect_absent.length).toBeGreaterThan(0);
    }
  });

  it("names no test case in the system prompt", () => {
    for (const needle of ["deburring", "staging", "return policy", "onboarding", "sepsis", "churn"]) {
      expect(SOD_SYSTEM_PROMPT.toLowerCase()).not.toContain(needle);
    }
  });

  it("forbids the decisions SOD must never make", () => {
    const p = SOD_SYSTEM_PROMPT.toLowerCase();
    for (const needle of ["habit", "teaching principle", "teaching move", "advance", "retry"]) {
      expect(p).toContain(needle);
    }
  });
});
