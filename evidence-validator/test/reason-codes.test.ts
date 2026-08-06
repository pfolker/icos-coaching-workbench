/**
 * Synthetic unit tests for every reason code not already exercised by an
 * Atlas fixture (QUOTE_NOT_FOUND: Case 005; BELIEF_FACT_COLLAPSE_ATTEMPT:
 * Case 009). Each test is a minimal, self-contained construction proving
 * the code path actually fires, not just that it's declared.
 */
import { describe, it, expect } from "vitest";
import { validateEvidence } from "../src/validator";
import { ValidatorInput } from "../src/types";
import { span } from "./helpers";

const base = (over: Partial<ValidatorInput> = {}): ValidatorInput => ({
  transcript: "",
  class_a_proposals: [],
  class_b_proposals: [],
  class_c_proposals: [],
  ...over,
});

describe("SOURCE_SPAN_MISMATCH", () => {
  it("rejects when source_span resolves to different text than the quote", () => {
    const transcript = "I fixed the mount and it held up fine after that.";
    const quote = "I fixed the mount";
    const out = validateEvidence(base({
      transcript,
      class_a_proposals: [{
        proposal_id: "p1", claim_type: "action", quote,
        source_span: { start: 5, end: 5 + quote.length }, // wrong offset on purpose
      }],
    }));
    expect(out.rejected).toEqual([{
      proposal_id: "p1", reason_code: "SOURCE_SPAN_MISMATCH",
      explanation: expect.stringContaining("does not match quote"),
    }]);
  });
});

describe("CLAIM_TYPE_UNKNOWN", () => {
  it("rejects a claim_type outside the v1 enum", () => {
    const transcript = "I fixed the mount and it held up fine after that.";
    const quote = "I fixed the mount";
    const out = validateEvidence(base({
      transcript,
      class_a_proposals: [{ proposal_id: "p1", claim_type: "confidence_score", quote, source_span: span(transcript, quote) }],
    }));
    expect(out.rejected[0]!.reason_code).toBe("CLAIM_TYPE_UNKNOWN");
  });
});

describe("CLAIM_TYPE_MISMATCH", () => {
  it("rejects an action tag on a cognition-only quote with no action verb", () => {
    const transcript = "I thought about it for a while before saying anything.";
    const quote = "I thought about it for a while before saying anything";
    const out = validateEvidence(base({
      transcript,
      class_a_proposals: [{ proposal_id: "p1", claim_type: "action", quote, source_span: span(transcript, quote) }],
    }));
    expect(out.rejected[0]!.reason_code).toBe("CLAIM_TYPE_MISMATCH");
  });

  it("rejects a self_reported_diagnosis tag on a bare action clause with no cognition language", () => {
    const transcript = "I replaced the sensor before the next shift started.";
    const quote = "I replaced the sensor";
    const out = validateEvidence(base({
      transcript,
      class_a_proposals: [{ proposal_id: "p1", claim_type: "self_reported_diagnosis", quote, source_span: span(transcript, quote) }],
    }));
    expect(out.rejected[0]!.reason_code).toBe("CLAIM_TYPE_MISMATCH");
  });
});

describe("CLAIM_TYPE_UNVERIFIABLE (requires_review)", () => {
  it("routes to requires_review, not rejected, when a quote mixes cognition and action signal", () => {
    const transcript = "I thought about it for a while, but I fixed the mount anyway.";
    const quote = "I thought about it for a while, but I fixed the mount anyway";
    const out = validateEvidence(base({
      transcript,
      class_a_proposals: [{ proposal_id: "p1", claim_type: "action", quote, source_span: span(transcript, quote) }],
    }));
    expect(out.rejected).toEqual([]);
    expect(out.requires_review.length).toBe(1);
    expect(out.requires_review[0]!.reason_code).toBe("CLAIM_TYPE_UNVERIFIABLE");
    expect(out.validated_class_a).toEqual([]);
  });
});

describe("RELATIONSHIP_TYPE_UNKNOWN", () => {
  it("rejects a relationship_type outside the closed five-value enum", () => {
    const transcript = "I fixed the mount. It held up fine.";
    const q1 = "I fixed the mount";
    const q2 = "It held up fine";
    const out = validateEvidence(base({
      transcript,
      class_a_proposals: [
        { proposal_id: "a1", claim_type: "action", quote: q1, source_span: span(transcript, q1) },
        { proposal_id: "a2", claim_type: "outcome", quote: q2, source_span: span(transcript, q2) },
      ],
      class_b_proposals: [{ proposal_id: "b1", relationship_type: "causal_link", marker_text: "", components: ["a1", "a2"] }],
    }));
    expect(out.rejected.find((r) => r.proposal_id === "b1")!.reason_code).toBe("RELATIONSHIP_TYPE_UNKNOWN");
  });
});

describe("COMPONENT_NOT_VALIDATED", () => {
  it("rejects a Class B proposal referencing a component id that was never validated", () => {
    const transcript = "I fixed the mount. It held up fine.";
    const q1 = "I fixed the mount";
    const out = validateEvidence(base({
      transcript,
      class_a_proposals: [{ proposal_id: "a1", claim_type: "action", quote: q1, source_span: span(transcript, q1) }],
      class_b_proposals: [{ proposal_id: "b1", relationship_type: "temporal_sequence", marker_text: "", components: ["a1", "does_not_exist"] }],
    }));
    expect(out.rejected.find((r) => r.proposal_id === "b1")!.reason_code).toBe("COMPONENT_NOT_VALIDATED");
  });
});

describe("MARKER_NOT_FOUND", () => {
  it("rejects a marker_text not in the fixed contrast_marker list", () => {
    const transcript = "I fixed the mount. It held up fine.";
    const q1 = "I fixed the mount";
    const out = validateEvidence(base({
      transcript,
      class_a_proposals: [{ proposal_id: "a1", claim_type: "action", quote: q1, source_span: span(transcript, q1) }],
      class_b_proposals: [{ proposal_id: "b1", relationship_type: "contrast_marker", marker_text: "although", components: ["a1"] }],
    }));
    expect(out.rejected.find((r) => r.proposal_id === "b1")!.reason_code).toBe("MARKER_NOT_FOUND");
  });

  it("rejects a valid marker_text that doesn't actually bridge the two referenced components", () => {
    const transcript = "I fixed the mount. Later that week it held up fine regardless.";
    const q1 = "I fixed the mount";
    const q2 = "it held up fine regardless";
    const out = validateEvidence(base({
      transcript,
      class_a_proposals: [
        { proposal_id: "a1", claim_type: "action", quote: q1, source_span: span(transcript, q1) },
        { proposal_id: "a2", claim_type: "outcome", quote: q2, source_span: span(transcript, q2) },
      ],
      class_b_proposals: [{ proposal_id: "b1", relationship_type: "contrast_marker", marker_text: "but", components: ["a1", "a2"] }],
    }));
    expect(out.rejected.find((r) => r.proposal_id === "b1")!.reason_code).toBe("MARKER_NOT_FOUND");
  });
});

describe("ORDER_INVALID", () => {
  it("rejects a temporal_sequence whose components are not in increasing textual position and no connector rescues it", () => {
    const transcript = "I fixed the mount. It held up fine.";
    const actionQuote = "I fixed the mount";
    const outcomeQuote = "It held up fine";
    const out = validateEvidence(base({
      transcript,
      class_a_proposals: [
        { proposal_id: "a1", claim_type: "action", quote: actionQuote, source_span: span(transcript, actionQuote) },
        { proposal_id: "a2", claim_type: "outcome", quote: outcomeQuote, source_span: span(transcript, outcomeQuote) },
      ],
      // claims components in the order [outcome, action], but "action" quote
      // actually appears EARLIER in the transcript than "outcome" here, and
      // no once/after/before connector is present to rescue a different order.
      class_b_proposals: [{ proposal_id: "b1", relationship_type: "temporal_sequence", marker_text: "", components: ["a2", "a1"] }],
    }));
    expect(out.rejected.find((r) => r.proposal_id === "b1")!.reason_code).toBe("ORDER_INVALID");
  });
});

describe("EP-004: connector-governed temporal_sequence ordering", () => {
  it("'after' connector rescues an order that fails raw position, records ordering_basis", () => {
    const transcript = "It held up fine after I fixed the mount.";
    const outcomeQuote = "It held up fine";
    const actionQuote = "I fixed the mount";
    const out = validateEvidence(base({
      transcript,
      class_a_proposals: [
        { proposal_id: "a1", claim_type: "action", quote: actionQuote, source_span: span(transcript, actionQuote) },
        { proposal_id: "a2", claim_type: "outcome", quote: outcomeQuote, source_span: span(transcript, outcomeQuote) },
      ],
      // raw position has outcome (a2) BEFORE action (a1) in the text, but
      // "after I fixed the mount" fixes the logical order as action-then-outcome,
      // which is exactly what's proposed here.
      class_b_proposals: [{ proposal_id: "b1", relationship_type: "temporal_sequence", marker_text: "", components: ["a1", "a2"] }],
    }));
    expect(out.rejected).toEqual([]);
    const b1 = out.validated_class_b.find((b) => b.proposal_id === "b1");
    expect(b1).toBeDefined();
    expect(b1!.ordering_basis).toBe("connector:after");
  });

  it("'before' connector reverses the expected order relative to 'once'/'after'", () => {
    const transcript = "I fixed the mount before the shift ended.";
    const actionQuote = "I fixed the mount";
    const shiftQuote = "the shift ended";
    const out = validateEvidence(base({
      transcript,
      class_a_proposals: [
        { proposal_id: "a1", claim_type: "action", quote: actionQuote, source_span: span(transcript, actionQuote) },
        { proposal_id: "a2", claim_type: "context_fact", quote: shiftQuote, source_span: span(transcript, shiftQuote) },
      ],
      // raw position has action (a1) before shift-ended (a2), which already
      // satisfies raw_position — so to exercise "before"'s reversed rule
      // specifically, propose the logically-later event (shift ending, per
      // "before" semantics: shift ending happens AFTER the fix) first.
      class_b_proposals: [{ proposal_id: "b1", relationship_type: "temporal_sequence", marker_text: "", components: ["a2", "a1"] }],
    }));
    // raw_position would already validate ["a1","a2"], but the CLAIMED order
    // here is ["a2","a1"] which raw position rejects. "before" attached to
    // a2's clause ("the shift ended" is X in "before X"); rule: before X,Y -> Y precedes X,
    // i.e. main(Y)=a1 precedes subordinate(X)=a2 -> logical order [a1, a2],
    // which does NOT match the claimed ["a2","a1"] -> must reject.
    expect(out.rejected.find((r) => r.proposal_id === "b1")!.reason_code).toBe("ORDER_INVALID");
  });

  it("'before' connector validates when the claimed order matches its reversed rule", () => {
    const transcript = "I fixed the mount before the shift ended.";
    const actionQuote = "I fixed the mount";
    const shiftQuote = "the shift ended";
    const out = validateEvidence(base({
      transcript,
      class_a_proposals: [
        { proposal_id: "a1", claim_type: "action", quote: actionQuote, source_span: span(transcript, actionQuote) },
        { proposal_id: "a2", claim_type: "context_fact", quote: shiftQuote, source_span: span(transcript, shiftQuote) },
      ],
      class_b_proposals: [{ proposal_id: "b1", relationship_type: "temporal_sequence", marker_text: "", components: ["a1", "a2"] }],
    }));
    // raw_position already holds here (a1 before a2 in text), so this
    // validates via raw_position, not the "before" connector rule — included
    // to document that "before" being PRESENT doesn't force connector-basis
    // when raw position already agrees with the proposed order.
    expect(out.rejected).toEqual([]);
    const b1 = out.validated_class_b.find((b) => b.proposal_id === "b1");
    expect(b1!.ordering_basis).toBe("raw_position");
  });
});

describe("QUANTITY_BINDING_INVALID", () => {
  it("rejects a quantity_binding component with no number+unit co-occurrence", () => {
    const transcript = "Scrap rate improved a lot after the change.";
    const quote = "Scrap rate improved a lot after the change";
    const out = validateEvidence(base({
      transcript,
      class_a_proposals: [{ proposal_id: "a1", claim_type: "outcome", quote, source_span: span(transcript, quote) }],
      class_b_proposals: [{ proposal_id: "b1", relationship_type: "quantity_binding", marker_text: "", components: ["a1"] }],
    }));
    expect(out.rejected.find((r) => r.proposal_id === "b1")!.reason_code).toBe("QUANTITY_BINDING_INVALID");
  });

  it("validates a quantity_binding component that does bind a number to a unit", () => {
    const transcript = "Scrap rate dropped by 8 percent after the change.";
    const quote = "Scrap rate dropped by 8 percent after the change";
    const out = validateEvidence(base({
      transcript,
      class_a_proposals: [{ proposal_id: "a1", claim_type: "outcome", quote, source_span: span(transcript, quote) }],
      class_b_proposals: [{ proposal_id: "b1", relationship_type: "quantity_binding", marker_text: "", components: ["a1"] }],
    }));
    expect(out.rejected).toEqual([]);
    expect(out.validated_class_b.length).toBe(1);
  });
});

describe("QUANTITY_BINDING dimensional/angular unit coverage (Work Order: Dimensional Unit Coverage)", () => {
  const expectBinds = (transcript: string, quote: string) => {
    const out = validateEvidence(base({
      transcript,
      class_a_proposals: [{ proposal_id: "a1", claim_type: "outcome", quote, source_span: span(transcript, quote) }],
      class_b_proposals: [{ proposal_id: "b1", relationship_type: "quantity_binding", marker_text: "", components: ["a1"] }],
    }));
    expect(out.rejected).toEqual([]);
    expect(out.validated_class_b.length).toBe(1);
  };

  const expectRejected = (transcript: string, quote: string) => {
    const out = validateEvidence(base({
      transcript,
      class_a_proposals: [{ proposal_id: "a1", claim_type: "outcome", quote, source_span: span(transcript, quote) }],
      class_b_proposals: [{ proposal_id: "b1", relationship_type: "quantity_binding", marker_text: "", components: ["a1"] }],
    }));
    expect(out.rejected.find((r) => r.proposal_id === "b1")?.reason_code).toBe("QUANTITY_BINDING_INVALID");
  };

  it('binds the real flagship case: .0005" to .0002"', () => {
    const transcript = 'I improved flatness from .0005" to .0002" consistently.';
    expectBinds(transcript, 'I improved flatness from .0005" to .0002" consistently');
  });

  it("binds 25.4 mm", () => {
    const transcript = "We reduced the gap to 25.4 mm across the run.";
    expectBinds(transcript, "We reduced the gap to 25.4 mm across the run");
  });

  it("binds 10 microns", () => {
    const transcript = "We held runout to within 10 microns all shift.";
    expectBinds(transcript, "We held runout to within 10 microns all shift");
  });

  it("binds 10 µm (micro sign, U+00B5)", () => {
    const transcript = "We held runout to within 10 µm all shift.";
    expectBinds(transcript, "We held runout to within 10 µm all shift");
  });

  it("binds 10 μm (Greek small mu, U+03BC)", () => {
    const transcript = "We held runout to within 10 μm all shift.";
    expectBinds(transcript, "We held runout to within 10 μm all shift");
  });

  it("binds five thou", () => {
    const transcript = "We closed the gap by five thou over the run.";
    expectBinds(transcript, "We closed the gap by five thou over the run");
  });

  it("binds 0.5 degrees", () => {
    const transcript = "We adjusted the fixture angle by 0.5 degrees.";
    expectBinds(transcript, "We adjusted the fixture angle by 0.5 degrees");
  });

  it("binds 90°", () => {
    const transcript = "We rotated the part 90° before the second pass.";
    expectBinds(transcript, "We rotated the part 90° before the second pass");
  });

  it("does NOT bind a bare quote mark unattached to any quantity", () => {
    const transcript = 'He said "go faster" but we still shipped 3 units late.';
    expectRejected(transcript, 'He said "go faster" but we still shipped 3 units late');
  });

  it('does NOT bind on bare "in" used as an ordinary preposition', () => {
    const transcript = "I reduced errors by 4 in the first pass.";
    expectRejected(transcript, "I reduced errors by 4 in the first pass");
  });

  it('does NOT bind "m" embedded inside another word (e.g. "maximum")', () => {
    const transcript = "We hit a maximum of 5 defects total.";
    expectRejected(transcript, "We hit a maximum of 5 defects total");
  });

  it('does NOT bind "um" embedded inside another word (e.g. "vacuum")', () => {
    const transcript = "The vacuum needed 5 attempts to seal properly.";
    expectRejected(transcript, "The vacuum needed 5 attempts to seal properly");
  });

  it('does NOT bind "degree" with no associated quantity at all', () => {
    const transcript = "I have a degree in mechanical engineering.";
    expectRejected(transcript, "I have a degree in mechanical engineering");
  });
});

describe("ENUMERATION_INVALID", () => {
  it("rejects an enumeration whose components don't share the same claim_type", () => {
    const transcript = "I fixed the mount. It held up fine.";
    const q1 = "I fixed the mount";
    const q2 = "It held up fine";
    const out = validateEvidence(base({
      transcript,
      class_a_proposals: [
        { proposal_id: "a1", claim_type: "action", quote: q1, source_span: span(transcript, q1) },
        { proposal_id: "a2", claim_type: "outcome", quote: q2, source_span: span(transcript, q2) },
      ],
      class_b_proposals: [{ proposal_id: "b1", relationship_type: "enumeration", marker_text: "", components: ["a1", "a2"] }],
    }));
    expect(out.rejected.find((r) => r.proposal_id === "b1")!.reason_code).toBe("ENUMERATION_INVALID");
  });

  it("rejects an enumeration with a different-type claim sitting between the components", () => {
    const transcript = "I checked the fixture. It was worn out. I replaced the pin.";
    const q1 = "I checked the fixture";
    const mid = "It was worn out";
    const q2 = "I replaced the pin";
    const out = validateEvidence(base({
      transcript,
      class_a_proposals: [
        { proposal_id: "a1", claim_type: "action", quote: q1, source_span: span(transcript, q1) },
        { proposal_id: "mid", claim_type: "self_reported_diagnosis", quote: mid, source_span: span(transcript, mid) },
        { proposal_id: "a2", claim_type: "action", quote: q2, source_span: span(transcript, q2) },
      ],
      class_b_proposals: [{ proposal_id: "b1", relationship_type: "enumeration", marker_text: "", components: ["a1", "a2"] }],
    }));
    expect(out.rejected.find((r) => r.proposal_id === "b1")!.reason_code).toBe("ENUMERATION_INVALID");
  });
});

describe("CLASS_C_MALFORMED", () => {
  it("rejects an empty hypothesis", () => {
    const out = validateEvidence(base({
      class_c_proposals: [{ proposal_id: "c1", hypothesis: "", supporting_claim_ids: ["x"], reasoning: "r", clarification_question: "q?" }],
    }));
    expect(out.rejected[0]!.reason_code).toBe("CLASS_C_MALFORMED");
  });

  it("rejects when no supporting_claim_ids are given", () => {
    const out = validateEvidence(base({
      class_c_proposals: [{ proposal_id: "c1", hypothesis: "h", supporting_claim_ids: [], reasoning: "r", clarification_question: "q?" }],
    }));
    expect(out.rejected[0]!.reason_code).toBe("CLASS_C_MALFORMED");
  });

  it("rejects when supporting_claim_ids reference nothing validated", () => {
    const out = validateEvidence(base({
      class_c_proposals: [{ proposal_id: "c1", hypothesis: "h", supporting_claim_ids: ["never_validated"], reasoning: "r", clarification_question: "q?" }],
    }));
    expect(out.rejected[0]!.reason_code).toBe("CLASS_C_MALFORMED");
  });
});
