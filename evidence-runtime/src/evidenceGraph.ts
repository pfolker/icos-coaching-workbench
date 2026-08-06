/**
 * Stage 4: the Validated Evidence Graph. Pure reshaping of
 * evidence-validator's ValidatorOutput into a graph view — no new
 * validation, no new judgment. Class A entries are the graph's nodes; Class
 * B entries are edges between those nodes; Class C entries are rendered
 * separately and are NEVER wired into the graph itself, since they are
 * permanently non-admissible (Specification Section 5) — this structural
 * separation is the point: an admissible node/edge and a non-admissible
 * hypothesis must never look interchangeable in the Debug UI.
 */
import { ValidatorOutput } from "../../evidence-validator/src/index";

export interface GraphNode {
  id: string;
  evidence_class: "A";
  claim_type: string;
  quote: string;
  speaker_assertion: boolean;
  admitted_by: string;
}

export interface GraphEdge {
  id: string;
  relationship_type: string;
  component_ids: string[];
  marker_text: string;
  ordering_basis?: string;
  admitted_by: string;
}

export interface GraphNonAdmissibleNode {
  id: string;
  evidence_class: "C";
  hypothesis: string;
  supporting_claim_ids: string[];
  reasoning: string;
  clarification_question: string;
  admissible: false;
  admitted_by: string;
}

export interface EvidenceGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  non_admissible: GraphNonAdmissibleNode[];
}

export function buildEvidenceGraph(output: ValidatorOutput): EvidenceGraph {
  const nodes: GraphNode[] = output.validated_class_a.map((c) => ({
    id: c.proposal_id,
    evidence_class: "A",
    claim_type: c.claim_type,
    quote: c.quote,
    speaker_assertion: c.speaker_assertion,
    admitted_by: c.admitted_by,
  }));

  const edges: GraphEdge[] = output.validated_class_b.map((b) => ({
    id: b.proposal_id,
    relationship_type: b.relationship_type,
    component_ids: b.components,
    marker_text: b.marker_text,
    ...(b.ordering_basis ? { ordering_basis: b.ordering_basis } : {}),
    admitted_by: b.admitted_by,
  }));

  const non_admissible: GraphNonAdmissibleNode[] = output.class_c_non_admissible.map((c) => ({
    id: c.proposal_id,
    evidence_class: "C",
    hypothesis: c.hypothesis,
    supporting_claim_ids: c.supporting_claim_ids,
    reasoning: c.reasoning,
    clarification_question: c.clarification_question,
    admissible: false,
    admitted_by: c.admitted_by,
  }));

  return { nodes, edges, non_admissible };
}
