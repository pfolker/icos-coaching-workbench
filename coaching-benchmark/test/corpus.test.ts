import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { HISTORICAL_FAILURES, FAILURE_CATEGORIES, HistoricalFailureCase } from "../src/corpus";
import { CRITERIA_BY_ID } from "../src/criteria";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("seed corpus — every case is a real, fully-documented historical failure", () => {
  it("covers all four seeded failure categories", () => {
    const present = new Set(HISTORICAL_FAILURES.map((c) => c.failure_category));
    for (const cat of FAILURE_CATEGORIES) expect(present.has(cat), `missing category ${cat}`).toBe(true);
  });

  it("gives every case the full record: transcript, produced, expected, why, sources", () => {
    for (const c of HISTORICAL_FAILURES) {
      expect(c.transcript.trim().length, `${c.case_id} transcript`).toBeGreaterThan(0);
      expect(c.system_produced.trim().length, `${c.case_id} system_produced`).toBeGreaterThan(0);
      expect(c.expected_output.trim().length, `${c.case_id} expected_output`).toBeGreaterThan(0);
      expect(c.why_failed.trim().length, `${c.case_id} why_failed`).toBeGreaterThan(0);
      expect(c.source_refs.length, `${c.case_id} source_refs`).toBeGreaterThan(0);
    }
  });

  it("tags every case with criteria that actually exist in the rubric", () => {
    for (const c of HISTORICAL_FAILURES) {
      expect(c.primary_criteria.length, `${c.case_id} primary_criteria`).toBeGreaterThan(0);
      for (const id of c.primary_criteria) {
        expect(CRITERIA_BY_ID.has(id), `${c.case_id} references unknown criterion ${id}`).toBe(true);
      }
    }
  });

  it("uses unique case ids", () => {
    const ids = HISTORICAL_FAILURES.map((c) => c.case_id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("locked failure invariants — the exact property each incident is about", () => {
  const byId = (id: string): HistoricalFailureCase =>
    HISTORICAL_FAILURES.find((c) => c.case_id === id)!;

  it("HF-001: the word 'indicator' is NOT in Case 001's transcript (the whole point of the fabrication)", () => {
    expect(byId("HF-001").transcript.toLowerCase()).not.toContain("indicator");
  });

  it("HF-002: 'because' appears once, inside the diagnosis sentence (self-contained, not a bridge)", () => {
    const t = byId("HF-002").transcript;
    expect((t.match(/because/gi) ?? []).length).toBe(1);
    // it sits inside the "I think the complaints dropped because ..." sentence
    expect(t).toMatch(/dropped because agents were less stressed/i);
  });

  it("HF-003/004/005: each dimensional case actually contains its unit token", () => {
    expect(byId("HF-003").transcript).toContain('.0002"');
    expect(byId("HF-004").transcript).toContain("25.4 mm");
    expect(byId("HF-005").transcript.toLowerCase()).toContain("thou");
  });

  it("HF-006: the grounding false-positive case names legitimate paraphrase words", () => {
    const produced = byId("HF-006").system_produced.toLowerCase();
    expect(produced).toContain("examining");
    expect(produced).toContain("timeframe");
  });
});

describe("provenance integrity — cited source files still exist (guards against the HF-001 copy-error class)", () => {
  it("every cited source file (before any :line suffix) resolves in the repo", () => {
    const missing: string[] = [];
    for (const c of HISTORICAL_FAILURES) {
      for (const ref of c.source_refs) {
        const path = ref.split(/[:\s#]/)[0]!;
        if (!existsSync(join(REPO_ROOT, path))) missing.push(`${c.case_id} → ${path}`);
      }
    }
    expect(missing, `missing source files: ${missing.join(", ")}`).toEqual([]);
  });
});
