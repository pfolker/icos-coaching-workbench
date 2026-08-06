/**
 * Class B validation — Specification v1.1, Section 4, "Validating Class B",
 * and Section 4's per-relationship-type mechanical definitions. Confirms
 * only that the transcript explicitly contains the relationship marker or
 * ordering; never asserts the stated relationship is true, sufficient, or
 * causal (Specification Section 2, Class B definition) — the v1.1 marker-
 * list and ordering-rule expansions (EP-003, EP-004) widen what counts as
 * marked, they do not loosen what marked means.
 */
import {
  ClassBProposal, OrderingBasis, RELATIONSHIP_TYPE_ENUM, RelationshipType, Rejected,
  ValidatedClassA, ValidatedClassB,
} from "./types";
import {
  CONTRAST_MARKERS, EXPLICIT_CONNECTIVES, NUMBER_TOKEN, TEMPORAL_CONNECTORS, TemporalConnector, UNIT_TOKEN,
} from "./lexicons";

export type ClassBResult =
  | { outcome: "validated"; claim: ValidatedClassB }
  | { outcome: "rejected"; rejection: Rejected };

const wordBoundaryIncludes = (haystack: string, phrase: string): boolean => {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(haystack);
};

/**
 * EP-004: does one of the fixed subordinating temporal connectors
 * immediately introduce this component's clause (e.g. "once we went back
 * to the old sealant")? Only checks immediately-preceding position — the
 * mechanical pattern the fixed connector list is defined over.
 */
function precedingConnector(transcript: string, comp: ValidatedClassA): TemporalConnector | null {
  const windowStart = Math.max(0, comp.source_span.start - 12);
  const before = transcript.slice(windowStart, comp.source_span.start);
  for (const connector of TEMPORAL_CONNECTORS) {
    if (new RegExp(`\\b${connector}\\s+$`, "i").test(before)) return connector;
  }
  return null;
}

export function validateClassBProposal(
  proposal: ClassBProposal,
  transcript: string,
  validatedClassA: ValidatedClassA[],
): ClassBResult {
  const byId = new Map(validatedClassA.map((c) => [c.proposal_id, c]));
  const reject = (reason_code: Rejected["reason_code"], explanation: string): ClassBResult =>
    ({ outcome: "rejected", rejection: { proposal_id: proposal.proposal_id, reason_code, explanation } });

  // ---- relationship_type in the closed enum ----
  const typeLower = proposal.relationship_type.trim().toLowerCase();
  if (!(RELATIONSHIP_TYPE_ENUM as readonly string[]).includes(typeLower)) {
    return reject("RELATIONSHIP_TYPE_UNKNOWN",
      `relationship_type "${proposal.relationship_type}" is not one of the five v1 values.`);
  }
  const relationshipType = typeLower as RelationshipType;

  // ---- rule 1: every component already validated as Class A ----
  const components: ValidatedClassA[] = [];
  for (const id of proposal.components) {
    const c = byId.get(id);
    if (!c) {
      return reject("COMPONENT_NOT_VALIDATED",
        `component "${id}" does not reference an already-validated Class A claim.`);
    }
    components.push(c);
  }

  let orderingBasis: OrderingBasis | undefined;
  let admittedBy = "";

  switch (relationshipType) {
    case "temporal_sequence": {
      if (components.length < 2) {
        return reject("ORDER_INVALID", "temporal_sequence requires at least two components to order.");
      }
      const rawOrdered = components.every((c, i) => i === 0 || components[i - 1]!.source_span.start < c.source_span.start);
      if (rawOrdered) {
        orderingBasis = "raw_position";
        admittedBy = "temporal_sequence via ordering_basis=raw_position: all components strictly increasing by source_span.start";
        break;
      }
      // EP-004: raw position failed. A fixed subordinating connector
      // (once/after/before) attached to one of exactly two components can
      // still justify the proposed order, overriding raw position.
      if (components.length !== 2) {
        return reject("ORDER_INVALID",
          "components are not in increasing transcript position, and connector-governed ordering " +
          "(Specification v1.1 EP-004) is only defined for exactly two components.");
      }
      const [c0, c1] = components as [ValidatedClassA, ValidatedClassA];
      const connectorOnC0 = precedingConnector(transcript, c0);
      const connectorOnC1 = precedingConnector(transcript, c1);
      const attached = connectorOnC0
        ? { subordinate: c0, main: c1, connector: connectorOnC0 }
        : connectorOnC1
        ? { subordinate: c1, main: c0, connector: connectorOnC1 }
        : null;
      if (!attached) {
        return reject("ORDER_INVALID",
          "components are not in increasing transcript position, and no fixed subordinating connector " +
          "(once/after/before) is attached to either component to justify a different order.");
      }
      const { subordinate, main, connector } = attached;
      // once/after: subordinate's event precedes main's event. before: reversed.
      const [logicalFirst, logicalSecond] = connector === "before" ? [main, subordinate] : [subordinate, main];
      if (c0.proposal_id !== logicalFirst.proposal_id || c1.proposal_id !== logicalSecond.proposal_id) {
        return reject("ORDER_INVALID",
          `the "${connector}" connector fixes the logical order as ["${logicalFirst.quote}", "${logicalSecond.quote}"], ` +
          `which does not match the proposed component order.`);
      }
      orderingBasis = `connector:${connector}`;
      admittedBy = `temporal_sequence via ordering_basis=connector:${connector}: connector "${connector}" attached to ` +
        `"${subordinate.quote}" fixes logical order ["${logicalFirst.quote}", "${logicalSecond.quote}"], matching the proposed component order`;
      break;
    }

    case "explicit_connective":
    case "contrast_marker": {
      const fixedList = relationshipType === "explicit_connective" ? EXPLICIT_CONNECTIVES : CONTRAST_MARKERS;
      const markerLower = proposal.marker_text.trim().toLowerCase();
      if (!(fixedList as readonly string[]).includes(markerLower)) {
        return reject("MARKER_NOT_FOUND",
          `marker_text "${proposal.marker_text}" is not one of the fixed ${relationshipType} phrases.`);
      }
      if (components.length === 1) {
        // self-contained: the connective and both linked ideas sit inside one Class A claim
        // (Atlas Case 001, B4: A11's own quote contains "because" internally).
        if (!wordBoundaryIncludes(components[0]!.quote, markerLower)) {
          return reject("MARKER_NOT_FOUND",
            `"${markerLower}" does not appear inside the single referenced component's own quote.`);
        }
        admittedBy = `${relationshipType} self-contained: marker "${markerLower}" found within component ` +
          `"${components[0]!.proposal_id}"'s own quote`;
      } else if (components.length === 2) {
        const [c1, c2] = components[0]!.source_span.start <= components[1]!.source_span.start
          ? [components[0]!, components[1]!] : [components[1]!, components[0]!];
        const gap = transcript.slice(c1.source_span.end, c2.source_span.start);
        if (!wordBoundaryIncludes(gap, markerLower)) {
          return reject("MARKER_NOT_FOUND",
            `"${markerLower}" does not appear in the transcript between the two referenced components.`);
        }
        admittedBy = `${relationshipType} bridging: marker "${markerLower}" found in the transcript gap between ` +
          `"${c1.proposal_id}" and "${c2.proposal_id}"`;
      } else {
        return reject("MARKER_NOT_FOUND",
          `${relationshipType} requires exactly one (self-contained) or two (bridging) components; got ${components.length}.`);
      }
      break;
    }

    case "quantity_binding": {
      if (components.length === 0) {
        return reject("QUANTITY_BINDING_INVALID", "quantity_binding requires at least one component.");
      }
      for (const c of components) {
        if (!NUMBER_TOKEN.test(c.quote) || !UNIT_TOKEN.test(c.quote)) {
          return reject("QUANTITY_BINDING_INVALID",
            `component "${c.quote}" does not contain both a number and a unit word in the same clause.`);
        }
      }
      admittedBy = `quantity_binding: NUMBER_TOKEN and UNIT_TOKEN both matched within each of ${components.length} component quote(s)`;
      break;
    }

    case "enumeration": {
      if (components.length < 2) {
        return reject("ENUMERATION_INVALID", "enumeration requires at least two components.");
      }
      const sharedType = components[0]!.claim_type;
      if (!components.every((c) => c.claim_type === sharedType)) {
        return reject("ENUMERATION_INVALID",
          "components do not all share the same claim_type — enumeration requires a run of same-type claims.");
      }
      const sorted = [...components].sort((a, b) => a.source_span.start - b.source_span.start);
      const rangeStart = sorted[0]!.source_span.start;
      const rangeEnd = sorted[sorted.length - 1]!.source_span.end;
      const componentIds = new Set(components.map((c) => c.proposal_id));
      const intervening = validatedClassA.find((other) =>
        !componentIds.has(other.proposal_id) &&
        other.claim_type !== sharedType &&
        other.source_span.start > rangeStart && other.source_span.start < rangeEnd
      );
      if (intervening) {
        return reject("ENUMERATION_INVALID",
          `a different-type claim ("${intervening.claim_type}": "${intervening.quote}") sits between the enumerated components.`);
      }
      admittedBy = `enumeration: ${components.length} same-claim_type ("${sharedType}") components with no intervening different-type claim in range`;
      break;
    }
  }

  return {
    outcome: "validated",
    claim: {
      evidence_class: "B",
      proposal_id: proposal.proposal_id,
      relationship_type: relationshipType,
      components: proposal.components,
      marker_text: proposal.marker_text,
      ...(orderingBasis ? { ordering_basis: orderingBasis } : {}),
      admitted_by: admittedBy,
    },
  };
}
