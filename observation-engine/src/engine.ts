/**
 * Observation Engine — assembly.
 * observe(input) is deterministic: same input → deep-equal output.
 */
import { createHash } from "node:crypto";
import {
  DEFAULT_WPM, ENGINE_VERSION,
  Observation, ObservationInput, ObservationMetrics, ObservationSet,
} from "./types";
import { segment } from "./segment";
import * as OBS from "./observers";

function countOf(observations: Observation[], type: Observation["observation_type"]): number {
  const o = observations.find((x) => x.observation_type === type);
  return o ? (typeof o.value === "number" ? o.value : o.evidence.length) : 0;
}

export function observe(input: ObservationInput): ObservationSet {
  if (!input || typeof input.transcript !== "string" || input.transcript.trim().length === 0) {
    throw Object.assign(new Error("transcript must be a non-empty string"), {
      code: "INPUT_INVALID", module: "observation-engine", retryable: false,
    });
  }
  if (input.duration_seconds !== undefined &&
      (!Number.isFinite(input.duration_seconds) || input.duration_seconds <= 0)) {
    throw Object.assign(new Error("duration_seconds must be a positive number when provided"), {
      code: "INPUT_INVALID", module: "observation-engine", retryable: false,
    });
  }

  const transcript = input.transcript;
  const sentences = segment(transcript);

  const observations: Observation[] = [
    ...OBS.observeFillers(transcript, sentences),
    ...OBS.observeHedges(transcript, sentences),
    ...OBS.observePronouns(transcript, sentences),
    ...OBS.observeQuantification(transcript, sentences),
    ...OBS.observeHypotheticals(transcript, sentences),
    ...OBS.observeNegativity(transcript, sentences),
    ...OBS.observeStructure(transcript, sentences),
  ];

  const word_count = sentences.reduce((n, s) => n + s.word_count, 0);
  const duration_is_estimated = input.duration_seconds === undefined;
  const duration_seconds = duration_is_estimated
    ? (word_count / DEFAULT_WPM) * 60
    : input.duration_seconds!;
  const minutes = Math.max(duration_seconds / 60, 1e-9);

  const filler_core_count = countOf(observations, "filler_core");
  const filler_soft_count = countOf(observations, "filler_soft");

  const metrics: ObservationMetrics = {
    word_count,
    sentence_count: sentences.length,
    duration_seconds: Math.round(duration_seconds * 10) / 10,
    duration_is_estimated,
    filler_core_count,
    filler_soft_count,
    filler_per_minute: Math.round((filler_core_count / minutes) * 10) / 10,
    hedge_marker_count: countOf(observations, "hedge_marker"),
    i_count: countOf(observations, "first_person_singular"),
    we_count: countOf(observations, "first_person_plural"),
    agency_verb_i_count: countOf(observations, "agency_verb_i"),
    presence_verb_i_count: countOf(observations, "presence_verb_i"),
    quantified_span_count: countOf(observations, "quantified_span"),
    numeric_span_count: countOf(observations, "numeric_span"),
    hypothetical_marker_count: countOf(observations, "hypothetical_marker"),
  };

  return {
    schema_version: "1.0",
    producer: { module: "observation-engine", version: ENGINE_VERSION },
    transcript_sha256: createHash("sha256").update(transcript).digest("hex"),
    sentences,
    observations,
    metrics,
  };
}
