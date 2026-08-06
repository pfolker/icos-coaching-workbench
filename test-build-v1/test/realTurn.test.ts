/**
 * Deterministic, no-network regression test: the forced-failure path
 * (Step 4's fallback) must always resolve to a valid, non-degraded-looking
 * render using the real regex-only functions — no live call attempted, no
 * broken/empty result. The genuine live-pipeline path is covered by this
 * package's live, real-transcript verification (see the deliverables
 * report), not here, since it requires a real network call and API cost.
 */
import { describe, it, expect } from "vitest";
import { runRealTurn } from "../server/realTurn";

describe("runRealTurn — forced-failure fallback (Step 4)", () => {
  it("degrades cleanly to the real regex-only pipeline, never a broken result", async () => {
    const { result, logDetail } = await runRealTurn(
      "I redesigned the clamping. As a result, scrap went from 8% to 2%.",
      { forceFailure: true }
    );
    expect(result.degraded).toBe(true);
    expect(result.degradedReason).toContain("forced failure");
    expect(result.quickScan).toBeTruthy();
    expect(Object.values(result.quickScan).flat().length).toBeGreaterThan(0);
    expect(logDetail.degraded).toBe(true);
    expect(logDetail.live).toBeUndefined();

    // Step 2's structured diagnostics schema, populated on the fallback path.
    const d = logDetail.diagnostics;
    expect(d.requestedPipeline).toBe("evidence");
    expect(d.actualPipeline).toBe("regex_fallback");
    expect(d.fallbackReason).toContain("forced failure");
    expect(d.errorName).toBe("ForcedFailureError");
    expect(d.errorMessage).toContain("forced failure");
    expect(d.errorCause).toBeNull(); // no underlying cause for the test hook
    expect(d.elapsedMs).toBeGreaterThanOrEqual(0);
  });

  it("a genuinely thin transcript still renders a usable, non-empty Coach's Notes in fallback mode", async () => {
    const { result } = await runRealTurn("It got fixed eventually.", { forceFailure: true });
    expect(result.degraded).toBe(true);
    expect(Object.values(result.quickScan).flat().length).toBeGreaterThan(0);
  });
});
