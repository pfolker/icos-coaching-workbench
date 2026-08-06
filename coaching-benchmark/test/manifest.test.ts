import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { AVAILABLE_TRANSCRIPTS, NEEDED_COVERAGE, coverageSummary } from "../src/manifest";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("Step 3 expansion manifest — real transcripts only", () => {
  it("every available transcript points to a source file that exists", () => {
    const missing: string[] = [];
    for (const t of AVAILABLE_TRANSCRIPTS) {
      const path = t.source.split(/[:\s#]/)[0]!;
      if (!existsSync(join(REPO_ROOT, path))) missing.push(`${t.case_id} → ${path}`);
    }
    expect(missing, `missing sources: ${missing.join(", ")}`).toEqual([]);
  });

  it("includes real cross-domain (non-manufacturing) transcripts", () => {
    const domains = new Set(AVAILABLE_TRANSCRIPTS.map((t) => t.domain));
    expect(domains.has("sales")).toBe(true);
    expect(domains.has("healthcare")).toBe(true);
    expect(domains.has("software/SRE")).toBe(true);
  });

  it("records the still-missing professions as an explicit request, not synthetic filler", () => {
    expect(NEEDED_COVERAGE.length).toBeGreaterThan(0);
    for (const n of NEEDED_COVERAGE) expect(n.why.length).toBeGreaterThan(0);
  });

  it("coverageSummary reports counts honestly", () => {
    const s = coverageSummary();
    expect(s.available_count).toBe(AVAILABLE_TRANSCRIPTS.length);
    expect(s.distinct_domains.length).toBeGreaterThan(1);
  });
});
